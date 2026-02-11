import { useState, useEffect, useRef } from 'react';

interface AnimatedCounterOptions {
    duration?: number;
    decimals?: number;
}

export function useAnimatedCounter(
    target: number,
    options: AnimatedCounterOptions = {}
): string {
    const { duration = 800, decimals = 0 } = options;
    const [display, setDisplay] = useState(target);
    const prevRef = useRef(target);
    const frameRef = useRef<number>(0);

    useEffect(() => {
        const from = prevRef.current;
        const to = target;
        prevRef.current = target;

        if (from === to) return;

        const startTime = performance.now();

        const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = from + (to - from) * eased;

            setDisplay(current);

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(animate);
            } else {
                setDisplay(to);
            }
        };

        frameRef.current = requestAnimationFrame(animate);

        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [target, duration]);

    if (decimals > 0) {
        return display.toFixed(decimals);
    }
    return Math.round(display).toLocaleString('ru-RU');
}
