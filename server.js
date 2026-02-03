import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const BASE_URL = 'https://freespaces.gmailshop.top';

// Utility to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/api/activate-key', async (req, res) => {
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
