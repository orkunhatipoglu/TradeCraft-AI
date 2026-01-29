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
  console.log(`🚀 Executing workflow: ${workflow.name}`);
  console.log(`📋 Strategy: ${config.strategy} | Model: ${config.model}`);
  console.log(`💰 Assets: ${config.equities.join(', ')}`);
  console.log(`🤖 Mode: AI Dynamic Allocation`);
  console.log(`${'='.repeat(60)}`);

  try {
    // 1. GET ACCOUNT BALANCE
    console.log('\n💰 Fetching account balance...');
    const balanceInfo = await bitmexService.getBalanceInUSDT();

    if (balanceInfo.availableMarginUSDT <= 0) {
      console.log('❌ No available balance. Skipping execution.');
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
    console.log('\n💾 Saving portfolio allocation signal...');
    const signalId = await createSignal({
      workflowId,
      signal: allocation.allocations.length > 0 ? 'PORTFOLIO' : 'HOLD',
      symbol: 'PORTFOLIO',
      confidence: allocation.allocations.length > 0
        ? allocation.allocations.reduce((sum, a) => sum + a.confidence, 0) / allocation.allocations.length
        : 0,
      reasoning: `Market: ${allocation.marketOutlook} | Risk: ${allocation.riskAssessment} | Total Allocation: ${allocation.totalAllocationPercent}%`,
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
    console.log(`  ✅ Signal saved: ${signalId}`);

    // 5. EXECUTE TRADES FOR EACH ALLOCATION
    if (allocation.allocations.length === 0) {
      console.log('\n⏸️  No allocations - keeping 100% in reserve');
      await updateWorkflowLastRun(workflowId);
      return;
    }

    const confidenceThreshold = config.strategy === 'aggressive' ? 0.5 : config.strategy === 'balanced' ? 0.6 : 0.7;

    console.log(`\n💹 Executing ${allocation.allocations.length} allocation(s)...`);

    for (const alloc of allocation.allocations) {
      if (alloc.signal === 'HOLD' || alloc.allocationPercent <= 0) {
        console.log(`  ⏭️  Skipping ${alloc.symbol}: ${alloc.signal} with ${alloc.allocationPercent}% allocation`);
        continue;
      }

      if (alloc.confidence < confidenceThreshold) {
        console.log(`  ⏭️  Skipping ${alloc.symbol}: confidence ${(alloc.confidence * 100).toFixed(0)}% below threshold ${(confidenceThreshold * 100).toFixed(0)}%`);
        continue;
      }

      const quantity = calculateQuantityFromAllocation(balanceInfo.availableMarginUSDT, alloc.allocationPercent);

      if (quantity < 100) {
        console.log(`  ⏭️  Skipping ${alloc.symbol}: quantity $${quantity} below minimum $100`);
        continue;
      }

      console.log(`\n  📈 Opening ${alloc.signal} position on ${alloc.symbol}...`);
      console.log(`     Allocation: ${alloc.allocationPercent}% ($${quantity})`);
      console.log(`     Leverage: ${alloc.leverage}x | TP: +${alloc.takeProfit}% | SL: -${alloc.stopLoss}%`);
      console.log(`     Confidence: ${(alloc.confidence * 100).toFixed(0)}%`);
      console.log(`     Reasoning: ${alloc.reasoning}`);

      console.log(`     → Setting leverage to ${alloc.leverage}x...`);
      const leverageSet = await bitmexService.setLeverage(alloc.symbol, alloc.leverage);
      if (!leverageSet) {
        console.log(`     ⚠️  Could not set leverage, using default`);
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

      let tpSlResult: { tpOrderId?: string; slOrderId?: string; error?: string } = {};
      if (tradeResult.success && tradeResult.filledPrice) {
        // Get actual position from BitMEX to determine real side and quantity
        const positions = await bitmexService.getPositions();
        const currentPosition = positions.find((p: any) => p.symbol === alloc.symbol);

        if (currentPosition && currentPosition.size !== 0) {
          const actualSide: 'LONG' | 'SHORT' = currentPosition.size > 0 ? 'LONG' : 'SHORT';
          const actualQty = Math.abs(currentPosition.size);

          console.log(`     📍 Actual position: ${actualSide} ${actualQty} @ $${currentPosition.entryPrice}`);

          tpSlResult = await bitmexService.setTakeProfitStopLoss({
            symbol: alloc.symbol,
            side: actualSide,
            entryPrice: currentPosition.entryPrice || tradeResult.filledPrice,
            quantity: actualQty,
            takeProfitPercent: alloc.takeProfit,
            stopLossPercent: alloc.stopLoss,
          });
        } else {
          console.log(`     ⚠️ No open position found after trade, skipping TP/SL`);
        }
      }

      const tradeId = await createTrade({
        workflowId,
        symbol: alloc.symbol,
        side: alloc.signal,
        type: 'MARKET',
        quantity,
        orderId: tradeResult.orderId || null,
        status: tradeResult.success ? 'filled' : 'failed',
        filledPrice: tradeResult.filledPrice || null,
        filledQuantity: tradeResult.filledQuantity || null,
        commission: tradeResult.commission || null,
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
        console.log(`     ✅ Trade executed: ${tradeId}`);
        console.log(`     📈 Filled at $${tradeResult.filledPrice}`);
        if (tpSlResult.tpOrderId && tpSlResult.slOrderId) {
          console.log(`     🎯 TP/SL orders placed successfully`);
        } else if (tpSlResult.error) {
          console.log(`     ⚠️ TP/SL order failed: ${tpSlResult.error}`);
        }
      } else {
        console.log(`     ❌ Trade failed: ${tradeResult.error}`);
      }
    }

    // 6. UPDATE WORKFLOW
    await updateWorkflowLastRun(workflowId);
    console.log('\n✅ Workflow cycle complete.');

  } catch (error: any) {
    console.error(`\n💥 CRITICAL ERR: ${error.message}`);
    throw error;
  }
}

export const executor = {
  executeWorkflow,
};
