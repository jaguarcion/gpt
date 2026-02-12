import React from 'react';
import { Check, Minus } from 'lucide-react';

interface CheckboxProps {
    checked: boolean;
    onChange: () => void;
    indeterminate?: boolean;
    disabled?: boolean;
    className?: string;
}

export function Checkbox({ checked, onChange, indeterminate, disabled, className = '' }: CheckboxProps) {
    const isActive = checked || indeterminate;

    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={indeterminate ? 'mixed' : checked}
            disabled={disabled}
            onClick={onChange}
            className={`
                w-4 h-4 rounded flex items-center justify-center shrink-0
                border transition-all duration-150
                ${isActive
                    ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-600/30'
                    : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 hover:border-blue-400 dark:hover:border-blue-500'
                }
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                ${className}
            `}
        >
            {indeterminate ? (
                <Minus className="w-3 h-3 text-white" strokeWidth={3} />
            ) : checked ? (
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
            ) : null}
        </button>
    );
}
