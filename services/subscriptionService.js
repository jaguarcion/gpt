import prisma from './db.js';
import axios from 'axios';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { KeyService } from './keyService.js';
import { SessionService } from './sessionService.js';
import { LogService } from './logService.js';
import { encrypt } from './encryptionService.js';
import { emitEvent, EVENTS } from './eventBus.js';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_USERS = (process.env.ALLOWED_TELEGRAM_USERS || '')
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

// Use Telegraf.Telegram directly for sending messages — does NOT start polling,
// avoiding conflicts with the main bot instance in bot.js
const telegram = BOT_TOKEN ? new Telegraf(BOT_TOKEN).telegram : null;

const notifyAdmins = async (message) => {
    if (!telegram) return;
    for (const userId of ALLOWED_USERS) {
        try {
            await telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
        } catch (e) {
            console.error(`Failed to send notification to ${userId}:`, e.message);
        }
    }
};

// Local API URL for activation requests (calls the existing /api/activate-key endpoint)
// We reuse the existing activation logic which handles the external API interaction
const ACTIVATE_API_URL = `http://127.0.0.1:${process.env.PORT || 3001}/api/activate-key`;
const API_TOKEN = process.env.API_TOKEN;

// In-memory lock to prevent race conditions for same user
const processingLocks = new Set();

// Constants
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const TWO_MINUTES_MS = 2 * 60 * 1000;

const getMaxRounds = (type) => type === '3m' ? 3 : (type === '2m' ? 2 : 1);

