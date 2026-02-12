import React, { useEffect, useState, useRef } from 'react';
import { getNotifications, setAuthToken } from '../services/api';
import { Bell, X, AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { timeAgo } from '../lib/timeAgo';

interface Notification {
    id: string;
    type: 'error' | 'warning' | 'success' | 'info';
    title: string;
    message: string;
    email?: string;
    createdAt: string;
}

const STORAGE_KEY = 'notifications-last-read';

function getDayGroup(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (d.getTime() === today.getTime()) return 'Сегодня';
    if (d.getTime() === yesterday.getTime()) return 'Вчера';
    return 'Ранее';
}

function groupByDay(notifications: Notification[]): Map<string, Notification[]> {
    const groups = new Map<string, Notification[]>();
    for (const n of notifications) {
        const key = getDayGroup(n.createdAt);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(n);
    }
    return groups;
}

export function NotificationCenter() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const [visible, setVisible] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadNotifications();
        const interval = setInterval(loadNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };
        if (open) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    const loadNotifications = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) return;
            setAuthToken(token);
            const data = await getNotifications();
            setNotifications(data);
            updateUnreadCount(data);
        } catch (e) {
            // Silently fail
        }
    };

    const updateUnreadCount = (notifs: Notification[]) => {
        const lastRead = localStorage.getItem(STORAGE_KEY);
        if (!lastRead) {
            setUnreadCount(notifs.length);
            return;
        }
        const lastReadDate = new Date(lastRead);
        const unread = notifs.filter(n => new Date(n.createdAt) > lastReadDate).length;
        setUnreadCount(unread);
    };

    const handleOpen = () => {
        if (open) {
            handleClose();
        } else {
            setOpen(true);
            requestAnimationFrame(() => setVisible(true));
            localStorage.setItem(STORAGE_KEY, new Date().toISOString());
            setUnreadCount(0);
        }
    };

    const handleClose = () => {
        setVisible(false);
        setTimeout(() => setOpen(false), 150);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'error': return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
            case 'success': return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
            default: return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
        }
    };

    const getBorderColor = (type: string) => {
        switch (type) {
            case 'error': return 'border-l-red-500';
            case 'warning': return 'border-l-yellow-500';
            case 'success': return 'border-l-green-500';
            default: return 'border-l-blue-500';
        }
    };

    const groups = groupByDay(notifications);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={handleOpen}
                className="relative p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                title="Уведомления"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className={`absolute right-0 top-full mt-2 w-96 max-h-[480px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden transition-all duration-150 origin-top-right ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80">
                        <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Уведомления</h3>
                        <button
                            onClick={handleClose}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Notification List */}
                    <div className="overflow-y-auto flex-1">
                        {notifications.length === 0 ? (
                            <div className="px-4 py-10 text-center text-zinc-500 text-sm">
                                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                Нет уведомлений
                            </div>
                        ) : (
                            Array.from(groups.entries()).map(([group, items]) => (
                                <div key={group}>
                                    {/* Day group header */}
                                    <div className="px-4 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 sticky top-0 z-10">
                                        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{group}</span>
                                    </div>
                                    {items.map((n, idx) => (
                                        <div
                                            key={n.id}
                                            className={`px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors border-l-2 ${getBorderColor(n.type)}`}
                                            style={{ animationDelay: `${idx * 30}ms` }}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5">
                                                    {getIcon(n.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-medium text-sm text-zinc-900 dark:text-white">{n.title}</span>
                                                        <span className="text-[10px] text-zinc-400 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                                                    </div>
                                                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 break-words">{n.message}</p>
                                                    {n.email && (
                                                        <span className="text-[10px] text-zinc-400 mt-1 block font-mono">{n.email}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-zinc-400">
                                    {notifications.filter(n => n.type === 'error').length} ошибок •{' '}
                                    {notifications.filter(n => n.type === 'warning').length} предупреждений
                                </span>
                                <span className="text-[10px] text-zinc-400">Обновление каждые 30с</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
