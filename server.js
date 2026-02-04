import express from 'express';
import cors from 'cors';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

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
    max: 100, // Limit each IP to 100 requests per windowMs
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
import { SubscriptionService } from './services/subscriptionService.js';

// ... (existing imports and config)

app.post('/api/keys', authenticateToken, async (req, res) => {
    try {
        const { code, codes } = req.body;
        
        // Handle bulk upload
        if (codes && Array.isArray(codes)) {
            const result = await KeyService.addKeys(codes);
            return res.json({ success: true, count: result.count });
        }

        // Handle single upload (legacy or simple)
        if (code) {
            const key = await KeyService.addKey(code);
            return res.json(key);
        }
        
        return res.status(400).json({ error: 'Code or codes array required' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/keys', authenticateToken, async (req, res) => {
    try {
        const keys = await KeyService.getAllKeys();
        res.json(keys);
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

app.get('/api/subscriptions', authenticateToken, async (req, res) => {
    console.log('GET /api/subscriptions request received');
    try {
        const { telegramId } = req.query;
        const subscriptions = telegramId 
            ? await SubscriptionService.getSubscriptionsByTelegramId(telegramId)
            : await SubscriptionService.getAllSubscriptions();
        console.log(`Returning ${subscriptions.length} subscriptions`);
        res.json(subscriptions);
    } catch (e) {
        console.error('Subscriptions Error:', e);
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

        // --- STEP 2: REQUEST ACTIVATION ---
        console.log(`[${cdk}] Step 2: Requesting activation...`);
        
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
        const maxAttempts = 60; // 2 minutes

        while (isPending && attempts < maxAttempts) {
            await sleep(2000);
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Endpoint: POST http://localhost:${PORT}/api/activate-key`);
});