export class SubscriptionService {
    static async getStats() {
        const total = await prisma.subscription.count();
        const active = await prisma.subscription.count({ where: { status: 'active' } });
        const type1m = await prisma.subscription.count({ where: { type: '1m', status: 'active' } });
        const type2m = await prisma.subscription.count({ where: { type: '2m', status: 'active' } });
        const type3m = await prisma.subscription.count({ where: { type: '3m', status: 'active' } });

        // Cohort Analysis (Lifetime Retention)
        // Groups by start month (actual activation date)
        // SECURITY: Using tagged template literal — Prisma auto-parameterizes. Do NOT use string concatenation here.
        const cohorts = await prisma.$queryRaw`
            SELECT 
                strftime('%Y-%m', startDate / 1000, 'unixepoch') as month,
                COUNT(*) as total_users,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
                SUM(CASE WHEN lifetimeActivations >= 2 THEN 1 ELSE 0 END) as retained_1_plus,
                SUM(CASE WHEN lifetimeActivations >= 3 THEN 1 ELSE 0 END) as retained_2_plus
            FROM subscriptions
            GROUP BY month
            ORDER BY month DESC
            LIMIT 6
        `;

        // Daily chart data — UNIFIED: group by key.usedAt (same as /api/today widget)
        // This ensures chart matches the header widget numbers
        const usedKeys = await prisma.key.findMany({
            where: {
                status: 'used',
                usedAt: { not: null }
            },
            select: {
                usedAt: true,
                subscription: {
                    select: { type: true }
                }
            },
            orderBy: {
                usedAt: 'asc'
            }
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

        // Process all used keys (both with and without subscriptions)
        usedKeys.forEach(key => {
            const date = formatDate(key.usedAt);
            // Get type from subscription, default to '1m' for orphan keys
            const type = key.subscription?.type || '1m';

            if (!statsMap.has(date)) {
                statsMap.set(date, { date, total: 0, type1m: 0, type2m: 0, type3m: 0 });
            }

            const entry = statsMap.get(date);
            entry.total++;
            if (type === '1m') entry.type1m++;
            else if (type === '2m') entry.type2m++;
            else if (type === '3m') entry.type3m++;
        });

        const chart = Array.from(statsMap.values()).slice(-30);
        const totalCompleted = await prisma.subscription.count({ where: { status: 'completed' } });

        // Fix for BigInt serialization
        const serializedCohorts = cohorts.map(c => ({
            ...c,
            total_users: Number(c.total_users),
            active_users: Number(c.active_users),
            retained_1_plus: Number(c.retained_1_plus),
            retained_2_plus: Number(c.retained_2_plus)
        }));

        // Count orphan keys for summary stats
        const orphanKeys = usedKeys.filter(k => !k.subscription);
        let orphanActiveCount = 0;
        let orphanCompletedCount = 0;
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        orphanKeys.forEach(key => {
            const usedDate = new Date(key.usedAt);

            // Summary stats (Active/Completed assumption based on 30 days)
            if (usedDate > thirtyDaysAgo) {
                orphanActiveCount++;
            } else {
                orphanCompletedCount++;
            }

            // Cohort stats fix
            const monthStr = usedDate.toISOString().slice(0, 7);
            let cohort = serializedCohorts.find(c => c.month === monthStr);

            if (cohort) {
                cohort.total_users++;
                if (usedDate > thirtyDaysAgo) {
                    cohort.active_users++;
                }
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

        // Build email filter conditions (search + emailProvider must not overwrite each other)
        const emailConditions = [];
        if (search) {
            emailConditions.push({ email: { contains: search } });
        }
        if (filters.emailProvider) {
            emailConditions.push({ email: { contains: filters.emailProvider } });
        }
        if (emailConditions.length === 1) {
            where.email = emailConditions[0].email;
        } else if (emailConditions.length > 1) {
            where.AND = [...(where.AND || []), ...emailConditions];
        }

        if (filters.status && filters.status !== 'all') {
            where.status = filters.status;
        }

        if (filters.type && filters.type !== 'all') {
            where.type = filters.type;
        }

        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
            if (filters.dateTo) where.createdAt.lte = new Date(new Date(filters.dateTo).setHours(23, 59, 59, 999));
        }

        if (filters.activationsMin !== undefined || filters.activationsMax !== undefined) {
            where.activationsCount = {};
            if (filters.activationsMin) where.activationsCount.gte = parseInt(filters.activationsMin);
            if (filters.activationsMax) where.activationsCount.lte = parseInt(filters.activationsMax);
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
            const existingSub = await prisma.subscription.findFirst({
                where: { email },
                include: { keys: { orderBy: { usedAt: 'desc' }, take: 1 } }
            });

            if (existingSub && existingSub.status === 'active') {
                const lastKey = existingSub.keys[0];
                if (lastKey && lastKey.usedAt) {
                    const timeDiff = Date.now() - new Date(lastKey.usedAt).getTime();
                    if (timeDiff < TWO_MINUTES_MS) {
                        console.log(`[Sub] Skipping duplicate activation for ${email}(activated ${Math.round(timeDiff / 1000)}s ago)`);
                        return {
                            subscription: {
                                id: existingSub.id,
                                email: existingSub.email,
                                type: existingSub.type,
                                status: existingSub.status,
                                activationsCount: existingSub.activationsCount,
                                startDate: existingSub.startDate,
                            },
                            activationResult: { success: true, message: 'Already activated' },
                        };
                    }
                }
            }

            // 1. Find available key
            const key = await KeyService.getAvailableKey();

            if (!key) {
                throw new Error(`Нет доступных ключей`);
            }

            // 2. Create/Update subscription
            console.log(`[Sub] Step 2: Creating/updating subscription for ${email}...`);
            let subscription;
            if (existingSub) {
                subscription = await prisma.subscription.update({
                    where: { id: existingSub.id },
                    data: {
                        type,
                        status: 'active',
                        activationsCount: 0,
                        lifetimeActivations: existingSub.lifetimeActivations,
                        startDate: new Date(),
                        nextActivationDate: (type === '3m' || type === '2m') ? new Date(Date.now() + THIRTY_DAYS_MS) : null
                    }
                });
            } else {
                subscription = await prisma.subscription.create({
                    data: {
                        email,
                        type,
                        status: 'active',
                        activationsCount: 0,
                        nextActivationDate: (type === '3m' || type === '2m') ? new Date(Date.now() + THIRTY_DAYS_MS) : null
                    }
                });
            }
            console.log(`[Sub] Step 2 done: subscription #${subscription.id}`);

            // 2b. Save/Update session (separate from subscription to avoid transaction stack overflow)
            console.log(`[Sub] Step 2b: Saving session for ${email}...`);
            let expiresAt = new Date(Date.now() + NINETY_DAYS_MS);
            const parsedSession = typeof sessionJson === 'string' ? (() => { try { return JSON.parse(sessionJson); } catch { return null; } })() : sessionJson;
            if (parsedSession && parsedSession.expires) {
                expiresAt = new Date(parsedSession.expires);
            }

            const existingSession = await prisma.session.findFirst({
                where: { email },
                orderBy: { createdAt: 'desc' }
            });

            const encryptedSession = encrypt(typeof sessionJson === 'object' ? JSON.stringify(sessionJson) : sessionJson);

            if (existingSession) {
                await prisma.session.update({
                    where: { id: existingSession.id },
                    data: {
                        sessionJson: encryptedSession,
                        expiresAt,
                        telegramId: BigInt(telegramId)
                    }
                });
            } else {
                await prisma.session.create({
                    data: {
                        email,
                        sessionJson: encryptedSession,
                        expiresAt,
                        telegramId: BigInt(telegramId)
                    }
                });
            }
            console.log(`[Sub] Step 2b done: session saved`);

            // 3. Perform Activation (external API call — outside transaction)
            // Ensure sessionJson is always a string for axios serialization safety
            const sessionStr = typeof sessionJson === 'object' ? JSON.stringify(sessionJson) : sessionJson;
            console.log(`[Sub #${subscription.id}] sessionJson type: ${typeof sessionJson}, length: ${sessionStr.length}`);
            const activationResult = await this.activateKeyForSubscription(subscription.id, key.code, sessionStr);

            if (activationResult.success) {
                // Mark key + update subscription counts in a transaction
                await prisma.$transaction(async (tx) => {
                    await tx.key.update({
                        where: { id: key.id },
                        data: {
                            status: 'used',
                            usedAt: new Date(),
                            usedByEmail: email,
                            subscriptionId: subscription.id
                        }
                    });

                    const updateData = {
                        activationsCount: 1,
                        lifetimeActivations: { increment: 1 }
                    };

                    if (type === '1m') {
                        updateData.status = 'active';
                        updateData.nextActivationDate = null;
                    }

                    await tx.subscription.update({
                        where: { id: subscription.id },
                        data: updateData
                    });
                });

                await LogService.log('ACTIVATION', `Activated subscription #${subscription.id} (${type})`, email, { source: 'bot' });
                emitEvent(EVENTS.ACTIVATION, { subscriptionId: subscription.id, email, type });

            } else {
                await LogService.log('ERROR', `Activation failed for #${subscription.id}: ${activationResult.message}`, email, { source: 'bot' });
                emitEvent(EVENTS.ERROR, { subscriptionId: subscription.id, email, message: activationResult.message });
                throw new Error(`Ошибка активации: ${activationResult.message}`);
            }

            return {
                subscription: {
                    id: subscription.id,
                    email: subscription.email,
                    type: subscription.type,
                    status: subscription.status,
                    activationsCount: subscription.activationsCount,
                    startDate: subscription.startDate,
                },
                activationResult: {
                    success: activationResult.success,
                    message: activationResult.message || 'OK',
                },
            };
        } finally {
            processingLocks.delete(email);
        }
    }

    static async activateKeyForSubscription(subscriptionId, cdk, sessionJson) {
        try {
            const startTime = Date.now();
            // Guarantee sessionJson is a string to prevent JSON.stringify circular ref issues
            const safeSessionJson = typeof sessionJson === 'object' ? JSON.stringify(sessionJson) : String(sessionJson);
            console.log(`[Sub #${subscriptionId}] Activating key ${cdk}, session length: ${safeSessionJson.length}...`);
            const response = await axios.post(ACTIVATE_API_URL, {
                cdk,
                sessionJson: safeSessionJson
            }, {
                headers: { 'Authorization': `Bearer ${API_TOKEN}` },
                timeout: 150000, // 2.5 min (activation polls up to 2 min)
            });
            console.log(`[Sub #${subscriptionId}] Activation completed in ${Date.now() - startTime}ms`);
            return response.data;
        } catch (error) {
            console.error(`[Sub #${subscriptionId}] Activation failed (${Date.now()}): `, error.message);
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

        const maxRounds = getMaxRounds(subscription.type);
        if (subscription.activationsCount >= maxRounds) {
            throw new Error(`Достигнут лимит активаций(${maxRounds})`);
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
            const isFinished = newCount >= maxRounds;

            await prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    activationsCount: newCount,
                    lifetimeActivations: { increment: 1 },
                    status: isFinished ? 'completed' : 'active',
                    nextActivationDate: isFinished ? null : new Date(Date.now() + THIRTY_DAYS_MS)
                }
            });

            // notifyAdmins(`🛠 * Ручная активация *\nEmail: \`${subscription.email}\`\nРаунд: ${newCount}/3`);
            await LogService.log('MANUAL_ACTIVATION', `Manual activation for #${subscription.id}, round ${newCount}/${maxRounds}`, subscription.email, { source: 'system' });
            return { success: true, message: 'Успешно активировано', round: newCount };
        } else {
            await LogService.log('ERROR', `Manual activation failed for #${subscription.id}: ${result.message}`, subscription.email, { source: 'system' });
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

        await LogService.log('USER_DELETE', `Deleted user #${id} (${deleted.email})`, deleted.email, { source: 'system' });
        return deleted;
    }

    static async updateSubscription(id, data) {
        const { email, type, endDate, status, note } = data;

        const existing = await prisma.subscription.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existing) throw new Error('Subscription not found');

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

        const updated = await prisma.subscription.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        // Calculate diff
        const diff = {};
        if (email && email !== existing.email) diff.email = { from: existing.email, to: email };
        if (type && type !== existing.type) diff.type = { from: existing.type, to: type };
        if (status && status !== existing.status) diff.status = { from: existing.status, to: status };
        if (note !== undefined && note !== existing.note) diff.note = { from: existing.note, to: note };
        if (endDate) {
            // Rough check since we only store startDate
            const oldEnd = new Date(existing.startDate);
            const oldMonths = existing.type === '3m' ? 3 : (existing.type === '2m' ? 2 : 1);
            oldEnd.setMonth(oldEnd.getMonth() + oldMonths);
            const newEnd = new Date(endDate);
            if (oldEnd.toISOString().split('T')[0] !== newEnd.toISOString().split('T')[0]) {
                diff.endDate = { from: oldEnd.toISOString().split('T')[0], to: newEnd.toISOString().split('T')[0] };
            }
        }

        if (Object.keys(diff).length > 0) {
            await LogService.log('USER_UPDATE', `Updated user #${id}`, existing.email, { diff, source: 'admin' });
        }

        return updated;
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
            const monthsToAdd = getMaxRounds(sub.type);
            const endDate = new Date(sub.startDate);
            endDate.setMonth(endDate.getMonth() + monthsToAdd);

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
        emitEvent(EVENTS.BATCH_START, { total: dueSubscriptions.length });

        let processedCount = 0;

        for (const sub of dueSubscriptions) {
            processedCount++;
            emitEvent(EVENTS.BATCH_PROGRESS, {
                current: processedCount,
                total: dueSubscriptions.length,
                email: sub.email
            });

            try {
                // Get Session
                const session = await SessionService.getSessionByEmail(sub.email);
                if (!session) {
                    console.error(`[Scheduler] Session not found for ${sub.email}`);
                    emitEvent(EVENTS.ERROR, { email: sub.email, message: 'Session not found' });
                    continue;
                }

                // Check session expiration
                if (session.expiresAt < now) {
                    console.error(`[Scheduler] Session expired for ${sub.email}. Marking subscription as completed/failed.`);
                    await prisma.subscription.update({
                        where: { id: sub.id },
                        data: { status: 'completed' } // Or 'expired'
                    });
                    emitEvent(EVENTS.ERROR, { email: sub.email, message: 'Session expired' });
                    continue;
                }

                // Get Key
                const key = await KeyService.getAvailableKey();
                if (!key) {
                    console.error(`[Scheduler] No keys available for ${sub.email}`);
                    notifyAdmins(`🚨 *КРИТИЧЕСКАЯ ОШИБКА*\nЗакончились ключи для продления!\nEmail: \`${sub.email}\`\nСрочно добавьте ключи!`);
                    emitEvent(EVENTS.ERROR, { email: sub.email, message: 'No keys available' });
                    continue; // Try next time
                }

                // Activate
                const result = await this.activateKeyForSubscription(sub.id, key.code, session.sessionJson);

                if (result.success) {
                    await KeyService.markKeyAsUsed(key.id, sub.email, sub.id);

                    const newCount = sub.activationsCount + 1;
                    const maxRounds = getMaxRounds(sub.type);
                    const isFinished = newCount >= maxRounds;

                    await prisma.subscription.update({
                        where: { id: sub.id },
                        data: {
                            activationsCount: newCount,
                            lifetimeActivations: { increment: 1 },
                            status: isFinished ? 'completed' : 'active',
                            nextActivationDate: isFinished ? null : new Date(now.getTime() + THIRTY_DAYS_MS)
                        }
                    });
                    console.log(`[Scheduler] Successfully activated round ${newCount} for ${sub.email}`);
                    notifyAdmins(`🔄 *Успешное продление*\nEmail: \`${sub.email}\`\nРаунд: ${newCount}/${maxRounds}\nID Подписки: ${sub.id}`);
                    await LogService.log('RENEWAL', `Auto-renewed subscription #${sub.id}, round ${newCount}/${maxRounds}`, sub.email, { source: 'scheduler' });
                    emitEvent(EVENTS.RENEWAL, { subscriptionId: sub.id, email: sub.email, round: newCount, maxRounds });
                } else {
                    console.error(`[Scheduler] Activation failed for ${sub.email}: ${result.message}`);
                    notifyAdmins(`⚠️ *Ошибка продления*\nEmail: \`${sub.email}\`\nID Подписки: ${sub.id}\nОшибка: ${result.message}`);
                    await LogService.log('ERROR', `Auto-renewal failed for #${sub.id}: ${result.message}`, sub.email, { source: 'scheduler' });
                    emitEvent(EVENTS.ERROR, { subscriptionId: sub.id, email: sub.email, message: result.message });
                    // Maybe we should not mark it as processed if failed? 
                    // But for the sake of queue progress, it IS processed (attempted).
                }

            } catch (e) {
                console.error(`[Scheduler] Error processing sub ${sub.id}:`, e);
                emitEvent(EVENTS.ERROR, { email: sub.email, message: e.message });
            }
        }

        emitEvent(EVENTS.BATCH_COMPLETE, { total: dueSubscriptions.length });
    }
}
