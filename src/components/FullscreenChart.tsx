import React, { useState } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';

interface FullscreenChartProps {
    title: string;
    children: React.ReactNode;
}

export function FullscreenChart({ title, children }: FullscreenChartProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    return (
        <>
            {/* Normal mode - toolbar */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{title}</h3>
                <button
                    onClick={() => setIsFullscreen(true)}
                    className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="На весь экран"
                >
                    <Maximize2 className="w-4 h-4" />
                </button>
            </div>

            {/* Chart content (normal) */}
            {children}

            {/* Fullscreen overlay */}
            {isFullscreen && (
                <div className="fixed inset-0 bg-white dark:bg-zinc-950 z-[200] flex flex-col">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsFullscreen(false)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors"
                            >
                                <Minimize2 className="w-4 h-4" />
                                Свернуть
                            </button>
                            <button
                                onClick={() => setIsFullscreen(false)}
                                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Fullscreen chart area */}
                    <div className="flex-1 p-6 overflow-hidden">
                        <div className="w-full h-full">
                            {children}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
