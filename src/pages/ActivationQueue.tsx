import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useSSE } from '../hooks/useSSE';
import { useToast } from '../components/Toast';
import { setAuthToken } from '../services/api'; // Ensure this is imported
import axios from 'axios';
import { Play, Clock, CheckCircle2, XCircle, Loader2, RotateCcw } from 'lucide-react';
import { RelativeTime } from '../components/RelativeTime';

interface QueueStatus {
    isRunning: boolean;
    nextRun: string; // ISO date
    lastRun: string | null;
    processed: number;
    total: number;
    currentEmail?: string;
    errors: { email: string; error: string; time: string }[];
}

// Move to api.ts
const getQueueStatus = async () => {
    const token = localStorage.getItem('adminToken');
    const response = await axios.get('/api/queue/status', {
        headers: { Authorization: token }
    });
    return response.data;
};

const runQueue = async () => {
    const token = localStorage.getItem('adminToken');
    await axios.post('/api/queue/run', {}, {
        headers: { Authorization: token }
    });
};

export function ActivationQueue() {
    const [status, setStatus] = useState<QueueStatus>({
        isRunning: false,
        nextRun: new Date(Date.now() + 3600000).toISOString(),
        lastRun: null,
        processed: 0,
        total: 0,
        errors: []
    });
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    // Listen to SSE updates
    const { lastEvent } = useSSE();

    useEffect(() => {
        setAuthToken(localStorage.getItem('adminToken') || '');
        loadStatus();
    }, []);

    useEffect(() => {
        if (lastEvent && lastEvent.type === 'queue-update') {
            const data = lastEvent.data as unknown as Partial<QueueStatus>;
            // Update status live
            setStatus(prev => {
                const newStatus = { ...prev, ...data };
                // Check if we just finished
                if (prev.isRunning && !newStatus.isRunning) {
                    toast.success('Очередь обработки завершена');
                    loadStatus(); // Reload full status to be sure
                }
                return newStatus;
            });
        }
    }, [lastEvent]);

    const loadStatus = async () => {
        try {
            const data = await getQueueStatus();
            setStatus(data);
        } catch (e) {
            // ignore
        } finally {
            setLoading(false);
        }
    };

    const handleRun = async () => {
        try {
            await runQueue();
            toast.info('Запуск обработки...');
            setStatus(prev => ({ ...prev, isRunning: true, processed: 0, total: 0 }));
        } catch (e: any) {
            toast.error('Ошибка запуска: ' + (e.response?.data?.error || e.message));
        }
    };

    const progress = status.total > 0 ? (status.processed / status.total) * 100 : 0;

    return (
        <Layout>
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                        Очередь активации
                    </h1>
                    <button
                        onClick={handleRun}
                        disabled={status.isRunning}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-white font-medium transition-all shadow-lg ${status.isRunning
                            ? 'bg-zinc-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30 active:scale-95'
                            }`}
                    >
                        {status.isRunning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                        {status.isRunning ? 'Обработка...' : 'Запустить сейчас'}
                    </button>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {/* Status Card */}
                    <div className="col-span-2 bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                <Clock className="w-5 h-5 text-zinc-500" />
                                Статус планировщика
                            </h3>
                            <div className={`px-3 py-1 rounded-full text-xs font-medium ${status.isRunning
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                }`}>
                                {status.isRunning ? 'В РАБОТЕ' : 'ОЖИДАНИЕ'}
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Countdown / Status */}
                            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-zinc-500 dark:text-zinc-400">Следующий запуск</div>
                                    <div className="text-xl font-mono font-medium text-zinc-900 dark:text-white mt-1">
                                        <RelativeTime date={status.nextRun} />
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-zinc-500 dark:text-zinc-400">Последний запуск</div>
                                    <div className="text-sm font-medium text-zinc-900 dark:text-white mt-1">
                                        {status.lastRun ? <RelativeTime date={status.lastRun} /> : 'Нет данных'}
                                    </div>
                                </div>
                            </div>

                            {/* Progress Bar (Visible only when running or recently finished) */}
                            {(status.isRunning || status.processed > 0) && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-600 dark:text-zinc-400">Прогресс выполнения</span>
                                        <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
                                    </div>
                                    <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-600 transition-all duration-300 ease-out relative"
                                            style={{ width: `${progress}%` }}
                                        >
                                            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs text-zinc-500">
                                        <span>Обработано: {status.processed} / {status.total}</span>
                                        {status.currentEmail && (
                                            <span className="animate-pulse text-blue-500">
                                                Текущий: {status.currentEmail}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats Card */}
                    <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col justify-center gap-6">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">
                                {status.total}
                            </div>
                            <div className="text-xs text-zinc-500 uppercase tracking-wider mt-1">К обработке</div>
                        </div>
                        <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800" />
                        <div className="text-center">
                            <div className="text-3xl font-bold text-red-500 tabular-nums">
                                {status.errors.length}
                            </div>
                            <div className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Ошибок</div>
                        </div>
                    </div>
                </div>

                {/* Recent Errors */}
                {status.errors.length > 0 && (
                    <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                            <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                <XCircle className="w-5 h-5 text-red-500" />
                                Ошибки обработки
                            </h3>
                            <button
                                onClick={() => setStatus(prev => ({ ...prev, errors: [] }))}
                                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1"
                            >
                                <RotateCcw className="w-3 h-3" /> Очистить
                            </button>
                        </div>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {status.errors.map((err, i) => (
                                <div key={i} className="px-6 py-3 flex items-start gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors">
                                    <div className="min-w-[40px] pt-1">
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm text-zinc-900 dark:text-white">{err.email}</div>
                                        <div className="text-xs text-zinc-500 font-mono mt-0.5">{new Date(err.time).toLocaleTimeString()}</div>
                                    </div>
                                    <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 px-3 py-1 rounded-lg border border-red-100 dark:border-red-900/20">
                                        {err.error}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
