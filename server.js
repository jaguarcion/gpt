import express from 'express';
import cors from 'cors';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';
import os from 'os';
import crypto from 'crypto';

dotenv.config();

// Add BigInt serialization support (safe — only adds toJSON, doesn't change behavior)
if (!BigInt.prototype.toJSON) {
    Object.defineProperty(BigInt.prototype, 'toJSON', {
        value: function() { return this.toString(); },
        writable: false,
        configurable: false
    });
}

const app = express();
app.set('trust proxy', 1); // Trust Nginx proxy
app.use(helmet()); // Set secure HTTP headers

// HTTPS redirect (when behind reverse proxy)
app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
});
const PORT = process.env.PORT || 3001;
const API_TOKEN = process.env.API_TOKEN;

if (!API_TOKEN) {
    console.error('FATAL ERROR: API_TOKEN is not defined in .env');
    process.exit(1);
}

// ===================== RATE LIMIT TRACKING =====================
const rateLimitTracker = {
    requests: new Map(),    // IP -> { count, firstSeen, lastSeen, paths: Map<path, count> }
    blocked: [],            // Array of { ip, time, path }
    totalRequests: 0,
    totalBlocked: 0,
    startTime: Date.now(),

    track(ip, path) {
        this.totalRequests++;
        if (!this.requests.has(ip)) {
            this.requests.set(ip, { count: 0, firstSeen: Date.now(), lastSeen: Date.now(), paths: new Map() });
        }
        const entry = this.requests.get(ip);
        entry.count++;
        entry.lastSeen = Date.now();
        entry.paths.set(path, (entry.paths.get(path) || 0) + 1);
    },

    trackBlocked(ip, path) {
        this.totalBlocked++;
        this.blocked.push({ ip, time: Date.now(), path });
        // Keep only last 100 blocks
        if (this.blocked.length > 100) this.blocked = this.blocked.slice(-100);
    },

    getStats() {
        const now = Date.now();
        const uptimeMs = now - this.startTime;

        // Top IPs by request count
        const topIPs = Array.from(this.requests.entries())
            .map(([ip, data]) => ({
                ip,
                count: data.count,
                firstSeen: new Date(data.firstSeen).toISOString(),
                lastSeen: new Date(data.lastSeen).toISOString(),
                topPaths: Array.from(data.paths.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([path, count]) => ({ path, count }))
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);

        // Requests per minute (approximate)
        const rpm = uptimeMs > 0 ? Math.round((this.totalRequests / (uptimeMs / 60000)) * 100) / 100 : 0;

        // Recent blocks
        const recentBlocks = this.blocked
            .slice(-20)
            .reverse()
            .map(b => ({ ...b, time: new Date(b.time).toISOString() }));

        return {
            totalRequests: this.totalRequests,
            totalBlocked: this.totalBlocked,
            uniqueIPs: this.requests.size,
            requestsPerMinute: rpm,
            uptimeMinutes: Math.round(uptimeMs / 60000),
            topIPs,
            recentBlocks,
            config: {
                windowMs: 15 * 60 * 1000,
                maxRequests: 1000
            }
        };
    },

    // Cleanup old entries every hour
    cleanup() {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        for (const [ip, data] of this.requests.entries()) {
            if (data.lastSeen < oneHourAgo) {
                this.requests.delete(ip);
            }
        }
    }
};

// Cleanup old tracking data every hour
setInterval(() => rateLimitTracker.cleanup(), 60 * 60 * 1000);

// Request tracking middleware (before rate limiter)
app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    rateLimitTracker.track(String(ip).split(',')[0].trim(), req.path);
    next();
});

// Security: Rate Limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: { error: 'Too many requests, please try again later.' },
    handler: (req, res) => {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        rateLimitTracker.trackBlocked(String(ip).split(',')[0].trim(), req.path);
        res.status(429).json({ error: 'Too many requests, please try again later.' });
    }
});

// Security: CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests without Origin only from localhost (server-to-server, bot, cron)
        if (!origin) {
            // Allow internal requests (bot, scheduler, health checks)
            return callback(null, true);
        }
        if (allowedOrigins.length > 0 && allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));

