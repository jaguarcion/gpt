import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface ApiStatus {
    online: boolean;
    latency: number;
    message: string;
}

// Global singleton: one background check for the entire app
let globalStatus: ApiStatus | null = null;
let globalInterval: ReturnType<typeof setInterval> | null = null;
let listeners: Set<() => void> = new Set();

async function fetchStatus() {
    try {
        const token = localStorage.getItem('adminToken');
        if (!token) return;
        const response = await axios.get('/api/status', {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
        });
        globalStatus = response.data;
    } catch {
        globalStatus = { online: false, latency: 0, message: 'Connection Error' };
    }
    listeners.forEach(fn => fn());
}

function startGlobalPolling() {
    if (globalInterval) return;
    fetchStatus();
    globalInterval = setInterval(fetchStatus, 60000); // Once per minute
}

function stopGlobalPolling() {
    if (globalInterval && listeners.size === 0) {
        clearInterval(globalInterval);
        globalInterval = null;
    }
}

export function ApiStatusWidget() {
    const [status, setStatus] = useState<ApiStatus | null>(globalStatus);

    useEffect(() => {
        const update = () => setStatus(globalStatus);
        listeners.add(update);
        startGlobalPolling();

        // If we already have cached status, use it immediately
        if (globalStatus) setStatus(globalStatus);

        return () => {
            listeners.delete(update);
            stopGlobalPolling();
        };
    }, []);

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${status?.online ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
            <div className="flex flex-col">
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-300">
                    API: {status?.online ? 'Online' : 'Offline'}
                </span>
                {status?.online && (
                    <span className="text-[10px] text-zinc-500">{status.latency}ms</span>
                )}
            </div>
        </div>
    );
}
