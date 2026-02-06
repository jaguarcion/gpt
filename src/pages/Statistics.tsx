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

    const getPath = (key: string) => {
        if (stats.chart.length === 0) return '';
        const points = stats.chart.map((d: any, i: number) => {
            const x = ((i + 0.5) / stats.chart.length) * 100;
            const y = 100 - (d[key] / maxVal) * 100;
            return `${x},${y}`;
        });
        return `M ${points.join(' L ')}`;
    };

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
                    
                    <div className="relative h-64">
                        {/* Lines */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {/* Grid lines */}
                            <line x1="0" y1="25" x2="100" y2="25" stroke="#27272a" strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeDasharray="4" />
                            <line x1="0" y1="50" x2="100" y2="50" stroke="#27272a" strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeDasharray="4" />
                            <line x1="0" y1="75" x2="100" y2="75" stroke="#27272a" strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeDasharray="4" />

                            <path d={getPath('type3m')} fill="none" stroke="#a855f7" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <path d={getPath('type1m')} fill="none" stroke="#3b82f6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <path d={getPath('total')} fill="none" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        </svg>

                        <div className="absolute inset-0 flex items-stretch overflow-x-auto pb-2 pt-2 z-10">
                            {stats.chart.map((day: any, i: number) => (
                                <div key={day.date} className="flex-1 min-w-[10px] flex flex-col items-center group relative">
                                    <div className="w-full flex-1 relative hover:bg-zinc-800/20 transition-colors cursor-crosshair">
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-800 text-xs p-2 rounded hidden group-hover:block z-20 whitespace-nowrap border border-zinc-700 shadow-xl">
                                            <div className="font-bold border-b border-zinc-700 pb-1 mb-1">{day.date}</div>
                                            <div className="text-white">Всего: {day.total}</div>
                                            <div className="text-blue-400">1 Месяц: {day.type1m}</div>
                                            <div className="text-purple-400">3 Месяца: {day.type3m}</div>
                                        </div>
                                        
                                        {/* Dot on hover for Total */}
                                        <div 
                                            className="absolute w-2 h-2 bg-white rounded-full left-1/2 -translate-x-1/2 hidden group-hover:block pointer-events-none"
                                            style={{ top: `${100 - (day.total / maxVal) * 100}%`, marginTop: '-4px' }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-zinc-600 -rotate-45 origin-top-left mt-1 whitespace-nowrap absolute top-full left-1/2">
                                        {i % 2 === 0 ? new Date(day.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }) : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Spacer for rotated labels */}
                    <div className="h-6"></div>
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
