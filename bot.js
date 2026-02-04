import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_TOKEN = process.env.API_TOKEN;
const API_URL = `http://localhost:${process.env.PORT || 3001}/api/sessions/activate`;

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

bot.start((ctx) => {
    userStates.delete(ctx.from.id);
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('1 месяц', 'plan_1m')],
        [Markup.button.callback('3 месяца', 'plan_3m')]
    ]);
    ctx.reply('Выберите тип подписки:', { parse_mode: 'Markdown', ...keyboard });
});

bot.command('cancel', (ctx) => {
    userStates.delete(ctx.from.id);
    ctx.reply('Операция отменена. Нажмите /start чтобы начать заново.');
});

bot.action('plan_1m', (ctx) => {
    userStates.set(ctx.from.id, { step: 'WAITING_SESSION', type: '1m' });
    ctx.reply('Вы выбрали: *1 месяц*.\n\nТеперь отправьте *JSON сессии*.', { parse_mode: 'Markdown' });
    ctx.answerCbQuery();
});

bot.action('plan_3m', (ctx) => {
    userStates.set(ctx.from.id, { step: 'WAITING_SESSION', type: '3m' });
    ctx.reply('Вы выбрали: *3 месяца*.\n(Бот будет активировать по 1 ключу каждый месяц).\n\nТеперь отправьте *JSON сессии*.', { parse_mode: 'Markdown' });
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
        // Remove markdown code blocks if present
        let cleanText = text.replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();
        // Also remove inline code blocks if wrapped in single backticks
        if (cleanText.startsWith('`') && cleanText.endsWith('`')) {
            cleanText = cleanText.slice(1, -1);
        }
        
        // Validate JSON and extract email
        let sessionData;
        try {
            sessionData = JSON.parse(cleanText);
        } catch (e) {
            return ctx.reply('Это не похоже на валидный JSON. Пожалуйста, проверьте формат и отправьте снова, или нажмите /cancel для отмены.');
        }

        // Try to find email in session user object or top level
        let email = sessionData.email || sessionData.user?.email;
        
        if (!email) {
            // Ask for email manually if not found
            currentState.sessionJson = cleanText;
            currentState.step = 'WAITING_EMAIL';
            userStates.set(userId, currentState);
            return ctx.reply('Не удалось найти email в JSON сессии.\n\nПожалуйста, отправьте *email* аккаунта отдельным сообщением:', { parse_mode: 'Markdown' });
        }

        // Proceed to activation
        await performActivation(ctx, email, cleanText, currentState.type);
    } else if (currentState.step === 'WAITING_EMAIL') {
        // Validate email format simple
        if (!text.includes('@')) {
            return ctx.reply('Это не похоже на валидный email. Попробуйте еще раз.');
        }
        await performActivation(ctx, text, currentState.sessionJson, currentState.type);
    }
});

async function performActivation(ctx, email, sessionJson, type) {
    const userId = ctx.from.id;
    const initialMsg = await ctx.reply(`Данные получены (${type}, ${email}).\nНачинаю активацию... ⏳`);

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
                        `Данные получены (${type}, ${email}).\n${step.text}`, 
                        { parse_mode: 'Markdown' }
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
            let msg = `Данные получены (${type}, ${email}).\n✅ *Успешно активировано!*`;
            
            if (type === '3m') {
                msg += `\n\n📅 Это первая активация из 3-х. Следующая активация запланирована автоматически через 30 дней.`;
            }

            msg += `\n\nНажмите /start для новой активации.`;
            
            await ctx.telegram.editMessageText(initialMsg.chat.id, initialMsg.message_id, undefined, msg, { parse_mode: 'Markdown' });
        } else {
             const errorText = result.activationResult?.message || 'Неизвестная ошибка';
             let failMsg = `Данные получены (${type}, ${email}).\n❌ *Ошибка активации*: ${errorText}`;
             failMsg += `\n\nНажмите /start для новой активации.`;
            await ctx.telegram.editMessageText(initialMsg.chat.id, initialMsg.message_id, undefined, failMsg, { parse_mode: 'Markdown' });
        }

    } catch (error) {
        isFinished = true;
        console.error('Bot Activation Error:', error.message);
        let errorMsg = 'Произошла ошибка при обращении к серверу.';
        if (error.response?.data?.message) {
            errorMsg += `\nДетали: ${error.response.data.message}`;
        } else if (error.response?.data?.error) {
            errorMsg += `\nДетали: ${error.response.data.error}`;
        }
        let failMsg = `Данные получены (${type}, ${email}).\n❌ *Ошибка*: ${errorMsg}`;
        failMsg += `\n\nНажмите /start для новой активации.`;
        await ctx.telegram.editMessageText(initialMsg.chat.id, initialMsg.message_id, undefined, failMsg, { parse_mode: 'Markdown' });
    } finally {
        isFinished = true; // Ensure loop stops
        userStates.delete(userId);
        // ctx.reply('Нажмите /start для новой активации.');
    }
}

bot.action('cancel', (ctx) => {
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
