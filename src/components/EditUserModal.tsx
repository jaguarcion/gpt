import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Drawer } from 'vaul';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface EditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    user: any;
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function EditUserForm({ user, onSave, onClose, isMobile }: { user: any, onSave: (data: any) => Promise<void>, onClose: () => void, isMobile?: boolean }) {
    const [email, setEmail] = useState('');
    const [type, setType] = useState('1m');
    const [status, setStatus] = useState('active');
    const [note, setNote] = useState('');
    const [endDate, setEndDate] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user) {
            setEmail(user.email || '');
            setType(user.type || '1m');
            setStatus(user.status || 'active');
            setNote(user.note || '');
            const start = new Date(user.startDate);
            const monthsToAdd = user.type === '3m' ? 3 : (user.type === '2m' ? 2 : 1);
            const ed = new Date(start.setMonth(start.getMonth() + monthsToAdd));
            setEndDate(ed.toISOString().split('T')[0]);
        }
    }, [user]);

    const emailValid = isValidEmail(email);
    const hasChanges = email !== user.email || type !== user.type || note !== (user.note || '') ||
        status !== user.status || endDate !== (() => {
            const s = new Date(user.startDate);
            const m = user.type === '3m' ? 3 : (user.type === '2m' ? 2 : 1);
            return new Date(s.setMonth(s.getMonth() + m)).toISOString().split('T')[0];
        })();
    const canSave = emailValid && hasChanges && !saving;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSave) return;
        setSaving(true);
        try {
            await onSave({ email: email.trim(), type, status, endDate, note: note.trim() });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={`space-y-4 ${isMobile ? 'pb-8' : ''}`}>
            <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={`w-full bg-zinc-50 dark:bg-zinc-800 border rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors ${email && !emailValid ? 'border-red-400 dark:border-red-500' : 'border-zinc-200 dark:border-zinc-700 focus:border-blue-500'
                        }`}
                />
                {email && !emailValid && (
                    <p className="text-[11px] text-red-500 mt-1">Некорректный email</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Тип подписки</label>
                    <select
                        value={type}
                        onChange={e => setType(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                    >
                        <option value="1m">1 Месяц</option>
                        <option value="2m">2 Месяца</option>
                        <option value="3m">3 Месяца</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Статус</label>
                    <select
                        value={status}
                        onChange={e => setStatus(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                    >
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Заметка</label>
                <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Комментарий..."
                    rows={3}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors resize-none"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Дата окончания</label>
                <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                    Изменение даты пересчитает дату старта на основе типа подписки
                </p>
            </div>

            {/* Footer */}
            <div className={`flex justify-end gap-2 pt-2 ${isMobile ? 'sticky bottom-0 bg-white dark:bg-zinc-900 py-3 border-t border-zinc-200 dark:border-zinc-800 -mx-6 px-6' : ''}`}>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    Отмена
                </button>
                <button
                    type="submit"
                    disabled={!canSave}
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {saving ? 'Сохранить' : 'Сохранить'}
                </button>
            </div>
        </form>
    );
}

export function EditUserModal({ isOpen, onClose, onSave, user }: EditUserModalProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const [visible, setVisible] = useState(false);

    // For Desktop animation
    useEffect(() => {
        if (isOpen && isDesktop) {
            requestAnimationFrame(() => setVisible(true));
        } else {
            setVisible(false);
        }
    }, [isOpen, isDesktop]);

    if (!user) return null;

    if (isDesktop) {
        if (!isOpen) return null;
        return (
            <div
                onClick={(e) => e.target === e.currentTarget && onClose()}
                className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${visible ? 'bg-black/50 backdrop-blur-sm' : 'bg-black/0'}`}
            >
                <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl transition-all duration-200 ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}>
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Редактировать пользователя</h2>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-6">
                        <EditUserForm user={user} onSave={onSave} onClose={onClose} />
                    </div>
                </div>
            </div>
        );
    }

    // Mobile Drawer
    return (
        <Drawer.Root open={isOpen} onOpenChange={(o) => !o && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
                <Drawer.Content className="bg-white dark:bg-zinc-900 flex flex-col rounded-t-[10px] fixed bottom-0 left-0 right-0 max-h-[95vh] z-50 outline-none">
                    <div className="p-4 bg-white dark:bg-zinc-900 rounded-t-[10px] flex-1 overflow-y-auto">
                        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700 mb-8" />
                        <div className="max-w-md mx-auto">
                            <Drawer.Title className="font-semibold text-xl mb-4 text-zinc-900 dark:text-white">
                                Редактировать
                            </Drawer.Title>
                            <EditUserForm user={user} onSave={onSave} onClose={onClose} isMobile />
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
