import React, { useEffect, useState } from 'react';
import axios from 'axios';

export interface LogEntry {
    id: number;
    action: string;
    details: string;
    email: string | null;
    createdAt: string;
}

export function LogConsole() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLogs();
        // Poll every 10 seconds
        const interval = setInterval(loadLogs, 10000);
        return () => clearInterval(interval);
    }, []);

    const loadLogs = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            const response = await axios.get('http://localhost:3001/api/logs', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLogs(response.data);
        } catch (e) {
            console.error('Failed to load logs:', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden h-96 flex flex-col">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
                <h3 className="font-medium text-zinc-100">Activity Log</h3>
                <span className="text-xs text-zinc-500">Auto-updates every 10s</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm">
                {loading && logs.length === 0 ? (
                    <div className="text-zinc-500 text-center py-4">Loading logs...</div>
                ) : logs.length === 0 ? (
                    <div className="text-zinc-500 text-center py-4">No activity recorded yet.</div>
                ) : (
                    logs.map(log => (
                        <div key={log.id} className="flex gap-3 text-zinc-400 hover:bg-zinc-800/30 p-1 rounded transition-colors">
                            <span className="text-zinc-600 whitespace-nowrap">
                                {new Date(log.createdAt).toLocaleTimeString()}
                            </span>
                            <span className={`font-bold whitespace-nowrap w-24 ${
                                log.action === 'ERROR' ? 'text-red-400' :
                                log.action.includes('ACTIVATION') ? 'text-green-400' :
                                log.action === 'KEY_ADDED' ? 'text-blue-400' :
                                'text-zinc-300'
                            }`}>
                                {log.action}
                            </span>
                            <span className="text-zinc-300 break-all">
                                {log.details}
                                {log.email && <span className="text-zinc-500 ml-2">({log.email})</span>}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
