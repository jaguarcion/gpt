import express from 'express';
import cors from 'cors';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

// Add BigInt serialization support
BigInt.prototype.toJSON = function() { return this.toString() }

const app = express();
app.set('trust proxy', 1); // Trust Nginx proxy
app.use(helmet()); // Set secure HTTP headers
const PORT = process.env.PORT || 3001;
const API_TOKEN = process.env.API_TOKEN;

if (!API_TOKEN) {
    console.error('FATAL ERROR: API_TOKEN is not defined in .env');
    process.exit(1);
}

// Security: Rate Limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});

// Security: CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));

// --- Settings Management ---
const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');
let globalSettings = {
    maintenanceMode: false,
    announcement: '',
    maxActivationsPerDay: 100 // Example limit
};

// Load settings on startup
if (fs.existsSync(SETTINGS_FILE)) {
    try {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
        globalSettings = { ...globalSettings, ...JSON.parse(data) };
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

const saveSettings = () => {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(globalSettings, null, 2));
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
};

app.get('/api/settings', authenticateToken, (req, res) => {
    res.json(globalSettings);
});

app.post('/api/settings', authenticateToken, (req, res) => {
    try {
        const newSettings = req.body;
        globalSettings = { ...globalSettings, ...newSettings };
        saveSettings();
        LogService.log('ADMIN_ACTIONS', `Updated settings: ${JSON.stringify(newSettings)}`);
        res.json(globalSettings);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Public endpoint to get announcement (optional, for UI to show banner)
app.get('/api/public/config', (req, res) => {
    res.json({
        maintenance: globalSettings.maintenanceMode,
        announcement: globalSettings.announcement
    });
});
// ---------------------------

app.use(express.json());

// Apply rate limiting to all requests
app.use(limiter);

const BASE_URL = 'https://freespaces.gmailshop.top';

// Utility to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.status(401).json({ error: 'Unauthorized: Missing token' });
    // Use timingSafeEqual in production for better security against timing attacks, 
    // but for simple token simple comparison is often enough for this scale.
    if (token !== API_TOKEN) return res.status(403).json({ error: 'Forbidden: Invalid token' });

    next();
};

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
        
        res.json({ success: true, name: backupName });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/backups/:filename', authenticateToken, async (req, res) => {
    try {
        const { filename } = req.params;
        const backupDir = path.join(process.cwd(), 'backups');
        const filePath = path.join(backupDir, filename);
        
        // Security check: ensure no directory traversal
        if (!filePath.startsWith(backupDir)) {
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
        const backupDir = path.join(process.cwd(), 'backups');
        const filePath = path.join(backupDir, filename);
        
        if (!filePath.startsWith(backupDir)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            await LogService.log('BACKUP', `Backup deleted: ${filename}`);
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
            return res.json({ success: true, count: result.count });
        }

        // Handle single upload (legacy or simple)
        if (code) {
            const key = await KeyService.addKey(code);
            await LogService.log('KEY_ADDED', `Added single key: ${code}`);
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
        const { telegramId, page, limit, search, status, type, expiring } = req.query;
        
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
                expiring: expiring === 'true'
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

import os from 'os';

app.get('/api/system/resources', authenticateToken, (req, res) => {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memUsage = Math.round((usedMem / totalMem) * 100);
        
        const cpus = os.cpus();
        const cpuModel = cpus[0].model;
        // Simple load average (on Windows loadavg is always 0, so we might need a workaround or just show basic info)
        // For accurate CPU usage on Node without external libs is tricky, but we can send loadavg
        const loadAvg = os.loadavg(); // [1, 5, 15] min
        
        res.json({
            memory: {
                total: totalMem,
                free: freeMem,
                used: usedMem,
                usage: memUsage
            },
            cpu: {
                model: cpuModel,
                cores: cpus.length,
                load: loadAvg
            },
            uptime: os.uptime(),
            platform: os.platform() + ' ' + os.release()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// New Endpoint for Bot/Admin to create subscription and activate
app.post('/api/sessions/activate', authenticateToken, async (req, res) => {
    try {
        const { email, sessionJson, subscriptionType, telegramId } = req.body;
        
        if (!email || !sessionJson || !subscriptionType || !telegramId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (globalSettings.maintenanceMode) {
             return res.status(503).json({ error: 'System is under maintenance.' });
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

    if (globalSettings.maintenanceMode) {
        return res.status(503).json({ error: 'System is under maintenance. Please try again later.' });
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

            if (!status.pending) {
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Endpoint: POST http://localhost:${PORT}/api/activate-key`);
});
