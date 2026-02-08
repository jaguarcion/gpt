import React, { useEffect, useState } from 'react';
import { getCalendar, setAuthToken } from '../services/api';
import { Layout } from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { SkeletonChart } from '../components/Skeleton';

interface CalendarDay {
    date: string;
    renewals: number;
    expirations: number;
    events: Array<{ date: string; type: string; email: string; subType: string; round?: number }>;
}

export function Calendar() {
    const [data, setData] = useState<CalendarDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) { navigate('/admin'); return; }
        setAuthToken(token);
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const result = await getCalendar();
            setData(result);
        } catch (e) {
            console.error('Failed to load calendar:', e);
        } finally {
            setLoading(false);
        }
    };

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7; // Monday start
    const daysInMonth = lastDay.getDate();

    const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
    const goToday = () => setCurrentMonth(new Date());

    const monthName = currentMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

    const getEventsForDay = (day: number): CalendarDay | undefined => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return data.find(d => d.date === dateStr);
    };

    const isToday = (day: number) => {
        const now = new Date();
        return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
    };

    const getIntensity = (count: number) => {
        if (count === 0) return '';
        if (count <= 2) return 'bg-blue-500/10';
        if (count <= 5) return 'bg-blue-500/20';
        if (count <= 10) return 'bg-blue-500/30';
        return 'bg-blue-500/40';
    };

    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    return (
        <Layout>
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <CalendarDays className="w-6 h-6 text-blue-500" />
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Календарь продлений</h1>
                    </div>
                    <button onClick={goToday} className="text-sm px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 transition-colors">
                        Сегодня
                    </button>
                </div>

                {loading ? <SkeletonChart /> : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Calendar Grid */}
                        <div className="lg:col-span-2 bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                            {/* Month Navigation */}
                            <div className="flex items-center justify-between mb-6">
                                <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                    <ChevronLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                                </button>
                                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white capitalize">{monthName}</h2>
                                <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                    <ChevronRight className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                                </button>
                            </div>

                            {/* Weekday Headers */}
                            <div className="grid grid-cols-7 gap-1 mb-1">
                                {weekDays.map(d => (
                                    <div key={d} className="text-center text-xs font-medium text-zinc-400 py-2">{d}</div>
                                ))}
                            </div>

                            {/* Days Grid */}
                            <div className="grid grid-cols-7 gap-1">
                                {/* Padding for first week */}
                                {Array.from({ length: startPad }).map((_, i) => (
                                    <div key={`pad-${i}`} className="aspect-square" />
                                ))}

                                {/* Actual days */}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const events = getEventsForDay(day);
                                    const totalEvents = (events?.renewals || 0) + (events?.expirations || 0);
                                    const today = isToday(day);
                                    const selected = selectedDay?.date === `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                                    return (
                                        <button
                                            key={day}
                                            onClick={() => events && setSelectedDay(events)}
                                            className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-sm transition-all relative ${
                                                selected ? 'ring-2 ring-blue-500 bg-blue-500/10' :
                                                today ? 'ring-2 ring-zinc-400 dark:ring-zinc-600' :
                                                ''
                                            } ${getIntensity(totalEvents)} ${events ? 'cursor-pointer hover:ring-2 hover:ring-blue-400' : 'cursor-default'}`}
                                        >
                                            <span className={`${today ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                                {day}
                                            </span>
                                            {events && (
                                                <div className="flex gap-0.5">
                                                    {events.renewals > 0 && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title={`${events.renewals} продлений`} />
                                                    )}
                                                    {events.expirations > 0 && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" title={`${events.expirations} истечений`} />
                                                    )}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Legend */}
                            <div className="flex gap-4 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Продление
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Истечение
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                    <span className="w-4 h-2.5 rounded bg-blue-500/30" /> Интенсивность
                                </div>
                            </div>
                        </div>

                        {/* Details Panel */}
                        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                            <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
                                {selectedDay ? new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Выберите дату'}
                            </h3>

                            {selectedDay ? (
                                <div className="space-y-3">
                                    {/* Summary */}
                                    <div className="flex gap-3 mb-4">
                                        {selectedDay.renewals > 0 && (
                                            <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-center">
                                                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{selectedDay.renewals}</div>
                                                <div className="text-[10px] text-blue-500">продлений</div>
                                            </div>
                                        )}
                                        {selectedDay.expirations > 0 && (
                                            <div className="flex-1 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg text-center">
                                                <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{selectedDay.expirations}</div>
                                                <div className="text-[10px] text-orange-500">истечений</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Events List */}
                                    <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                                        {selectedDay.events.map((ev, idx) => (
                                            <div key={idx} className={`px-3 py-2 rounded-lg border text-xs ${
                                                ev.type === 'renewal'
                                                    ? 'border-blue-200 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10'
                                                    : 'border-orange-200 dark:border-orange-900/30 bg-orange-50/50 dark:bg-orange-900/10'
                                            }`}>
                                                <div className="font-mono text-zinc-900 dark:text-white truncate">{ev.email}</div>
                                                <div className="flex items-center gap-2 mt-1 text-zinc-500">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                        ev.subType === '3m' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                                                        ev.subType === '2m' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                                                        'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                    }`}>{ev.subType}</span>
                                                    <span>{ev.type === 'renewal' ? `Продление #${ev.round}` : 'Истечение'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 text-zinc-400">
                                    <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">Нажмите на дату с событиями, чтобы увидеть подробности</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
