import { Router } from 'express';
import { getTrades, getSignals, getWorkflows } from '../lib/firestore';
import { bitmexService } from '../services/bitmex';
import { Timestamp } from 'firebase-admin/firestore';

const router = Router();

function serializeTimestamp(value: any): string | null {
  if (!value) return null;
  if (value instanceof Timestamp || (value._seconds !== undefined)) {
    return new Date(value._seconds * 1000).toISOString();
  }
  return value;
}

// GET /api/trades - List trades
router.get('/', async (req, res) => {
  try {
    const { workflowId } = req.query;
    const [trades, workflows] = await Promise.all([
      getTrades(workflowId as string | undefined),
      getWorkflows(),
    ]);

    const workflowMap = new Map(workflows.map(w => [w.id, w]));

    const enrichedTrades = trades.map(trade => ({
      ...trade,
      createdAt: serializeTimestamp(trade.createdAt),
      closedAt: serializeTimestamp(trade.closedAt),
      workflow: workflowMap.has(trade.workflowId)
        ? { name: workflowMap.get(trade.workflowId)!.name }
        : null,
    }));

    res.json(enrichedTrades);
  } catch (error: any) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/trades/stats/summary - Simple stats for dashboard cards
router.get('/stats/summary', async (req, res) => {
  try {
    const { workflowId } = req.query;
    const trades = await getTrades(workflowId as string | undefined);

    const filled = trades.filter(t => t.status === 'filled').length;
    const pending = trades.filter(t => t.status === 'pending').length;
    const total = trades.length;
    const successRate = total > 0 ? (filled / total) * 100 : 0;

    res.json({ total, filled, pending, successRate });
  } catch (error: any) {
    console.error('Error fetching trade stats summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/trades/stats - Trade statistics WITH weight influence
router.get('/stats', async (req, res) => {
  try {
    const trades = await getTrades();
    const signals = await getSignals();

    // Map trades to their signals to get weight info
    const tradesWithWeights = trades.map(trade => {
      const signal = signals.find(s => s.tradeId === trade.id);
      return { trade, signal };
    });

    const filledTrades = trades.filter((t) => t.status === 'filled');
    const closedTrades = filledTrades.filter((t) => t.positionStatus === 'closed');

    // Calculate PnL stats
    const pnlStats = closedTrades.length > 0 ? {
      totalPnL: closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
      avgPnL: closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / closedTrades.length,
      winningTrades: closedTrades.filter((t) => (t.pnl || 0) > 0).length,
      losingTrades: closedTrades.filter((t) => (t.pnl || 0) < 0).length,
      winRate: ((closedTrades.filter((t) => (t.pnl || 0) > 0).length / closedTrades.length) * 100).toFixed(2) + '%',
    } : {
      totalPnL: 0,
      avgPnL: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 'N/A',
    };

    // Weight influence analysis
    const tradesWithSignalWeights = tradesWithWeights.filter(t => t.signal?.dataSourceWeights);
    
    const weightInfluenceStats = tradesWithSignalWeights.length > 0 ? {
      tradesAnalyzed: tradesWithSignalWeights.length,
      performanceByWeightPriority: {
        highPriority: {
          count: tradesWithSignalWeights.filter(t => {
            const weights = Object.values(t.signal?.dataSourceWeights || {});
            return weights.some(w => w && w > 65);
          }).length,
          avgConfidence: tradesWithSignalWeights
            .filter(t => {
              const weights = Object.values(t.signal?.dataSourceWeights || {});
              return weights.some(w => w && w > 65);
            })
            .reduce((sum, t) => sum + t.trade.aiConfidence, 0) /
            tradesWithSignalWeights.filter(t => {
              const weights = Object.values(t.signal?.dataSourceWeights || {});
              return weights.some(w => w && w > 65);
            }).length || 0,
          avgPnL: tradesWithSignalWeights
            .filter(t => {
              const weights = Object.values(t.signal?.dataSourceWeights || {});
              return weights.some(w => w && w > 65);
            })
            .reduce((sum, t) => sum + (t.trade.pnl || 0), 0) /
            tradesWithSignalWeights.filter(t => {
              const weights = Object.values(t.signal?.dataSourceWeights || {});
              return weights.some(w => w && w > 65);
            }).length || 0,
        },
        mediumPriority: {
          count: tradesWithSignalWeights.filter(t => {
            const weights = Object.values(t.signal?.dataSourceWeights || {});
            return weights.some(w => w && w >= 35 && w <= 65);
          }).length,
          avgConfidence: tradesWithSignalWeights
            .filter(t => {
              const weights = Object.values(t.signal?.dataSourceWeights || {});
              return weights.some(w => w && w >= 35 && w <= 65);
            })
            .reduce((sum, t) => sum + t.trade.aiConfidence, 0) /
            tradesWithSignalWeights.filter(t => {
              const weights = Object.values(t.signal?.dataSourceWeights || {});
              return weights.some(w => w && w >= 35 && w <= 65);
            }).length || 0,
          avgPnL: tradesWithSignalWeights
            .filter(t => {
              const weights = Object.values(t.signal?.dataSourceWeights || {});
              return weights.some(w => w && w >= 35 && w <= 65);
            })
            .reduce((sum, t) => sum + (t.trade.pnl || 0), 0) /
            tradesWithSignalWeights.filter(t => {
              const weights = Object.values(t.signal?.dataSourceWeights || {});
              return weights.some(w => w && w >= 35 && w <= 65);
            }).length || 0,
        },
        lowPriority: {
          count: tradesWithSignalWeights.filter(t => {
            const weights = Object.values(t.signal?.dataSourceWeights || {});
            return weights.some(w => w && w < 35);
          }).length,
          avgConfidence: tradesWithSignalWeights
            .filter(t => {
              const weights = Object.values(t.signal?.dataSourceWeights || {});
              return weights.some(w => w && w < 35);
            })
            .reduce((sum, t) => sum + t.trade.aiConfidence, 0) /
            tradesWithSignalWeights.filter(t => {
              const weights = Object.values(t.signal?.dataSourceWeights || {});
              return weights.some(w => w && w < 35);
            }).length || 0,
          avgPnL: tradesWithSignalWeights
            .filter(t => {
              const weights = Object.values(t.signal?.dataSourceWeights || {});
              return weights.some(w => w && w < 35);
            })
            .reduce((sum, t) => sum + (t.trade.pnl || 0), 0) /
            tradesWithSignalWeights.filter(t => {
              const weights = Object.values(t.signal?.dataSourceWeights || {});
              return weights.some(w => w && w < 35);
            }).length || 0,
        },
      },
      dataSourceInfluence: {
        whale: tradesWithSignalWeights.filter(t => t.signal?.dataSourceWeights?.whale).length,
        sentiment: tradesWithSignalWeights.filter(t => t.signal?.dataSourceWeights?.sentiment).length,
        news: tradesWithSignalWeights.filter(t => t.signal?.dataSourceWeights?.news).length,
      },
    } : {
      tradesAnalyzed: 0,
      performanceByWeightPriority: {},
      dataSourceInfluence: {},
    };

    const stats = {
      summary: {
        totalTrades: trades.length,
        filledTrades: filledTrades.length,
        failedTrades: trades.filter((t) => t.status === 'failed').length,
        openTrades: filledTrades.filter((t) => t.positionStatus === 'open').length,
        closedTrades: closedTrades.length,
      },
      direction: {
        longTrades: trades.filter((t) => t.side === 'LONG').length,
        shortTrades: trades.filter((t) => t.side === 'SHORT').length,
      },
      volume: {
        totalVolume: filledTrades.reduce((sum, t) => sum + (t.filledPrice || 0) * (t.filledQuantity || 0), 0),
        avgOrderSize: filledTrades.length > 0
          ? filledTrades.reduce((sum, t) => sum + (t.quantity || 0), 0) / filledTrades.length
          : 0,
      },
      confidence: {
        avgConfidence: trades.length > 0
          ? trades.reduce((sum, t) => sum + t.aiConfidence, 0) / trades.length
          : 0,
        avgLeverage: trades.length > 0
          ? trades.reduce((sum, t) => sum + t.leverage, 0) / trades.length
          : 0,
      },
      performance: pnlStats,
      // NEW: Weight influence metrics
      weightInfluence: weightInfluenceStats,
    };

    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching trade stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/trades/weight-performance - Detailed weight impact on trade outcomes
router.get('/weight-performance', async (req, res) => {
  try {
    const trades = await getTrades();
    const signals = await getSignals();

    const closedTrades = trades.filter((t) => t.positionStatus === 'closed' && t.pnl !== null);
    
    // Match trades with their signal weights
    const tradesWithWeightData = closedTrades
      .map(trade => {
        const signal = signals.find(s => s.tradeId === trade.id);
        return {
          trade,
          weights: signal?.dataSourceWeights,
          whaleWeight: signal?.dataSourceWeights?.whale || 0,
          sentimentWeight: signal?.dataSourceWeights?.sentiment || 0,
          newsWeight: signal?.dataSourceWeights?.news || 0,
        };
      })
      .filter(t => t.weights); // Only include trades with weight data

    const analysis = {
      totalClosedTrades: closedTrades.length,
      tradesWithWeightTracking: tradesWithWeightData.length,
      performanceMetrics: {
        totalPnL: tradesWithWeightData.reduce((sum, t) => sum + (t.trade.pnl || 0), 0),
        avgPnL: tradesWithWeightData.length > 0
          ? tradesWithWeightData.reduce((sum, t) => sum + (t.trade.pnl || 0), 0) / tradesWithWeightData.length
          : 0,
        winCount: tradesWithWeightData.filter(t => (t.trade.pnl || 0) > 0).length,
        lossCount: tradesWithWeightData.filter(t => (t.trade.pnl || 0) < 0).length,
        breakEvenCount: tradesWithWeightData.filter(t => (t.trade.pnl || 0) === 0).length,
      },
      // Analyze best and worst performing weight combinations
      weightCombinations: {
        allThreeHigh: analyzeWeightCombination(tradesWithWeightData, (w) => w.whaleWeight > 65 && w.sentimentWeight > 65 && w.newsWeight > 65),
        allThreeLow: analyzeWeightCombination(tradesWithWeightData, (w) => w.whaleWeight < 35 && w.sentimentWeight < 35 && w.newsWeight < 35),
        mixedPriorities: analyzeWeightCombination(tradesWithWeightData, (w) => {
          const weights = [w.whaleWeight, w.sentimentWeight, w.newsWeight];
          const high = weights.filter(x => x > 65).length;
          const low = weights.filter(x => x < 35).length;
          return high > 0 && low > 0;
        }),
      },
      dataSourceCorrelation: {
        whaleVsPerformance: calculateCorrelation(
          tradesWithWeightData.map(t => t.whaleWeight),
          tradesWithWeightData.map(t => t.trade.pnl || 0)
        ),
        sentimentVsPerformance: calculateCorrelation(
          tradesWithWeightData.map(t => t.sentimentWeight),
          tradesWithWeightData.map(t => t.trade.pnl || 0)
        ),
        newsVsPerformance: calculateCorrelation(
          tradesWithWeightData.map(t => t.newsWeight),
          tradesWithWeightData.map(t => t.trade.pnl || 0)
        ),
      },
      insight: tradesWithWeightData.length > 5
        ? 'Sufficient data for weight optimization analysis'
        : 'Collect more trades for meaningful weight correlation analysis',
    };

    res.json(analysis);
  } catch (error: any) {
    console.error('Error fetching weight performance:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/trades/balance - Get BitMEX balance
router.get('/balance', async (req, res) => {
  try {
    const balance = await bitmexService.getBalanceInUSDT();
    res.json(balance);
  } catch (error: any) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/trades/positions - Get BitMEX open positions
router.get('/positions', async (req, res) => {
  try {
    const positions = await bitmexService.getPositions();
    res.json(positions);
  } catch (error: any) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/trades/status - Check BitMEX connection
router.get('/status', async (req, res) => {
  try {
    const connected = await bitmexService.checkConnection();
    res.json({
      connected,
      testnet: bitmexService.isTestnet,
    });
  } catch (error: any) {
    console.error('Error checking status:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Helper Functions ---

interface TradeWithWeights {
  trade: any;
  weights?: any;
  whaleWeight: number;
  sentimentWeight: number;
  newsWeight: number;
}

function analyzeWeightCombination(trades: TradeWithWeights[], filter: (w: TradeWithWeights) => boolean) {
  const filtered = trades.filter(filter);
  
  if (filtered.length === 0) {
    return {
      count: 0,
      avgPnL: 0,
      winRate: 'N/A',
    };
  }

  const wins = filtered.filter(t => (t.trade.pnl || 0) > 0).length;
  
  return {
    count: filtered.length,
    avgPnL: filtered.reduce((sum, t) => sum + (t.trade.pnl || 0), 0) / filtered.length,
    winRate: ((wins / filtered.length) * 100).toFixed(2) + '%',
  };
}

function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const meanX = x.reduce((a, b) => a + b) / x.length;
  const meanY = y.reduce((a, b) => a + b) / y.length;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(3));
}

export default router;