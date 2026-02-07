import { useState } from 'react';

export type TableDensity = 'compact' | 'comfortable';

const STORAGE_KEY = 'table-density';

export function useTableDensity() {
    const [density, setDensity] = useState<TableDensity>(() => {
        try {
            return (localStorage.getItem(STORAGE_KEY) as TableDensity) || 'comfortable';
        } catch {
            return 'comfortable';
        }
    });

    const toggle = () => {
        const next = density === 'comfortable' ? 'compact' : 'comfortable';
        setDensity(next);
        localStorage.setItem(STORAGE_KEY, next);
    };

    const cellPadding = density === 'compact' ? 'px-4 py-2' : 'px-6 py-4';
    const headerPadding = density === 'compact' ? 'px-4 py-2' : 'px-6 py-3';
    const fontSize = density === 'compact' ? 'text-xs' : 'text-sm';

    return { density, toggle, cellPadding, headerPadding, fontSize };
}
