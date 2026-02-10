import { useState, useCallback } from 'react';

export interface WidgetConfig {
    id: string;
    label: string;
    visible: boolean;
}

const STORAGE_KEY = 'dashboard-widgets';

const DEFAULT_WIDGETS: WidgetConfig[] = [
    { id: 'kpis', label: 'KPI-карточки', visible: true },
    { id: 'chart', label: 'График активаций', visible: true },
    { id: 'activity', label: 'Последние события', visible: true },
    { id: 'quicklinks', label: 'Быстрые ссылки', visible: true },
];

function loadWidgets(): WidgetConfig[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed: WidgetConfig[] = JSON.parse(saved);
            // Merge with defaults to handle new widgets added in code
            const ids = new Set(parsed.map(w => w.id));
            const merged = [...parsed];
            for (const def of DEFAULT_WIDGETS) {
                if (!ids.has(def.id)) merged.push(def);
            }
            return merged;
        }
    } catch { /* ignore */ }
    return DEFAULT_WIDGETS.map(w => ({ ...w }));
}

function saveWidgets(widgets: WidgetConfig[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    } catch { /* ignore */ }
}

export function useDashboardWidgets() {
    const [widgets, setWidgets] = useState<WidgetConfig[]>(loadWidgets);

    const toggleVisibility = useCallback((id: string) => {
        setWidgets(prev => {
            const next = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
            saveWidgets(next);
            return next;
        });
    }, []);

    const reorder = useCallback((fromIndex: number, toIndex: number) => {
        setWidgets(prev => {
            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            saveWidgets(next);
            return next;
        });
    }, []);

    const reset = useCallback(() => {
        const defaults = DEFAULT_WIDGETS.map(w => ({ ...w }));
        setWidgets(defaults);
        saveWidgets(defaults);
    }, []);

    return { widgets, toggleVisibility, reorder, reset };
}
