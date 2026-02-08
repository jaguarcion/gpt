import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
    children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
    const location = useLocation();
    const [visible, setVisible] = useState(true);
    const prevPath = useRef(location.pathname);

    useEffect(() => {
        if (prevPath.current !== location.pathname) {
            prevPath.current = location.pathname;
            // Fade out briefly, then fade in
            setVisible(false);
            const timer = setTimeout(() => setVisible(true), 50);
            return () => clearTimeout(timer);
        }
    }, [location.pathname]);

    return (
        <div
            className={`transition-all duration-200 ease-out ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
            }`}
        >
            {children}
        </div>
    );
}
