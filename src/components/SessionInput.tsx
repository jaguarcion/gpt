import React from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const SessionInput: React.FC<Props> = ({ value, onChange, disabled }) => (
  <div className="space-y-2">
    <label htmlFor="session-json" className="block text-sm font-medium text-zinc-300">
      JSON сессии
    </label>
    <textarea
      id="session-json"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={6}
      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 font-mono text-sm"
      placeholder='Вставьте здесь полный JSON сессии...'
    />
  </div>
);
