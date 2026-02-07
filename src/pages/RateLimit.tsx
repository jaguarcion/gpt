import React, { useEffect, useState } from 'react';
import { getRateLimitStats, setAuthToken } from '../services/api';
import { Layout } from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { Shield, RefreshCw, Globe, AlertTriangle, Activity, Clock } from 'lucide-react';
import { SkeletonCards4, SkeletonTable } from '../components/Skeleton';

export function RateLimit() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) { navigate('/admin'); return; }
        setAuthToken(token);
        loadData();
        const interval = setInterval(loadData, 15000); // Auto-refresh every 15s
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            const data = await getRateLimitStats();
            setStats(data);
        } catch (e) {
            console.error('Failed to load rate limit stats:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const timeAgo = (isoStr: string) => {
        const diff = Date.now() - new Date(isoStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'только что';
        if (mins < 60) return `${mins} мин. назад`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} ч. назад`;
        return `${Math.floor(hrs / 24)} дн. назад`;
    };

    return (
        <Layout>
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Shield className="w-6 h-6 text-orange-500" />
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Rate Limit Monitor</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-zinc-400">Авто-обновление 15с</span>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            Обновить
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-8">
                        <SkeletonCards4 count={4} />
                        <SkeletonTable rows={6} cols={4} />
                    </div>
                ) : stats ? (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <KPICard
                                icon={<Activity className="w-5 h-5 text-blue-500" />}
                                label="Всего запросов"
                                value={stats.totalRequests.toLocaleString()}
                            />
                            <KPICard
                                icon={<Globe className="w-5 h-5 text-cyan-500" />}
                                label="Уникальных IP"
                                value={stats.uniqueIPs}
                            />
                            <KPICard
                                icon={<Clock className="w-5 h-5 text-green-500" />}
                                label="Запросов/мин"
                                value={stats.requestsPerMinute}
                            />
                            <KPICard
                                icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
                                label="Заблокировано"
                                value={stats.totalBlocked}
                                highlight={stats.totalBlocked > 0}
                            />
                        </div>

                        {/* Config Info */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 p-4 rounded-xl border border-blue-200 dark:border-blue-900/30 text-sm flex items-center gap-3">
                            <Shield className="w-5 h-5 shrink-0" />
                            <span>
                                Текущий лимит: <strong>{stats.config.maxRequests}</strong> запросов за <strong>{stats.config.windowMs / 60000} мин</strong> с одного IP.
                                Мониторинг работает <strong>{stats.uptimeMinutes} мин</strong>.
                            </span>
                        </div>

                        {/* Top IPs Table */}
                        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex justify-between items-center">
                                <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-zinc-500" />
                                    Топ IP-адресов по количеству запросов
                                </h3>
                                <span className="text-xs text-zinc-500">{stats.topIPs.length} IP</span>
                            </div>
                            <div className="max-h-[50vh] overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 text-xs uppercase sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3">IP-адрес</th>
                                            <th className="px-6 py-3">Запросов</th>
                                            <th className="px-6 py-3">Последний запрос</th>
                                            <th className="px-6 py-3">Популярные пути</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                        {stats.topIPs.map((ip: any, idx: number) => (
                                            <tr key={ip.ip} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-zinc-400 w-4">{idx + 1}</span>
                                                        <span className="font-mono text-zinc-900 dark:text-white">{ip.ip}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className={`font-bold ${ip.count > 500 ? 'text-red-500' : ip.count > 100 ? 'text-yellow-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                                        {ip.count.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-zinc-500 text-xs">
                                                    {timeAgo(ip.lastSeen)}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {ip.topPaths.map((p: any) => (
                                                            <span key={p.path} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                                                                {p.path} <span className="text-zinc-400">×{p.count}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {stats.topIPs.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">Нет данных</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Recent Blocks */}
                        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex justify-between items-center">
                                <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                    Последние блокировки
                                </h3>
                                <span className="text-xs text-zinc-500">{stats.recentBlocks.length} записей</span>
                            </div>
                            {stats.recentBlocks.length === 0 ? (
                                <div className="px-6 py-10 text-center text-zinc-500 text-sm">
                                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    Блокировок не было — всё чисто!
                                </div>
                            ) : (
                                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-[40vh] overflow-y-auto">
                                    {stats.recentBlocks.map((block: any, idx: number) => (
                                        <div key={idx} className="px-6 py-3 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                            <span className="font-mono text-sm text-zinc-900 dark:text-white">{block.ip}</span>
                                            <span className="font-mono text-xs text-zinc-500">{block.path}</span>
                                            <span className="text-xs text-zinc-400 ml-auto">{timeAgo(block.time)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : null}
            </div>
        </Layout>
    );
}

function KPICard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string | number; highlight?: boolean }) {
    return (
        <div className={`bg-white dark:bg-zinc-900/50 p-5 rounded-xl border transition-colors ${
            highlight ? 'border-red-300 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/10' : 'border-zinc-200 dark:border-zinc-800'
        }`}>
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-sm text-zinc-500">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${highlight ? 'text-red-600 dark:text-red-500' : 'text-zinc-900 dark:text-white'}`}>
                {value}
            </div>
        </div>
    );
}
