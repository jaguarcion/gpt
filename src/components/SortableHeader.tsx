import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import type { SortDirection } from '../hooks/useSortable';

interface SortableHeaderProps {
    label: string;
    sortKey: string;
    currentSortKey: string | null;
    currentDirection: SortDirection;
    onSort: (key: string) => void;
    className?: string;
}

export function SortableHeader({
    label,
    sortKey,
    currentSortKey,
    currentDirection,
    onSort,
    className = '',
}: SortableHeaderProps) {
    const isActive = currentSortKey === sortKey;

    return (
        <th
            className={`${className} cursor-pointer select-none group`}
            onClick={() => onSort(sortKey)}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                <span className={`transition-colors ${isActive ? 'text-blue-500' : 'text-zinc-400 dark:text-zinc-600 opacity-0 group-hover:opacity-100'}`}>
                    {isActive && currentDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5" />
                    ) : isActive && currentDirection === 'desc' ? (
                        <ArrowDown className="w-3.5 h-3.5" />
                    ) : (
                        <ArrowUpDown className="w-3.5 h-3.5" />
                    )}
                </span>
            </span>
        </th>
    );
}
