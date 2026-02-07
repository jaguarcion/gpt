import React, { useState, useRef, useEffect } from 'react';
import { Settings2, RotateCcw } from 'lucide-react';

export interface Column {
    key: string;
    label: string;
    required?: boolean; // Can't be hidden
}

interface ColumnSelectorProps {
    columns: Column[];
    visible: string[];
    onToggle: (key: string) => void;
    onReset: () => void;
}

export function useColumnVisibility(storageKey: string, allColumns: Column[]) {
    const defaultVisible = allColumns.map(c => c.key);

    const [visible, setVisible] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(`columns-${storageKey}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Ensure required columns are always visible
                const required = allColumns.filter(c => c.required).map(c => c.key);
                const merged = [...new Set([...parsed, ...required])];
                return merged;
            }
        } catch (e) { /* ignore */ }
        return defaultVisible;
    });

    const toggle = (key: string) => {
        const col = allColumns.find(c => c.key === key);
        if (col?.required) return;

        setVisible(prev => {
            const next = prev.includes(key)
                ? prev.filter(k => k !== key)
                : [...prev, key];
            localStorage.setItem(`columns-${storageKey}`, JSON.stringify(next));
            return next;
        });
    };

    const isVisible = (key: string) => visible.includes(key);

    const reset = () => {
        localStorage.removeItem(`columns-${storageKey}`);
        setVisible(defaultVisible);
    };

    return { visible, toggle, isVisible, reset };
}

export function ColumnSelector({ columns, visible, onToggle, onReset }: ColumnSelectorProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    const hiddenCount = columns.filter(c => !c.required).length - visible.filter(k => {
        const col = columns.find(c => c.key === k);
        return col && !col.required;
    }).length;

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                    open || hiddenCount > 0
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
                title="Настроить колонки"
            >
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">Колонки</span>
                {hiddenCount > 0 && (
                    <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full px-1.5 py-0.5">
                        -{hiddenCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500">Видимые колонки</span>
                        <button
                            onClick={() => { onReset(); }}
                            className="text-[10px] text-blue-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
                            title="Сбросить"
                        >
                            <RotateCcw className="w-3 h-3" />
                            Сбросить
                        </button>
                    </div>
                    <div className="p-2 space-y-0.5 max-h-64 overflow-y-auto">
                        {columns.map(col => (
                            <label
                                key={col.key}
                                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                                    col.required
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={visible.includes(col.key)}
                                    onChange={() => onToggle(col.key)}
                                    disabled={col.required}
                                    className="rounded border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-blue-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                                />
                                <span className="text-sm text-zinc-700 dark:text-zinc-300">{col.label}</span>
                                {col.required && (
                                    <span className="text-[9px] text-zinc-400 ml-auto">обязат.</span>
                                )}
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
