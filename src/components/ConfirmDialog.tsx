import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { AlertTriangle, Trash2, Zap, HelpCircle, X } from 'lucide-react';

type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmVariant;
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

interface DialogState extends ConfirmOptions {
    resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [dialog, setDialog] = useState<DialogState | null>(null);
    const [visible, setVisible] = useState(false);
    const backdropRef = useRef<HTMLDivElement>(null);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setDialog({ ...options, resolve });
            // Trigger enter animation
            requestAnimationFrame(() => setVisible(true));
        });
    }, []);

    const handleClose = useCallback((result: boolean) => {
        setVisible(false);
        setTimeout(() => {
            dialog?.resolve(result);
            setDialog(null);
        }, 200);
    }, [dialog]);

    // Close on Escape
    useEffect(() => {
        if (!dialog) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose(false);
            if (e.key === 'Enter') handleClose(true);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [dialog, handleClose]);

    const variantConfig = {
        danger: {
            icon: <Trash2 className="w-6 h-6" />,
            iconBg: 'bg-red-500/10',
            iconColor: 'text-red-500',
            buttonBg: 'bg-red-600 hover:bg-red-700 focus:ring-red-500/50',
        },
        warning: {
            icon: <AlertTriangle className="w-6 h-6" />,
            iconBg: 'bg-yellow-500/10',
            iconColor: 'text-yellow-500',
            buttonBg: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500/50',
        },
        info: {
            icon: <Zap className="w-6 h-6" />,
            iconBg: 'bg-blue-500/10',
            iconColor: 'text-blue-500',
            buttonBg: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/50',
        },
    };

    const v = dialog ? variantConfig[dialog.variant || 'danger'] : variantConfig.danger;

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {dialog && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        ref={backdropRef}
                        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
                            visible ? 'opacity-100' : 'opacity-0'
                        }`}
                        onClick={() => handleClose(false)}
                    />

                    {/* Dialog */}
                    <div
                        className={`relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden transition-all duration-200 ${
                            visible
                                ? 'opacity-100 scale-100 translate-y-0'
                                : 'opacity-0 scale-95 translate-y-4'
                        }`}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => handleClose(false)}
                            className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="p-6">
                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-xl ${v.iconBg} flex items-center justify-center mb-4`}>
                                <span className={v.iconColor}>{v.icon}</span>
                            </div>

                            {/* Content */}
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                                {dialog.title}
                            </h3>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                {dialog.message}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 px-6 pb-6">
                            <button
                                onClick={() => handleClose(false)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500/30"
                            >
                                {dialog.cancelText || 'Отмена'}
                            </button>
                            <button
                                onClick={() => handleClose(true)}
                                autoFocus
                                className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl text-white transition-colors focus:outline-none focus:ring-2 ${v.buttonBg}`}
                            >
                                {dialog.confirmText || 'Подтвердить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
    return ctx.confirm;
}
