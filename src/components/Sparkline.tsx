import React from 'react';

interface SparklineProps {
    data: number[];
    color?: string;
    width?: number;
    height?: number;
}

export function Sparkline({ data, color = '#3b82f6', width = 80, height = 24 }: SparklineProps) {
    if (!data || data.length < 2) return null;

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    const padding = 1;
    const stepX = (width - padding * 2) / (data.length - 1);

    const points = data.map((v, i) => {
        const x = padding + i * stepX;
        const y = height - padding - ((v - min) / range) * (height - padding * 2);
        return `${x},${y}`;
    });

    const linePath = `M${points.join(' L')}`;

    // Area fill path
    const areaPath = `${linePath} L${width - padding},${height} L${padding},${height} Z`;

    return (
        <svg width={width} height={height} className="overflow-visible">
            <defs>
                <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#spark-${color.replace('#', '')})`} />
            <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            {/* Last dot */}
            <circle
                cx={padding + (data.length - 1) * stepX}
                cy={height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2)}
                r={2}
                fill={color}
            />
        </svg>
    );
}
