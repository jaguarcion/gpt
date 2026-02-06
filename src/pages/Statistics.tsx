import React, { useEffect, useState } from 'react';
import { getDailyStats, setAuthToken } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { ApiStatusWidget } from '../components/ApiStatusWidget';

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

    // Calculate max value for chart scaling
    const maxVal = Math.max(...stats.chart.map((d: any) => d.total), 1);

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <Link to="/admin" className="text-zinc-400 hover:text-white transition-colors">← Назад</Link>
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
                    
                    <div className="h-64 flex gap-2 overflow-x-auto pb-2 pt-10 items-stretch">
                        {stats.chart.map((day: any) => (
                            <div key={day.date} className="flex-1 min-w-[30px] flex flex-col items-center gap-2 group">
                                <div className="w-full flex flex-col-reverse flex-1 relative">
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-800 text-xs p-2 rounded hidden group-hover:block z-10 whitespace-nowrap border border-zinc-700">
                                        <div className="font-bold">{day.date}</div>
                                        <div>Всего: {day.total}</div>
                                        <div className="text-blue-400">1 Месяц: {day.type1m}</div>
                                        <div className="text-purple-400">3 Месяца: {day.type3m}</div>
                                    </div>

                                    {/* Bars */}
                                    <div 
                                        style={{ height: `${(day.type3m / maxVal) * 100}%` }} 
                                        className="w-full bg-purple-500/50 hover:bg-purple-500/70 transition-all rounded-t-sm"
                                    />
                                    <div 
                                        style={{ height: `${(day.type1m / maxVal) * 100}%` }} 
                                        className="w-full bg-blue-500/50 hover:bg-blue-500/70 transition-all rounded-t-sm mb-[1px]"
                                    />
                                </div>
                                <span className="text-[10px] text-zinc-600 -rotate-45 origin-top-left mt-2 whitespace-nowrap">
                                    {new Date(day.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                                </span>
                            </div>
                        ))}
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
                                <th className="px-6 py-3">3 Месяца</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {[...stats.chart].reverse().map((day: any) => (
                                <tr key={day.date} className="hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-zinc-400">{day.date}</td>
                                    <td className="px-6 py-4 font-bold text-white">{day.total}</td>
                                    <td className="px-6 py-4 text-blue-400">{day.type1m}</td>
                                    <td className="px-6 py-4 text-purple-400">{day.type3m}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
