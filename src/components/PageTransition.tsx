import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
    children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
    const location = useLocation();
    const [visible, setVisible] = useState(false);
    const [content, setContent] = useState(children);

    useEffect(() => {
        setVisible(false);
        // Small delay so the fade-out is barely visible, then swap content and fade in
        const timer = setTimeout(() => {
            setContent(children);
            setVisible(true);
        }, 50);
        return () => clearTimeout(timer);
    }, [location.pathname]);

    // On first render, show immediately
    useEffect(() => {
        setVisible(true);
    }, []);

    return (
        <div
            className={`transition-all duration-200 ease-out ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
            }`}
        >
            {content}
        </div>
    );
}
