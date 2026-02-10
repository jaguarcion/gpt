import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ModeToggle } from './ModeToggle';
import { ApiStatusWidget } from './ApiStatusWidget';
import { NotificationCenter } from './NotificationCenter';
import { TodayWidget } from './TodayWidget';
import { PageTransition } from './PageTransition';
import { getChangelogBadge } from '../pages/Changelog';
import { useAuthStore } from '../stores/authStore';
import { CommandPalette } from './CommandPalette';
import { PullToRefreshIndicator } from './PullToRefreshIndicator';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { SSEToastListener } from './SSEToastListener';
import { ChevronDown, BarChart3, Settings, LogOut, Search, LayoutDashboard, KeyRound, Users, ScrollText, MoreHorizontal } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
}

interface NavLink {
    path: string;
    label: string;
    badge?: boolean;
}

interface NavGroup {
    label: string;
    icon: React.ReactNode;
    items: NavLink[];
}

type NavEntry = NavLink | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
    return 'items' in entry;
}

function NavDropdown({ group, location }: { group: NavGroup; location: ReturnType<typeof useLocation> }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const isActive = group.items.some(item => location.pathname === item.path);
    const hasBadge = group.items.some(item => item.badge);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    // Close on navigation
    useEffect(() => { setOpen(false); }, [location.pathname]);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className={`relative flex items-center gap-1 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive || open
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                }`}
            >
                {group.icon}
                {group.label}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                {hasBadge && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.6)]" />
                )}
            </button>

            {open && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                    {group.items.map(item => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`relative flex items-center px-4 py-2.5 text-sm transition-colors ${
                                location.pathname === item.path
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                        >
                            {item.label}
                            {item.badge && (
                                <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded-full">NEW</span>
                            )}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export function Layout({ children }: LayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const pullToRefresh = usePullToRefresh({
        onRefresh: async () => {
            window.location.reload();
        }
    });

    const navEntries: NavEntry[] = [
        { path: '/admin', label: 'Дашборд' },
        { path: '/admin/keys', label: 'Ключи' },
        { path: '/admin/users', label: 'Пользователи' },
        {
            label: 'Аналитика',
            icon: <BarChart3 className="w-4 h-4" />,
            items: [
                { path: '/admin/stats', label: 'Статистика' },
                { path: '/admin/sla', label: 'SLA' },
                { path: '/admin/inventory', label: 'Склад ключей' },
                { path: '/admin/calendar', label: 'Календарь продлений' },
            ]
        },
        {
            label: 'Система',
            icon: <Settings className="w-4 h-4" />,
            items: [
                { path: '/admin/logs', label: 'Логи' },
                { path: '/admin/health', label: 'Состояние системы' },
                { path: '/admin/backups', label: 'Бэкапы' },
                { path: '/admin/rate-limit', label: 'Rate Limit' },
                { path: '/admin/changelog', label: 'Changelog', badge: getChangelogBadge() },
            ]
        },
    ];

    // Flat list for mobile nav
    const allNavItems: NavLink[] = navEntries.flatMap(entry =>
        isGroup(entry) ? entry.items : [entry]
    );

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-100 flex flex-col">
            <CommandPalette />
            <SSEToastListener />
            <PullToRefreshIndicator {...pullToRefresh} />
            {/* Header */}
            <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link to="/admin" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                            GPT Admin
                        </Link>
                        
                        {/* Desktop Nav */}
                        <nav className="hidden md:flex items-center gap-0.5">
                            {navEntries.map((entry, idx) =>
                                isGroup(entry) ? (
                                    <NavDropdown key={idx} group={entry} location={location} />
                                ) : (
                                    <Link
                                        key={entry.path}
                                        to={entry.path}
                                        className={`relative px-3 py-2 rounded-md text-sm transition-colors ${
                                            location.pathname === entry.path
                                                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                                                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                                        }`}
                                    >
                                        {entry.label}
                                    </Link>
                                )
                            )}
                        </nav>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
                            title="Поиск (Ctrl+K)"
                        >
                            <Search className="w-3.5 h-3.5" />
                            <span>Поиск</span>
                        </button>
                        <TodayWidget />
                        <NotificationCenter />
                        <ModeToggle />
                        <button 
                            onClick={() => { useAuthStore.getState().logout(); navigate('/login'); }}
                            className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            title="Выйти"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Выйти</span>
                        </button>
                    </div>
                </div>
                
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 pb-20 md:pb-6">
                <PageTransition>
                    {children}
                </PageTransition>
            </main>

            {/* Mobile Bottom Tab Bar */}
            <MobileTabBar location={location} />
        </div>
    );
}

// ---- Mobile Bottom Tab Bar ----

interface MobileTab {
    path: string;
    label: string;
    icon: React.ReactNode;
}

function MobileTabBar({ location }: { location: ReturnType<typeof useLocation> }) {
    const [showMore, setShowMore] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);

    const primaryTabs: MobileTab[] = [
        { path: '/admin', label: 'Дашборд', icon: <LayoutDashboard className="w-5 h-5" /> },
        { path: '/admin/keys', label: 'Ключи', icon: <KeyRound className="w-5 h-5" /> },
        { path: '/admin/users', label: 'Юзеры', icon: <Users className="w-5 h-5" /> },
        { path: '/admin/logs', label: 'Логи', icon: <ScrollText className="w-5 h-5" /> },
    ];

    const moreTabs: MobileTab[] = [
        { path: '/admin/stats', label: 'Статистика', icon: <BarChart3 className="w-4 h-4" /> },
        { path: '/admin/sla', label: 'SLA', icon: <BarChart3 className="w-4 h-4" /> },
        { path: '/admin/inventory', label: 'Склад', icon: <KeyRound className="w-4 h-4" /> },
        { path: '/admin/calendar', label: 'Календарь', icon: <BarChart3 className="w-4 h-4" /> },
        { path: '/admin/health', label: 'Здоровье', icon: <Settings className="w-4 h-4" /> },
        { path: '/admin/backups', label: 'Бэкапы', icon: <Settings className="w-4 h-4" /> },
    ];

    const isMoreActive = moreTabs.some(t => location.pathname === t.path);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
        };
        if (showMore) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showMore]);

    useEffect(() => { setShowMore(false); }, [location.pathname]);

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 safe-bottom">
            <div className="flex items-center justify-around h-14">
                {primaryTabs.map(tab => {
                    const active = location.pathname === tab.path;
                    return (
                        <Link
                            key={tab.path}
                            to={tab.path}
                            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                                active
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-zinc-400 dark:text-zinc-500'
                            }`}
                        >
                            {tab.icon}
                            <span className="text-[10px] font-medium">{tab.label}</span>
                        </Link>
                    );
                })}

                {/* More button */}
                <div className="relative flex-1 h-full" ref={moreRef}>
                    <button
                        onClick={() => setShowMore(!showMore)}
                        className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors ${
                            isMoreActive || showMore
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-zinc-400 dark:text-zinc-500'
                        }`}
                    >
                        <MoreHorizontal className="w-5 h-5" />
                        <span className="text-[10px] font-medium">Ещё</span>
                    </button>

                    {showMore && (
                        <div className="absolute bottom-full right-0 mb-2 mr-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl py-1 overflow-hidden">
                            {moreTabs.map(tab => {
                                const active = location.pathname === tab.path;
                                return (
                                    <Link
                                        key={tab.path}
                                        to={tab.path}
                                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                            active
                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                                        }`}
                                    >
                                        {tab.icon}
                                        {tab.label}
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
