import prisma from '../services/db.js';

async function main() {
    console.log('='.repeat(60));
    console.log('📊 АНАЛИЗ ПРОДОВОЙ БАЗЫ');
    console.log('='.repeat(60));

    // === KEYS ===
    const totalKeys = await prisma.key.count();
    const activeKeys = await prisma.key.count({ where: { status: 'active' } });
    const usedKeys = await prisma.key.count({ where: { status: 'used' } });
    const usedWithEmail = await prisma.key.count({ where: { status: 'used', usedByEmail: { not: null } } });
    const usedWithSub = await prisma.key.count({ where: { status: 'used', subscriptionId: { not: null } } });
    const usedNoSub = await prisma.key.count({ where: { status: 'used', subscriptionId: null } });
    const usedNoEmail = await prisma.key.count({ where: { status: 'used', usedByEmail: null } });

    console.log('\n🔑 КЛЮЧИ:');
    console.log(`  Всего: ${totalKeys}`);
    console.log(`  Active: ${activeKeys}`);
    console.log(`  Used: ${usedKeys}`);
    console.log(`    с email: ${usedWithEmail}`);
    console.log(`    с subscriptionId: ${usedWithSub}`);
    console.log(`    БЕЗ subscriptionId (сироты): ${usedNoSub}`);
    console.log(`    БЕЗ email: ${usedNoEmail}`);

    // === SUBSCRIPTIONS ===
    const totalSubs = await prisma.subscription.count();
    const activeSubs = await prisma.subscription.count({ where: { status: 'active' } });
    const completedSubs = await prisma.subscription.count({ where: { status: 'completed' } });
    const expiredSubs = await prisma.subscription.count({ where: { status: 'expired' } });
    const type1m = await prisma.subscription.count({ where: { type: '1m' } });
    const type2m = await prisma.subscription.count({ where: { type: '2m' } });
    const type3m = await prisma.subscription.count({ where: { type: '3m' } });

    console.log('\n👥 ПОДПИСКИ:');
    console.log(`  Всего: ${totalSubs}`);
    console.log(`  Active: ${activeSubs} | Completed: ${completedSubs} | Expired: ${expiredSubs}`);
    console.log(`  1m: ${type1m} | 2m: ${type2m} | 3m: ${type3m}`);

    // === SESSIONS ===
    const totalSessions = await prisma.session.count();
    console.log(`\n📧 Сессии: ${totalSessions}`);

    // === LOGS ===
    const totalLogs = await prisma.activityLog.count();
    const activationLogs = await prisma.activityLog.count({ where: { action: 'ACTIVATION' } });
    const errorLogs = await prisma.activityLog.count({ where: { action: 'ERROR' } });
    const renewalLogs = await prisma.activityLog.count({ where: { action: 'RENEWAL' } });
    const recoveryLogs = await prisma.activityLog.count({ where: { action: 'RECOVERY' } });

    console.log(`\n📝 ЛОГИ: ${totalLogs}`);
    console.log(`  ACTIVATION: ${activationLogs} | ERROR: ${errorLogs} | RENEWAL: ${renewalLogs} | RECOVERY: ${recoveryLogs}`);

    // === CROSS-CHECK ===
    console.log('\n' + '─'.repeat(60));
    console.log('🔍 ПЕРЕКРЁСТНАЯ ПРОВЕРКА:');
    console.log('─'.repeat(60));

    // 1. Subscriptions with correct key count
    const subsWithKeys = await prisma.subscription.findMany({
        include: { keys: true }
    });

    let mismatchCount = 0;
    const mismatchDetails = [];
    for (const sub of subsWithKeys) {
        const linkedKeys = sub.keys.length;
        if (linkedKeys !== sub.activationsCount && linkedKeys !== sub.lifetimeActivations) {
            mismatchCount++;
            mismatchDetails.push({
                id: sub.id,
                email: sub.email,
                type: sub.type,
                status: sub.status,
                activationsCount: sub.activationsCount,
                lifetimeActivations: sub.lifetimeActivations,
                linkedKeys,
                keyIds: sub.keys.map(k => k.id)
            });
        }
    }

    console.log(`\n1️⃣ Подписки с несовпадением ключей/активаций: ${mismatchCount}`);
    if (mismatchDetails.length > 0) {
        mismatchDetails.forEach(m => {
            console.log(`   #${m.id} ${m.email} — type=${m.type} status=${m.status} activations=${m.activationsCount} lifetime=${m.lifetimeActivations} linkedKeys=${m.linkedKeys}`);
        });
    }

    // 2. Check for active subs that should be completed (by date)
    const now = new Date();
    const activeShouldComplete = [];
    for (const sub of subsWithKeys) {
        if (sub.status !== 'active') continue;
        const months = sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1);
        const endDate = new Date(sub.startDate);
        endDate.setMonth(endDate.getMonth() + months);
        if (endDate <= now) {
            activeShouldComplete.push({
                id: sub.id, email: sub.email, type: sub.type,
                endDate: endDate.toLocaleDateString('ru'),
                activationsCount: sub.activationsCount,
                maxAct: months
            });
        }
    }
    console.log(`\n2️⃣ Active подписки с истёкшим сроком (должны быть completed): ${activeShouldComplete.length}`);
    activeShouldComplete.forEach(s => {
        console.log(`   #${s.id} ${s.email} type=${s.type} expired=${s.endDate} activations=${s.activationsCount}/${s.maxAct}`);
    });

    // 2b. Active subscriptions with all activations done (informational)
    const allActivationsDone = [];
    for (const sub of subsWithKeys) {
        if (sub.status !== 'active') continue;
        const maxAct = sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1);
        if (sub.activationsCount >= maxAct) {
            const months = sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1);
            const endDate = new Date(sub.startDate);
            endDate.setMonth(endDate.getMonth() + months);
            allActivationsDone.push({ id: sub.id, email: sub.email, type: sub.type, expires: endDate.toLocaleDateString('ru') });
        }
    }
    console.log(`\n   ℹ️ Active подписки с выполненными активациями (ждут истечения срока): ${allActivationsDone.length}`);

    // 3. Check for completed subs that have status active
    const completedButActive = subsWithKeys.filter(s =>
        s.status === 'completed' && s.keys.length === 0
    );
    console.log(`\n3️⃣ Completed подписки без ключей: ${completedButActive.length}`);

    // 4. Unique emails across tables
    const keyEmails = await prisma.key.findMany({
        where: { status: 'used', usedByEmail: { not: null } },
        select: { usedByEmail: true },
        distinct: ['usedByEmail']
    });
    const subEmails = await prisma.subscription.findMany({
        select: { email: true },
        distinct: ['email']
    });
    const sessionEmails = await prisma.session.findMany({
        select: { email: true },
        distinct: ['email']
    });

    const keyEmailSet = new Set(keyEmails.map(k => k.usedByEmail));
    const subEmailSet = new Set(subEmails.map(s => s.email));
    const sessionEmailSet = new Set(sessionEmails.map(s => s.email));

    const inKeysNotSubs = [...keyEmailSet].filter(e => !subEmailSet.has(e));
    const inSubsNotKeys = [...subEmailSet].filter(e => !keyEmailSet.has(e));
    const inSessionsNotSubs = [...sessionEmailSet].filter(e => !subEmailSet.has(e));

    console.log(`\n4️⃣ Уникальные email:`);
    console.log(`   В ключах: ${keyEmailSet.size} | В подписках: ${subEmailSet.size} | В сессиях: ${sessionEmailSet.size}`);
    console.log(`   В ключах, но НЕ в подписках: ${inKeysNotSubs.length}`);
    if (inKeysNotSubs.length > 0) {
        inKeysNotSubs.forEach(e => console.log(`     ⚠️ ${e}`));
    }
    console.log(`   В подписках, но НЕ в ключах: ${inSubsNotKeys.length}`);
    if (inSubsNotKeys.length > 0 && inSubsNotKeys.length <= 10) {
        inSubsNotKeys.forEach(e => console.log(`     ℹ️ ${e}`));
    }
    console.log(`   В сессиях, но НЕ в подписках: ${inSessionsNotSubs.length}`);

    // 5. Recovered subscriptions check
    const recoveredSubs = await prisma.subscription.findMany({
        where: { note: { contains: 'Восстановлено' } },
        include: { keys: true }
    });
    console.log(`\n5️⃣ Восстановленные подписки: ${recoveredSubs.length}`);

    let recoveredIssues = 0;
    for (const sub of recoveredSubs) {
        const months = sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1);
        const endDate = new Date(sub.startDate);
        endDate.setMonth(endDate.getMonth() + months);
        const shouldBeCompleted = endDate <= now;
        
        if (sub.status === 'active' && shouldBeCompleted) {
            recoveredIssues++;
            console.log(`   ⚠️ #${sub.id} ${sub.email} type=${sub.type} status=${sub.status} expired=${endDate.toLocaleDateString('ru')} — должна быть completed`);
        }
    }
    if (recoveredIssues === 0 && recoveredSubs.length > 0) {
        console.log('   ✅ Все восстановленные подписки выглядят корректно');
    }

    // 6. Stats summary comparison
    console.log('\n' + '─'.repeat(60));
    console.log('📈 СВОДКА ДЛЯ СТАТИСТИКИ:');
    console.log('─'.repeat(60));
    console.log(`  Всего уникальных пользователей (по ключам): ${keyEmailSet.size}`);
    console.log(`  Всего подписок в БД: ${totalSubs}`);
    console.log(`  Всего активаций (used keys): ${usedKeys}`);
    console.log(`  Всего ACTIVATION в логах: ${activationLogs}`);
    console.log(`  Разница (ключи - логи): ${usedKeys - activationLogs} (ожидаемо если логи были потеряны)`);

    // 7. Show subscriptions with wrong status based on key dates
    console.log('\n' + '─'.repeat(60));
    console.log('🕐 ПРОВЕРКА СТАТУСОВ:');
    console.log('─'.repeat(60));
    let wrongStatus = 0;
    for (const sub of subsWithKeys) {
        const months = sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1);
        const startDate = new Date(sub.startDate);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + months);
        
        // Active but expired by date
        if (sub.status === 'active' && endDate <= now) {
            wrongStatus++;
            console.log(`  ⏰ #${sub.id} ${sub.email} status=active но истекла ${endDate.toLocaleDateString('ru-RU')} (${sub.type})`);
        }
    }
    if (wrongStatus === 0) console.log('  ✅ Все статусы корректны по датам');

    await prisma.$disconnect();
}

main().catch(e => {
    console.error('Error:', e);
    process.exit(1);
});
