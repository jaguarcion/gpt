import React, { useState, useRef, useCallback } from 'react';
import { Maximize2, Minimize2, Download, X } from 'lucide-react';

interface FullscreenChartProps {
    title: string;
    children: React.ReactNode;
    chartRef?: React.RefObject<HTMLDivElement | null>;
}

function inlineStyles(source: SVGElement, target: SVGElement) {
    const computed = window.getComputedStyle(source);
    const importantStyles = [
        'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap',
        'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight',
        'text-anchor', 'dominant-baseline', 'visibility', 'display'
    ];
    for (const prop of importantStyles) {
        const val = computed.getPropertyValue(prop);
        if (val && val !== '' && val !== 'none' && val !== 'normal' && val !== 'visible') {
            (target as any).style[prop] = val;
        }
    }
    // Special handling for fill/stroke that might be "none"
    const fill = computed.getPropertyValue('fill');
    if (fill) (target as any).style.fill = fill;
    const stroke = computed.getPropertyValue('stroke');
    if (stroke) (target as any).style.stroke = stroke;

    const sourceChildren = source.children;
    const targetChildren = target.children;
    for (let i = 0; i < sourceChildren.length; i++) {
        if (sourceChildren[i] instanceof SVGElement && targetChildren[i] instanceof SVGElement) {
            inlineStyles(sourceChildren[i] as SVGElement, targetChildren[i] as SVGElement);
        }
    }
}

export function FullscreenChart({ title, children, chartRef }: FullscreenChartProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const internalRef = useRef<HTMLDivElement>(null);
    const activeRef = chartRef || internalRef;

    const handleExportPNG = useCallback(() => {
        const container = activeRef.current;
        if (!container) return;

        const svg = container.querySelector('.recharts-wrapper svg') as SVGSVGElement | null;
        if (!svg) return;

        // Get actual rendered size
        const bbox = svg.getBoundingClientRect();
        const width = bbox.width;
        const height = bbox.height;

        // Clone SVG and inline all computed styles
        const cloned = svg.cloneNode(true) as SVGSVGElement;
        cloned.setAttribute('width', String(width));
        cloned.setAttribute('height', String(height));
        // Ensure viewBox is set
        if (!cloned.getAttribute('viewBox')) {
            cloned.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }

        // Inline styles from original to clone
        inlineStyles(svg, cloned);

        // Serialize
        const svgData = new XMLSerializer().serializeToString(cloned);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = 2;
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.scale(scale, scale);

            // Detect theme for background
            const isDark = document.documentElement.classList.contains('dark');
            ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

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
