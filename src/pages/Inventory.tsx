import React, { useEffect, useState } from 'react';
import { getInventoryStats, setAuthToken } from '../services/api';
import { Layout } from '../components/Layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../components/ThemeProvider';

export function Inventory() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [targetDays, setTargetDays] = useState(5); // Calculator input
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
        if (!token) {
            navigate('/admin');
            return;
        }
        setAuthToken(token);
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await getInventoryStats();
            setStats(data);
        } catch (e) {
            console.error('Failed to load inventory stats:', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center text-zinc-500">Загрузка...</div>;
    if (!stats) return null;

    const chartGridColor = isDark ? "#27272a" : "#e4e4e7";
    const chartTextColor = isDark ? "#71717a" : "#71717a";

    // Calculator Logic
    const keysNeeded = Math.max(0, Math.ceil((stats.summary.burnRate7d * targetDays) - stats.summary.active));
    const projectedDepletionDate = new Date();
    projectedDepletionDate.setDate(projectedDepletionDate.getDate() + stats.summary.runwayDays);

    return (
        <Layout>
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Управление складом ключей</h1>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="text-zinc-500 text-sm mb-1">Доступно на складе</div>
                        <div className="text-3xl font-bold text-green-600 dark:text-green-500">{stats.summary.active}</div>
                        <div className="text-xs text-zinc-400 mt-2">Ключей готово к выдаче</div>
                    </div>
                    
                    <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="text-zinc-500 text-sm mb-1">Скорость расхода (7д)</div>
                        <div className="text-3xl font-bold text-zinc-900 dark:text-white">{stats.summary.burnRate7d}</div>
                        <div className="text-xs text-zinc-400 mt-2">Ключей в день</div>
                    </div>

                    <div className={`bg-white dark:bg-zinc-900/50 p-6 rounded-xl border ${
                        stats.summary.runwayDays < 7 ? 'border-red-500/50 bg-red-50/10' : 'border-zinc-200 dark:border-zinc-800'
                    }`}>
                        <div className="text-zinc-500 text-sm mb-1">Запаса хватит на</div>
                        <div className={`text-3xl font-bold ${
                            stats.summary.runwayDays < 7 ? 'text-red-600 dark:text-red-500' : 'text-zinc-900 dark:text-white'
                        }`}>
                            {stats.summary.runwayDays > 365 ? '> 1 года' : `${stats.summary.runwayDays} дн.`}
                        </div>
                        <div className="text-xs text-zinc-400 mt-2">
                            {stats.summary.runwayDays < 999 && `До ${projectedDepletionDate.toLocaleDateString()}`}
                            {stats.summary.runwayDays >= 999 && 'Бесконечный запас'}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="text-zinc-500 text-sm mb-1">Всего использовано</div>
                        <div className="text-3xl font-bold text-zinc-600 dark:text-zinc-500">{stats.summary.used}</div>
                        <div className="text-xs text-zinc-400 mt-2">За всё время</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Burn Rate Chart */}
                    <div className="lg:col-span-2 bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-6">Расход ключей (30 дней)</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.chart}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                                    <XAxis 
                                        dataKey="date" 
                                        stroke={chartTextColor} 
                                        tick={{ fill: chartTextColor, fontSize: 12 }}
                                        tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                                        minTickGap={30}
                                    />
                                    <YAxis 
                                        stroke={chartTextColor} 
                                        tick={{ fill: chartTextColor, fontSize: 12 }}
                                        allowDecimals={false}
                                    />
                                    <Tooltip 
                                        cursor={{ fill: isDark ? '#3f3f46' : '#f4f4f5', opacity: 0.4 }}
                                        contentStyle={{ 
                                            backgroundColor: isDark ? '#27272a' : '#fff', 
                                            border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`, 
                                            borderRadius: '8px',
                                            color: isDark ? '#fff' : '#000'
                                        }}
                                    />
                                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Использовано" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Restock Calculator */}
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Калькулятор закупки</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                                    На сколько дней нужен запас?
                                </label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" 
                                        min="1"
                                        value={targetDays}
                                        onChange={(e) => setTargetDays(Math.max(1, parseInt(e.target.value) || 0))}
                                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                                    />
                                    <span className="text-zinc-500">дней</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Текущий расход (7д):</span>
                                    <span className="font-mono text-zinc-900 dark:text-white">{stats.summary.burnRate7d} / день</span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Имеется в наличии:</span>
                                    <span className="font-mono text-green-600 dark:text-green-500">{stats.summary.active} шт.</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-800">
                                    <span className="font-medium text-zinc-900 dark:text-white">Нужно докупить:</span>
                                    <span className={`text-xl font-bold ${keysNeeded > 0 ? 'text-blue-600' : 'text-green-600'}`}>
                                        {keysNeeded > 0 ? keysNeeded : '0'} шт.
                                    </span>
                                </div>
                            </div>
                            
                            {keysNeeded > 0 && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-3 rounded text-xs">
                                    💡 Рекомендуем закупить {keysNeeded} ключей, чтобы обеспечить бесперебойную работу на {targetDays} дней.
                                </div>
                            )}
                            {keysNeeded === 0 && (
                                <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-3 rounded text-xs">
                                    ✅ Текущего запаса достаточно для вашей цели.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
