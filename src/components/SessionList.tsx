import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Session {
    id: number;
    email: string;
    telegramId: string | null;
    expiresAt: string;
    createdAt: string;
}

export function SessionList() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await axios.get('http://localhost:3001/api/sessions/active', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSessions(response.data);
        } catch (e) {
            console.error('Failed to load sessions:', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900">
                <h3 className="font-medium text-zinc-100">Активные сессии ({sessions.length})</h3>
            </div>
            <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-900/50 text-zinc-500 text-xs uppercase sticky top-0">
                        <tr>
                            <th className="px-4 py-2">Email</th>
                            <th className="px-4 py-2">Telegram ID</th>
                            <th className="px-4 py-2">Истекает</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                        {loading ? (
                            <tr><td colSpan={3} className="px-4 py-4 text-center text-zinc-500">Загрузка...</td></tr>
                        ) : sessions.length === 0 ? (
                            <tr><td colSpan={3} className="px-4 py-4 text-center text-zinc-500">Нет активных сессий</td></tr>
                        ) : (
                            sessions.map(session => (
                                <tr key={session.id} className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-4 py-2 text-zinc-300">{session.email}</td>
                                    <td className="px-4 py-2 text-zinc-400 font-mono text-xs">{session.telegramId?.toString() || '-'}</td>
                                    <td className="px-4 py-2 text-zinc-400 text-xs">
                                        {new Date(session.expiresAt).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
