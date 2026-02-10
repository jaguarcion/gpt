import { useState, useEffect, useCallback } from 'react';

/**
 * useState that persists to localStorage.
 * Reads saved value on mount, writes on every change.
 */
export function useStickyState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
    const storageKey = `sticky-${key}`;

    const [value, setValue] = useState<T>(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved !== null) {
                return JSON.parse(saved);
            }
        } catch {
            // ignore parse errors
        }
        return defaultValue;
    });

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(value));
        } catch {
            // ignore quota errors
        }
    }, [storageKey, value]);

    const reset = useCallback(() => {
        localStorage.removeItem(storageKey);
        setValue(defaultValue);
    }, [storageKey, defaultValue]);

    return [value, setValue, reset];
}
