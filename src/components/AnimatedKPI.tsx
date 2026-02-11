import React from 'react';
import { useAnimatedCounter } from '../hooks/useAnimatedCounter';
import { Sparkline } from './Sparkline';

interface AnimatedKPIProps {
    label: string;
    value: number | string;
    subtitle: string;
    icon: React.ReactNode;
    color: string;
    iconBg: string;
    sparkData?: number[];
    sparkColor?: string;
}

export function AnimatedKPI({ label, value, subtitle, icon, color, iconBg, sparkData, sparkColor }: AnimatedKPIProps) {
    const isNumeric = typeof value === 'number';
    const isPercent = typeof value === 'string' && value.endsWith('%');
    const numericValue = isPercent ? parseFloat(value) : (isNumeric ? value : 0);
    const animated = useAnimatedCounter(numericValue, {
        duration: 900,
        decimals: isPercent ? 1 : 0,
    });

    const displayValue = isPercent ? `${animated}%` : (isNumeric ? animated : value);

    return (
        <div className="relative bg-white/70 dark:bg-zinc-900/40 backdrop-blur-md p-5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-zinc-900/50 group">
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-500">{label}</span>
                <div className={`p-2 rounded-lg ${iconBg} transition-transform group-hover:scale-110`}>
                    <span className={color}>{icon}</span>
                </div>
            </div>
            <div className="flex items-end justify-between gap-2">
                <div className={`text-3xl font-bold tabular-nums ${color}`}>{displayValue}</div>
                {sparkData && sparkData.length >= 2 && (
                    <Sparkline data={sparkData} color={sparkColor || '#3b82f6'} width={72} height={28} />
                )}
            </div>
            <div className="text-xs text-zinc-400 mt-1">{subtitle}</div>
        </div>
    );
}
