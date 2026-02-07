import React, { useEffect, useState } from 'react';
import { getHealth, setAuthToken } from '../services/api';
import { Layout } from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { Server, Database, HardDrive, Clock, Cpu, MemoryStick, Activity, RefreshCw, Key, Users, FileText, Shield } from 'lucide-react';

export function Health() {
    const [health, setHealth] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            navigate('/admin');
            return;
        }
        setAuthToken(token);
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await getHealth();
            setHealth(data);
        } catch (e) {
            console.error('Failed to load health data:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center py-20 text-zinc-500">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    Загрузка данных...
                </div>
            </Layout>
        );
    }

    if (!health) return null;

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const parts = [];
        if (days > 0) parts.push(`${days}д`);
        if (hours > 0) parts.push(`${hours}ч`);
        if (mins > 0) parts.push(`${mins}м`);
        if (parts.length === 0) parts.push(`${secs}с`);
        return parts.join(' ');
    };

    const memPercent = Math.round((health.memory.heapUsed / health.memory.heapTotal) * 100);
    const osMemPercent = Math.round(((health.memory.osTotal - health.memory.osFree) / health.memory.osTotal) * 100);

    return (
        <Layout>
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Activity className="w-6 h-6 text-green-500" />
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Состояние системы</h1>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Обновить
                    </button>
                </div>

                {/* Server Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatusCard
                        icon={<Clock className="w-5 h-5 text-blue-500" />}
                        title="Аптайм сервера"
                        value={formatUptime(health.server.uptime)}
                        subtitle={`Запущен: ${new Date(health.server.startedAt).toLocaleString()}`}
                    />
                    <StatusCard
                        icon={<Server className="w-5 h-5 text-purple-500" />}
                        title="Node.js"
                        value={health.server.nodeVersion}
                        subtitle={health.server.platform}
                    />
                    <StatusCard
                        icon={<Shield className="w-5 h-5 text-green-500" />}
                        title="Статус"
                        value="Online"
                        subtitle="Сервер работает"
                        valueColor="text-green-600 dark:text-green-500"
                    />
                </div>

                {/* Memory Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Process Memory */}
                    <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-2 mb-4">
                            <MemoryStick className="w-5 h-5 text-orange-500" />
                            <h3 className="font-semibold text-zinc-900 dark:text-white">Память процесса (Node.js)</h3>
                        </div>
                        <div className="space-y-4">
                            <ProgressBar
                                label="Heap"
                                used={health.memory.heapUsed}
                                total={health.memory.heapTotal}
                                percent={memPercent}
                                formatFn={formatBytes}
                            />
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-zinc-500">RSS</span>
                                    <p className="font-mono font-medium text-zinc-900 dark:text-white">{formatBytes(health.memory.rss)}</p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">External</span>
                                    <p className="font-mono font-medium text-zinc-900 dark:text-white">{formatBytes(health.memory.external)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* OS Memory */}
                    <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-2 mb-4">
                            <Cpu className="w-5 h-5 text-cyan-500" />
                            <h3 className="font-semibold text-zinc-900 dark:text-white">Память ОС</h3>
                        </div>
                        <div className="space-y-4">
                            <ProgressBar
                                label="RAM"
                                used={health.memory.osTotal - health.memory.osFree}
                                total={health.memory.osTotal}
                                percent={osMemPercent}
                                formatFn={formatBytes}
                            />
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-zinc-500">Всего</span>
                                    <p className="font-mono font-medium text-zinc-900 dark:text-white">{formatBytes(health.memory.osTotal)}</p>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Свободно</span>
                                    <p className="font-mono font-medium text-zinc-900 dark:text-white">{formatBytes(health.memory.osFree)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Database & Backups */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Database */}
                    <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-2 mb-4">
                            <Database className="w-5 h-5 text-emerald-500" />
                            <h3 className="font-semibold text-zinc-900 dark:text-white">База данных</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                                <span className="text-sm text-zinc-600 dark:text-zinc-400">Размер файла</span>
                                <span className="font-mono font-medium text-zinc-900 dark:text-white">{formatBytes(health.database.size)}</span>
                            </div>
                            <RecordRow icon={<Key className="w-3.5 h-3.5" />} label="Ключи" count={health.database.records.keys} />
                            <RecordRow icon={<Users className="w-3.5 h-3.5" />} label="Подписки" count={health.database.records.subscriptions} />
                            <RecordRow icon={<FileText className="w-3.5 h-3.5" />} label="Сессии" count={health.database.records.sessions} />
                            <RecordRow icon={<Activity className="w-3.5 h-3.5" />} label="Логи" count={health.database.records.logs} />
                        </div>
                    </div>

                    {/* Backups */}
                    <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-2 mb-4">
                            <HardDrive className="w-5 h-5 text-indigo-500" />
                            <h3 className="font-semibold text-zinc-900 dark:text-white">Резервные копии</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                                <span className="text-sm text-zinc-600 dark:text-zinc-400">Кол-во бэкапов</span>
                                <span className="font-mono font-medium text-zinc-900 dark:text-white">{health.backups.count}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                                <span className="text-sm text-zinc-600 dark:text-zinc-400">Общий размер</span>
                                <span className="font-mono font-medium text-zinc-900 dark:text-white">{formatBytes(health.backups.totalSize)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                                <span className="text-sm text-zinc-600 dark:text-zinc-400">Последний бэкап</span>
                                <span className="font-mono text-sm text-zinc-900 dark:text-white">
                                    {health.backups.lastBackup
                                        ? new Date(health.backups.lastBackup).toLocaleString()
                                        : 'Нет'
                                    }
                                </span>
                            </div>
                            {health.backups.lastBackupName && (
                                <div className="text-xs text-zinc-500 font-mono break-all">
                                    {health.backups.lastBackupName}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MiniCard label="Ключей на складе" value={health.inventory.activeKeys} color="text-green-600 dark:text-green-500" />
                    <MiniCard label="Ключей использовано" value={health.inventory.usedKeys} color="text-zinc-600 dark:text-zinc-400" />
                    <MiniCard label="Всего ключей" value={health.inventory.totalKeys} color="text-zinc-900 dark:text-white" />
                    <MiniCard label="Активных подписок" value={health.subscriptions.active} color="text-blue-600 dark:text-blue-500" />
                </div>

                {/* Cron Jobs */}
                <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-4">
                        <RefreshCw className="w-5 h-5 text-amber-500" />
                        <h3 className="font-semibold text-zinc-900 dark:text-white">Запланированные задачи (Cron)</h3>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-2.5 text-left">Задача</th>
                                    <th className="px-4 py-2.5 text-left">Расписание (cron)</th>
                                    <th className="px-4 py-2.5 text-left">Описание</th>
                                    <th className="px-4 py-2.5 text-left">Статус</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {health.cronJobs.map((job: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{job.name}</td>
                                        <td className="px-4 py-3 font-mono text-zinc-500 text-xs">{job.schedule}</td>
                                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{job.description}</td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-600 dark:text-green-400">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                Активна
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

// ============ Sub-components ============

function StatusCard({ icon, title, value, subtitle, valueColor }: {
    icon: React.ReactNode;
    title: string;
    value: string;
    subtitle: string;
    valueColor?: string;
}) {
    return (
        <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-3">
                {icon}
                <span className="text-sm text-zinc-500">{title}</span>
            </div>
            <div className={`text-2xl font-bold ${valueColor || 'text-zinc-900 dark:text-white'}`}>{value}</div>
            <p className="text-xs text-zinc-400 mt-1 truncate">{subtitle}</p>
        </div>
    );
}

function ProgressBar({ label, used, total, percent, formatFn }: {
    label: string;
    used: number;
    total: number;
    percent: number;
    formatFn: (n: number) => string;
}) {
    const color = percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-yellow-500' : 'bg-blue-500';
    return (
        <div>
            <div className="flex justify-between text-sm mb-1.5">
                <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
                <span className="font-mono text-zinc-900 dark:text-white">{formatFn(used)} / {formatFn(total)}</span>
            </div>
            <div className="h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                />
            </div>
            <div className="text-right text-[10px] text-zinc-400 mt-0.5">{percent}%</div>
        </div>
    );
}

function RecordRow({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                {icon}
                {label}
            </div>
            <span className="font-mono font-medium text-zinc-900 dark:text-white">{count.toLocaleString()}</span>
        </div>
    );
}

function MiniCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="bg-white dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center">
            <div className="text-xs text-zinc-500 mb-1">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
        </div>
    );
}
