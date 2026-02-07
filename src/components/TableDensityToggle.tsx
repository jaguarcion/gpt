import React from 'react';
import { AlignJustify, AlignCenter } from 'lucide-react';
import type { TableDensity } from '../hooks/useTableDensity';

interface TableDensityToggleProps {
    density: TableDensity;
    onToggle: () => void;
}

export function TableDensityToggle({ density, onToggle }: TableDensityToggleProps) {
    return (
        <button
            onClick={onToggle}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                density === 'compact'
                    ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
            title={density === 'compact' ? 'Переключить на просторный режим' : 'Переключить на компактный режим'}
        >
            {density === 'compact' ? (
                <AlignJustify className="w-4 h-4" />
            ) : (
                <AlignCenter className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{density === 'compact' ? 'Компактный' : 'Просторный'}</span>
        </button>
    );
}
