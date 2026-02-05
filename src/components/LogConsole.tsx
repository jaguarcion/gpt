import React from 'react';

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

interface LogConsoleProps {
  logs: LogEntry[];
}

export function LogConsole({ logs }: LogConsoleProps) {
  return (
    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden h-64 flex flex-col">
      <div className="p-4 border-b border-zinc-800 bg-zinc-900">
        <h3 className="font-medium text-zinc-100">Лог выполнения</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-zinc-500 text-center py-4">Ожидание действий...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="flex gap-3">
              <span className="text-zinc-500">{log.timestamp}</span>
              <span className={`${
                log.type === 'error' ? 'text-red-400' : 
                log.type === 'success' ? 'text-green-400' : 
                'text-zinc-300'
              }`}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
