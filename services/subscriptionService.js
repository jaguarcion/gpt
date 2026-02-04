import { Telegraf } from 'telegraf';
import prisma from './db.js';
import { KeyService } from './keyService.js';
import { SessionService } from './sessionService.js';
import axios from 'axios';
import dotenv from 'dotenv';

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

export class SubscriptionService {
    static async getAllSubscriptions() {
        return prisma.subscription.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                keys: {
                    select: { code: true, usedAt: true }
                }
            }
        });
    }

    static async getSubscriptionsByTelegramId(telegramId) {
        // Need to join with Session to find by telegramId
        // Or find sessions first.
        // Let's assume we can filter by email from sessions? No, relationship is loose.
        // But we have SessionService. Let's find emails for this telegramId.
        
        // Since we don't have direct relation in schema (Session <-> Subscription is via email string),
        // we do a 2-step query or raw query.
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
        // 1. Find available key
        const key = await KeyService.getAvailableKey();

        if (!key) {
            throw new Error(`Нет доступных ключей`);
        }

        // 2. Create Subscription Record
        const subscription = await prisma.subscription.create({
            data: {
                email,
                type,
                status: 'active',
                activationsCount: 0,
                nextActivationDate: type === '3m' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null // Next activation in 30 days if 3m
            }
        });

        // Notify Admins about new subscription
        notifyAdmins(`🆕 *Новая подписка*\nEmail: \`${email}\`\nТип: ${type}\nTelegram ID: ${telegramId}`);

        // 3. Save Session (if not exists or update)
        // We need session info for future activations
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
            await prisma.subscription.update({
                where: { id: subscription.id },
                data: { activationsCount: { increment: 1 } }
            });
            
            // If type is 1m, mark completed
            if (type === '1m') {
                await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { status: 'completed', nextActivationDate: null }
                });
            }
        } else {
             // If activation failed, maybe we shouldn't mark key as used?
             // Or maybe we should? Depends on failure reason. 
             // For now, let's NOT mark as used so it can be retried, but throw error
             throw new Error(`Ошибка активации: ${activationResult.message}`);
        }

        return { subscription, activationResult };
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

        if (subscription.status === 'completed' || subscription.activationsCount >= 3) {
            throw new Error('Подписка уже завершена или достигнут лимит активаций');
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
            const isFinished = newCount >= 3;
            
            await prisma.subscription.update({
                where: { id: subscription.id },
                data: { 
                    activationsCount: newCount,
                    status: isFinished ? 'completed' : 'active',
                    nextActivationDate: isFinished ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }
            });

            notifyAdmins(`🛠 *Ручная активация*\nEmail: \`${subscription.email}\`\nРаунд: ${newCount}/3`);
            return { success: true, message: 'Успешно активировано', round: newCount };
        } else {
            throw new Error(result.message || 'Ошибка активации');
        }
    }

    static async processScheduledActivations() {
        const now = new Date();
        // Find active subscriptions where nextActivationDate is past due
        const dueSubscriptions = await prisma.subscription.findMany({
            where: {
                status: 'active',
                nextActivationDate: { lte: now },
                activationsCount: { lt: 3 }
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
                    const isFinished = newCount >= 3;
                    
                    await prisma.subscription.update({
                        where: { id: sub.id },
                        data: { 
                            activationsCount: newCount,
                            status: isFinished ? 'completed' : 'active',
                            nextActivationDate: isFinished ? null : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
                        }
                    });
                    console.log(`[Scheduler] Successfully activated round ${newCount} for ${sub.email}`);
                    notifyAdmins(`🔄 *Успешное продление*\nEmail: \`${sub.email}\`\nРаунд: ${newCount}/3\nID Подписки: ${sub.id}`);
                } else {
                    console.error(`[Scheduler] Activation failed for ${sub.email}: ${result.message}`);
                    notifyAdmins(`⚠️ *Ошибка продления*\nEmail: \`${sub.email}\`\nID Подписки: ${sub.id}\nОшибка: ${result.message}`);
                }

            } catch (e) {
                console.error(`[Scheduler] Error processing sub ${sub.id}:`, e);
            }
        }
    }
}
