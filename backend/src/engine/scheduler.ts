import cron from 'node-cron';
import { getActiveWorkflows } from '../lib/firestore';
import { executor } from './executor';
import { positionManager } from './positionManager';

let isRunning = false;

// Run all active workflows
async function runActiveWorkflows(): Promise<void> {
  if (isRunning) {
    console.log('⚠️  Previous execution still running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           🤖 TRADECRAFT AI - SCHEDULED RUN                 ║');
  console.log(`║           📅 ${new Date().toISOString()}             ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Get all active workflows
    const workflows = await getActiveWorkflows();

    if (workflows.length === 0) {
      console.log('\n📭 No active workflows found');
      return;
    }

    console.log(`\n📋 Found ${workflows.length} active workflow(s)`);

    // Execute each workflow
    for (const workflow of workflows) {
      try {
        await executor.executeWorkflow(workflow);
      } catch (error: any) {
        console.error(`❌ Error executing workflow "${workflow.name}": ${error.message}`);
        // Continue with next workflow even if one fails
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ All workflows processed in ${duration}s`);

  } catch (error: any) {
    console.error('❌ Scheduler error:', error.message);
  } finally {
    isRunning = false;
  }
}

// Start the scheduler
export function startScheduler(): void {
  console.log('🕐 Starting scheduler...');

  // Run workflows every 60 minutes
  cron.schedule('*/60 * * * *', () => {
    runActiveWorkflows();
  });
  console.log('  → Workflows: Every 60 minutes');
  // Sync positions with BitMEX every minute (check if TP/SL triggered)
  cron.schedule('* * * * *', () => {
    positionManager.syncPositions();
  });
  console.log('  → Position Sync: Every minute');

  console.log('✅ Scheduler started');
  console.log('📅 Next workflow run at: ' + getNextRunTime());
}

// Get next scheduled run time
function getNextRunTime(): string {
  const next = new Date();
  next.setHours(next.getHours() + 1);
  next.setMinutes(0);
  next.setSeconds(0);

  return next.toLocaleTimeString();
}

// Manual trigger for testing
export async function runNow(): Promise<void> {
  console.log('🔧 Manual trigger requested');
  await runActiveWorkflows();
}

export const scheduler = {
  start: startScheduler,
  runNow,
};