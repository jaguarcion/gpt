import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: number;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextType {
    toast: (message: string, type?: ToastType, duration?: number) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
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

    const ctx: ToastContextType = {
        toast: addToast,
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error'),
        warning: (msg) => addToast(msg, 'warning'),
        info: (msg) => addToast(msg, 'info'),
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

    const icon = {
        success: <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />,
        error: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
        warning: <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />,
        info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
    }[toast.type];

    const borderColor = {
        success: 'border-l-green-500',
        error: 'border-l-red-500',
        warning: 'border-l-yellow-500',
        info: 'border-l-blue-500',
    }[toast.type];

    return (
        <div
            className={`pointer-events-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-[3px] ${borderColor} rounded-lg shadow-2xl px-4 py-3 flex items-start gap-3 transition-all duration-200 ${
                visible
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 translate-x-8'
            }`}
        >
            {icon}
            <p className="text-sm text-zinc-900 dark:text-zinc-100 flex-1 pt-0.5">{toast.message}</p>
            <button
                onClick={handleClose}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors shrink-0"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
