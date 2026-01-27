import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Import routes
import workflowsRouter from './routes/workflows';
import tradesRouter from './routes/trades';
import signalsRouter from './routes/signals';

// Import scheduler
import { scheduler } from './engine/scheduler';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API Routes
app.use('/api/workflows', workflowsRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/signals', signalsRouter);

// Manual scheduler trigger (for testing)
app.post('/api/scheduler/run', async (req, res) => {
  try {
    await scheduler.runNow();
    res.json({ success: true, message: 'Scheduler triggered' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 TradeCraft AI Backend v2.0                           ║
║                                                            ║
║   Server running on http://localhost:${PORT}                 ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(10)}                        ║
║   BitMEX: ${process.env.BITMEX_TESTNET === 'true' ? 'TESTNET    ' : 'MAINNET    '}                            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Start the scheduler
  scheduler.start();
});

export default app;
