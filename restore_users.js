
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

const BACKUP_PATH = './prisma/dev.db.bak';
const CURRENT_DB_PATH = './prisma/dev.db';

if (!fs.existsSync(BACKUP_PATH)) {
    console.error(`❌ Файл бэкапа не найден: ${BACKUP_PATH}`);
    console.error('Пожалуйста, положите файл dev.db.bak в папку prisma/');
    process.exit(1);
}

const dbBackup = new sqlite3.Database(BACKUP_PATH, sqlite3.OPEN_READONLY);
const dbCurrent = new sqlite3.Database(CURRENT_DB_PATH);

async function getAll(db, query) {
    return new Promise((resolve, reject) => {
        db.all(query, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function run(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function restore() {
    console.log('🚀 Начинаем восстановление пользователей...');

    try {
        // 1. Check table name in backup (Subscription vs subscriptions)
        let tableName = 'subscriptions';
        try {
            await getAll(dbBackup, 'SELECT count(*) FROM subscriptions');
        } catch (e) {
            console.log('⚠️ Таблица subscriptions не найдена в бэкапе, ищем Subscription...');
            try {
                await getAll(dbBackup, 'SELECT count(*) FROM Subscription');
                tableName = 'Subscription';
            } catch (e2) {
                console.error('❌ Таблица подписок не найдена в бэкапе!');
                return;
            }
        }
        console.log(`✅ Нашли таблицу: ${tableName}`);

        // 2. Read Users (Subscriptions)
        const users = await getAll(dbBackup, `SELECT * FROM ${tableName}`);
        console.log(`📦 Найдено пользователей в бэкапе: ${users.length}`);

        // 3. Read Sessions (Optional but good for login)
        let sessions = [];
        try {
            sessions = await getAll(dbBackup, 'SELECT * FROM sessions');
            console.log(`📦 Найдено сессий в бэкапе: ${sessions.length}`);
        } catch (e) {
            console.log('⚠️ Таблица sessions не найдена в бэкапе (не критично)');
        }

        // 4. Restore Users
        let restoredCount = 0;
        for (const user of users) {
            // Check if exists
            const existing = await getAll(dbCurrent, `SELECT id FROM subscriptions WHERE email = '${user.email}'`);
            if (existing.length > 0) {
                console.log(`⏭️ Пользователь ${user.email} уже существует, пропускаем.`);
                continue;
            }

            // Insert
            // Map fields manually to handle schema changes
            const lifetimeActivations = user.lifetimeActivations || 0;
            const note = user.note || null;
            
            // Handle date formats if needed (sqlite stores strings/numbers)
            // Assuming direct copy is fine for sqlite->sqlite
            
            try {
                await run(dbCurrent, `
                    INSERT INTO subscriptions (
                        email, type, status, startDate, activationsCount, 
                        lifetimeActivations, nextActivationDate, note, createdAt, updatedAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    user.email,
                    user.type,
                    user.status,
                    user.startDate,
                    user.activationsCount,
                    lifetimeActivations, // New field default
                    user.nextActivationDate,
                    note, // New field default
                    user.createdAt,
                    user.updatedAt || user.createdAt // Fallback
                ]);
                restoredCount++;
            } catch (err) {
                console.error(`❌ Ошибка при восстановлении ${user.email}:`, err.message);
            }
        }

        // 5. Restore Sessions
        let restoredSessions = 0;
        for (const session of sessions) {
             const existing = await getAll(dbCurrent, `SELECT id FROM sessions WHERE email = '${session.email}'`);
             if (existing.length > 0) continue;

             try {
                await run(dbCurrent, `
                    INSERT INTO sessions (email, sessionJson, expiresAt, telegramId, createdAt)
                    VALUES (?, ?, ?, ?, ?)
                `, [session.email, session.sessionJson, session.expiresAt, session.telegramId, session.createdAt]);
                restoredSessions++;
             } catch (err) {
                 console.error(`❌ Ошибка сессии ${session.email}:`, err.message);
             }
        }

        console.log('------------------------------------------------');
        console.log(`🎉 Восстановление завершено!`);
        console.log(`👤 Восстановлено пользователей: ${restoredCount}`);
        console.log(`🔑 Восстановлено сессий: ${restoredSessions}`);

    } catch (e) {
        console.error('CRITICAL ERROR:', e);
    } finally {
        dbBackup.close();
        dbCurrent.close();
    }
}

restore();
