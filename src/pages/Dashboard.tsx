import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard, setAuthToken } from '../services/api';
import { Layout } from '../components/Layout';
import { AnimatePresence, motion } from 'framer-motion';
import { SkeletonDashboard } from '../components/Skeleton';
import { useTheme } from '../components/ThemeProvider';
import { useSSE } from '../hooks/useSSE';
import { useDashboardWidgets } from '../hooks/useDashboardWidgets';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
    Key, Users, ShieldCheck, AlertTriangle, TrendingUp,
    Zap, CalendarClock, ArrowUpRight, ArrowDownRight, Wifi, WifiOff,
    Settings2, GripVertical, Eye, EyeOff, RotateCcw
} from 'lucide-react';
import { useScrollRestore } from '../hooks/useScrollRestore';
import { AnimatedKPI } from '../components/AnimatedKPI';

export function Dashboard() {
    const [token, setToken] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [isDark, setIsDark] = useState(true);
    useScrollRestore();

    // Widget system (must be before any conditional returns)
    const { widgets, toggleVisibility, reorder, reset: resetWidgets } = useDashboardWidgets();
    const [showSettings, setShowSettings] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const settingsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
        };
        if (showSettings) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showSettings]);

    useEffect(() => {
        const checkDark = () => {
            if (theme === 'dark') return true;
            if (theme === 'light') return false;
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        };
        setIsDark(checkDark());
    }, [theme]);

    const handleLogin = async () => {
        if (!token) return;
        setAuthToken(token);
        try {
            const dashData = await getDashboard();
            setData(dashData);
            setIsAuthenticated(true);
            localStorage.setItem('adminToken', token);
        } catch (e: any) {
            if (e.response && (e.response.status === 401 || e.response.status === 403)) {
                setMessage({ text: 'Неверный токен', type: 'error' });
            } else {
                setMessage({ text: 'Ошибка сети или сервера', type: 'error' });
            }
            setIsAuthenticated(false);
            localStorage.removeItem('adminToken');
        }
    };

    // SSE live updates
    const refreshData = useCallback(async () => {
        try {
            const d = await getDashboard();
            setData(d);
        } catch {
            // silently ignore refresh errors
        }
    }, []);

    const { connected: sseConnected } = useSSE((event) => {
        // Refresh dashboard on any meaningful event
        if (['activation', 'renewal', 'error', 'key_added', 'subscription_created', 'subscription_updated', 'subscription_deleted'].includes(event.type)) {
            refreshData();
        }
    });

    useEffect(() => {
        const savedToken = localStorage.getItem('adminToken');
        if (savedToken) {
            setToken(savedToken);
            setAuthToken(savedToken);
            getDashboard()
                .then(d => { setData(d); setIsAuthenticated(true); })
                .catch(() => { localStorage.removeItem('adminToken'); setIsAuthenticated(false); })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    if (loading) {
        return (
            <Layout>
                <SkeletonDashboard />
            </Layout>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-zinc-900/50 p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-md w-full space-y-4">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 text-center">Admin Login</h2>
                    <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        placeholder="Enter API Token"
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleLogin}
                        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                        Войти
                    </button>
                    {message && (
                        <div className={`text-sm text-center ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                            {message.text}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (!data) return null;

    const chartGridColor = isDark ? '#27272a' : '#e4e4e7';
    const chartTextColor = '#71717a';

    // Calculate week total for comparison
    const weekActivations = data.weekChart.reduce((s: number, d: any) => s + d.activations, 0);
    const weekErrors = data.weekChart.reduce((s: number, d: any) => s + d.errors, 0);

    // Extract sparkline data from weekChart
    const sparkActivations = data.weekChart.map((d: any) => d.activations);
    const sparkErrors = data.weekChart.map((d: any) => d.errors);
    const sparkTotal = data.weekChart.map((d: any) => d.activations + d.errors);
    const sparkSLA = data.weekChart.map((d: any) => {
        const total = d.activations + d.errors;
        return total > 0 ? (d.activations / total) * 100 : 100;
    });

    const kpis = [
        {
            label: 'Доступные ключи',
            value: data.keys.active,
            subtitle: `из ${data.keys.total} всего`,
            icon: <Key className="w-5 h-5" />,
            color: data.keys.active > 10 ? 'text-green-600 dark:text-green-400' : data.keys.active > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400',
            iconBg: data.keys.active > 10 ? 'bg-green-500/10' : data.keys.active > 0 ? 'bg-yellow-500/10' : 'bg-red-500/10',
        },
        {
            label: 'Активные подписки',
            value: data.subscriptions.active,
            subtitle: `из ${data.subscriptions.total} всего`,
            icon: <Users className="w-5 h-5" />,
            color: 'text-blue-600 dark:text-blue-400',
            iconBg: 'bg-blue-500/10',
        },
        {
            label: 'SLA сегодня',
            value: `${data.sla.today}%`,
            subtitle: `${data.today.activations} усп. / ${data.today.activations + data.today.errors} всего`,
            icon: <ShieldCheck className="w-5 h-5" />,
            color: data.sla.today >= 99 ? 'text-green-600 dark:text-green-400' : data.sla.today >= 95 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400',
            iconBg: data.sla.today >= 99 ? 'bg-green-500/10' : data.sla.today >= 95 ? 'bg-yellow-500/10' : 'bg-red-500/10',
            sparkData: sparkSLA,
            sparkColor: '#22c55e',
        },
        {
            label: 'Ошибки сегодня',
            value: data.today.errors,
            subtitle: `${weekErrors} за неделю`,
            icon: <AlertTriangle className="w-5 h-5" />,
            color: data.today.errors === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
            iconBg: data.today.errors === 0 ? 'bg-green-500/10' : 'bg-red-500/10',
            sparkData: sparkErrors,
            sparkColor: '#ef4444',
        },
        {
            label: 'Активаций сегодня',
            value: data.today.activations,
            subtitle: `${weekActivations} за неделю`,
            icon: <Zap className="w-5 h-5" />,
            color: 'text-purple-600 dark:text-purple-400',
            iconBg: 'bg-purple-500/10',
            sparkData: sparkActivations,
            sparkColor: '#a855f7',
        },
        {
            label: 'Продления (7 дн.)',
            value: data.upcomingRenewals,
            subtitle: 'запланировано',
            icon: <CalendarClock className="w-5 h-5" />,
            color: 'text-orange-600 dark:text-orange-400',
            iconBg: 'bg-orange-500/10',
        },
    ];

    const actionBadge = (action: string) => {
        const map: Record<string, string> = {
            'ERROR': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
            'ACTIVATION': 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
            'RENEWAL': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
            'KEY_ADDED': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
            'MANUAL_ACTIVATION': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
            'USER_EDIT': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
            'BACKUP': 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
            'AUDIT': 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700',
        };
        return map[action] || 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700';
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-3 rounded-lg shadow-xl text-sm">
                    <p className="text-zinc-900 dark:text-zinc-300 font-medium mb-1">{label}</p>
                    {payload.map((entry: any) => (
                        <p key={entry.name} style={{ color: entry.color }} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span>{entry.name}: {entry.value}</span>
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    // Widget content map
    const widgetContent: Record<string, React.ReactNode> = {
        kpis: (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {kpis.map((kpi, idx) => (
                    <AnimatedKPI key={idx} {...kpi} />
                ))}
            </div>
        ),
        chart: (
            <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        Активации за 7 дней
                    </h2>
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                            Успешные
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                            Ошибки
                        </span>
                    </div>
                </div>
                <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.weekChart} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke={chartTextColor}
                                tick={{ fill: chartTextColor, fontSize: 12 }}
                            />
                            <YAxis
                                stroke={chartTextColor}
                                tick={{ fill: chartTextColor, fontSize: 12 }}
                                allowDecimals={false}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="activations" name="Успешные" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="errors" name="Ошибки" fill="#f87171" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        ),
        activity: (
            <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col">
                <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Последние события</h2>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[320px] divide-y divide-zinc-100 dark:divide-zinc-800/50">
                    {data.recentLogs.map((log: any) => (
                        <div key={log.id} className="px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${actionBadge(log.action)}`}>
                                    {log.action}
                                </span>
                                <span className="text-[11px] text-zinc-400 ml-auto whitespace-nowrap">
                                    {new Date(log.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
                                {log.details}
                            </p>
                            {log.email && (
                                <p className="text-xs text-zinc-400 truncate">{log.email}</p>
                            )}
                        </div>
                    ))}
                    {data.recentLogs.length === 0 && (
                        <div className="px-5 py-8 text-center text-zinc-500 text-sm">
                            Нет событий
                        </div>
                    )}
                </div>
            </div>
        ),
        quicklinks: (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Управление ключами', path: '/admin/keys', icon: <Key className="w-4 h-4" /> },
                    { label: 'Пользователи', path: '/admin/users', icon: <Users className="w-4 h-4" /> },
                    { label: 'Статистика', path: '/admin/stats', icon: <TrendingUp className="w-4 h-4" /> },
                    { label: 'SLA', path: '/admin/sla', icon: <ShieldCheck className="w-4 h-4" /> },
                ].map((link) => (
                    <button
                        key={link.path}
                        onClick={() => navigate(link.path)}
                        className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all text-left group"
                    >
                        <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {link.icon}
                        </div>
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                            {link.label}
                        </span>
                        <ArrowUpRight className="w-4 h-4 ml-auto text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-500 dark:group-hover:text-zinc-500 transition-colors" />
                    </button>
                ))}
            </div>
        ),
    };

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <Layout>
            <motion.div
                className="max-w-6xl mx-auto space-y-6"
                variants={container}
                initial="hidden"
                animate="show"
            >
                {/* Header */}
                <motion.div className="flex justify-between items-center" variants={item}>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Дашборд</h1>
                        <p className="text-sm text-zinc-500 mt-1">Обзор системы на {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    {/* ... (rest of header content) */}
                    <div className="flex items-center gap-2">
                        {sseConnected ? (
                            <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
                                <Wifi className="w-3 h-3" />
                                Live
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-500/10 px-2.5 py-1 rounded-full">
                                <WifiOff className="w-3 h-3" />
                                Offline
                            </span>
                        )}

                        {/* Widget settings */}
                        <div className="relative" ref={settingsRef}>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                title="Настройка виджетов"
                            >
                                <Settings2 className="w-4 h-4" />
                            </button>
                            {showSettings && (
                                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 py-2 overflow-hidden">
                                    <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Виджеты</span>
                                        <button onClick={resetWidgets} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1" title="Сбросить">
                                            <RotateCcw className="w-3 h-3" />
                                            Сброс
                                        </button>
                                    </div>
                                    {widgets.map((w, idx) => (
                                        <div
                                            key={w.id}
                                            draggable
                                            onDragStart={() => setDragIdx(idx)}
                                            onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                                            onDrop={() => {
                                                if (dragIdx !== null && dragIdx !== idx) reorder(dragIdx, idx);
                                                setDragIdx(null);
                                                setDragOverIdx(null);
                                            }}
                                            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                                            className={`flex items-center gap-2 px-4 py-2.5 cursor-grab active:cursor-grabbing transition-colors ${dragOverIdx === idx ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                                                }`}
                                        >
                                            <GripVertical className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 shrink-0" />
                                            <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">{w.label}</span>
                                            <button
                                                onClick={() => toggleVisibility(w.id)}
                                                className={`p-1 rounded transition-colors ${w.visible ? 'text-blue-500 hover:text-blue-600' : 'text-zinc-300 dark:text-zinc-600 hover:text-zinc-500'}`}
                                            >
                                                {w.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Render widgets in saved order */}
                {widgets.filter(w => w.visible).map(w => (
                    <motion.div key={w.id} variants={item}>
                        {widgetContent[w.id]}
                    </motion.div>
                ))}
            </motion.div>
        </Layout>
    );
}
