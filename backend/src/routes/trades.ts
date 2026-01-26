import { Router } from 'express';
import { getTrades } from '../lib/firestore';
import { bitmexService } from '../services/bitmex';

const router = Router();

// GET /api/trades - List trades
router.get('/', async (req, res) => {
  try {
    const { workflowId } = req.query;
    const trades = await getTrades(workflowId as string | undefined);
    res.json(trades);
  } catch (error: any) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/trades/stats - Trade statistics
router.get('/stats', async (req, res) => {
  try {
    const trades = await getTrades();

    const stats = {
      totalTrades: trades.length,
      filledTrades: trades.filter((t) => t.status === 'filled').length,
      failedTrades: trades.filter((t) => t.status === 'failed').length,
      buyTrades: trades.filter((t) => t.side === 'BUY').length,
      sellTrades: trades.filter((t) => t.side === 'SELL').length,
      totalVolume: trades
        .filter((t) => t.status === 'filled')
        .reduce((sum, t) => sum + (t.filledPrice || 0) * (t.filledQuantity || 0), 0),
      avgConfidence:
        trades.length > 0
          ? trades.reduce((sum, t) => sum + t.aiConfidence, 0) / trades.length
          : 0,
    };

    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching trade stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/trades/balance - Get BitMEX balance
router.get('/balance', async (req, res) => {
  try {
    const balance = await bitmexService.getBalance();
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

export default router;
