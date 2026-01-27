import { Workflow, createSignal, createTrade, updateWorkflowLastRun } from '../lib/firestore';
import { bitmexService } from '../services/bitmex';
import { whaleService } from '../services/whale';
import { sentimentService } from '../services/sentiment';
import { newsService } from '../services/news';
import { analyzer, MarketData } from './analyzer';

// Calculate trade quantity based on strategy
// BitMEX uses USD-based contract sizes (orderQty must be multiple of lot size, typically 100)
function calculateQuantity(
  symbol: string,
  strategy: 'conservative' | 'balanced' | 'aggressive'
): number {
  // Base quantities in USD (must be multiples of 100 for BitMEX)
  const baseAmounts: Record<string, Record<string, number>> = {
    conservative: { BTCUSDT: 100, ETHUSDT: 100, SOLUSDT: 100, BNBUSDT: 100, XRPUSDT: 100 },
    balanced: { BTCUSDT: 200, ETHUSDT: 200, SOLUSDT: 200, BNBUSDT: 200, XRPUSDT: 200 },
    aggressive: { BTCUSDT: 500, ETHUSDT: 500, SOLUSDT: 500, BNBUSDT: 500, XRPUSDT: 500 },
  };

  return baseAmounts[strategy][symbol] || 100;
}

// Execute a single workflow
export async function executeWorkflow(workflow: Workflow): Promise<void> {
  const workflowId = workflow.id!;
  const { config } = workflow;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Executing workflow: ${workflow.name}`);
  console.log(`📋 Strategy: ${config.strategy} | Model: ${config.model}`);
  console.log(`💰 Equities: ${config.equities.join(', ')}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // 1. COLLECT MARKET DATA
    console.log('\n📊 Collecting market data...');
    const marketData: MarketData = {
      prices: {},
    };

    // Get prices for all equities
    console.log('  → Fetching prices...');
    marketData.prices = await bitmexService.getPrices(config.equities);

    // Get whale data if enabled
    if (config.dataSources.whale.enabled) {
      console.log('  → Fetching whale activity...');
      const minAmount = parseInt(config.dataSources.whale.minAmount) || 1000000;
      marketData.whale = await whaleService.getWhaleActivity(minAmount);
    }

    // Get sentiment data if enabled
    if (config.dataSources.sentiment.enabled) {
      console.log('  → Analyzing sentiment...');
      marketData.sentiment = await sentimentService.analyzeSentiment(config.equities);
    }

    // Get news data if enabled
    if (config.dataSources.news.enabled) {
      console.log('  → Fetching news...');
      marketData.news = await newsService.getNews(config.dataSources.news.filter);
    }

    // 2. AI ANALYSIS
    console.log('\n🤖 Running AI analysis...');
    const aiResult = await analyzer.analyze({
      marketData,
      model: config.model,
      strategy: config.strategy,
      equities: config.equities,
    });

    // 3. SAVE SIGNAL
    console.log('\n💾 Saving signal...');
    const signalId = await createSignal({
      workflowId,
      signal: aiResult.signal,
      symbol: aiResult.symbol,
      confidence: aiResult.confidence,
      reasoning: aiResult.reasoning,
      marketData: {
        prices: Object.entries(marketData.prices).map(([symbol, data]) => ({
          symbol,
          price: data.price,
          change24h: data.change24h,
        })),
        sentiment: marketData.sentiment
          ? {
              score: marketData.sentiment.score,
              trend: marketData.sentiment.trend,
            }
          : null,
        whale: marketData.whale
          ? {
              netFlow: marketData.whale.netFlow,
              sentiment: marketData.whale.sentiment,
            }
          : null,
        hasBreakingNews: marketData.news?.hasBreaking || false,
      },
      tradeId: null,
    });

    console.log(`  ✅ Signal saved: ${signalId}`);

    // 4. EXECUTE TRADE (if not HOLD and confidence threshold met)
    const confidenceThreshold = config.strategy === 'aggressive' ? 0.5 : config.strategy === 'balanced' ? 0.6 : 0.7;

    if (aiResult.signal !== 'HOLD' && aiResult.confidence >= confidenceThreshold) {
      console.log('\n💹 Opening futures position...');
      console.log(`  → ${aiResult.signal} ${aiResult.symbol}`);
      console.log(`  → Leverage: ${aiResult.leverage}x | TP: +${aiResult.takeProfit}% | SL: -${aiResult.stopLoss}%`);

      const quantity = calculateQuantity(aiResult.symbol, config.strategy);

      // Set leverage before executing trade
      console.log(`  → Setting leverage to ${aiResult.leverage}x...`);
      const leverageSet = await bitmexService.setLeverage(aiResult.symbol, aiResult.leverage);
      if (!leverageSet) {
        console.log(`  ⚠️  Could not set leverage, using default`);
      }

      const tradeResult = await bitmexService.executeTrade({
        symbol: aiResult.symbol,
        side: aiResult.signal,
        quantity,
      });

      // Set TP/SL orders if trade was successful
      let tpSlResult: { tpOrderId?: string; slOrderId?: string; error?: string } = {};
      if (tradeResult.success && tradeResult.filledPrice) {
        tpSlResult = await bitmexService.setTakeProfitStopLoss({
          symbol: aiResult.symbol,
          side: aiResult.signal,
          entryPrice: tradeResult.filledPrice,
          quantity: tradeResult.filledQuantity || quantity,
          takeProfitPercent: aiResult.takeProfit,
          stopLossPercent: aiResult.stopLoss,
        });
      }

      // Save trade record with TP/SL fields
      const tradeId = await createTrade({
        workflowId,
        symbol: aiResult.symbol,
        side: aiResult.signal,
        type: 'MARKET',
        quantity,
        orderId: tradeResult.orderId || null,
        status: tradeResult.success ? 'filled' : 'failed',
        filledPrice: tradeResult.filledPrice || null,
        filledQuantity: tradeResult.filledQuantity || null,
        commission: tradeResult.commission || null,
        aiSignal: aiResult.signal,
        aiConfidence: aiResult.confidence,
        aiReasoning: aiResult.reasoning,
        leverage: aiResult.leverage,
        takeProfit: aiResult.takeProfit,
        stopLoss: aiResult.stopLoss,
        tpOrderId: tpSlResult.tpOrderId || null,
        slOrderId: tpSlResult.slOrderId || null,
        positionStatus: tradeResult.success ? 'open' : 'closed',
        closedAt: null,
        closePrice: null,
        pnl: null,
      });

      if (tradeResult.success) {
        console.log(`  ✅ Trade executed: ${tradeId}`);
        console.log(`  📈 Filled at $${tradeResult.filledPrice}`);
        if (tpSlResult.tpOrderId && tpSlResult.slOrderId) {
          console.log(`  🎯 TP/SL orders placed successfully`);
        } else if (tpSlResult.error) {
          console.log(`  ⚠️ TP/SL order failed: ${tpSlResult.error}`);
        }
      } else {
        console.log(`  ❌ Trade failed: ${tradeResult.error}`);
      }
    } else {
      console.log('\n⏸️  No trade executed');
      console.log(`  → Signal: ${aiResult.signal}`);
      console.log(`  → Confidence: ${(aiResult.confidence * 100).toFixed(0)}% (threshold: ${(confidenceThreshold * 100).toFixed(0)}%)`);
    }

    // 5. UPDATE WORKFLOW
    await updateWorkflowLastRun(workflowId);
    console.log('\n✅ Workflow execution completed');

  } catch (error: any) {
    console.error(`\n❌ Workflow execution failed: ${error.message}`);
    throw error;
  }
}

export const executor = {
  executeWorkflow,
};