app.use(express.json({ limit: '1mb' }));

// Apply rate limiting to all requests
app.use(limiter);

// Strict rate limit for activation endpoints only (brute-force protection)
// NOT applied to /api/keys or /api/subscriptions — admin panel makes many requests per page load
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10,
    message: { error: 'Too many auth attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
// Only protect the activation endpoint (external-facing, most sensitive)
app.use('/api/sessions/activate', authLimiter);

const BASE_URL = 'https://freespaces.gmailshop.top';

// Utility to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Auth Middleware (timing-safe token comparison)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.status(401).json({ error: 'Unauthorized: Missing token' });
    
    // Timing-safe comparison to prevent timing attacks
    const tokenBuf = Buffer.from(token);
    const apiTokenBuf = Buffer.from(API_TOKEN);
    if (tokenBuf.length !== apiTokenBuf.length || !crypto.timingSafeEqual(tokenBuf, apiTokenBuf)) {
        return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }

    next();
};

// Request Logger Middleware
const requestLogger = (req, res, next) => {
    if (req.path.includes('/activate')) {
        try {
            const timestamp = new Date().toISOString();
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            let email = 'unknown';
            try {
                email = req.body.email || (req.body.user ? JSON.parse(req.body.user).email : 'unknown');
            } catch (e) {
                email = req.body.email || 'parse-error';
            }
            console.log(`[REQ] ${timestamp} ${req.method} ${req.path} from ${ip} - Email: ${email}`);
        } catch (e) {
            // Never let logger crash the server
            console.error('[REQ Logger Error]', e.message);
        }
    }
    next();
};

app.use(requestLogger);

import prisma from './services/db.js';
import { KeyService } from './services/keyService.js';
import { SessionService } from './services/sessionService.js';
import { LogService } from './services/logService.js';
import { SubscriptionService } from './services/subscriptionService.js';

// ... (existing imports and config)

import fs from 'fs';
import path from 'path';

// ... (existing endpoints)

