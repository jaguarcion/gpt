import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_TOKEN = process.env.API_TOKEN;
const API_URL = `http://127.0.0.1:${process.env.PORT || 3001}/api/sessions/activate`;

// Parse allowed users from .env (comma-separated IDs)
const ALLOWED_USERS = (process.env.ALLOWED_TELEGRAM_USERS || '')
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0)
    .map(Number); // Convert to numbers for comparison

if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    console.error('FATAL ERROR: TELEGRAM_BOT_TOKEN is not defined in .env');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Middleware to check authorization
bot.use((ctx, next) => {
    if (!ctx.from) return next();

    const userId = ctx.from.id;

    // If ALLOWED_USERS is empty, allow everyone (or restrict if you prefer secure-by-default)
    // Here we assume if the variable is set, we restrict. If not set, we might warn or allow all.
    // Let's implement Strict Mode: if variable exists but user not in it -> deny.

    if (ALLOWED_USERS.length > 0 && !ALLOWED_USERS.includes(userId)) {
        console.log(`Unauthorized access attempt from user: ${userId} (${ctx.from.username})`);
        return ctx.reply('⛔ У вас нет доступа к этому боту.');
    }

    return next();
});

// State management
// Map<userId, { step: 'WAITING_SESSION' | 'WAITING_EMAIL' | 'SELECT_PLAN', sessionJson: string, email: string }>
const userStates = new Map();

// Buffer for multi-message JSON input (Telegram splits messages over ~4096 chars)
// Map<userId, { chunks: string[], timer: NodeJS.Timeout, notifiedBuffering: boolean }>
const jsonBuffers = new Map();

const JSON_BUFFER_TIMEOUT_MS = 15000; // 15 seconds to wait for more parts
const JSON_NOTIFY_DELAY_MS = 3000;  // 3 seconds before showing "waiting for parts" message

function clearJsonBuffer(userId) {
    const buf = jsonBuffers.get(userId);
    if (buf?.notifyTimer) clearTimeout(buf.notifyTimer);
    if (buf?.timer) clearTimeout(buf.timer);
    jsonBuffers.delete(userId);
}

function cleanJsonText(text) {
    let clean = text.replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();
    if (clean.startsWith('`') && clean.endsWith('`')) {
        clean = clean.slice(1, -1);
    }
    return clean;
}

bot.start((ctx) => {
    clearJsonBuffer(ctx.from.id);
    userStates.delete(ctx.from.id);
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('1 месяц', 'plan_1m')],
        [Markup.button.callback('2 месяца', 'plan_2m')],
        [Markup.button.callback('3 месяца', 'plan_3m')]
    ]);
    ctx.reply('Выберите тип подписки:', { parse_mode: 'Markdown', ...keyboard });
});

bot.command('cancel', (ctx) => {
    clearJsonBuffer(ctx.from.id);
    userStates.delete(ctx.from.id);
    ctx.reply('Операция отменена. Нажмите /start чтобы начать заново.');
});

bot.action('plan_1m', (ctx) => {
    userStates.set(ctx.from.id, { step: 'WAITING_SESSION', type: '1m' });
    ctx.reply('Вы выбрали: *1 месяц*.\n\nТеперь отправьте *JSON сессии*.', { parse_mode: 'Markdown' });
    ctx.answerCbQuery();
});

bot.action('plan_2m', (ctx) => {
    userStates.set(ctx.from.id, { step: 'WAITING_SESSION', type: '2m' });
    ctx.reply('Вы выбрали: *2 месяца*.\n\nБот будет активировать по 1 ключу каждый месяц).\n\nТеперь отправьте *JSON сессии*.', { parse_mode: 'Markdown' });
    ctx.answerCbQuery();
});

