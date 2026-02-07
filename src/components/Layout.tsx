import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ModeToggle } from './ModeToggle';
import { ApiStatusWidget } from './ApiStatusWidget';
import { NotificationCenter } from './NotificationCenter';

interface LayoutProps {
    children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { path: '/admin', label: 'Главная' },
        { path: '/admin/users', label: 'Пользователи' },
        { path: '/admin/logs', label: 'Логи' },
        { path: '/admin/stats', label: 'Статистика' },
        { path: '/admin/backups', label: 'Бэкапы' },
        { path: '/admin/inventory', label: 'Склад' },
        { path: '/admin/health', label: 'Система' },
        { path: '/admin/rate-limit', label: 'Rate Limit' },
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-100 flex flex-col">
            {/* Header */}
            <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link to="/admin" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                            GPT Admin
                        </Link>
                        
                        {/* Desktop Nav */}
                        <nav className="hidden md:flex items-center gap-1">
                            {navItems.map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`px-3 py-2 rounded-md text-sm transition-colors ${
                                        location.pathname === item.path 
                                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium' 
                                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="hidden sm:block">
                             <ApiStatusWidget />
                        </div>
                        <NotificationCenter />
                        <ModeToggle />
                        <button 
                            onClick={() => { localStorage.removeItem('adminToken'); navigate('/admin'); }}
                            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        >
                            Выйти
                        </button>
                    </div>
                </div>
                
                {/* Mobile Nav (Horizontal Scroll) */}
                <div className="md:hidden overflow-x-auto border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex p-2 gap-2 min-w-max">
                        {navItems.map(item => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                                    location.pathname === item.path 
                                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 shadow-sm' 
                                        : 'text-zinc-600 dark:text-zinc-400 border border-transparent'
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">
                {children}
            </main>
        </div>
    );
}