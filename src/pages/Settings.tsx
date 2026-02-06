import React, { useEffect, useState } from 'react';
import { getSettings, saveSettings, setAuthToken } from '../services/api';
import { Layout } from '../components/Layout';
import { useNavigate } from 'react-router-dom';

export function Settings() {
    const [settings, setSettings] = useState<any>({
        maintenanceMode: false,
        announcement: '',
        maxActivationsPerDay: 100
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            navigate('/admin');
            return;
        }
        setAuthToken(token);
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const data = await getSettings();
            setSettings(data);
        } catch (e: any) {
            console.error('Failed to load settings:', e);
            setMessage({ text: 'Ошибка загрузки настроек', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await saveSettings(settings);
            setMessage({ text: 'Настройки успешно сохранены', type: 'success' });
        } catch (e: any) {
            console.error('Failed to save settings:', e);
            setMessage({ text: 'Ошибка сохранения: ' + (e.response?.data?.error || e.message), type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-center text-zinc-500 py-10">Загрузка...</div>;

    return (
        <Layout>
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Настройки системы</h1>
                </div>

                <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-6">
                    
                    {/* Maintenance Mode */}
                    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <div>
                            <div className="font-medium text-zinc-900 dark:text-zinc-100">Режим обслуживания</div>
                            <div className="text-sm text-zinc-500">
                                Временно отключает активацию ключей и подписок для пользователей.
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={settings.maintenanceMode}
                                onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {/* Announcement */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Глобальное объявление
                        </label>
                        <div className="text-xs text-zinc-500 mb-2">
                            Текст, который будет отображаться всем пользователям (например, "Технические работы"). Оставьте пустым, чтобы скрыть.
                        </div>
                        <textarea 
                            value={settings.announcement}
                            onChange={(e) => setSettings({ ...settings, announcement: e.target.value })}
                            rows={3}
                            placeholder="Введите текст объявления..."
                            className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Max Activations (Example) */}
                    <div className="space-y-2">
                         <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Лимит активаций в день
                        </label>
                        <input 
                            type="number"
                            value={settings.maxActivationsPerDay}
                            onChange={(e) => setSettings({ ...settings, maxActivationsPerDay: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Save Button */}
                    <div className="pt-4 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
                         {message && (
                            <div className={`text-sm ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                                {message.text}
                            </div>
                        )}
                        {!message && <div></div>} {/* Spacer */}
                        
                        <button 
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
                        >
                            {saving ? 'Сохранение...' : 'Сохранить настройки'}
                        </button>
                    </div>

                </div>
            </div>
        </Layout>
    );
}
