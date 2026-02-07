import React, { useState, useRef, useCallback } from 'react';
import { Maximize2, Minimize2, Download, X } from 'lucide-react';

interface FullscreenChartProps {
    title: string;
    children: React.ReactNode;
    chartRef?: React.RefObject<HTMLDivElement | null>;
}

export function FullscreenChart({ title, children, chartRef }: FullscreenChartProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const internalRef = useRef<HTMLDivElement>(null);
    const activeRef = chartRef || internalRef;

    const handleExportPNG = useCallback(() => {
        const container = activeRef.current;
        if (!container) return;

        // Find the SVG inside recharts
        const svg = container.querySelector('.recharts-wrapper svg') as SVGSVGElement | null;
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = 2; // High DPI
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.scale(scale, scale);
            // Fill background
            ctx.fillStyle = '#09090b';
            ctx.fillRect(0, 0, img.width, img.height);
            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            }, 'image/png');

            URL.revokeObjectURL(svgUrl);
        };
        img.src = svgUrl;
    }, [title, activeRef]);

    return (
        <>
            {/* Normal mode - toolbar */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{title}</h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleExportPNG}
                        className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Скачать PNG"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsFullscreen(true)}
                        className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="На весь экран"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Chart content (normal) */}
            <div ref={internalRef}>
                {children}
            </div>

            {/* Fullscreen overlay */}
            {isFullscreen && (
                <div className="fixed inset-0 bg-white dark:bg-zinc-950 z-[200] flex flex-col">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExportPNG}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                PNG
                            </button>
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
                        <div className="w-full h-full" ref={activeRef}>
                            {children}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
