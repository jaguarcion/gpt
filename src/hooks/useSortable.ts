import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

interface SortState {
    key: string | null;
    direction: SortDirection;
}

export function useSortable<T>(data: T[]) {
    const [sort, setSort] = useState<SortState>({ key: null, direction: null });

    const toggleSort = useCallback((key: string) => {
        setSort(prev => {
            if (prev.key !== key) return { key, direction: 'asc' };
            if (prev.direction === 'asc') return { key, direction: 'desc' };
            return { key: null, direction: null };
        });
    }, []);

    const sorted = useMemo(() => {
        if (!sort.key || !sort.direction) return data;

        return [...data].sort((a: any, b: any) => {
            const aVal = a[sort.key!];
            const bVal = b[sort.key!];

            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            let cmp: number;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                cmp = aVal - bVal;
            } else if (aVal instanceof Date && bVal instanceof Date) {
                cmp = aVal.getTime() - bVal.getTime();
            } else {
                cmp = String(aVal).localeCompare(String(bVal), 'ru');
            }

            return sort.direction === 'desc' ? -cmp : cmp;
        });
    }, [data, sort.key, sort.direction]);

    return { sorted, sortKey: sort.key, sortDirection: sort.direction, toggleSort };
}
