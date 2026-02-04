import React from 'react';
import { clsx } from 'clsx';

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface Props {
  logs: LogEntry[];
}

export const LogConsole: React.FC<Props> = ({ logs }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="mt-6 rounded-md border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
      </div>
      <div 
        ref={scrollRef}
        className="h-64 overflow-y-auto font-mono text-sm space-y-1"
      >
        {logs.length === 0 && (
          <div className="text-zinc-600 italic"></div>
        )}
        {logs.map((log, index) => (
          <div key={index} className="flex gap-2">
            <span className="text-zinc-500 select-none">[{log.timestamp}]</span>
            <span className={clsx(
              log.type === 'info' && "text-zinc-300",
              log.type === 'success' && "text-green-400",
              log.type === 'error' && "text-red-400"
            )}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
