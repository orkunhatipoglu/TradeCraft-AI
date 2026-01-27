import { getOpenTrades, updateTrade, Trade } from '../lib/firestore';
import { bitmexService } from '../services/bitmex';
import { Timestamp } from 'firebase-admin/firestore';

// Sync open trades with BitMEX positions (TP/SL may have triggered)
export async function syncPositions(): Promise<void> {
  try {
    // Get all open trades from DB
    const openTrades = await getOpenTrades();

    if (openTrades.length === 0) {
      return;
    }

    // Get current positions from BitMEX
    const bitmexPositions = await bitmexService.getPositions();

    console.log(`\n🔄 Syncing ${openTrades.length} open trade(s) with BitMEX...`);

    for (const trade of openTrades) {
      await syncTradeWithPosition(trade, bitmexPositions);
    }

  } catch (error: any) {
    console.error('Position sync error:', error.message);
  }
}

// Sync a single trade with BitMEX position data
async function syncTradeWithPosition(trade: Trade, bitmexPositions: any[]): Promise<void> {
  const tradeId = trade.id!;

  // Find matching position on BitMEX
  const position = bitmexPositions.find(p => p.symbol === trade.symbol);

  // If position exists and has size, it's still open
  if (position && position.size !== 0) {
    // Position still open - check if size matches expected direction
    const isLong = position.size > 0;
    const expectedLong = trade.side === 'LONG';

    if (isLong !== expectedLong) {
      // Position direction changed - might have closed and reopened
      console.log(`  ⚠️ ${trade.symbol}: Position direction mismatch, marking as closed`);
      await markTradeClosed(trade, position.markPrice);
    }
    // Otherwise position is still active, nothing to do
    return;
  }

  // Position not found or size is 0 - position was closed (TP/SL triggered or manual)
  console.log(`  → ${trade.symbol}: Position closed (TP/SL triggered)`);

  // Try to get the close price from recent order history
  const closePrice = await getClosePrice(trade);

  await markTradeClosed(trade, closePrice);
}

// Mark a trade as closed and calculate PnL
async function markTradeClosed(trade: Trade, closePrice: number | null): Promise<void> {
  const tradeId = trade.id!;
  const entryPrice = trade.filledPrice || 0;
  const finalClosePrice = closePrice || entryPrice; // Fallback to entry if unknown
  const quantity = trade.filledQuantity || trade.quantity;

  // Calculate PnL
  let pnl = 0;
  if (entryPrice > 0 && finalClosePrice > 0) {
    if (trade.side === 'LONG') {
      pnl = ((finalClosePrice - entryPrice) / entryPrice) * quantity * trade.leverage;
    } else {
      pnl = ((entryPrice - finalClosePrice) / entryPrice) * quantity * trade.leverage;
    }
  }

  // Determine if it was TP or SL
  let closeReason = 'unknown';
  if (entryPrice > 0 && finalClosePrice > 0) {
    const priceChange = ((finalClosePrice - entryPrice) / entryPrice) * 100;
    if (trade.side === 'LONG') {
      closeReason = priceChange > 0 ? 'take_profit' : 'stop_loss';
    } else {
      closeReason = priceChange < 0 ? 'take_profit' : 'stop_loss';
    }
  }

  await updateTrade(tradeId, {
    positionStatus: 'closed',
    closedAt: Timestamp.now(),
    closePrice: finalClosePrice,
    pnl: pnl,
  });

  const pnlDisplay = pnl >= 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2);
  const emoji = pnl >= 0 ? '🎯' : '🛑';
  console.log(`    ${emoji} Closed via ${closeReason} at $${finalClosePrice} | PnL: ${pnlDisplay} USD`);
}

// Try to get close price from BitMEX order history
async function getClosePrice(trade: Trade): Promise<number | null> {
  // For now, return null - could be enhanced to query order history
  // BitMEX positions endpoint gives markPrice which we can use as approximation
  return null;
}

// Manual close for a specific trade (cancels TP/SL and closes position)
export async function closePositionManually(tradeId: string): Promise<boolean> {
  console.log(`Manual close requested for trade: ${tradeId}`);
  // TODO: Cancel TP/SL orders and close position
  return false;
}

export const positionManager = {
  syncPositions,
  closePositionManually,
};