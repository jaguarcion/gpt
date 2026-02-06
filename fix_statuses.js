
import sqlite3 from 'sqlite3';

const CURRENT_DB_PATH = './prisma/dev.db';
const db = new sqlite3.Database(CURRENT_DB_PATH);

async function run(query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function getAll(query) {
    return new Promise((resolve, reject) => {
        db.all(query, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function fixStatuses() {
    console.log('🚀 Начинаем обновление статусов...');

    try {
        const now = new Date();
        
        // Получаем всех пользователей со статусом 'completed'
        const users = await getAll("SELECT * FROM subscriptions WHERE status = 'completed'");
        console.log(`📦 Найдено пользователей со статусом 'completed': ${users.length}`);

        let updatedCount = 0;

        for (const user of users) {
            // Логика определения активности
            // Если дата окончания > сейчас -> active
            
            const startDate = new Date(user.startDate);
            const months = user.type === '3m' ? 3 : (user.type === '2m' ? 2 : 1);
            
            // Расчет даты окончания
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + months);
            
            // Проверяем
            if (endDate > now) {
                // Если подписка еще не истекла, делаем активной
                
                // Проверка на количество активаций для многомесячных
                // Если 3 месяца, но активаций 3 -> значит завершена (если прошло 3 месяца, но тут мы проверяем endDate)
                // Если активаций 3, но срок не вышел (например активировал 3 раза за день) -> все равно active до конца срока?
                // Нет, активация происходит раз в месяц.
                // Если activationsCount >= maxRounds, и last activation date была давно...
                // Но проще всего: если срок не вышел -> active.
                
                // Однако, есть кейс когда все активации исчерпаны.
                // Но у нас модель такая: 3 месяца = 3 активации, растянутые по времени.
                // Если activationsCount == 3, но endDate > now -> значит пользователь получил последнюю активацию и пользуется ей.
                // Значит он 'active' до конца периода.
                
                await run("UPDATE subscriptions SET status = 'active' WHERE id = ?", [user.id]);
                console.log(`✅ [${user.email}] Обновлен статус на 'active' (Истекает: ${endDate.toISOString().split('T')[0]})`);
                updatedCount++;
            } else {
                // Истек, оставляем completed
                // console.log(`Skipping ${user.email} - expired at ${endDate.toISOString()}`);
            }
        }

        console.log('------------------------------------------------');
        console.log(`🎉 Обновление завершено!`);
        console.log(`🔄 Обновлено статусов: ${updatedCount}`);

    } catch (e) {
        console.error('CRITICAL ERROR:', e);
    } finally {
        db.close();
    }
}

fixStatuses();
