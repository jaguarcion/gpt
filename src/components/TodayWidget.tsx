import React, { useEffect, useState } from 'react';
import { getTodayStats, setAuthToken } from '../services/api';

export function TodayWidget() {
    const [stats, setStats] = useState<{ activations: number; errors: number; newSubs: number } | null>(null);

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    const loadStats = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) return;
            setAuthToken(token);
            const data = await getTodayStats();
            setStats(data);
        } catch (e) {
            // Silently fail
        }
    };

    if (!stats) return null;

    return (
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[11px]">
            <span className="text-zinc-400">Сегодня:</span>
            <span className="flex items-center gap-1">
                <span className="font-bold text-blue-600 dark:text-blue-400">{stats.newSubs}</span>
                <span className="text-zinc-400">новых</span>
            </span>
        </div>
    );
}