bot.action('plan_3m', (ctx) => {
    userStates.set(ctx.from.id, { step: 'WAITING_SESSION', type: '3m' });
    ctx.reply('Вы выбрали: *3 месяца*.\n\n(Бот будет активировать по 1 ключу каждый месяц).\n\nТеперь отправьте *JSON сессии*.', { parse_mode: 'Markdown' });
    ctx.answerCbQuery();
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const currentState = userStates.get(userId);

    if (!currentState) {
        return ctx.reply('Нажмите /start чтобы начать.');
    }

    if (currentState.step === 'WAITING_SESSION') {
        const cleanText = cleanJsonText(text);

        // Try parsing the single message first
        let sessionData;
        let finalJsonString = cleanText; // Will be overwritten if buffer is used
        try {
            sessionData = JSON.parse(cleanText);
        } catch (e) {
            // Single message is not valid JSON — start or append to buffer
            const existing = jsonBuffers.get(userId);

            if (existing) {
                // Append to existing buffer
                existing.chunks.push(cleanText);
                clearTimeout(existing.timer);
            } else {
                // Start a new buffer
                jsonBuffers.set(userId, { chunks: [cleanText], timer: null, notifyTimer: null });
            }

            const buf = jsonBuffers.get(userId);

            // Try to parse the combined buffer
            const combined = buf.chunks.join('');
            try {
                sessionData = JSON.parse(combined);
                finalJsonString = combined; // Use the full combined JSON
                // Success! Combined text is valid JSON — clear buffer and proceed
                clearJsonBuffer(userId);
                // Fall through to the processing below
            } catch (e2) {
                // Still not valid — set a delayed notification (only if not already scheduled)
                if (!buf.notifyTimer) {
                    buf.notifyTimer = setTimeout(() => {
                        const currentBuf = jsonBuffers.get(userId);
                        if (currentBuf) {
                            ctx.reply(`📥 Получено ${currentBuf.chunks.length} ${currentBuf.chunks.length === 1 ? 'часть' : 'части'} JSON. Жду остальные части... (таймаут: ${JSON_BUFFER_TIMEOUT_MS / 1000} сек)`);
                        }
                    }, JSON_NOTIFY_DELAY_MS);
                }

                // Reset the main timeout — if no more messages come, report error
                if (buf.timer) clearTimeout(buf.timer);
                buf.timer = setTimeout(() => {
                    const finalBuf = jsonBuffers.get(userId);
                    if (finalBuf) {
                        const finalCombined = finalBuf.chunks.join('');
                        try {
                            JSON.parse(finalCombined);
                        } catch (e3) {
                            ctx.reply(`❌ Не удалось собрать валидный JSON из ${finalBuf.chunks.length} частей. Пожалуйста, проверьте формат и отправьте снова, или нажмите /cancel для отмены.`);
                        }
                        clearJsonBuffer(userId);
                    }
                }, JSON_BUFFER_TIMEOUT_MS);

                return; // Wait for more messages
            }
        }

        // Try to find email in session user object or top level
        let email = sessionData.email || sessionData.user?.email;

        if (!email) {
            // Ask for email manually if not found
            currentState.sessionJson = finalJsonString;
            currentState.step = 'WAITING_EMAIL';
            userStates.set(userId, currentState);
            return ctx.reply('Не удалось найти email в JSON сессии.\n\nПожалуйста, отправьте *email* аккаунта отдельным сообщением:', { parse_mode: 'Markdown' });
        }

        // Proceed to activation
        await performActivation(ctx, email, finalJsonString, currentState.type);
    } else if (currentState.step === 'WAITING_EMAIL') {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(text)) {
            return ctx.reply('Это не похоже на валидный email. Проверьте формат (example@mail.com) и попробуйте еще раз.');
        }
        await performActivation(ctx, text.toLowerCase().trim(), currentState.sessionJson, currentState.type);
    }
});

