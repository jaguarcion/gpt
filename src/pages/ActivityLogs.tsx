import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Layout } from '../components/Layout';
import { ApiStatusWidget } from '../components/ApiStatusWidget';

export interface LogEntry {
    id: number;
    action: string;
    details: string;
    email: string | null;
    createdAt: string;
}

export function ActivityLogs() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('');
    const [filterSearch, setFilterSearch] = useState('');

    useEffect(() => {
        loadLogs();
        // Poll every 10 seconds
        const interval = setInterval(loadLogs, 10000);
        return () => clearInterval(interval);
    }, [filterType, filterSearch]);

    const loadLogs = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            const response = await axios.get('/api/logs', {
                headers: { Authorization: `Bearer ${token}` },
                params: { 
                    type: filterType,
                    search: filterSearch
                }
            });
            setLogs(response.data);
        } catch (e) {
            console.error('Failed to load logs:', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <h1 className="text-2xl font-bold">Activity Logs</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <ApiStatusWidget />
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden min-h-[500px] flex flex-col">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 flex justify-between items-center gap-4">
                        <div className="flex items-center gap-4 flex-1">
                            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">Последние события</h3>
                            
                            {/* Filters */}
                            <select 
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-300 text-sm rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                            >
                                <option value="">Все типы</option>
                                <option value="ACTIVATION">Activation</option>
                                <option value="RENEWAL">Renewal</option>
                                <option value="ERROR">Error</option>
                                <option value="KEY_ADDED">Key Added</option>
                                <option value="ADMIN_LOGIN">Admin Login</option>
                                <option value="MANUAL_ACTIVATION">Manual Activation</option>
                                <option value="USER_EDIT">User Edit</option>
                            </select>

                            <input 
                                type="text" 
                                placeholder="Поиск по email или деталям..." 
                                value={filterSearch}
                                onChange={(e) => setFilterSearch(e.target.value)}
                                className="bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-300 text-sm rounded px-3 py-1 focus:outline-none focus:border-blue-500 flex-1 max-w-xs"
                            />
                        </div>
                        <span className="text-xs text-zinc-500 whitespace-nowrap">Auto-updates every 10s</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm">
                        {loading && logs.length === 0 ? (
                            <div className="text-zinc-500 text-center py-4">Loading logs...</div>
                        ) : logs.length === 0 ? (
                            <div className="text-zinc-500 text-center py-4">No activity recorded yet.</div>
                        ) : (
                            logs.map(log => (
                                <div key={log.id} className="flex gap-4 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 p-2 rounded transition-colors border-b border-zinc-100 dark:border-zinc-800/30 last:border-0">
                                    <span className="text-zinc-500 dark:text-zinc-600 whitespace-nowrap w-24">
                                        {new Date(log.createdAt).toLocaleTimeString()}
                                        <div className="text-[10px] opacity-60">{new Date(log.createdAt).toLocaleDateString()}</div>
                                    </span>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                                                log.action === 'ERROR' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
                                                log.action.includes('ACTIVATION') ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' :
                                                log.action === 'KEY_ADDED' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                                                'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                            }`}>
                                                {log.action}
                                            </span>
                                            {log.email && <span className="text-zinc-500 text-xs">User: {log.email}</span>}
                                        </div>
                                        <span className="text-zinc-800 dark:text-zinc-300 break-all">
                                            {log.details}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
