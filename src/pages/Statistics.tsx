import React, { useEffect, useState } from 'react';
import { getDailyStats, setAuthToken } from '../services/api';
import { Layout } from '../components/Layout';
import { ApiStatusWidget } from '../components/ApiStatusWidget';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';

export function Statistics() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
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
            const data = await getDailyStats();
            setStats(data);
        } catch (e) {
            console.error('Failed to load stats:', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Загрузка...</div>;
    }

    if (!stats) return null;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-zinc-800 border border-zinc-700 p-3 rounded-lg shadow-xl text-sm">
                    <p className="text-zinc-300 font-medium mb-2">{label}</p>
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

    return (
        <Layout>
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <h1 className="text-2xl font-bold">Статистика</h1>
                    </div>
                    <ApiStatusWidget />
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                        <div className="text-zinc-500 text-sm mb-1">Всего активных</div>
                        <div className="text-2xl font-bold text-green-500">{stats.summary.active}</div>
                    </div>
                    <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                        <div className="text-zinc-500 text-sm mb-1">Всего завершенных</div>
                        <div className="text-2xl font-bold text-zinc-400">{stats.summary.completed}</div>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
                    <h3 className="text-lg font-medium mb-6">Подключения за последние 30 дней</h3>
                    
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={stats.chart}
                                margin={{
                                    top: 5,
                                    right: 30,
                                    left: 20,
                                    bottom: 5,
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#71717a" 
                                    tick={{ fill: '#71717a', fontSize: 12 }}
                                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                                    minTickGap={30}
                                />
                                <YAxis 
                                    stroke="#71717a" 
                                    tick={{ fill: '#71717a', fontSize: 12 }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Line 
                                    type="monotone" 
                                    dataKey="total" 
                                    name="Всего" 
                                    stroke="#fff" 
                                    strokeWidth={2}
                                    dot={{ fill: '#fff', r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="type1m" 
                                    name="1 Месяц" 
                                    stroke="#3b82f6" 
                                    strokeWidth={2}
                                    dot={{ fill: '#3b82f6', r: 4 }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="type2m" 
                                    name="2 Месяца" 
                                    stroke="#10b981" 
                                    strokeWidth={2}
                                    dot={{ fill: '#10b981', r: 4 }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="type3m" 
                                    name="3 Месяца" 
                                    stroke="#a855f7" 
                                    strokeWidth={2}
                                    dot={{ fill: '#a855f7', r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Cohort Analysis */}
                <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
                    <h3 className="text-lg font-medium mb-2">Когортный анализ (Удержание)</h3>
                    <p className="text-sm text-zinc-500 mb-6">Показывает, сколько пользователей из каждого месяца продолжают пользоваться сервисом.</p>
                    
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={stats.cohorts}
                                margin={{
                                    top: 5,
                                    right: 30,
                                    left: 20,
                                    bottom: 5,
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis 
                                    dataKey="month" 
                                    stroke="#71717a" 
                                    tick={{ fill: '#71717a', fontSize: 12 }}
                                />
                                <YAxis 
                                    stroke="#71717a" 
                                    tick={{ fill: '#71717a', fontSize: 12 }}
                                />
                                <Tooltip 
                                    cursor={{ fill: '#27272a' }}
                                    contentStyle={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="total_users" name="Всего новых" fill="#3f3f46" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="active_users" name="Активны сейчас" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="retained_users" name="Продлили (2+ раз)" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-900 text-zinc-400 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3">Дата</th>
                                <th className="px-6 py-3">Всего</th>
                                <th className="px-6 py-3">1 Месяц</th>
                                <th className="px-6 py-3">2 Месяца</th>
                                <th className="px-6 py-3">3 Месяца</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {[...stats.chart].reverse().map((day: any) => (
                                <tr key={day.date} className="hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-zinc-400">{day.date}</td>
                                    <td className="px-6 py-4 font-bold text-white">{day.total}</td>
                                    <td className="px-6 py-4 text-blue-400">{day.type1m}</td>
                                    <td className="px-6 py-4 text-green-400">{day.type2m}</td>
                                    <td className="px-6 py-4 text-purple-400">{day.type3m}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
}
