import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Layout } from '../components/Layout';
import { ApiStatusWidget } from '../components/ApiStatusWidget';
import { SkeletonLogs } from '../components/Skeleton';
import { useStickyState } from '../hooks/useStickyState';
import { RelativeTime } from '../components/RelativeTime';

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
    const [filterType, setFilterType] = useStickyState('logs-filterType', '');
    const [filterSearch, setFilterSearch] = useStickyState('logs-filterSearch', '');

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

    const exportLogs = () => {
        const headers = ['ID', 'Date', 'Action', 'Email', 'Details'];
        const csvContent = [
            headers.join(','),
            ...logs.map(log => {
                const date = new Date(log.createdAt).toLocaleString('ru-RU');
                const safeDetails = log.details.replace(/"/g, '""'); // Escape quotes
                return `${log.id},"${date}","${log.action}","${log.email || ''}","${safeDetails}"`;
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `activity_logs_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderDetails = (details: string) => {
        try {
            const parsed = JSON.parse(details);
            if (parsed.message) return <span>{parsed.message}</span>;
            if (parsed.diff) {
                return (
                    <div className="text-xs space-y-1 mt-1">
                        {Object.entries(parsed.diff).map(([field, change]: [string, any]) => (
                            <div key={field} className="flex items-center gap-2">
                                <span className="font-semibold text-zinc-500 uppercase">{field}:</span>
                                <span className="line-through text-red-400">{String(change.from)}</span>
                                <span className="text-zinc-400">→</span>
                                <span className="text-green-600 dark:text-green-400 font-medium">{String(change.to)}</span>
                            </div>
                        ))}
                    </div>
                );
            }
            if (typeof parsed === 'object') return <pre className="text-xs">{JSON.stringify(parsed, null, 2)}</pre>;
            return <span>{String(parsed)}</span>;
        } catch {
            return <span>{details}</span>;
        }
    };

    return (
        <Layout>
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400">
                            Журнал действий
                        </h1>
                        <p className="text-sm text-zinc-500">История событий и изменений в системе</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={exportLogs}
                            className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Экспорт CSV
                        </button>
                        <ApiStatusWidget />
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden min-h-[500px] flex flex-col shadow-sm">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex flex-wrap items-center gap-3 flex-1 w-full">
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-300 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            >
                                <option value="">Все типы</option>
                                <option value="ACTIVATION">Активация</option>
                                <option value="RENEWAL">Продление</option>
                                <option value="ERROR">Ошибки</option>
                                <option value="KEY_ADDED">Добавление ключей</option>
                                <option value="USER_UPDATE">Изменение пользователя</option>
                                <option value="MANUAL_ACTIVATION">Ручная активация</option>
                                <option value="USER_DELETE">Удаление пользователя</option>
                                <option value="ADMIN_ACTIONS">Действия админа</option>
                            </select>

                            <input
                                type="text"
                                placeholder="Поиск..."
                                value={filterSearch}
                                onChange={(e) => setFilterSearch(e.target.value)}
                                className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-300 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 flex-1 min-w-[200px]"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading && logs.length === 0 ? (
                            <div className="p-4"><SkeletonLogs rows={8} /></div>
                        ) : logs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-zinc-500">
                                <span className="text-4xl mb-2">📝</span>
                                <p>Журнал пуст</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                {logs.map(log => (
                                    <div key={log.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors p-4 flex gap-4 items-start">
                                        <div className="min-w-[140px] pt-1">
                                            <div className="text-xs font-mono text-zinc-400">
                                                <RelativeTime date={log.createdAt} />
                                            </div>
                                            <div className="text-[10px] text-zinc-300 dark:text-zinc-600 mt-1">
                                                {new Date(log.createdAt).toLocaleTimeString()}
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`font-semibold px-2.5 py-0.5 rounded text-[10px] uppercase tracking-wider ${log.action === 'ERROR' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/30' :
                                                        log.action.includes('ACTIVATION') || log.action === 'RENEWAL' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 border border-green-100 dark:border-green-900/30' :
                                                            log.action === 'USER_UPDATE' ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30' :
                                                                'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                                                    }`}>
                                                    {log.action}
                                                </span>
                                                {log.email && <span className="text-zinc-600 dark:text-zinc-300 text-sm font-medium">{log.email}</span>}
                                            </div>

                                            <div className="text-sm text-zinc-600 dark:text-zinc-400 break-words">
                                                {renderDetails(log.details)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
