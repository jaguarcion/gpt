/**
 * Fix Script: Исправление статусов подписок на основе даты окончания.
 * 
 * Логика:
 *   - endDate = startDate + (1m=30дн / 2m=60дн / 3m=90дн)
 *   - Если endDate > now → active
 *   - Если endDate <= now → completed
 *   - Также фиксит activationsCount и lifetimeActivations по привязанным ключам
 * 
 * Запуск:
 *   node scripts/fix-statuses.js            — превью
 *   node scripts/fix-statuses.js --execute   — выполнить
 */

import prisma from '../services/db.js';

const EXECUTE = process.argv.includes('--execute');

function getEndDate(startDate, type) {
    const start = new Date(startDate);
    const months = type === '3m' ? 3 : (type === '2m' ? 2 : 1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    return end;
}

async function main() {
    console.log('='.repeat(60));
    console.log(EXECUTE ? '🔧 РЕЖИМ ВЫПОЛНЕНИЯ' : '👁️  РЕЖИМ ПРЕДПРОСМОТРА (dry-run)');
    console.log('='.repeat(60));
    console.log();

    const now = new Date();
    console.log(`📅 Текущая дата: ${now.toISOString()}`);
    console.log();

    const allSubs = await prisma.subscription.findMany({
        include: { keys: true }
    });

    const fixes = [];

    for (const sub of allSubs) {
        const endDate = getEndDate(sub.startDate, sub.type);
        const linkedKeys = sub.keys.length;
        const changes = {};
        const notes = [];

        // Fix 1: Статус на основе даты окончания
        const shouldBeStatus = endDate > now ? 'active' : 'completed';
        if (sub.status !== shouldBeStatus) {
            changes.status = shouldBeStatus;
            notes.push(`status: ${sub.status} → ${shouldBeStatus} (expires: ${endDate.toLocaleDateString('ru')})`);
        }

        // Fix 2: activationsCount по привязанным ключам
        if (sub.activationsCount !== linkedKeys) {
            changes.activationsCount = linkedKeys;
            notes.push(`activationsCount: ${sub.activationsCount} → ${linkedKeys}`);
        }

        // Fix 3: lifetimeActivations >= linkedKeys
        if (sub.lifetimeActivations < linkedKeys) {
            changes.lifetimeActivations = linkedKeys;
            notes.push(`lifetimeActivations: ${sub.lifetimeActivations} → ${linkedKeys}`);
        }

        // Fix 4: Если подписка active и все активации выполнены, но ещё не истекла —
        //         убрать nextActivationDate (нет смысла активировать ещё раз)
        const maxAct = sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1);
        const effectiveActivations = changes.activationsCount !== undefined ? changes.activationsCount : sub.activationsCount;
        if (shouldBeStatus === 'active' && effectiveActivations >= maxAct && sub.nextActivationDate) {
            changes.nextActivationDate = null;
            notes.push(`nextActivationDate: cleared (all activations done)`);
        }

        if (Object.keys(changes).length > 0) {
            fixes.push({ sub, changes, notes, endDate });
        }
    }

    // Categorize
    let toActive = 0;
    let toCompleted = 0;
    let counterFixes = 0;

    for (const { sub, changes, notes } of fixes) {
        if (changes.status === 'active') toActive++;
        if (changes.status === 'completed') toCompleted++;
        if (changes.activationsCount !== undefined) counterFixes++;

        console.log(`  #${sub.id} ${sub.email} (${sub.type})`);
        for (const n of notes) {
            console.log(`    ${n}`);
        }
    }

    console.log();
    console.log('─'.repeat(60));
    console.log(`📊 ИТОГО: ${fixes.length} подписок к исправлению`);
    console.log(`   → active (ещё не истекли): ${toActive}`);
    console.log(`   → completed (истекли): ${toCompleted}`);
    console.log(`   Счётчик активаций: ${counterFixes}`);
    console.log('─'.repeat(60));

    if (fixes.length === 0) {
        console.log('✨ Нечего исправлять!');
        await prisma.$disconnect();
        return;
    }

    if (!EXECUTE) {
        console.log('\n💡 Для выполнения: node scripts/fix-statuses.js --execute');
        await prisma.$disconnect();
        return;
    }

    console.log('\n🚀 Применяю исправления...');

    let fixed = 0;
    let errors = 0;

    for (const { sub, changes } of fixes) {
        try {
            await prisma.subscription.update({
                where: { id: sub.id },
                data: changes
            });
            fixed++;
        } catch (e) {
            errors++;
            console.error(`  ❌ #${sub.id}: ${e.message}`);
        }
    }

    console.log(`\n✅ Исправлено: ${fixed} | Ошибок: ${errors}`);

    await prisma.activityLog.create({
        data: {
            action: 'FIX',
            details: `Fixed statuses by date: ${toActive} → active, ${toCompleted} → completed, ${counterFixes} counters`,
            email: null
        }
    });

    await prisma.$disconnect();
}

main().catch(e => {
    console.error('Error:', e);
    process.exit(1);
});
