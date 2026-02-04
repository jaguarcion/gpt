import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_TOKEN = process.env.API_TOKEN;
const API_URL = `http://localhost:${process.env.PORT || 3001}/api/activate-key`;

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

// State management (in-memory for simplicity)
// Map<userId, { step: 'WAITING_KEY' | 'WAITING_SESSION', cdk: string }>
const userStates = new Map();

bot.start((ctx) => {
    userStates.delete(ctx.from.id);
    ctx.reply('Пожалуйста, отправьте мне ваш *CDK-ключ* для начала.', { parse_mode: 'Markdown' });
});

bot.command('cancel', (ctx) => {
    userStates.delete(ctx.from.id);
    ctx.reply('Операция отменена. Отправьте новый CDK-ключ для начала.');
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const currentState = userStates.get(userId) || { step: 'WAITING_KEY' };

    // STEP 1: Handle CDK Key
    if (currentState.step === 'WAITING_KEY') {
        // Simple validation: check if it looks like a key (not empty, maybe check length if needed)
        if (text.length < 5) {
            return ctx.reply('Слишком короткий ключ. Пожалуйста, проверьте и отправьте снова.');
        }

        userStates.set(userId, { step: 'WAITING_SESSION', cdk: text });
        return ctx.reply(
            `Ключ принят: \`${text}\`\n\nТеперь отправьте *JSON сессии*.`, 
            { parse_mode: 'Markdown', ...Markup.inlineKeyboard([Markup.button.callback('Отмена', 'cancel')]) }
        );
    }

    // STEP 2: Handle Session JSON
    if (currentState.step === 'WAITING_SESSION') {
        // Validate JSON
        let sessionData;
        try {
            sessionData = JSON.parse(text);
        } catch (e) {
            return ctx.reply('Это не похоже на валидный JSON. Пожалуйста, проверьте формат и отправьте снова, или нажмите /cancel для отмены.');
        }

        const cdkKey = currentState.cdk;
        
        ctx.reply('Данные получены. Активация может занять до 30 секунд. ⏳');

        try {
            // Call local API
            const response = await axios.post(API_URL, {
                cdk: cdkKey,
                sessionJson: text // Send as string/object based on what API expects (server handles both)
            }, {
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = response.data;

            if (result.success) {
                ctx.reply(`✅ *Успешно активировано!*\n\nTask ID: \`${result.data.task_id}\``, { parse_mode: 'Markdown' });
            } else {
                ctx.reply(`❌ *Ошибка активации*\n\n${result.message}`, { parse_mode: 'Markdown' });
            }

        } catch (error) {
            console.error('Bot Activation Error:', error.message);
            let errorMsg = 'Произошла ошибка при обращении к серверу активации.';
            
            if (error.response) {
                errorMsg += `\nДетали: ${error.response.data?.message || error.message}`;
            }

            ctx.reply(`❌ *Ошибка*\n\n${errorMsg}`, { parse_mode: 'Markdown' });
        } finally {
            // Reset state
            userStates.delete(userId);
            ctx.reply('Отправьте новый CDK-ключ для следующей активации.');
        }
    }
});

bot.action('cancel', (ctx) => {
    userStates.delete(ctx.from.id);
    ctx.reply('Операция отменена. Отправьте новый CDK-ключ для начала.');
    ctx.answerCbQuery();
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

bot.launch().then(() => {
    console.log('Telegram Bot started!');
});
