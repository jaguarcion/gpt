import React from 'react';

function Pulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <div className={`animate-pulse bg-zinc-200 dark:bg-zinc-800 rounded ${className || ''}`} style={style} />
    );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <Pulse className="h-3 w-20" />
                    <Pulse className="h-8 w-16" />
                </div>
            ))}
        </div>
    );
}

export function SkeletonCards4({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <Pulse className="h-3 w-24" />
                    <Pulse className="h-8 w-16" />
                    <Pulse className="h-2 w-32" />
                </div>
            ))}
        </div>
    );
}

export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
    return (
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Header */}
            <div className="bg-zinc-100 dark:bg-zinc-900 px-6 py-3 flex gap-6">
                {Array.from({ length: cols }).map((_, i) => (
                    <Pulse key={i} className="h-3 flex-1" />
                ))}
            </div>
            {/* Rows */}
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="px-6 py-4 flex gap-6 items-center">
                        {Array.from({ length: cols }).map((_, j) => (
                            <Pulse key={j} className={`h-4 flex-1 ${j === 0 ? 'max-w-[40px]' : ''}`} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SkeletonChart() {
    return (
        <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-6">
            <Pulse className="h-5 w-48" />
            <div className="h-[300px] flex items-end gap-2 px-4">
                {Array.from({ length: 20 }).map((_, i) => (
                    <Pulse
                        key={i}
                        className="flex-1 rounded-t"
                        style={{ height: `${Math.random() * 60 + 20}%` } as React.CSSProperties}
                    />
                ))}
            </div>
        </div>
    );
}

export function SkeletonLogs({ rows = 10 }: { rows?: number }) {
    return (
        <div className="space-y-3 p-4">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 items-start">
                    <Pulse className="h-4 w-20 shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                            <Pulse className="h-5 w-20 rounded-full" />
                            <Pulse className="h-4 w-32" />
                        </div>
                        <Pulse className="h-3 w-3/4" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function SkeletonDashboard() {
    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <Pulse className="h-7 w-40" />
                <Pulse className="h-4 w-64" />
            </div>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900/50 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                        <div className="flex justify-between items-center">
                            <Pulse className="h-3 w-24" />
                            <Pulse className="h-9 w-9 rounded-lg" />
                        </div>
                        <Pulse className="h-8 w-16" />
                        <Pulse className="h-3 w-28" />
                    </div>
                ))}
            </div>
            {/* Chart + Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                    <Pulse className="h-5 w-48" />
                    <div className="h-[240px] flex items-end gap-3 px-4">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <Pulse key={i} className="flex-1 rounded-t" style={{ height: `${Math.random() * 60 + 30}%` } as React.CSSProperties} />
                        ))}
                    </div>
                </div>
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
                    <Pulse className="h-5 w-40" />
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <div className="flex gap-2">
                                <Pulse className="h-4 w-16 rounded-full" />
                                <Pulse className="h-4 w-12 ml-auto" />
                            </div>
                            <Pulse className="h-3 w-full" />
                        </div>
                    ))}
                </div>
            </div>
            {/* Quick links */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4 bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
                        <Pulse className="h-9 w-9 rounded-lg" />
                        <Pulse className="h-4 w-24" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SkeletonHealthPage() {
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <Pulse className="h-7 w-56" />
                <Pulse className="h-10 w-28 rounded-lg" />
            </div>
            {/* 3 status cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                        <Pulse className="h-3 w-24" />
                        <Pulse className="h-8 w-20" />
                        <Pulse className="h-2 w-32" />
                    </div>
                ))}
            </div>
            {/* 2 memory blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                        <Pulse className="h-5 w-40" />
                        <Pulse className="h-2.5 w-full rounded-full" />
                        <div className="grid grid-cols-2 gap-4">
                            <Pulse className="h-10" />
                            <Pulse className="h-10" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
