import { Router } from 'express';
import { getSignals } from '../lib/firestore';

const router = Router();

// GET /api/signals - List signals
router.get('/', async (req, res) => {
  try {
    const { workflowId } = req.query;
    const signals = await getSignals(workflowId as string | undefined);
    res.json(signals);
  } catch (error: any) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/signals/stats - Signal statistics WITH weight analytics
router.get('/stats', async (req, res) => {
  try {
    const signals = await getSignals();

    // Calculate weight statistics
    const signalsWithWeights = signals.filter(s => s.dataSourceWeights);
    
    const avgWeights = signalsWithWeights.length > 0 ? {
      whale: signalsWithWeights
        .filter(s => s.dataSourceWeights?.whale)
        .reduce((sum, s) => sum + (s.dataSourceWeights?.whale || 0), 0) / 
        signalsWithWeights.filter(s => s.dataSourceWeights?.whale).length,
      sentiment: signalsWithWeights
        .filter(s => s.dataSourceWeights?.sentiment)
        .reduce((sum, s) => sum + (s.dataSourceWeights?.sentiment || 0), 0) / 
        signalsWithWeights.filter(s => s.dataSourceWeights?.sentiment).length,
      news: signalsWithWeights
        .filter(s => s.dataSourceWeights?.news)
        .reduce((sum, s) => sum + (s.dataSourceWeights?.news || 0), 0) / 
        signalsWithWeights.filter(s => s.dataSourceWeights?.news).length,
    } : { whale: 0, sentiment: 0, news: 0 };

    const stats = {
      totalSignals: signals.length,
      signalBreakdown: {
        long: signals.filter((s) => s.signal === 'LONG').length,
        short: signals.filter((s) => s.signal === 'SHORT').length,
        hold: signals.filter((s) => s.signal === 'HOLD').length,
        portfolio: signals.filter((s) => s.signal === 'PORTFOLIO').length,
      },
      confidence: {
        average: signals.length > 0
          ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
          : 0,
        median: signals.length > 0
          ? signals.sort((a, b) => a.confidence - b.confidence)[Math.floor(signals.length / 2)].confidence
          : 0,
        max: signals.length > 0
          ? Math.max(...signals.map(s => s.confidence))
          : 0,
        min: signals.length > 0
          ? Math.min(...signals.map(s => s.confidence))
          : 0,
      },
      execution: {
        executed: signals.filter((s) => s.tradeId !== null).length,
        executionRate: signals.length > 0
          ? ((signals.filter((s) => s.tradeId !== null).length / signals.length) * 100).toFixed(2) + '%'
          : '0%',
      },
      // NEW: Weight analytics
      weightAnalytics: {
        signalsWithWeightTracking: signalsWithWeights.length,
        averageWeights: {
          whale: Number(avgWeights.whale.toFixed(2)),
          sentiment: Number(avgWeights.sentiment.toFixed(2)),
          news: Number(avgWeights.news.toFixed(2)),
        },
        weightedSignalTrend: {
          highPrioritySignals: signals.filter(s => {
            const weights = s.dataSourceWeights;
            if (!weights) return false;
            const highCount = Object.values(weights).filter(w => w && w > 65).length;
            return highCount >= 2; // At least 2 high-priority sources
          }).length,
          mediumPrioritySignals: signals.filter(s => {
            const weights = s.dataSourceWeights;
            if (!weights) return false;
            return Object.values(weights).some(w => w && w >= 35 && w <= 65);
          }).length,
          lowPrioritySignals: signals.filter(s => {
            const weights = s.dataSourceWeights;
            if (!weights) return false;
            return Object.values(weights).some(w => w && w < 35);
          }).length,
        },
      },
    };

    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching signal stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/signals/weight-analysis - Detailed weight influence analysis
router.get('/weight-analysis', async (req, res) => {
  try {
    const signals = await getSignals();
    
    // Analyze correlation between weights and outcomes
    const signalsWithTrades = signals.filter(s => s.tradeId !== null && s.dataSourceWeights);
    
    const analysis = {
      totalAnalyzed: signalsWithTrades.length,
      weightDistribution: {
        whaleWeights: signalsWithTrades.map(s => s.dataSourceWeights?.whale || 0),
        sentimentWeights: signalsWithTrades.map(s => s.dataSourceWeights?.sentiment || 0),
        newsWeights: signalsWithTrades.map(s => s.dataSourceWeights?.news || 0),
      },
      confidenceByWeightLevel: {
        highWeightSignals: {
          count: signalsWithTrades.filter(s => {
            const weights = Object.values(s.dataSourceWeights || {});
            return weights.some(w => w && w > 65);
          }).length,
          avgConfidence: signalsWithTrades
            .filter(s => {
              const weights = Object.values(s.dataSourceWeights || {});
              return weights.some(w => w && w > 65);
            })
            .reduce((sum, s) => sum + s.confidence, 0) /
            signalsWithTrades.filter(s => {
              const weights = Object.values(s.dataSourceWeights || {});
              return weights.some(w => w && w > 65);
            }).length || 0,
        },
        mediumWeightSignals: {
          count: signalsWithTrades.filter(s => {
            const weights = Object.values(s.dataSourceWeights || {});
            return weights.some(w => w && w >= 35 && w <= 65);
          }).length,
          avgConfidence: signalsWithTrades
            .filter(s => {
              const weights = Object.values(s.dataSourceWeights || {});
              return weights.some(w => w && w >= 35 && w <= 65);
            })
            .reduce((sum, s) => sum + s.confidence, 0) /
            signalsWithTrades.filter(s => {
              const weights = Object.values(s.dataSourceWeights || {});
              return weights.some(w => w && w >= 35 && w <= 65);
            }).length || 0,
        },
        lowWeightSignals: {
          count: signalsWithTrades.filter(s => {
            const weights = Object.values(s.dataSourceWeights || {});
            return weights.some(w => w && w < 35);
          }).length,
          avgConfidence: signalsWithTrades
            .filter(s => {
              const weights = Object.values(s.dataSourceWeights || {});
              return weights.some(w => w && w < 35);
            })
            .reduce((sum, s) => sum + s.confidence, 0) /
            signalsWithTrades.filter(s => {
              const weights = Object.values(s.dataSourceWeights || {});
              return weights.some(w => w && w < 35);
            }).length || 0,
        },
      },
      recommendation: {
        message: 'Weight configuration impact analysis',
        dataQuality: signalsWithTrades.length > 10 ? 'Good' : 'Limited (< 10 samples)',
        insight: signalsWithTrades.length > 10 
          ? 'Monitor weight distributions to optimize signal quality'
          : 'Collect more signals for meaningful weight analysis',
      },
    };

    res.json(analysis);
  } catch (error: any) {
    console.error('Error fetching weight analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;