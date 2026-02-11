import React, { useState, useRef, useEffect } from 'react';
import { Check, X } from 'lucide-react';

interface InlineEditProps {
    value: string;
    onSave: (value: string) => Promise<void> | void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
}

export function InlineEdit({ value, onSave, className = '', placeholder = '-', disabled }: InlineEditProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    // Sync external value changes
    useEffect(() => {
        if (!editing) setDraft(value);
    }, [value, editing]);

    const handleSave = async () => {
        const trimmed = draft.trim();
        if (trimmed === value) {
            setEditing(false);
            return;
        }
        setSaving(true);
        try {
            await onSave(trimmed);
            setEditing(false);
        } catch {
            // keep editing on error
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setDraft(value);
        setEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleCancel();
    };

    if (disabled) {
        return <span className={className}>{value || <span className="text-zinc-400 dark:text-zinc-600">{placeholder}</span>}</span>;
    }

    if (!editing) {
        return (
            <span
                className={`cursor-pointer border-b border-dashed border-transparent hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors ${className}`}
                onDoubleClick={() => setEditing(true)}
                title="Дважды кликните для редактирования"
            >
                {value || <span className="text-zinc-400 dark:text-zinc-600">{placeholder}</span>}
            </span>
        );
    }

    return (
        <div className="flex items-center gap-1">
            <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSave}
                disabled={saving}
                className="w-full bg-white dark:bg-zinc-800 border border-blue-500 rounded px-1.5 py-0.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            <button
                onClick={handleSave}
                disabled={saving}
                className="text-green-500 hover:text-green-400 shrink-0 p-0.5"
                title="Сохранить"
            >
                <Check className="w-3.5 h-3.5" />
            </button>
            <button
                onMouseDown={(e) => { e.preventDefault(); handleCancel(); }}
                className="text-zinc-400 hover:text-red-400 shrink-0 p-0.5"
                title="Отмена"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