async function performActivation(ctx, email, sessionJson, type) {
    const userId = ctx.from.id;
    const initialMsg = await ctx.reply(`Данные получены (${type}, ${email}).\n\nНачинаю активацию... ⏳`);

    let isFinished = false;

    // Simulated progress steps
    const progressSteps = [
        { delay: 2000, text: 'Проверяю доступность ключа... 🔎' },
        { delay: 5000, text: 'Ключ найден. Отправляю запрос на активацию... 🚀' },
        { delay: 10000, text: 'Запрос отправлен. Ожидаю подтверждения от сервера... 🔄' },
        { delay: 20000, text: 'Всё еще ожидаю подтверждения (это может занять время)... 🕒' }
    ];

    // Start progress simulation loop
    (async () => {
        for (const step of progressSteps) {
            await new Promise(r => setTimeout(r, step.delay));
            if (isFinished) break;
            try {
                // Check if isFinished became true during await
                if (!isFinished) {
                    await ctx.telegram.editMessageText(
                        initialMsg.chat.id,
                        initialMsg.message_id,
                        undefined,
                        `Данные получены (${type}, ${email}).\n${step.text}`
                    );
                }
            } catch (e) {
                // Ignore edit errors (e.g. message not modified or user blocked)
            }
        }
    })();

    try {
        const response = await axios.post(API_URL, {
            email,
            sessionJson,
            subscriptionType: type,
            telegramId: userId
        }, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        isFinished = true;
        const result = response.data; // { subscription, activationResult }

        if (result.activationResult && result.activationResult.success) {
            const taskId = result.activationResult.data?.task_id || 'N/A';
            let msg = `Данные получены (${type}, ${email}).\n\n✅ Успешно активировано!\n\nВыберите срок новой активации.`;

            if (type === '3m') {
                msg += `\n\n📅 Это первая активация из 3-х. Следующая активация запланирована автоматически через 30 дней.`;
            } else if (type === '2m') {
                msg += `\n\n📅 Это первая активация из 2-х. Следующая активация запланирована автоматически через 30 дней.`;
            }

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('1 месяц', 'plan_1m')],
                [Markup.button.callback('2 месяца', 'plan_2m')],
                [Markup.button.callback('3 месяца', 'plan_3m')]
            ]);

            await ctx.telegram.editMessageText(initialMsg.chat.id, initialMsg.message_id, undefined, msg, { ...keyboard });
        } else {
            const errorText = result.activationResult?.message || 'Неизвестная ошибка';
            let failMsg = `Данные получены (${type}, ${email}).\n\n❌ Ошибка активации: ${errorText}`;
            failMsg += `\n\nНажмите /start для новой активации.`;
            await ctx.telegram.editMessageText(initialMsg.chat.id, initialMsg.message_id, undefined, failMsg);
        }

    } catch (error) {
        isFinished = true;
        console.error('Bot Activation Error:', error.message);
        let errorMsg = 'Произошла ошибка при обращении к серверу.';
        if (error.response?.data?.message) {
            errorMsg += `\n\nДетали: ${error.response.data.message}`;
        } else if (error.response?.data?.error) {
            errorMsg += `\n\nДетали: ${error.response.data.error}`;
        } else if (typeof error.response?.data === 'string') {
            // Handle HTML or raw string errors
            errorMsg += `\n\nОтвет сервера: ${error.response.data.substring(0, 200)}...`;
        }
        let failMsg = `Данные получены (${type}, ${email}).\n\n❌ Ошибка: ${errorMsg}`;
        failMsg += `\n\nНажмите /start для новой активации.`;
        await ctx.telegram.editMessageText(initialMsg.chat.id, initialMsg.message_id, undefined, failMsg);
    } finally {
        isFinished = true; // Ensure loop stops
        clearJsonBuffer(userId);
        userStates.delete(userId);
        // ctx.reply('Нажмите /start для новой активации.');
    }
}

bot.action('cancel', (ctx) => {
    clearJsonBuffer(ctx.from.id);
    userStates.delete(ctx.from.id);
    ctx.reply('Операция отменена.');
    ctx.answerCbQuery();
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

bot.launch().then(() => {
    console.log('Telegram Bot started!');
});
