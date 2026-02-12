import React, { useState } from 'react';
import { motion, PanInfo, useAnimation } from 'framer-motion';
import { Trash2, Zap } from 'lucide-react';

interface SwipeableCardProps {
    children: React.ReactNode;
    onSwipeLeft?: () => void; // Delete
    onSwipeRight?: () => void; // Action
    leftActionColor?: string;
    rightActionColor?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export function SwipeableCard({
    children,
    onSwipeLeft,
    onSwipeRight,
    leftActionColor = 'bg-red-500',
    rightActionColor = 'bg-green-500',
    leftIcon = <Trash2 className="text-white w-6 h-6" />,
    rightIcon = <Zap className="text-white w-6 h-6" />,
}: SwipeableCardProps) {
    const controls = useAnimation();
    const [dragStart, setDragStart] = useState({ x: 0 });

    const handleDragEnd = async (event: any, info: PanInfo) => {
        const threshold = 100;
        const velocityThreshold = 500;

        // Swipe Left (Negative X) -> Delete
        if (onSwipeLeft && (info.offset.x < -threshold || info.velocity.x < -velocityThreshold)) {
            await controls.start({ x: -window.innerWidth, opacity: 0, transition: { duration: 0.2 } });
            onSwipeLeft();
            // We don't reset here because the item is expected to be removed.
            // If the parent doesn't remove it, it will stay invisible.
            // Ideally the parent re-renders and this component unmounts.
        }
        // Swipe Right (Positive X) -> Activate
        else if (onSwipeRight && (info.offset.x > threshold || info.velocity.x > velocityThreshold)) {
            // For activation, we might want to snap back after action or fly away?
            // "Quick action" usually implies doing something. If it's pure "activate and stay", maybe snap back.
            // But if it's "activate and move to active list", fly away is good.
            // Let's assume fly away for now, or snap back for better feedback?
            // User said "swipe right -> quick action (activation)". 
            // If activation is manual activation of a subscription, it stays in the list but status changes.
            // So it should snap back!
            onSwipeRight();
            controls.start({ x: 0 });
        } else {
            controls.start({ x: 0 });
        }
    };

    return (
        <div className="relative mb-3 touch-pan-y select-none">
            {/* Background Actions */}
            <div className="absolute inset-0 flex rounded-xl overflow-hidden">
                {/* Right Swipe Reveal (Left Side Background) -> Green */}
                <div className={`flex-1 ${rightActionColor} flex items-center justify-start pl-6 ${!onSwipeRight ? 'invisible' : ''}`}>
                    {rightIcon}
                </div>
                {/* Left Swipe Reveal (Right Side Background) -> Red */}
                <div className={`flex-1 ${leftActionColor} flex items-center justify-end pr-6 ${!onSwipeLeft ? 'invisible' : ''}`}>
                    {leftIcon}
                </div>
            </div>

            {/* Foreground Content */}
            <motion.div
                drag="x"
                dragElastic={0.7} // Elastic drag
                onDragStart={(e, info) => setDragStart({ x: info.point.x })}
                onDragEnd={handleDragEnd}
                animate={controls}
                className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm z-10"
                style={{ touchAction: 'pan-y' }}
            >
                {children}
            </motion.div>
        </div>
    );
}
