import { Workflow, createSignal, createTrade, updateWorkflowLastRun } from '../lib/firestore';
import { bitmexService } from '../services/bitmex';
import { whaleService } from '../services/whale';
import { sentimentService } from '../services/sentiment';
import { marketIntelligenceService as newsService } from '../services/news';
import { analyzer, MarketData, PortfolioAnalyzerInput } from './analyzer';

// Calculate trade quantity from allocation percentage
function calculateQuantityFromAllocation(
  availableBalanceUSDT: number,
  allocationPercent: number
): number {
  const usdAmount = (availableBalanceUSDT * allocationPercent) / 100;
  // BitMEX minimums and contract rounding (rounding to nearest 100 for safety)
  const roundedAmount = Math.round(usdAmount / 100) * 100;
  return Math.max(100, roundedAmount);
}

/**
 * Execute workflow with AI-driven dynamic portfolio allocation.
 * Fixed: Handles weighted intelligence and missing trade properties.
 */
export async function executeWorkflow(workflow: Workflow): Promise<void> {
  const workflowId = workflow.id!;
  const { config } = workflow;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 DEPLOYING WORKFLOW: ${workflow.name}`);
  console.log(`📋 Strategy: ${config.strategy.toUpperCase()} | Model: ${config.model}`);
  console.log(`💰 Targets: ${config.equities.join(', ')}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // 1. GET ACCOUNT BALANCE
    console.log('\n💰 Checking the war chest...');
    const balanceInfo = await bitmexService.getBalanceInUSDT();

    if (balanceInfo.availableMarginUSDT <= 0) {
      console.error('❌ Zero margin available. Aborting mission.');
      await updateWorkflowLastRun(workflowId);
      return;
    }

    console.log(`   Available Margin: $${balanceInfo.availableMarginUSDT.toFixed(2)} USDT`);

    // 2. COLLECT MARKET DATA (Weighted Intelligence)
    console.log('\n📊 Gathering Intel...');
    const marketData: MarketData = { prices: {} };

    // Prices are the baseline
    marketData.prices = await bitmexService.getPrices(config.equities);

    if (config.dataSources.whale?.enabled) {
      const weight = config.dataSources.whale.weight || 1.0;
      console.log(`   → Tracking Whales (Weight: ${weight})...`);
      const minAmount = parseInt(config.dataSources.whale.minAmount) || 1000000;
      marketData.whale = await whaleService.getWhaleActivity(minAmount, weight);
    }

    if (config.dataSources.sentiment?.enabled) {
      const weight = config.dataSources.sentiment.weight || 1.0;
      console.log(`   → Analyzing Sentiment (Weight: ${weight})...`);
      marketData.sentiment = await sentimentService.analyzeSentiment(config.equities, weight);
    }

    if (config.dataSources.news?.enabled) {
      const weight = config.dataSources.news.weight || 1.0;
      console.log(`   → Scanning News (Weight: ${weight})...`);
      marketData.news = await newsService.getNews(config.dataSources.news.filter, weight);
    }

    // 3. AI PORTFOLIO ALLOCATION
    console.log('\n🤖 Calculating allocation matrix...');
    const portfolioInput: PortfolioAnalyzerInput = {
      marketData,
      model: config.model,
      strategy: config.strategy,
      equities: config.equities,
      availableBalanceUSDT: balanceInfo.availableMarginUSDT,
      totalBalanceUSDT: balanceInfo.balanceUSDT,
    };

    const allocation = await analyzer.analyzePortfolioAllocation(portfolioInput);

    // 4. SAVE PORTFOLIO SIGNAL
    console.log('\n💾 Logging master signal...');
    await createSignal({
      workflowId,
      signal: allocation.allocations.length > 0 ? 'PORTFOLIO' : 'HOLD',
      symbol: 'PORTFOLIO',
      confidence: allocation.allocations.length > 0
        ? allocation.allocations.reduce((sum, a) => sum + a.confidence, 0) / allocation.allocations.length
        : 0,
      reasoning: `Outlook: ${allocation.marketOutlook} | Risk: ${allocation.riskAssessment} | Total Alloc: ${allocation.totalAllocationPercent}%`,
      marketData: {
        prices: Object.entries(marketData.prices).map(([symbol, data]) => ({
          symbol,
          price: data.price,
          change24h: data.change24h,
        })),
        sentiment: marketData.sentiment ? { 
            score: marketData.sentiment.score, 
            trend: marketData.sentiment.trend,
            weight: marketData.sentiment.weight 
        } : null,
        whale: marketData.whale ? { 
            netFlow: marketData.whale.netFlow, 
            sentiment: marketData.whale.sentiment,
            weight: marketData.whale.weight
        } : null,
        hasBreakingNews: marketData.news?.hasBreaking || false,
      },
      tradeId: null,
    });

    // 5. EXECUTE TRADES
    if (allocation.allocations.length === 0) {
      console.log('\n⏸️ AI recommends standing down. No action taken.');
      await updateWorkflowLastRun(workflowId);
      return;
    }

    const confidenceThreshold = config.strategy === 'aggressive' ? 0.45 : config.strategy === 'balanced' ? 0.6 : 0.75;

    for (const alloc of allocation.allocations) {
      if (alloc.signal === 'HOLD' || alloc.allocationPercent <= 0) continue;

      if (alloc.confidence < confidenceThreshold) {
        console.log(`   ⏭️ Skipping ${alloc.symbol}: Confidence ${(alloc.confidence * 100).toFixed(0)}% too low.`);
        continue;
      }

      const quantity = calculateQuantityFromAllocation(balanceInfo.availableMarginUSDT, alloc.allocationPercent);
      if (quantity < 100) {
        console.log(`   ⏭️ Skipping ${alloc.symbol}: Size $${quantity} below minimum.`);
        continue;
      }

      console.log(`\n💹 EXECUTING: ${alloc.signal} ${alloc.symbol}`);
      console.log(`   Alloc: ${alloc.allocationPercent}% ($${quantity}) | Leverage: ${alloc.leverage}x`);
      
      // Set Leverage
      await bitmexService.setLeverage(alloc.symbol, alloc.leverage);

      // Execute Trade
      const tradeResult = await bitmexService.executeTrade({
        symbol: alloc.symbol,
        side: alloc.signal as 'LONG' | 'SHORT',
        quantity,
      });

      let tpSlResult: any = {};
      if (tradeResult.success && tradeResult.filledPrice) {
        const positions = await bitmexService.getPositions();
        const pos = positions.find((p: any) => p.symbol === alloc.symbol);

        if (pos && pos.size !== 0) {
          tpSlResult = await bitmexService.setTakeProfitStopLoss({
            symbol: alloc.symbol,
            side: pos.size > 0 ? 'LONG' : 'SHORT',
            entryPrice: pos.entryPrice || tradeResult.filledPrice,
            quantity: Math.abs(pos.size),
            takeProfitPercent: alloc.takeProfit,
            stopLossPercent: alloc.stopLoss,
          });
        }
      }

      // Record the trade (Filling in the "missing" fields with nulls to satisfy TS)
      await createTrade({
        workflowId,
        symbol: alloc.symbol,
        side: alloc.signal as 'LONG' | 'SHORT',
        type: 'MARKET',
        quantity,
        orderId: tradeResult.orderId || null,
        status: tradeResult.success ? 'filled' : 'failed',
        filledPrice: tradeResult.filledPrice || null,
        filledQuantity: tradeResult.filledQuantity || null,
        commission: null, // Initialize empty
        aiSignal: alloc.signal,
        aiConfidence: alloc.confidence,
        aiReasoning: alloc.reasoning,
        leverage: alloc.leverage,
        takeProfit: alloc.takeProfit,
        stopLoss: alloc.stopLoss,
        tpOrderId: tpSlResult.tpOrderId || null,
        slOrderId: tpSlResult.slOrderId || null,
        positionStatus: tradeResult.success ? 'open' : 'closed',
        closedAt: null,   // Initialize empty
        closePrice: null, // Initialize empty
        pnl: null         // Initialize empty
      });

      if (tradeResult.success) {
        console.log(`   ✅ Trade hit: Filled @ $${tradeResult.filledPrice}`);
      } else {
        console.log(`   ❌ Trade whiffed: ${tradeResult.error}`);
      }
    }

    await updateWorkflowLastRun(workflowId);
    console.log('\n✅ Workflow cycle complete.');

  } catch (error: any) {
    console.error(`\n💥 CRITICAL ERR: ${error.message}`);
    throw error;
  }
}

export const executor = { executeWorkflow };