import cron from 'node-cron';
import { SubscriptionService } from './services/subscriptionService.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('Starting Scheduler Service...');

// Run every day at 10:00 AM
cron.schedule('0 10 * * *', async () => {
    console.log('[Cron] Running scheduled activations...');
    await SubscriptionService.processScheduledActivations();
});

// Also run once on startup for dev/test
// setTimeout(() => SubscriptionService.processScheduledActivations(), 5000);
