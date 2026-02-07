import prisma from './db.js';
import axios from 'axios';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { KeyService } from './keyService.js';
import { SessionService } from './sessionService.js';
import { LogService } from './logService.js';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_USERS = (process.env.ALLOWED_TELEGRAM_USERS || '')
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

const bot = new Telegraf(BOT_TOKEN);

const notifyAdmins = async (message) => {
    for (const userId of ALLOWED_USERS) {
        try {
            await bot.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
        } catch (e) {
            console.error(`Failed to send notification to ${userId}:`, e.message);
        }
    }
};

// Local API URL for activation requests (calls the existing /api/activate-key endpoint)
// We reuse the existing activation logic which handles the external API interaction
const ACTIVATE_API_URL = `http://localhost:${process.env.PORT || 3001}/api/activate-key`;
const API_TOKEN = process.env.API_TOKEN;

// In-memory lock to prevent race conditions for same user
const processingLocks = new Set();

export class SubscriptionService {
    static async getStats() {
        const total = await prisma.subscription.count();
        const active = await prisma.subscription.count({ where: { status: 'active' } });
        const type1m = await prisma.subscription.count({ where: { type: '1m', status: 'active' } });
        const type2m = await prisma.subscription.count({ where: { type: '2m', status: 'active' } });
        const type3m = await prisma.subscription.count({ where: { type: '3m', status: 'active' } });

        // Cohort Analysis (Lifetime Retention)
        // Groups by creation month
        const cohorts = await prisma.$queryRaw`
            SELECT 
                strftime('%Y-%m', createdAt / 1000, 'unixepoch') as month,
                COUNT(*) as total_users,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
                SUM(CASE WHEN lifetimeActivations >= 2 THEN 1 ELSE 0 END) as retained_1_plus,
                SUM(CASE WHEN lifetimeActivations >= 3 THEN 1 ELSE 0 END) as retained_2_plus
            FROM subscriptions
            GROUP BY month
            ORDER BY month DESC
            LIMIT 6
        `;

        // Daily chart data (last 30 days)
        const subscriptions = await prisma.subscription.findMany({
            select: {
                createdAt: true,
                type: true
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        // 2. Fetch "Orphan" keys (used keys with no subscription) to fill gaps in stats
        // These are keys that were sold but the subscription record was lost/deleted
        const orphanKeys = await prisma.key.findMany({
            where: {
                status: 'used',
                subscriptionId: null,
                usedAt: { not: null }
            },
            select: { usedAt: true }
        });
        
        const statsMap = new Map();
        
        // Helper to format date with Moscow timezone
        const formatDate = (dateObj) => {
            return new Date(dateObj).toLocaleDateString('ru-RU', {
                timeZone: 'Europe/Moscow',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).split('.').reverse().join('-');
        };

        // Process normal subscriptions
        subscriptions.forEach(sub => {
            const date = formatDate(sub.createdAt);

            if (!statsMap.has(date)) {
                statsMap.set(date, { date, total: 0, type1m: 0, type2m: 0, type3m: 0 });
            }
            
            const entry = statsMap.get(date);
            entry.total++;
            if (sub.type === '1m') entry.type1m++;
            else if (sub.type === '2m') entry.type2m++;
            else if (sub.type === '3m') entry.type3m++;
        });

        const chart = Array.from(statsMap.values()).slice(-30);
        const totalCompleted = await prisma.subscription.count({ where: { status: 'completed' } });
        
        // Fix for BigInt serialization (MOVE UP before orphan processing)
        const serializedCohorts = cohorts.map(c => ({
            ...c,
            total_users: Number(c.total_users),
            active_users: Number(c.active_users),
            retained_1_plus: Number(c.retained_1_plus),
            retained_2_plus: Number(c.retained_2_plus)
        }));

        // Process orphan keys (assume 1m type for them)
        let orphanActiveCount = 0;
        let orphanCompletedCount = 0;
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        orphanKeys.forEach(key => {
             const usedDate = new Date(key.usedAt);
             const dateStr = formatDate(key.usedAt);
             
             // Chart stats
             if (!statsMap.has(dateStr)) {
                 statsMap.set(dateStr, { date: dateStr, total: 0, type1m: 0, type2m: 0, type3m: 0 });
             }

             const entry = statsMap.get(dateStr);
             entry.total++;
             entry.type1m++; // Default assumption

             // Summary stats (Active/Completed assumption based on 30 days)
             if (usedDate > thirtyDaysAgo) {
                 orphanActiveCount++;
             } else {
                 orphanCompletedCount++;
             }

             // Cohort stats fix
             // Get YYYY-MM from usedAt
             const monthStr = usedDate.toISOString().slice(0, 7); // "2026-02"
             
             // Find or create cohort entry
             let cohort = serializedCohorts.find(c => c.month === monthStr);
             if (!cohort) {
                 // Note: Usually SQL returns ordered desc, so if we add new one we might break order or limit. 
                 // But for simplicity let's find existing. If not found (e.g. old orphan), we skip or push.
                 // Given the limit 6 in SQL, we only patch existing recent months.
             }
             
             if (cohort) {
                 cohort.total_users++;
                 if (usedDate > thirtyDaysAgo) {
                     cohort.active_users++;
                 }
                 // We can't know about retained status (re-buys) for orphans easily without email linking
             }
        });

        return {
            chart,
            cohorts: serializedCohorts,
            summary: {
                total: total + orphanKeys.length,
                active: active + orphanActiveCount,
                completed: totalCompleted + orphanCompletedCount,
                type1m: type1m + orphanKeys.length, // Assign all orphans to 1m for simplicity in type breakdown
                type2m,
                type3m
            }
        };
    }

    static async getAllSubscriptions(page = 1, limit = 20, search = '', filters = {}) {
        const where = {};
        
        if (search) {
            where.email = { contains: search };
        }
        
        if (filters.status && filters.status !== 'all') {
            where.status = filters.status;
        }
        
        if (filters.type && filters.type !== 'all') {
            where.type = filters.type;
        }

        // Handle "expiring soon" filter (e.g. within 3 days)
        // This is complex because endDate is calculated dynamically in code, not stored in DB directly as 'endDate'
        // But we can approximate using startDate + type duration
        // Or if we want to be precise, we need to filter in memory (bad for pagination) or use raw query.
        // For simplicity/performance with sqlite/prisma:
        // Let's rely on client-side or basic status filtering for now, 
        // OR we can add a 'expiringSoon' flag that checks if startDate is older than (Duration - 3 days).
        
        // Let's implement expiring logic:
        if (filters.expiring) {
             const now = new Date();
             const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
             
             // Logic:
             // End Date = StartDate + Months
             // We want: EndDate <= threeDaysFromNow AND EndDate >= now
             // So: StartDate <= threeDaysFromNow - Months AND StartDate >= now - Months
             
             // Since 'Months' varies by type, we might need OR conditions
             
             const getDateRange = (months) => {
                 const targetEnd = new Date(threeDaysFromNow);
                 targetEnd.setMonth(targetEnd.getMonth() - months);
                 
                 const targetStart = new Date(now);
                 targetStart.setMonth(targetStart.getMonth() - months);
                 
                 return { lte: targetEnd, gte: targetStart };
             };
             
             where.AND = [
                 { status: 'active' },
                 {
                     OR: [
                        { type: '1m', startDate: getDateRange(1) },
                        { type: '2m', startDate: getDateRange(2) },
                        { type: '3m', startDate: getDateRange(3) }
                     ]
                 }
             ];
        }

        const [subscriptions, total] = await Promise.all([
            prisma.subscription.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    keys: {
                        select: { code: true, usedAt: true }
                    }
                }
            }),
            prisma.subscription.count({ where })
        ]);

        return {
            subscriptions,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        };
    }

    static async getSubscriptionsByTelegramId(telegramId) {
        // Need to join with Session to find by telegramId
        // Step 1: Get emails for this telegramId
        const sessions = await prisma.session.findMany({
            where: { telegramId: BigInt(telegramId) },
            select: { email: true }
        });
        
        const emails = sessions.map(s => s.email);
        
        if (emails.length === 0) return [];

        return prisma.subscription.findMany({
            where: { email: { in: emails } },
            orderBy: { createdAt: 'desc' },
            include: {
                keys: {
                    select: { code: true, usedAt: true }
                }
            }
        });
    }

    static async createSubscription(email, type, telegramId, sessionJson) {
        if (processingLocks.has(email)) {
            console.warn(`[Lock] Duplicate request blocked for ${email}`);
            throw new Error('Запрос уже обрабатывается. Пожалуйста, подождите.');
        }

        processingLocks.add(email);

        try {
            // 0. Double-check: verify if we recently activated this user (within 2 minutes)
            // This protects against race conditions that might bypass the memory lock (e.g. server restart or separate processes if scaled)
            // and logic errors where we might re-activate an active user.
            const existingSub = await prisma.subscription.findFirst({
                where: { email },
                include: { keys: { orderBy: { usedAt: 'desc' }, take: 1 } }
            });

            if (existingSub && existingSub.status === 'active') {
                const lastKey = existingSub.keys[0];
                if (lastKey && lastKey.usedAt) {
                    const timeDiff = Date.now() - new Date(lastKey.usedAt).getTime();
                    if (timeDiff < 2 * 60 * 1000) { // 2 minutes
                        console.log(`[Sub] Skipping duplicate activation for ${email} (activated ${Math.round(timeDiff/1000)}s ago)`);
                        return { subscription: existingSub, activationResult: { success: true, message: 'Already activated' } };
                    }
                }
            }

            // 1. Find available key
            const key = await KeyService.getAvailableKey();

            if (!key) {
                throw new Error(`Нет доступных ключей`);
            }

            // Check if subscription exists
            let subscription = existingSub; // We already fetched it above

            if (subscription) {
                 // Update existing subscription
                 // IMPORTANT: Check if we are creating a new one because the previous one was completed/expired?
                 // Or is this a "re-subscribe" action?
                 // If status is 'active', we probably shouldn't be here unless user forces it.
                 // But let's assume this is a fresh start or upgrade.
                 
                 // If we are reactivating a user, we should reset their state properly.
                 
                 subscription = await prisma.subscription.update({
                     where: { id: subscription.id },
                     data: {
                         type,
                         status: 'active',
                         activationsCount: 0, // Reset for new period
                         lifetimeActivations: subscription.lifetimeActivations, // Keep lifetime stats
                         startDate: new Date(),
                         nextActivationDate: (type === '3m' || type === '2m') ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null
                     }
                 });
            } else {
                // 2. Create Subscription Record
                subscription = await prisma.subscription.create({
                    data: {
                        email,
                        type,
                        status: 'active',
                        activationsCount: 0,
                        nextActivationDate: (type === '3m' || type === '2m') ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null
                    }
                });
            }

            // 3. Save Session (upsert)
            // Extract expiresAt from sessionJson if possible, or default
            let expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // Default 3 months
            if (sessionJson.expires) {
                expiresAt = new Date(sessionJson.expires);
            }
            
            await SessionService.createSession(email, sessionJson, expiresAt, telegramId);

            // 4. Perform Activation
            const activationResult = await this.activateKeyForSubscription(subscription.id, key.code, sessionJson);

            if (activationResult.success) {
                // Mark key as used
                await KeyService.markKeyAsUsed(key.id, email, subscription.id);
                
                // Update subscription count
                // We need to increment lifetimeActivations, and activationsCount (which is 0 now, so becomes 1)
                
                await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { 
                        activationsCount: 1, // Explicitly set to 1 for first activation
                        lifetimeActivations: { increment: 1 }
                    }
                });
                
                // If type is 1m, mark active
                if (type === '1m') {
                    await prisma.subscription.update({
                        where: { id: subscription.id },
                        data: { status: 'active', nextActivationDate: null }
                    });
                }
                
                await LogService.log('ACTIVATION', `Activated subscription #${subscription.id} (${type})`, email);

            } else {
                 // If activation failed
                 await LogService.log('ERROR', `Activation failed for #${subscription.id}: ${activationResult.message}`, email);
                 throw new Error(`Ошибка активации: ${activationResult.message}`);
            }

            return { subscription, activationResult };
        } finally {
            processingLocks.delete(email);
        }
    }

    static async activateKeyForSubscription(subscriptionId, cdk, sessionJson) {
        try {
            console.log(`[Sub #${subscriptionId}] Activating key ${cdk}...`);
            const response = await axios.post(ACTIVATE_API_URL, {
                cdk,
                sessionJson
            }, {
                headers: { 'Authorization': `Bearer ${API_TOKEN}` }
            });
            return response.data;
        } catch (error) {
            console.error(`[Sub #${subscriptionId}] Activation failed:`, error.message);
            return { 
                success: false, 
                message: error.response?.data?.message || error.message 
            };
        }
    }

    static async manualActivate(subscriptionId) {
        const subscription = await prisma.subscription.findUnique({
            where: { id: Number(subscriptionId) }
        });

        if (!subscription) {
            throw new Error('Подписка не найдена');
        }

        if (subscription.activationsCount >= (subscription.type === '3m' ? 3 : (subscription.type === '2m' ? 2 : 1))) {
            throw new Error(`Достигнут лимит активаций (${subscription.type === '3m' ? 3 : (subscription.type === '2m' ? 2 : 1)})`);
        }

        // Get Session
        const session = await SessionService.getSessionByEmail(subscription.email);
        if (!session) {
            throw new Error('Сессия не найдена');
        }

        // Get Key
        const key = await KeyService.getAvailableKey();
        if (!key) {
            throw new Error('Нет доступных ключей');
        }

        // Activate
        const result = await this.activateKeyForSubscription(subscription.id, key.code, session.sessionJson);

        if (result.success) {
            await KeyService.markKeyAsUsed(key.id, subscription.email, subscription.id);
            
            const newCount = subscription.activationsCount + 1;
            const maxRounds = subscription.type === '3m' ? 3 : (subscription.type === '2m' ? 2 : 1);
            const isFinished = newCount >= maxRounds;
            
            await prisma.subscription.update({
                where: { id: subscription.id },
                data: { 
                    activationsCount: newCount,
                    lifetimeActivations: { increment: 1 },
                    status: isFinished ? 'completed' : 'active',
                    nextActivationDate: isFinished ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }
            });

            // notifyAdmins(`🛠 *Ручная активация*\nEmail: \`${subscription.email}\`\nРаунд: ${newCount}/3`);
            await LogService.log('MANUAL_ACTIVATION', `Manual activation for #${subscription.id}, round ${newCount}/${maxRounds}`, subscription.email);
            return { success: true, message: 'Успешно активировано', round: newCount };
        } else {
            await LogService.log('ERROR', `Manual activation failed for #${subscription.id}: ${result.message}`, subscription.email);
            throw new Error(result.message || 'Ошибка активации');
        }
    }

    static async deleteSubscription(id) {
        // 1. Delete related sessions? No, sessions might be kept or we delete them too.
        // Usually better to keep history or soft delete. But here we delete hard.
        
        // Delete Keys relation? 
        // Keys are related to Subscription. If we delete subscription, keys.subscriptionId becomes null?
        // Or we should delete keys too? 
        // Prisma schema: subscription Subscription? @relation(fields: [subscriptionId], references: [id])
        // If we don't set onDelete: Cascade, we need to handle it.
        
        // Let's disconnect keys first
        await prisma.key.updateMany({
            where: { subscriptionId: parseInt(id) },
            data: { subscriptionId: null }
        });

        const deleted = await prisma.subscription.delete({
            where: { id: parseInt(id) }
        });
        
        await LogService.log('USER_DELETE', `Deleted user #${id} (${deleted.email})`);
        return deleted;
    }

    static async updateSubscription(id, data) {
        const { email, type, endDate, status, note } = data;
        
        // Prepare update data
        const updateData = {};
        if (email) updateData.email = email;
        if (type) updateData.type = type;
        if (status) updateData.status = status;
        if (note !== undefined) updateData.note = note;
        
        if (endDate) {
           const end = new Date(endDate);
           const months = type === '3m' ? 3 : (type === '2m' ? 2 : 1);
           // New start date = end date - duration
           const newStart = new Date(end);
           newStart.setMonth(newStart.getMonth() - months);
           updateData.startDate = newStart;
        }

        return prisma.subscription.update({
            where: { id: parseInt(id) },
            data: updateData
        });
    }

    static async processScheduledActivations() {
        const now = new Date();
        
        // 1. Mark expired subscriptions as completed
        // For 1m subs: if startDate + 1 month < now -> completed
        // For 3m subs: if activationsCount >= 3 AND last activation date + 1 month < now -> completed
        // To simplify: we can calculate endDate for all active subs and check against now
        
        const activeSubs = await prisma.subscription.findMany({
            where: { status: 'active' }
        });

        for (const sub of activeSubs) {
            const start = new Date(sub.startDate);
            const monthsToAdd = sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1);
            const endDate = new Date(start.setMonth(start.getMonth() + monthsToAdd));
            
            if (endDate < now) {
                console.log(`[Scheduler] Marking subscription #${sub.id} (${sub.email}) as completed (expired).`);
                await prisma.subscription.update({
                    where: { id: sub.id },
                    data: { status: 'completed' }
                });
            }
        }

        // 2. Find active subscriptions where nextActivationDate is past due
            const dueSubscriptions = await prisma.subscription.findMany({
            where: {
                status: 'active',
                nextActivationDate: { lte: now },
                OR: [
                    { type: '3m', activationsCount: { lt: 3 } },
                    { type: '2m', activationsCount: { lt: 2 } },
                    { type: '1m', activationsCount: { lt: 1 } } // Should not happen if logic correct, but for safety
                ]
            }
        });

        console.log(`[Scheduler] Found ${dueSubscriptions.length} subscriptions due for activation.`);

        for (const sub of dueSubscriptions) {
            try {
                // Get Session
                const session = await SessionService.getSessionByEmail(sub.email);
                if (!session) {
                    console.error(`[Scheduler] Session not found for ${sub.email}`);
                    continue;
                }

                // Check session expiration
                if (session.expiresAt < now) {
                    console.error(`[Scheduler] Session expired for ${sub.email}. Marking subscription as completed/failed.`);
                    await prisma.subscription.update({
                        where: { id: sub.id },
                        data: { status: 'completed' } // Or 'expired'
                    });
                    continue;
                }

                // Get Key
                const key = await KeyService.getAvailableKey();
                if (!key) {
                    console.error(`[Scheduler] No keys available for ${sub.email}`);
                    notifyAdmins(`🚨 *КРИТИЧЕСКАЯ ОШИБКА*\nЗакончились ключи для продления!\nEmail: \`${sub.email}\`\nСрочно добавьте ключи!`);
                    continue; // Try next time
                }

                // Activate
                const result = await this.activateKeyForSubscription(sub.id, key.code, session.sessionJson);

                if (result.success) {
                    await KeyService.markKeyAsUsed(key.id, sub.email, sub.id);
                    
                    const newCount = sub.activationsCount + 1;
                    const maxRounds = sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1);
                    const isFinished = newCount >= maxRounds;
                    
                    await prisma.subscription.update({
                        where: { id: sub.id },
                        data: { 
                            activationsCount: newCount,
                            lifetimeActivations: { increment: 1 },
                            status: isFinished ? 'completed' : 'active',
                            nextActivationDate: isFinished ? null : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
                        }
                    });
                    console.log(`[Scheduler] Successfully activated round ${newCount} for ${sub.email}`);
                    notifyAdmins(`🔄 *Успешное продление*\nEmail: \`${sub.email}\`\nРаунд: ${newCount}/${maxRounds}\nID Подписки: ${sub.id}`);
                    await LogService.log('RENEWAL', `Auto-renewed subscription #${sub.id}, round ${newCount}/${maxRounds}`, sub.email);
                } else {
                    console.error(`[Scheduler] Activation failed for ${sub.email}: ${result.message}`);
                    notifyAdmins(`⚠️ *Ошибка продления*\nEmail: \`${sub.email}\`\nID Подписки: ${sub.id}\nОшибка: ${result.message}`);
                    await LogService.log('ERROR', `Auto-renewal failed for #${sub.id}: ${result.message}`, sub.email);
                }

            } catch (e) {
                console.error(`[Scheduler] Error processing sub ${sub.id}:`, e);
            }
        }
    }
}
