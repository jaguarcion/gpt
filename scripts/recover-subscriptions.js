/**
 * Recovery Script: Восстановление утерянных подписок из ключей, логов и сессий.
 * 
 * Логика:
 * 1. Находит "сиротские" used-ключи (subscriptionId = null или ссылается на несуществующую подписку)
 * 2. Группирует по email
 * 3. Из логов ACTIVATION извлекает тип подписки (1m/2m/3m)
 * 4. Из сессий берёт telegramId
 * 5. Создаёт подписки и привязывает ключи
 * 
 * Запуск:
 *   node scripts/recover-subscriptions.js            — превью (dry-run)
 *   node scripts/recover-subscriptions.js --execute   — выполнить восстановление
 */

import prisma from '../services/db.js';

const EXECUTE = process.argv.includes('--execute');

async function main() {
    console.log('='.repeat(60));
    console.log(EXECUTE ? '🔧 РЕЖИМ ВЫПОЛНЕНИЯ' : '👁️  РЕЖИМ ПРЕДПРОСМОТРА (dry-run)');
    console.log('='.repeat(60));
    console.log();

    // 1. Fetch all used keys
    const allUsedKeys = await prisma.key.findMany({
        where: { status: 'used', usedByEmail: { not: null } },
        orderBy: { usedAt: 'asc' }
    });

    console.log(`📦 Всего used-ключей с email: ${allUsedKeys.length}`);

    // 2. Get existing subscription IDs
    const existingSubs = await prisma.subscription.findMany({
        select: { id: true, email: true }
    });
    const existingSubIds = new Set(existingSubs.map(s => s.id));
    const existingSubEmails = new Set(existingSubs.map(s => s.email));

    // 3. Find orphan keys: subscriptionId is null OR points to non-existent subscription
    const orphanKeys = allUsedKeys.filter(k =>
        k.subscriptionId === null || !existingSubIds.has(k.subscriptionId)
    );

    console.log(`🔍 Ключей-сирот (без подписки): ${orphanKeys.length}`);
    console.log(`✅ Ключей с валидной подпиской: ${allUsedKeys.length - orphanKeys.length}`);
    console.log();

    if (orphanKeys.length === 0) {
        console.log('✨ Нечего восстанавливать — все ключи привязаны к подпискам!');
        await prisma.$disconnect();
        return;
    }

    // 4. Group orphan keys by email
    const emailGroups = new Map();
    for (const key of orphanKeys) {
        const email = key.usedByEmail;
        if (!emailGroups.has(email)) {
            emailGroups.set(email, []);
        }
        emailGroups.get(email).push(key);
    }

    console.log(`👥 Уникальных email без подписки: ${emailGroups.size}`);
    console.log();

    // 5. Fetch activity logs for type detection
    const activationLogs = await prisma.activityLog.findMany({
        where: { action: 'ACTIVATION' },
        orderBy: { createdAt: 'desc' }
    });

    // Parse type from log details: "Activated subscription #X (1m)" → "1m"
    const typeRegex = /\((\d+m)\)/;
    const emailTypeMap = new Map(); // email → type from logs

    for (const log of activationLogs) {
        if (!log.email) continue;
        const match = log.details?.match(typeRegex);
        if (match && !emailTypeMap.has(log.email)) {
            emailTypeMap.set(log.email, match[1]);
        }
    }

    // 6. Fetch sessions for telegramId
    const sessions = await prisma.session.findMany({
        select: { email: true, telegramId: true }
    });
    const sessionMap = new Map();
    for (const s of sessions) {
        sessionMap.set(s.email, s.telegramId);
    }

    // 7. Build recovery plan
    const recoveryPlan = [];
    const now = new Date();

    for (const [email, keys] of emailGroups) {
        // Sort keys by usedAt
        keys.sort((a, b) => new Date(a.usedAt) - new Date(b.usedAt));

        // Determine type
        let type = emailTypeMap.get(email);
        if (!type) {
            // Guess from key count: 1 key = 1m, 2 = 2m, 3 = 3m
            const count = keys.length;
            type = count >= 3 ? '3m' : count >= 2 ? '2m' : '1m';
        }

        // Determine max activations for type
        const maxActivations = type === '3m' ? 3 : (type === '2m' ? 2 : 1);

        // Start date = first key's usedAt
        const startDate = keys[0].usedAt || keys[0].createdAt;

        // Activations count = number of keys used
        const activationsCount = keys.length;
        const lifetimeActivations = keys.length;

        // Determine status
        let status;
        if (activationsCount >= maxActivations) {
            status = 'completed';
        } else {
            // Check if subscription period has expired
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + maxActivations);
            status = endDate < now ? 'expired' : 'active';
        }

        // Next activation date (for active multi-month subs)
        let nextActivationDate = null;
        if (status === 'active' && maxActivations > 1 && activationsCount < maxActivations) {
            const lastKeyDate = keys[keys.length - 1].usedAt || keys[keys.length - 1].createdAt;
            nextActivationDate = new Date(lastKeyDate);
            nextActivationDate.setDate(nextActivationDate.getDate() + 30);
            // If next activation is in the past, set to null (needs manual review)
            if (nextActivationDate < now) {
                nextActivationDate = null;
                status = 'expired'; // Probably expired since next activation was missed
            }
        }

        // Check if subscription already exists for this email
        const alreadyExists = existingSubEmails.has(email);

        const telegramId = sessionMap.get(email) || null;

        recoveryPlan.push({
            email,
            type,
            status,
            startDate,
            activationsCount,
            lifetimeActivations,
            nextActivationDate,
            telegramId: telegramId ? telegramId.toString() : null,
            keyIds: keys.map(k => k.id),
            keyCodes: keys.map(k => k.code),
            alreadyExists,
            note: `Восстановлено из ${keys.length} ключей`
        });
    }

    // 8. Print recovery plan
    console.log('─'.repeat(60));
    console.log('📋 ПЛАН ВОССТАНОВЛЕНИЯ:');
    console.log('─'.repeat(60));
    console.log();

    let toCreate = 0;
    let toUpdate = 0;
    let skipped = 0;

    for (const plan of recoveryPlan) {
        const action = plan.alreadyExists ? '🔄 UPDATE' : '🆕 CREATE';
        if (plan.alreadyExists) toUpdate++;
        else toCreate++;

        console.log(`${action}  ${plan.email}`);
        console.log(`   Тип: ${plan.type} | Статус: ${plan.status} | Активаций: ${plan.activationsCount}/${plan.type === '3m' ? 3 : plan.type === '2m' ? 2 : 1}`);
        console.log(`   Дата начала: ${new Date(plan.startDate).toLocaleDateString('ru-RU')}`);
        console.log(`   Ключи (${plan.keyIds.length}): ${plan.keyCodes.map(c => c.substring(0, 12) + '...').join(', ')}`);
        if (plan.nextActivationDate) {
            console.log(`   Следующая активация: ${new Date(plan.nextActivationDate).toLocaleDateString('ru-RU')}`);
        }
        if (plan.telegramId) {
            console.log(`   Telegram ID: ${plan.telegramId}`);
        }
        console.log();
    }

    console.log('─'.repeat(60));
    console.log(`📊 ИТОГО: ${toCreate} создать | ${toUpdate} обновить | ${recoveryPlan.length} всего`);
    console.log('─'.repeat(60));
    console.log();

    // 9. Execute if flag is set
    if (!EXECUTE) {
        console.log('💡 Для выполнения запустите:');
        console.log('   node scripts/recover-subscriptions.js --execute');
        console.log();
        await prisma.$disconnect();
        return;
    }

    console.log('🚀 Начинаю восстановление...');
    console.log();

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const plan of recoveryPlan) {
        try {
            let subscription;

            if (plan.alreadyExists) {
                // Find existing and update
                const existing = await prisma.subscription.findFirst({
                    where: { email: plan.email }
                });

                if (existing) {
                    subscription = await prisma.subscription.update({
                        where: { id: existing.id },
                        data: {
                            activationsCount: Math.max(existing.activationsCount, plan.activationsCount),
                            lifetimeActivations: Math.max(existing.lifetimeActivations, plan.lifetimeActivations),
                            note: existing.note
                                ? `${existing.note} | ${plan.note}`
                                : plan.note
                        }
                    });
                    updated++;
                    console.log(`  🔄 Обновлено: ${plan.email} (sub #${subscription.id})`);
                }
            } else {
                // Create new subscription
                subscription = await prisma.subscription.create({
                    data: {
                        email: plan.email,
                        type: plan.type,
                        status: plan.status,
                        startDate: new Date(plan.startDate),
                        activationsCount: plan.activationsCount,
                        lifetimeActivations: plan.lifetimeActivations,
                        nextActivationDate: plan.nextActivationDate ? new Date(plan.nextActivationDate) : null,
                        note: plan.note
                    }
                });
                created++;
                console.log(`  🆕 Создано: ${plan.email} → sub #${subscription.id} (${plan.type}, ${plan.status})`);
            }

            // Link orphan keys to subscription
            if (subscription) {
                await prisma.key.updateMany({
                    where: { id: { in: plan.keyIds } },
                    data: { subscriptionId: subscription.id }
                });
                console.log(`     🔗 Привязано ключей: ${plan.keyIds.length}`);
            }

        } catch (e) {
            errors++;
            console.error(`  ❌ Ошибка для ${plan.email}: ${e.message}`);
        }
    }

    console.log();
    console.log('='.repeat(60));
    console.log(`✅ Готово! Создано: ${created} | Обновлено: ${updated} | Ошибок: ${errors}`);
    console.log('='.repeat(60));

    // Log the recovery action
    await prisma.activityLog.create({
        data: {
            action: 'RECOVERY',
            details: `Recovered ${created} subscriptions, updated ${updated}. Total orphan keys processed: ${orphanKeys.length}`,
            email: null
        }
    });

    await prisma.$disconnect();
}

main().catch(e => {
    console.error('❌ Фатальная ошибка:', e);
    process.exit(1);
});
