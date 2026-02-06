import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface LogEntry {
    id: number;
    action: string;
    details: string;
    email: string | null;
    createdAt: string;
}

interface UserHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    email: string;
}

export function UserHistoryModal({ isOpen, onClose, email }: UserHistoryModalProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && email) {
            loadLogs();
        }
    }, [isOpen, email]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) return;

            // Use the existing search parameter to filter by email
            const response = await axios.get('/api/logs', {
                headers: { Authorization: `Bearer ${token}` },
                params: { 
                    search: email,
                    limit: 100 
                }
            });
            setLogs(response.data);
        } catch (e) {
            console.error('Failed to load logs:', e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">История активности: {email}</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {loading ? (
                        <div className="text-center text-zinc-500 py-8">Загрузка...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-center text-zinc-500 py-8">История пуста</div>
                    ) : (
                        logs.map(log => (
                            <div key={log.id} className="flex gap-4 text-sm p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                <div className="text-zinc-500 dark:text-zinc-400 whitespace-nowrap text-xs font-mono">
                                    {new Date(log.createdAt).toLocaleString()}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase ${
                                            log.action === 'ERROR' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                            log.action.includes('ACTIVATION') ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                                            log.action === 'RENEWAL' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                                            'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                                        }`}>
                                            {log.action}
                                        </span>
                                    </div>
                                    <div className="text-zinc-800 dark:text-zinc-300 break-all text-xs">
                                        {log.details}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                    >
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
}