app.get('/api/backups', authenticateToken, async (req, res) => {
    try {
        const backupDir = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(backupDir)) {
            return res.json([]);
        }
        
        const files = fs.readdirSync(backupDir)
            .filter(file => file.endsWith('.db'))
            .map(file => {
                const stats = fs.statSync(path.join(backupDir, file));
                return {
                    name: file,
                    size: stats.size,
                    created: stats.mtime
                };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created));
            
        res.json(files);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/backups', authenticateToken, async (req, res) => {
    try {
        // Trigger manual backup via existing logic in backup_service
        // Since backup_service runs on import, we can't easily call its internal function directly without refactoring.
        // For now, let's implement a simple manual copy here or refactor backup_service to export the function.
        // Let's do a simple copy here to avoid complex refactoring in this step.
        
        const backupDir = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
        
        const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `manual_backup_${timestamp}.db`;
        
        fs.copyFileSync(dbPath, path.join(backupDir, backupName));
        
        await LogService.log('BACKUP', `Manual backup created: ${backupName}`);
        await LogService.log('AUDIT', `Admin created backup: ${backupName}`);
        
        res.json({ success: true, name: backupName });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/backups/:filename', authenticateToken, async (req, res) => {
    try {
        const { filename } = req.params;
        // Sanitize: strip any path separators from filename
        const safeName = path.basename(filename);
        const backupDir = path.resolve(process.cwd(), 'backups');
        const filePath = path.resolve(backupDir, safeName);
        
        // Security check: ensure resolved path is within backup directory
        if (!filePath.startsWith(backupDir + path.sep) && filePath !== backupDir) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        res.download(filePath);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/backups/:filename', authenticateToken, async (req, res) => {
    try {
        const { filename } = req.params;
        const safeName = path.basename(filename);
        const backupDir = path.resolve(process.cwd(), 'backups');
        const filePath = path.resolve(backupDir, safeName);
        
        if (!filePath.startsWith(backupDir + path.sep) && filePath !== backupDir) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            await LogService.log('BACKUP', `Backup deleted: ${filename}`);
            await LogService.log('AUDIT', `Admin deleted backup: ${filename}`);
        }
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/logs', authenticateToken, async (req, res) => {
    try {
        const { limit, type, search } = req.query;
        const logs = await LogService.getLogs(limit || 50, type, search);
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/keys', authenticateToken, async (req, res) => {
    try {
        const { code, codes } = req.body;
        
        // Handle bulk upload
        if (codes && Array.isArray(codes)) {
            const result = await KeyService.addKeys(codes);
            await LogService.log('KEY_ADDED', `Added ${result.count} keys via bulk upload`);
            await LogService.log('AUDIT', `Admin added ${result.count} keys via bulk upload`);
            return res.json({ success: true, count: result.count });
        }

        // Handle single upload (legacy or simple)
        if (code) {
            const key = await KeyService.addKey(code);
            await LogService.log('KEY_ADDED', `Added single key: ${code}`);
            await LogService.log('AUDIT', `Admin added single key: ${code}`);
            return res.json(key);
        }
        
        return res.status(400).json({ error: 'Code or codes array required' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/keys', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status || 'all';

        const result = await KeyService.getAllKeys(page, limit, status);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/keys/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await KeyService.deleteKey(id);
        await LogService.log('AUDIT', `Admin deleted key #${id}`);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/keys/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await KeyService.getStats();
        res.json(stats);
    } catch (e) {
        console.error('Stats Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/inventory/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await KeyService.getInventoryStats();
        res.json(stats);
    } catch (e) {
        console.error('Inventory Stats Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/stats/daily', authenticateToken, async (req, res) => {
    try {
        const stats = await SubscriptionService.getStats();
        res.json(stats);
    } catch (e) {
        console.error('Stats Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/subscriptions', authenticateToken, async (req, res) => {
    try {
        const { telegramId, page, limit, search, status, type, expiring, dateFrom, dateTo, emailProvider, activationsMin, activationsMax } = req.query;
        
        if (telegramId) {
             const subscriptions = await SubscriptionService.getSubscriptionsByTelegramId(telegramId);
             return res.json({ subscriptions, total: subscriptions.length, totalPages: 1, currentPage: 1 });
        }

        const result = await SubscriptionService.getAllSubscriptions(
            parseInt(page) || 1, 
            parseInt(limit) || 20, 
            search || '',
            { 
                status: status || 'all',
                type: type || 'all',
                expiring: expiring === 'true',
                dateFrom,
                dateTo,
                emailProvider,
                activationsMin,
                activationsMax
            }
        );
        res.json(result);
    } catch (e) {
        console.error('Subscriptions Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/sessions/active', authenticateToken, async (req, res) => {
    try {
        const sessions = await SessionService.getActiveSessions();
        res.json(sessions);
    } catch (e) {
        console.error('Sessions Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/status', authenticateToken, async (req, res) => {
    try {
        const start = Date.now();
        // Check main page instead of specific API endpoint to avoid 404
        const response = await axios.get(`${BASE_URL}`, {
            timeout: 5000,
            headers: { 'x-product-id': 'chatgpt' } 
        });
        const duration = Date.now() - start;
        
        res.json({ 
            online: true, 
            latency: duration,
            message: 'API Online'
        });
    } catch (e) {
        console.error('API Status Check Error:', e.message);
        res.json({ 
            online: false, 
            latency: 0,
            message: e.message || 'API Unreachable'
        });
    }
});

// New Endpoint for Bot/Admin to create subscription and activate
app.post('/api/sessions/activate', authenticateToken, async (req, res) => {
    try {
        const { email, sessionJson, subscriptionType, telegramId } = req.body;
        
        if (!email || !sessionJson || !subscriptionType || !telegramId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await SubscriptionService.createSubscription(
            email, 
            subscriptionType, 
            telegramId, 
            sessionJson
        );

        res.json(result);

    } catch (e) {
        console.error('Subscription Error:', e.message);
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/subscriptions/:id/activate', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await SubscriptionService.manualActivate(id);
        await LogService.log('AUDIT', `Admin manually activated user #${id}`);
        res.json(result);
    } catch (e) {
        console.error('Manual Activation Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/subscriptions/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { email, type, endDate, status } = req.body;
        const result = await SubscriptionService.updateSubscription(id, { email, type, endDate, status });
        
        await LogService.log('USER_EDIT', `Updated user #${id}: ${JSON.stringify(req.body)}`);
        await LogService.log('AUDIT', `Admin updated user #${id} (${email})`);
        
        res.json(result);
    } catch (e) {
        console.error('Update User Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/subscriptions/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await SubscriptionService.deleteSubscription(id);
        await LogService.log('AUDIT', `Admin deleted user #${id}`);
        res.json({ success: true });
    } catch (e) {
        console.error('Delete User Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Legacy Endpoint (keep for backward compatibility or direct key usage)
app.post('/api/activate-key', authenticateToken, async (req, res) => {
// ... (existing implementation)
    const { cdk, sessionJson } = req.body;

    if (!cdk || !sessionJson) {
        return res.status(400).json({ error: 'Missing cdk or sessionJson' });
    }

    // Log the request
    console.log(`[${new Date().toISOString()}] Received activation request for key: ${cdk}`);

    try {
        // --- OPTIMIZATION: Skipped separate key check to save time. 
        // The activation request handles validation internally or returns error.
        /*
        // --- STEP 1: CHECK KEY ---
        console.log(`[${cdk}] Step 1: Checking key...`);
        const checkRes = await axios.post(`${BASE_URL}/api/cdks/public/check`, 
            { code: cdk },
            { headers: { 'x-product-id': 'chatgpt', 'Content-Type': 'application/json' } }
        );

        if (checkRes.data.used) {
            console.log(`[${cdk}] Key is already used.`);
            return res.status(400).json({ success: false, message: 'Key is already used' });
        }
        */

        // --- STEP 2: REQUEST ACTIVATION ---
        console.log(`[${cdk}] Step 1: Requesting activation...`);
        
        // Ensure sessionJson is a string (if passed as object, stringify it)
        // The API expects the 'user' field to be the JSON string of the session
        let sessionPayload = sessionJson;
        if (typeof sessionJson === 'object') {
            sessionPayload = JSON.stringify(sessionJson);
        } else {
             // Validate it's valid JSON if it's a string
             try {
                JSON.parse(sessionJson);
             } catch (e) {
                return res.status(400).json({ error: 'Invalid Session JSON format' });
             }
        }

        const activateRes = await axios.post(`${BASE_URL}/api/stocks/public/outstock`,
            { cdk: cdk, user: sessionPayload },
            { headers: { 'Content-Type': 'application/json' } }
        );

        const taskId = activateRes.data; // API returns UUID string directly
        if (!taskId || typeof taskId !== 'string') {
             console.error(`[${cdk}] Failed to get taskId. Response:`, activateRes.data);
             return res.status(500).json({ success: false, message: 'Failed to get activation Task ID' });
        }
        
        console.log(`[${cdk}] Task ID received: ${taskId}. Starting poll...`);

        // --- STEP 3: POLL STATUS ---
        let isPending = true;
        let attempts = 0;
        const maxAttempts = 120; // 2 minutes (120 * 1s)

        while (isPending && attempts < maxAttempts) {
            // Wait 1s instead of 2s for faster feedback
            await sleep(1000);
            attempts++;

            const statusRes = await axios.get(`${BASE_URL}/api/stocks/public/outstock/${taskId}`);
            const status = statusRes.data;

            console.log(`[${cdk}] Poll ${attempts}: pending=${status.pending}, success=${status.success}`);

            // If success is true, we can return early even if pending is true
            if (!status.pending || status.success === true) {
                isPending = false;
                if (status.success) {
                    console.log(`[${cdk}] Activation SUCCESS!`);
                    return res.json({ success: true, message: 'Successfully activated', data: status });
                } else {
                    console.log(`[${cdk}] Activation FAILED: ${status.message}`);
                    return res.status(400).json({ success: false, message: status.message || 'Activation failed', data: status });
                }
            }
        }

        if (isPending) {
            console.log(`[${cdk}] Timeout waiting for activation.`);
            return res.status(504).json({ success: false, message: 'Activation timed out' });
        }

    } catch (error) {
        console.error(`[${cdk}] Error:`, error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            return res.status(error.response.status).json({ 
                success: false, 
                message: error.response.data?.message || error.message,
                details: error.response.data 
            });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
});

import cron from 'node-cron';

// ... (existing imports)

// Schedule: Run every hour
cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running scheduled activations check...');
    await SubscriptionService.processScheduledActivations();
});

import './backup_service.js';

// ===================== NOTIFICATIONS =====================
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const notifications = [];
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // 1. Recent errors (last 24h)
        const allErrors = await LogService.getLogs(20, 'ERROR');
        const recentErrors = allErrors.filter(e => new Date(e.createdAt) > oneDayAgo);
        recentErrors.forEach(e => {
            notifications.push({
                id: `error-${e.id}`,
                type: 'error',
                title: 'Ошибка активации',
                message: e.details || 'Неизвестная ошибка',
                email: e.email,
                createdAt: e.createdAt
            });
        });

        // 2. Low key inventory
        const keyStats = await KeyService.getStats();
        if (keyStats.active === 0) {
            notifications.push({
                id: 'no-keys',
                type: 'error',
                title: 'Ключи закончились!',
                message: 'На складе 0 доступных ключей. Активации невозможны.',
                createdAt: now
            });
        } else if (keyStats.active < 10) {
            notifications.push({
                id: 'low-keys',
                type: 'warning',
                title: 'Мало ключей на складе',
                message: `Осталось ${keyStats.active} ключей. Рекомендуем пополнить запас.`,
                createdAt: now
            });
        }

        // 3. Backup recency check
        const backupDir = path.join(process.cwd(), 'backups');
        if (fs.existsSync(backupDir)) {
            const backupFiles = fs.readdirSync(backupDir)
                .filter(f => f.endsWith('.db'))
                .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime }))
                .sort((a, b) => b.time - a.time);

            if (backupFiles.length > 0) {
                const lastBackup = backupFiles[0];
                const hoursSinceBackup = (now - lastBackup.time) / (1000 * 60 * 60);
                if (hoursSinceBackup > 5) {
                    notifications.push({
                        id: 'backup-old',
                        type: 'warning',
                        title: 'Бэкап устарел',
                        message: `Последний бэкап создан ${Math.floor(hoursSinceBackup)} ч. назад (ожидается каждые 4 часа).`,
                        createdAt: lastBackup.time
                    });
                }
            } else {
                notifications.push({
                    id: 'no-backups',
                    type: 'warning',
                    title: 'Нет бэкапов',
                    message: 'Не найдено ни одного бэкапа базы данных.',
                    createdAt: now
                });
            }
        }

        // 4. Expiring subscriptions (within 3 days)
        const activeSubs = await prisma.subscription.findMany({ where: { status: 'active' } });
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        let expiringCount = 0;
        activeSubs.forEach(sub => {
            const start = new Date(sub.startDate);
            const monthsToAdd = sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1);
            const endDate = new Date(start);
            endDate.setMonth(endDate.getMonth() + monthsToAdd);
            if (endDate <= threeDaysFromNow && endDate >= now) {
                expiringCount++;
            }
        });
        if (expiringCount > 0) {
            notifications.push({
                id: 'expiring-subs',
                type: 'warning',
                title: 'Подписки истекают',
                message: `${expiringCount} подписок истекают в ближайшие 3 дня.`,
                createdAt: now
            });
        }

        // 5. Recent successful renewals (info)
        const allRenewals = await LogService.getLogs(5, 'RENEWAL');
        const recentRenewals = allRenewals.filter(r => new Date(r.createdAt) > oneDayAgo);
        recentRenewals.forEach(r => {
            notifications.push({
                id: `renewal-${r.id}`,
                type: 'success',
                title: 'Успешное продление',
                message: r.details || 'Подписка продлена',
                email: r.email,
                createdAt: r.createdAt
            });
        });

        notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(notifications);
    } catch (e) {
        console.error('Notifications Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ===================== HEALTH CHECK =====================
app.get('/api/health', authenticateToken, async (req, res) => {
    try {
        const now = new Date();

        // Server info
        const serverUptime = process.uptime();
        const mem = process.memoryUsage();
        const osMem = { total: os.totalmem(), free: os.freemem() };
        const nodeVersion = process.version;
        const platform = `${os.platform()} ${os.arch()} (${os.release()})`;

        // DB size
        const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
        let dbSize = 0;
        if (fs.existsSync(dbPath)) {
            dbSize = fs.statSync(dbPath).size;
        }

        // DB record counts
        const [keyCount, sessionCount, subCount, logCount] = await Promise.all([
            prisma.key.count(),
            prisma.session.count(),
            prisma.subscription.count(),
            prisma.activityLog.count()
        ]);

        // Backup info
        const backupDir = path.join(process.cwd(), 'backups');
        let backupInfo = { count: 0, totalSize: 0, lastBackup: null, lastBackupName: null };
        if (fs.existsSync(backupDir)) {
            const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'));
            let totalSize = 0;
            let lastTime = null;
            let lastName = null;
            files.forEach(f => {
                const stat = fs.statSync(path.join(backupDir, f));
                totalSize += stat.size;
                if (!lastTime || stat.mtime > lastTime) {
                    lastTime = stat.mtime;
                    lastName = f;
                }
            });
            backupInfo = { count: files.length, totalSize, lastBackup: lastTime, lastBackupName: lastName };
        }

        // Key inventory
        const activeKeys = await prisma.key.count({ where: { status: 'active' } });
        const usedKeys = await prisma.key.count({ where: { status: 'used' } });

        // Active subscriptions
        const activeSubs = await prisma.subscription.count({ where: { status: 'active' } });

        // Cron schedules (static info since we know them)
        const cronJobs = [
            { name: 'Проверка продлений', schedule: '0 * * * *', description: 'Каждый час' },
            { name: 'Авто-бэкап БД', schedule: '0 */4 * * *', description: 'Каждые 4 часа' },
            { name: 'Плановые активации', schedule: '0 10 * * *', description: 'Ежедневно в 10:00' }
        ];

        res.json({
            server: {
                uptime: serverUptime,
                nodeVersion,
                platform,
                startedAt: new Date(now.getTime() - serverUptime * 1000)
            },
            memory: {
                rss: mem.rss,
                heapUsed: mem.heapUsed,
                heapTotal: mem.heapTotal,
                external: mem.external,
                osTotal: osMem.total,
                osFree: osMem.free
            },
            database: {
                size: dbSize,
                records: {
                    keys: keyCount,
                    sessions: sessionCount,
                    subscriptions: subCount,
                    logs: logCount
                }
            },
            backups: backupInfo,
            inventory: {
                activeKeys,
                usedKeys,
                totalKeys: activeKeys + usedKeys
            },
            subscriptions: {
                active: activeSubs
            },
            cronJobs
        });
    } catch (e) {
        console.error('Health Check Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ===================== SLA STATS =====================
app.get('/api/sla', authenticateToken, async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Source of truth for successes: USED KEYS (not logs, which can be incomplete)
        const usedKeys = await prisma.key.findMany({
            where: { status: 'used', usedAt: { not: null, gte: monthAgo } },
            select: { usedAt: true }
        });

        // Errors come from activity logs (only place they're recorded)
        const errorLogs = await prisma.activityLog.findMany({
            where: { createdAt: { gte: monthAgo }, action: 'ERROR' },
            select: { createdAt: true }
        });

        const calcSLA = (successes, errors) => {
            const total = successes + errors;
            return { successes, errors, total, rate: total > 0 ? Math.round((successes / total) * 10000) / 100 : 100 };
        };

        const todaySuccesses = usedKeys.filter(k => new Date(k.usedAt) >= todayStart).length;
        const todayErrors = errorLogs.filter(l => new Date(l.createdAt) >= todayStart).length;
        const weekSuccesses = usedKeys.filter(k => new Date(k.usedAt) >= weekAgo).length;
        const weekErrors = errorLogs.filter(l => new Date(l.createdAt) >= weekAgo).length;
        const monthSuccesses = usedKeys.length;
        const monthErrors = errorLogs.length;

        // Hourly breakdown for chart (last 24 hours)
        const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentKeys = usedKeys.filter(k => new Date(k.usedAt) >= h24ago);
        const recentErrors = errorLogs.filter(l => new Date(l.createdAt) >= h24ago);
        const hourlyChart = [];
        for (let i = 23; i >= 0; i--) {
            const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
            hourStart.setMinutes(0, 0, 0);
            const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
            const s = recentKeys.filter(k => { const d = new Date(k.usedAt); return d >= hourStart && d < hourEnd; }).length;
            const e = recentErrors.filter(l => { const d = new Date(l.createdAt); return d >= hourStart && d < hourEnd; }).length;
            hourlyChart.push({ hour: hourStart.toISOString(), successes: s, errors: e });
        }

        res.json({
            today: calcSLA(todaySuccesses, todayErrors),
            week: calcSLA(weekSuccesses, weekErrors),
            month: calcSLA(monthSuccesses, monthErrors),
            hourlyChart
        });
    } catch (e) {
        console.error('SLA Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ===================== RENEWAL CALENDAR =====================
app.get('/api/calendar', authenticateToken, async (req, res) => {
    try {
        // Get all subscriptions with nextActivationDate
        const subs = await prisma.subscription.findMany({
            where: { status: 'active', nextActivationDate: { not: null } },
            select: { id: true, email: true, type: true, nextActivationDate: true, activationsCount: true }
        });

        // Also get subscriptions by their endDate (startDate + duration)
        const activeSubs = await prisma.subscription.findMany({
            where: { status: 'active' },
            select: { id: true, email: true, type: true, startDate: true, activationsCount: true }
        });

        // Build calendar events
        const events = [];

        // Scheduled renewals
        subs.forEach(sub => {
            if (sub.nextActivationDate) {
                events.push({
                    date: sub.nextActivationDate.toISOString().split('T')[0],
                    type: 'renewal',
                    email: sub.email,
                    subType: sub.type,
                    round: sub.activationsCount + 1
                });
            }
        });

        // Expiration dates
        activeSubs.forEach(sub => {
            const start = new Date(sub.startDate);
            const months = sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1);
            const endDate = new Date(start);
            endDate.setMonth(endDate.getMonth() + months);
            events.push({
                date: endDate.toISOString().split('T')[0],
                type: 'expiration',
                email: sub.email,
                subType: sub.type
            });
        });

        // Group by date
        const calendarMap = {};
        events.forEach(ev => {
            if (!calendarMap[ev.date]) {
                calendarMap[ev.date] = { date: ev.date, renewals: 0, expirations: 0, events: [] };
            }
            if (ev.type === 'renewal') calendarMap[ev.date].renewals++;
            else calendarMap[ev.date].expirations++;
            calendarMap[ev.date].events.push(ev);
        });

        const calendar = Object.values(calendarMap).sort((a, b) => a.date.localeCompare(b.date));
        res.json(calendar);
    } catch (e) {
        console.error('Calendar Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ===================== TODAY WIDGET =====================
app.get('/api/today', authenticateToken, async (req, res) => {
    try {
        const now = new Date();
        // Считаем "сегодня" по московскому времени, чтобы совпадало с дневным графиком
        const formatMoscowDate = (date) =>
            new Date(date).toLocaleDateString('ru-RU', {
                timeZone: 'Europe/Moscow',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });

        const todayMoscow = formatMoscowDate(now);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

        const [usedKeys, errorLogs] = await Promise.all([
            // Берём ключи за последние 2 дня и фильтруем по дате в МСК
            prisma.key.findMany({
                where: { status: 'used', usedAt: { gte: twoDaysAgo } },
                select: { usedAt: true }
            }),
            prisma.activityLog.findMany({
                where: { createdAt: { gte: twoDaysAgo }, action: 'ERROR' },
                select: { createdAt: true }
            })
        ]);

        const activations = usedKeys.filter(k => formatMoscowDate(k.usedAt) === todayMoscow).length;
        const errors = errorLogs.filter(l => formatMoscowDate(l.createdAt) === todayMoscow).length;
        // Новые подписки считаем так же, как и активации (включая "ключи-сироты")
        const newSubs = activations;

        res.json({ activations, errors, newSubs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ===================== DASHBOARD =====================
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        const now = new Date();
        // Единое определение "сегодня" по московскому времени — чтобы совпадало с /api/stats/daily
        const formatMoscowDate = (date) =>
            new Date(date).toLocaleDateString('ru-RU', {
                timeZone: 'Europe/Moscow',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });

        const todayMoscow = formatMoscowDate(now);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Key stats
        const [activeKeys, usedKeys, totalKeys] = await Promise.all([
            prisma.key.count({ where: { status: 'active' } }),
            prisma.key.count({ where: { status: 'used' } }),
            prisma.key.count()
        ]);

        // Subscription stats
        const [activeSubs, totalSubs] = await Promise.all([
            prisma.subscription.count({ where: { status: 'active' } }),
            prisma.subscription.count()
        ]);

        // Today stats (from keys/subscriptions, считаем по московскому времени)
        const [todayKeys, todayErrorLogs, todaySubs] = await Promise.all([
            prisma.key.findMany({
                where: { status: 'used', usedAt: { gte: twoDaysAgo } },
                select: { usedAt: true }
            }),
            prisma.activityLog.findMany({
                where: { createdAt: { gte: twoDaysAgo }, action: 'ERROR' },
                select: { createdAt: true }
            }),
            prisma.subscription.findMany({
                where: { startDate: { gte: twoDaysAgo } },
                select: { startDate: true }
            })
        ]);

        const activationsToday = todayKeys.filter(k => formatMoscowDate(k.usedAt) === todayMoscow).length;
        const errorsToday = todayErrorLogs.filter(l => formatMoscowDate(l.createdAt) === todayMoscow).length;
        const newSubsToday = todaySubs.filter(s => formatMoscowDate(s.startDate) === todayMoscow).length;

        // SLA today
        const todayTotal = activationsToday + errorsToday;
        const slaToday = todayTotal > 0 ? Math.round((activationsToday / todayTotal) * 10000) / 100 : 100;

        // 7-day chart (activations per day)
        const usedKeysWeek = await prisma.key.findMany({
            where: { status: 'used', usedAt: { gte: weekAgo } },
            select: { usedAt: true }
        });
        const errorLogsWeek = await prisma.activityLog.findMany({
            where: { createdAt: { gte: weekAgo }, action: 'ERROR' },
            select: { createdAt: true }
        });

        const weekChart = [];
        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date(now);
            dayStart.setDate(dayStart.getDate() - i);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);

            const dayActivations = usedKeysWeek.filter(k => {
                const d = new Date(k.usedAt);
                return d >= dayStart && d < dayEnd;
            }).length;
            const dayErrors = errorLogsWeek.filter(l => {
                const d = new Date(l.createdAt);
                return d >= dayStart && d < dayEnd;
            }).length;

            weekChart.push({
                date: dayStart.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
                activations: dayActivations,
                errors: dayErrors
            });
        }

        // Recent activity (last 15 entries)
        const recentLogs = await prisma.activityLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 15,
            select: { id: true, action: true, details: true, email: true, createdAt: true }
        });

        // Upcoming renewals (next 7 days)
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const upcomingRenewals = await prisma.subscription.count({
            where: {
                status: 'active',
                nextActivationDate: { gte: now, lte: sevenDaysFromNow }
            }
        });

        res.json({
            keys: { active: activeKeys, used: usedKeys, total: totalKeys },
            subscriptions: { active: activeSubs, total: totalSubs },
            today: { activations: activationsToday, errors: errorsToday, newSubs: newSubsToday },
            sla: { today: slaToday },
            weekChart,
            recentLogs,
            upcomingRenewals
        });
    } catch (e) {
        console.error('Dashboard Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ===================== RATE LIMIT STATS =====================
app.get('/api/rate-limit/stats', authenticateToken, async (req, res) => {
    try {
        res.json(rateLimitTracker.getStats());
    } catch (e) {
        console.error('Rate Limit Stats Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Endpoint: POST http://localhost:${PORT}/api/activate-key`);
});
