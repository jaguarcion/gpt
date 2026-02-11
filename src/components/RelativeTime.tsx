import React, { useEffect, useState } from 'react';
import { timeAgo, fullDate } from '../lib/timeAgo';

interface RelativeTimeProps {
    date: string | Date;
    className?: string;
}

export function RelativeTime({ date, className = '' }: RelativeTimeProps) {
    const [text, setText] = useState(() => timeAgo(date));

    useEffect(() => {
        setText(timeAgo(date));
        const interval = setInterval(() => setText(timeAgo(date)), 30000);
        return () => clearInterval(interval);
    }, [date]);

    return (
        <span className={className} title={fullDate(date)}>
            {text}
        </span>
    );
}
