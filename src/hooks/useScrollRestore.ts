import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const scrollPositions = new Map<string, number>();

export function useScrollRestore() {
    const location = useLocation();
    const key = location.pathname;
    const restored = useRef(false);

    // Save scroll position on unmount / route change
    useEffect(() => {
        return () => {
            scrollPositions.set(key, window.scrollY);
        };
    }, [key]);

    // Restore scroll position on mount
    useEffect(() => {
        if (restored.current) return;
        restored.current = true;

        const saved = scrollPositions.get(key);
        if (saved !== undefined && saved > 0) {
            // Use rAF to ensure DOM is rendered before scrolling
            requestAnimationFrame(() => {
                window.scrollTo(0, saved);
            });
        }
    }, [key]);
}
