import { getExpiredOpenTrades, updateTrade, Trade } from '../lib/firestore';
import { bitmexService } from '../services/bitmex';
import { Timestamp } from 'firebase-admin/firestore';

// Check and close positions that have exceeded their hold duration
export async function checkAndCloseExpiredPositions(): Promise<void> {
  try {
    // Get all trades with expired hold duration
    const expiredTrades = await getExpiredOpenTrades();

    if (expiredTrades.length === 0) {
      return;
    }

    console.log(`\n⏰ Found ${expiredTrades.length} position(s) to close`);

    for (const trade of expiredTrades) {
      await closeExpiredPosition(trade);
    }

  } catch (error: any) {
    console.error('Position manager error:', error.message);
  }
}

// Close a single expired position
async function closeExpiredPosition(trade: Trade): Promise<void> {
  const tradeId = trade.id!;

  console.log(`  → Closing position: ${trade.symbol} (Trade ID: ${tradeId})`);

  try {
    // Close the position on BitMEX
    const closeResult = await bitmexService.closePosition(trade.symbol);

    if (closeResult.success) {
      // Calculate PnL
      const entryPrice = trade.filledPrice || 0;
      const closePrice = closeResult.filledPrice || 0;
      const quantity = trade.filledQuantity || trade.quantity;

      // PnL calculation (simplified - actual PnL depends on contract type)
      let pnl = 0;
      if (entryPrice > 0 && closePrice > 0) {
        if (trade.side === 'BUY') {
          // Long position: profit when price goes up
          pnl = ((closePrice - entryPrice) / entryPrice) * quantity * trade.leverage;
        } else {
          // Short position: profit when price goes down
          pnl = ((entryPrice - closePrice) / entryPrice) * quantity * trade.leverage;
        }
      }

      // Update trade record
      await updateTrade(tradeId, {
        positionStatus: 'closed',
        closedAt: Timestamp.now(),
        closePrice: closePrice,
        pnl: pnl,
      });

      const pnlDisplay = pnl >= 0 ? `+${pnl.toFixed(6)}` : pnl.toFixed(6);
      console.log(`    ✅ Position closed at $${closePrice} | PnL: ${pnlDisplay}`);

    } else {
      console.log(`    ❌ Failed to close position: ${closeResult.error}`);

      // Check if position might have been liquidated
      if (closeResult.error?.includes('position') || closeResult.error?.includes('not found')) {
        await updateTrade(tradeId, {
          positionStatus: 'liquidated',
          closedAt: Timestamp.now(),
        });
        console.log(`    ⚠️  Position may have been liquidated`);
      }
    }

  } catch (error: any) {
    console.error(`    ❌ Error closing position ${tradeId}:`, error.message);
  }
}

// Manual close for a specific trade
export async function closePositionManually(tradeId: string): Promise<boolean> {
  // This would need to fetch the trade first - placeholder for now
  console.log(`Manual close requested for trade: ${tradeId}`);
  return false;
}

export const positionManager = {
  checkAndCloseExpiredPositions,
  closePositionManually,
};
