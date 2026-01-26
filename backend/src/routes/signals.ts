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

// GET /api/signals/stats - Signal statistics
router.get('/stats', async (req, res) => {
  try {
    const signals = await getSignals();

    const stats = {
      totalSignals: signals.length,
      longSignals: signals.filter((s) => s.signal === 'LONG').length,
      shortSignals: signals.filter((s) => s.signal === 'SHORT').length,
      holdSignals: signals.filter((s) => s.signal === 'HOLD').length,
      avgConfidence:
        signals.length > 0
          ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
          : 0,
      executedSignals: signals.filter((s) => s.tradeId !== null).length,
    };

    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching signal stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
