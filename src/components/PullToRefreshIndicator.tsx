import React from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  pulling: boolean;
  refreshing: boolean;
  pullDistance: number;
  progress: number;
}

export function PullToRefreshIndicator({ pulling, refreshing, pullDistance, progress }: Props) {
  if (!pulling && !refreshing) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center pointer-events-none md:hidden"
      style={{ height: `${Math.max(pullDistance, refreshing ? 48 : 0)}px`, transition: pulling ? 'none' : 'height 0.3s ease' }}
    >
      <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-zinc-800 shadow-lg border border-zinc-200 dark:border-zinc-700 ${refreshing ? 'opacity-100' : ''}`}>
        <RefreshCw
          className={`w-4 h-4 text-blue-500 ${refreshing ? 'animate-spin' : ''}`}
          style={!refreshing ? { transform: `rotate(${progress * 360}deg)`, transition: 'none' } : undefined}
        />
        <span className="text-xs text-zinc-600 dark:text-zinc-300">
          {refreshing ? 'Обновление...' : progress >= 1 ? 'Отпустите' : 'Потяните вниз'}
        </span>
      </div>
    </div>
  );
}
