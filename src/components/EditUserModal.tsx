import React, { useState } from 'react';

interface EditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    user: any;
}

export function EditUserModal({ isOpen, onClose, onSave, user }: EditUserModalProps) {
    const [email, setEmail] = useState(user?.email || '');
    const [type, setType] = useState(user?.type || '1m');
    const [status, setStatus] = useState(user?.status || 'active');
    const [note, setNote] = useState(user?.note || '');
    
    // Calculate endDate for display/edit
    // This logic duplicates what's in the table render, ideally should be a helper
    const getEndDate = () => {
        if (!user) return '';
        const start = new Date(user.startDate);
        const monthsToAdd = user.type === '3m' ? 3 : (user.type === '2m' ? 2 : 1);
        const endDate = new Date(start.setMonth(start.getMonth() + monthsToAdd));
        return endDate.toISOString().split('T')[0];
    };

    const [endDate, setEndDate] = useState(getEndDate());

    if (!isOpen || !user) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave({ email, type, status, endDate, note });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-xl">
                <h2 className="text-xl font-bold text-white mb-4">Редактировать пользователя</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">Email</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">Тип подписки</label>
                        <select 
                            value={type}
                            onChange={e => setType(e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        >
                            <option value="1m">1 Месяц</option>
                            <option value="2m">2 Месяца</option>
                            <option value="3m">3 Месяца</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">Статус</label>
                        <select 
                            value={status}
                            onChange={e => setStatus(e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        >
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">Заметка</label>
                        <textarea 
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Например: Оплатил наличкой"
                            rows={3}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">Дата окончания (изменит дату старта)</label>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        />
                        <p className="text-[10px] text-zinc-500 mt-1">
                            Внимание: изменение даты окончания автоматически пересчитает дату старта на основе типа подписки.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                        >
                            Отмена
                        </button>
                        <button 
                            type="submit" 
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                        >
                            Сохранить
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
