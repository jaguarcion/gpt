import React, { useEffect, useState } from 'react';
import { getSLAStats, setAuthToken } from '../services/api';
import { Layout } from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTheme } from '../components/ThemeProvider';
import { SkeletonCards4, SkeletonChart } from '../components/Skeleton';
import { FullscreenChart } from '../components/FullscreenChart';
import { Activity, TrendingUp, AlertTriangle, Clock, RefreshCw } from 'lucide-react';

const SLA_THRESHOLD = 95; // Below this = red alert

export function SLA() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        const checkDark = () => {
            if (theme === 'dark') return true;
            if (theme === 'light') return false;
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        };
        setIsDark(checkDark());
    }, [theme]);

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) { navigate('/admin'); return; }
        setAuthToken(token);
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await getSLAStats();
            setStats(data);
        } catch (e) {
            console.error('Failed to load SLA stats:', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="max-w-6xl mx-auto space-y-8">
                    <SkeletonCards4 count={3} />
                    <SkeletonChart />
                </div>
            </Layout>
        );
    }

    if (!stats) return null;

    const chartGridColor = isDark ? '#27272a' : '#e4e4e7';
    const chartTextColor = '#71717a';

    // Format chart data
    const chartData = stats.hourlyChart.map((h: any) => ({
        ...h,
        hour: new Date(h.hour).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }));

    return (
        <Layout>
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Activity className="w-6 h-6 text-emerald-500" />
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">SLA Дашборд</h1>
                    </div>
                    <button
                        onClick={() => { setLoading(true); loadData(); }}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Обновить
                    </button>
                </div>

                {/* SLA Banner */}
                {stats.today.rate < SLA_THRESHOLD && stats.today.total > 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 px-6 py-4 rounded-xl flex items-center gap-3 animate-pulse">
                        <AlertTriangle className="w-6 h-6 shrink-0" />
                        <div>
                            <p className="font-bold">SLA ниже порога!</p>
                            <p className="text-sm opacity-80">Успешность сегодня: {stats.today.rate}% (порог: {SLA_THRESHOLD}%). Проверьте ошибки активации.</p>
                        </div>
                    </div>
                )}

                {/* Main SLA Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <SLACard
                        label="Сегодня"
                        rate={stats.today.rate}
                        successes={stats.today.successes}
                        errors={stats.today.errors}
                        total={stats.today.total}
                        threshold={SLA_THRESHOLD}
                    />
                    <SLACard
                        label="Неделя (7 дней)"
                        rate={stats.week.rate}
                        successes={stats.week.successes}
                        errors={stats.week.errors}
                        total={stats.week.total}
                        threshold={SLA_THRESHOLD}
                    />
                    <SLACard
                        label="Месяц (30 дней)"
                        rate={stats.month.rate}
                        successes={stats.month.successes}
                        errors={stats.month.errors}
                        total={stats.month.total}
                        threshold={SLA_THRESHOLD}
                    />
                </div>

                {/* Summary Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MiniStat icon={<TrendingUp className="w-4 h-4 text-green-500" />} label="Успешных за месяц" value={stats.month.successes} />
                    <MiniStat icon={<AlertTriangle className="w-4 h-4 text-red-500" />} label="Ошибок за месяц" value={stats.month.errors} />
                    <MiniStat icon={<Activity className="w-4 h-4 text-blue-500" />} label="Всего за месяц" value={stats.month.total} />
                    <MiniStat icon={<Clock className="w-4 h-4 text-zinc-400" />} label="Порог SLA" value={`${SLA_THRESHOLD}%`} />
                </div>

                {/* Hourly Chart */}
                <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <FullscreenChart title="Активации за последние 24 часа">
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} barGap={2}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                                    <XAxis dataKey="hour" stroke={chartTextColor} tick={{ fill: chartTextColor, fontSize: 11 }} minTickGap={20} />
                                    <YAxis stroke={chartTextColor} tick={{ fill: chartTextColor, fontSize: 12 }} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: isDark ? '#27272a' : '#fff',
                                            border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
                                            borderRadius: '8px',
                                            color: isDark ? '#fff' : '#000'
                                        }}
                                    />
                                    <Bar dataKey="successes" name="Успешных" fill="#22c55e" radius={[3, 3, 0, 0]} stackId="a" />
                                    <Bar dataKey="errors" name="Ошибок" fill="#ef4444" radius={[3, 3, 0, 0]} stackId="a" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </FullscreenChart>
                </div>
            </div>
        </Layout>
    );
}

// ============ Sub-components ============

function SLACard({ label, rate, successes, errors, total, threshold }: {
    label: string; rate: number; successes: number; errors: number; total: number; threshold: number;
}) {
    const isGood = rate >= threshold || total === 0;
    const ringColor = isGood ? 'text-emerald-500' : 'text-red-500';
    const bgRing = isGood ? 'stroke-emerald-500/20' : 'stroke-red-500/20';
    const fgRing = isGood ? 'stroke-emerald-500' : 'stroke-red-500';

    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (rate / 100) * circumference;

    return (
        <div className={`bg-white dark:bg-zinc-900/50 p-6 rounded-xl border transition-colors ${
            !isGood && total > 0 ? 'border-red-300 dark:border-red-900/50' : 'border-zinc-200 dark:border-zinc-800'
        }`}>
            <div className="text-sm text-zinc-500 mb-4">{label}</div>
            <div className="flex items-center gap-6">
                {/* Circular Progress */}
                <div className="relative w-24 h-24 shrink-0">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8" className={bgRing} />
                        <circle
                            cx="50" cy="50" r="45" fill="none" strokeWidth="8"
                            className={fgRing}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={total === 0 ? circumference : offset}
                            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-lg font-bold ${ringColor}`}>
                            {total === 0 ? '—' : `${rate}%`}
                        </span>
                    </div>
                </div>

                {/* Stats */}
                <div className="space-y-2 flex-1">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-zinc-500">Успешных</span>
                        <span className="font-mono font-medium text-green-600 dark:text-green-400">{successes}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-zinc-500">Ошибок</span>
                        <span className="font-mono font-medium text-red-600 dark:text-red-400">{errors}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-zinc-100 dark:border-zinc-800">
                        <span className="text-xs text-zinc-500">Всего</span>
                        <span className="font-mono font-medium text-zinc-900 dark:text-white">{total}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <div className="bg-white dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="text-xs text-zinc-500">{label}</span>
            </div>
            <div className="text-xl font-bold text-zinc-900 dark:text-white">{value}</div>
        </div>
    );
}
