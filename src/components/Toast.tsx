import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'undo';

interface Toast {
    id: number;
    type: ToastType;
    message: string;
    duration?: number;
    onUndo?: () => void;
}

interface ToastContextType {
    toast: (message: string, type?: ToastType, duration?: number) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
    undo: (message: string, onUndo: () => void, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
        const id = ++idCounter;
        setToasts(prev => [...prev, { id, type, message, duration }]);
        if (duration > 0) {
            setTimeout(() => removeToast(id), duration);
        }
    }, [removeToast]);

    const addUndoToast = useCallback((message: string, onUndo: () => void, duration: number = 5000) => {
        const id = ++idCounter;
        setToasts(prev => [...prev, { id, type: 'undo' as ToastType, message, duration, onUndo }]);
        if (duration > 0) {
            setTimeout(() => removeToast(id), duration);
        }
    }, [removeToast]);

    const ctx: ToastContextType = {
        toast: addToast,
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error'),
        warning: (msg) => addToast(msg, 'warning'),
        info: (msg) => addToast(msg, 'info'),
        undo: addUndoToast,
    };

    return (
        <ToastContext.Provider value={ctx}>
            {children}
            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setVisible(true));
    }, []);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 200); // Wait for exit animation
    };

    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (toast.type !== 'undo' || !toast.duration) return;
        const start = performance.now();
        let frame: number;
        const tick = (now: number) => {
            const elapsed = now - start;
            const pct = Math.max(0, 100 - (elapsed / toast.duration!) * 100);
            setProgress(pct);
            if (pct > 0) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [toast.type, toast.duration]);

    const icon = {
        success: <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />,
        error: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
        warning: <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />,
        info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
        undo: <Info className="w-5 h-5 text-orange-500 shrink-0" />,
    }[toast.type];

    const borderColor = {
        success: 'border-l-green-500',
        error: 'border-l-red-500',
        warning: 'border-l-yellow-500',
        info: 'border-l-blue-500',
        undo: 'border-l-orange-500',
    }[toast.type];

    return (
        <div
            className={`pointer-events-auto relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-[3px] ${borderColor} rounded-lg shadow-2xl px-4 py-3 flex items-start gap-3 transition-all duration-200 overflow-hidden ${
                visible
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 translate-x-8'
            }`}
        >
            {icon}
            <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-900 dark:text-zinc-100 pt-0.5">{toast.message}</p>
                {toast.type === 'undo' && toast.onUndo && (
                    <button
                        onClick={() => { toast.onUndo!(); handleClose(); }}
                        className="mt-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
                    >
                        Отменить
                    </button>
                )}
            </div>
            <button
                onClick={handleClose}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors shrink-0"
            >
                <X className="w-4 h-4" />
            </button>
            {toast.type === 'undo' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-200 dark:bg-zinc-700">
                    <div className="h-full bg-orange-500 transition-none" style={{ width: `${progress}%` }} />
                </div>
            )}
        </div>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
