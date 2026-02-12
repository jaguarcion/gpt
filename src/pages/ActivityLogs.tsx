import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Layout } from '../components/Layout';
import { ApiStatusWidget } from '../components/ApiStatusWidget';
import { SkeletonLogs } from '../components/Skeleton';
import { useStickyState } from '../hooks/useStickyState';
import { RelativeTime } from '../components/RelativeTime';
import { AlertTriangle, List, Grid, Users } from 'lucide-react';
import { motion } from 'framer-motion';

export interface LogEntry {
    id: number;
    action: string;
    details: string;
    email: string | null;
    createdAt: string;
}

interface GroupedError {
    message: string;
    count: number;
    lastSeen: string;
    firstSeen: string;
    uniqueUsers: number;
    emails: string[];
}

export function ActivityLogs() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [groupedErrors, setGroupedErrors] = useState<GroupedError[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useStickyState('logs-viewMode', 'list'); // 'list' | 'grouped'
    const [filterType, setFilterType] = useStickyState('logs-filterType', '');
    const [filterSearch, setFilterSearch] = useStickyState('logs-filterSearch', '');

    useEffect(() => {
        loadData();
    }, [filterType, filterSearch, viewMode]);

    const loadData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) return;
            const headers = { Authorization: `Bearer ${token}` };

            if (viewMode === 'grouped') {
                const response = await axios.get('/api/logs/stats', { headers, params: { days: 7 } });
                setGroupedErrors(response.data);
            } else {
                const response = await axios.get('/api/logs', {
                    headers,
                    params: { type: filterType, search: filterSearch }
                });
                setLogs(response.data);
            }
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
                const safeDetails = log.details.replace(/"/g, '""');
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
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400">
                            Логи системы
                        </h1>
                        <p className="text-sm text-zinc-500">История действий пользователей и администраторов</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list'
                                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                    }`}
                            >
                                <List className="w-4 h-4" />
                                <span className="hidden sm:inline">Список</span>
                            </button>
                            <button
                                onClick={() => setViewMode('grouped')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'grouped'
                                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                    }`}
                            >
                                <AlertTriangle className="w-4 h-4" />
                                <span className="hidden sm:inline">Ошибки (Топ)</span>
                            </button>
                        </div>
                        <ApiStatusWidget />
                    </div>
                </div>

                {viewMode === 'list' ? (
                    <>
                        {/* Filters */}
                        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
                            <input
                                type="text"
                                placeholder="Поиск по email или деталям..."
                                value={filterSearch}
                                onChange={(e) => setFilterSearch(e.target.value)}
                                className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            >
                                <option value="">Все действия</option>
                                <option value="ADMIN_ACTIONS">Действия админа</option>
                                <option value="ACTIVATION">Активации</option>
                                <option value="RENEWAL">Продления</option>
                                <option value="ERROR">Ошибки</option>
                            </select>
                            <button
                                onClick={exportLogs}
                                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium rounded-lg transition-colors text-sm"
                            >
                                Экспорт CSV
                            </button>
                        </div>

                        {/* Logs List */}
                        {loading ? (
                            <SkeletonLogs rows={8} />
                        ) : (
                            <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                                                <th className="px-6 py-3 font-medium text-zinc-500">Дата</th>
                                                <th className="px-6 py-3 font-medium text-zinc-500">Действие</th>
                                                <th className="px-6 py-3 font-medium text-zinc-500">Пользователь</th>
                                                <th className="px-6 py-3 font-medium text-zinc-500">Детали</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                            {logs.map((log) => (
                                                <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-zinc-500">
                                                        <RelativeTime date={log.createdAt} />
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${log.action === 'ERROR'
                                                            ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50'
                                                            : log.action === 'ACTIVATION' || log.action === 'RENEWAL'
                                                                ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50'
                                                                : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50'
                                                            }`}>
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">
                                                        {log.email || <span className="text-zinc-400 italic">Система</span>}
                                                    </td>
                                                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 break-all max-w-md">
                                                        {renderDetails(log.details)}
                                                    </td>
                                                </tr>
                                            ))}
                                            {logs.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                                                        Нет записей
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    /* GROUPED ERROR VIEW */
                    <div className="grid gap-4">
                        {loading ? (
                            <SkeletonLogs rows={5} />
                        ) : (
                            groupedErrors.map((error, idx) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    key={idx}
                                    className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-red-300 dark:hover:border-red-900/50 transition-colors cursor-pointer group"
                                    onClick={() => {
                                        // Drill down: switch to list mode and search for this error
                                        setFilterSearch(error.message.substring(0, 50)); // Search by message part
                                        setFilterType('ERROR');
                                        setViewMode('list');
                                    }}
                                >
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="flex items-center justify-center w-6 h-6 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold">
                                                    {idx + 1}
                                                </span>
                                                <h3 className="font-medium text-red-600 dark:text-red-400 break-all">
                                                    {renderDetails(error.message)}
                                                </h3>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-zinc-500 mt-2">
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-3 h-3" />
                                                    {error.uniqueUsers} пострадавших
                                                </span>
                                                <span>•</span>
                                                <span>Первая: <RelativeTime date={error.firstSeen} /></span>
                                                <span>•</span>
                                                <span>Последняя: <RelativeTime date={error.lastSeen} /></span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end">
                                            <span className="text-2xl font-bold text-zinc-900 dark:text-white">
                                                {error.count}
                                            </span>
                                            <span className="text-xs text-zinc-500 uppercase tracking-wider">событий</span>
                                        </div>
                                    </div>

                                    {/* Affected emails mini-list */}
                                    {error.emails && error.emails.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50 flex flex-wrap gap-2">
                                            {error.emails.map(email => (
                                                <span key={email} className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800 rounded text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                    {email}
                                                </span>
                                            ))}
                                            {error.uniqueUsers > error.emails.length && (
                                                <span className="px-2 py-1 text-xs text-zinc-400">
                                                    +{error.uniqueUsers - error.emails.length} еще
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            ))
                        )}

                        {!loading && groupedErrors.length === 0 && (
                            <div className="text-center py-12 text-zinc-500 bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-50" />
                                <p>Ошибок за последние 7 дней не найдено 🎉</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
}

