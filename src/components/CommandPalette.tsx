import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Key, FileText, ArrowRight, Command, LayoutDashboard, BarChart3, Shield, Database, Activity, Calendar as CalendarIcon, Gauge, Clock } from 'lucide-react';
import { globalSearch } from '../services/api';

interface SearchResults {
  subscriptions: Array<{ id: number; email: string; type: string; status: string }>;
  keys: Array<{ id: number; code: string; status: string; usedByEmail: string | null }>;
  logs: Array<{ id: number; action: string; details: string | null; email: string | null; createdAt: string }>;
}

const PAGES = [
  { path: '/admin', label: 'Дашборд', icon: LayoutDashboard, keywords: 'dashboard главная' },
  { path: '/admin/keys', label: 'Ключи', icon: Key, keywords: 'keys cdk коды' },
  { path: '/admin/users', label: 'Пользователи', icon: User, keywords: 'users subscriptions подписки email' },
  { path: '/admin/stats', label: 'Статистика', icon: BarChart3, keywords: 'statistics графики аналитика' },
  { path: '/admin/sla', label: 'SLA', icon: Shield, keywords: 'sla uptime доступность' },
  { path: '/admin/inventory', label: 'Склад ключей', icon: Database, keywords: 'inventory запас склад' },
  { path: '/admin/calendar', label: 'Календарь продлений', icon: CalendarIcon, keywords: 'calendar расписание продления' },
  { path: '/admin/logs', label: 'Логи', icon: FileText, keywords: 'logs активность журнал' },
  { path: '/admin/health', label: 'Состояние системы', icon: Activity, keywords: 'health система мониторинг' },
  { path: '/admin/backups', label: 'Бэкапы', icon: Database, keywords: 'backups резервные копии' },
  { path: '/admin/rate-limit', label: 'Rate Limit', icon: Gauge, keywords: 'rate limit лимиты запросы' },
  { path: '/admin/changelog', label: 'Changelog', icon: Clock, keywords: 'changelog изменения версии' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults(null);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await globalSearch(q);
      setResults(data);
      setSelectedIndex(0);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  // Filter pages by query
  const filteredPages = query.length > 0
    ? PAGES.filter(p =>
        p.label.toLowerCase().includes(query.toLowerCase()) ||
        p.keywords.toLowerCase().includes(query.toLowerCase())
      )
    : PAGES;

  // Build flat list of all navigable items
  const allItems: Array<{ type: string; label: string; sublabel?: string; action: () => void }> = [];

  // Pages first
  filteredPages.forEach(p => {
    allItems.push({
      type: 'page',
      label: p.label,
      action: () => { navigate(p.path); setOpen(false); }
    });
  });

  // Then search results
  if (results) {
    results.subscriptions.forEach(s => {
      allItems.push({
        type: 'subscription',
        label: s.email,
        sublabel: `${s.type} · ${s.status}`,
        action: () => { navigate(`/admin/users?search=${encodeURIComponent(s.email)}`); setOpen(false); }
      });
    });
    results.keys.forEach(k => {
      allItems.push({
        type: 'key',
        label: k.code.length > 20 ? k.code.slice(0, 20) + '...' : k.code,
        sublabel: k.status + (k.usedByEmail ? ` · ${k.usedByEmail}` : ''),
        action: () => { navigate(`/admin/keys?search=${encodeURIComponent(k.code)}`); setOpen(false); }
      });
    });
    results.logs.forEach(l => {
      allItems.push({
        type: 'log',
        label: l.action,
        sublabel: l.details?.slice(0, 50) || l.email || '',
        action: () => { navigate('/admin/logs'); setOpen(false); }
      });
    });
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault();
      allItems[selectedIndex].action();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'page': return <ArrowRight className="w-4 h-4" />;
      case 'subscription': return <User className="w-4 h-4" />;
      case 'key': return <Key className="w-4 h-4" />;
      case 'log': return <FileText className="w-4 h-4" />;
      default: return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'page': return 'Страница';
      case 'subscription': return 'Подписка';
      case 'key': return 'Ключ';
      case 'log': return 'Лог';
      default: return '';
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Поиск по страницам, подпискам, ключам..."
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none"
          />
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] rounded border border-zinc-200 dark:border-zinc-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {!loading && allItems.length === 0 && query.length >= 2 && (
            <p className="text-center text-sm text-zinc-500 py-8">Ничего не найдено</p>
          )}

          {!loading && allItems.map((item, idx) => {
            const isFirstOfType = idx === 0 || allItems[idx - 1].type !== item.type;
            return (
              <React.Fragment key={`${item.type}-${idx}`}>
                {isFirstOfType && (
                  <div className="px-2 pt-2 pb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {getTypeLabel(item.type)}
                  </div>
                )}
                <button
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    idx === selectedIndex
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <span className="shrink-0 text-zinc-400">{getIcon(item.type)}</span>
                  <span className="truncate font-medium">{item.label}</span>
                  {item.sublabel && (
                    <span className="ml-auto text-xs text-zinc-400 truncate max-w-[40%]">{item.sublabel}</span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px]">↑↓</kbd> навигация</span>
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px]">↵</kbd> выбрать</span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>
      </div>
    </div>
  );
}
