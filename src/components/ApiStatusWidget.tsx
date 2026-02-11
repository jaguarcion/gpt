import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface ApiStatus {
    online: boolean;
    db: boolean;
    external: boolean;
    externalLatency: number;
    uptime: number;
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
        globalStatus = { online: false, db: false, external: false, externalLatency: 0, uptime: 0, message: 'Connection Error' };
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

function formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}с`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}м`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}ч ${Math.floor((seconds % 3600) / 60)}м`;
    return `${Math.floor(seconds / 86400)}д ${Math.floor((seconds % 86400) / 3600)}ч`;
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
        <div className="flex items-center gap-3 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            {/* Backend status */}
            <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${status?.online ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                <div className="flex flex-col">
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-300">
                        {status?.online ? 'Online' : 'Offline'}
                    </span>
                    {status?.online && status.uptime > 0 && (
                        <span className="text-[10px] text-zinc-500">up {formatUptime(status.uptime)}</span>
                    )}
                </div>
            </div>

            {/* Separator */}
            {status?.online && (
                <>
                    <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700" />

                    {/* DB status */}
                    <div className="flex items-center gap-1.5" title="База данных">
                        <div className={`w-1.5 h-1.5 rounded-full ${status.db ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-[10px] text-zinc-500">DB</span>
                    </div>

                    {/* External API status */}
                    <div className="flex items-center gap-1.5" title={`Внешний API${status.external ? ` (${status.externalLatency}ms)` : ''}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${status.external ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        <span className="text-[10px] text-zinc-500">
                            API {status.external ? `${status.externalLatency}ms` : '✕'}
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}
