import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useToast } from '../components/Toast';
import { setAuthToken, getSettings, saveSettings } from '../services/api';
import { Save, RefreshCw, Shield, AlertTriangle, Clock, Globe } from 'lucide-react';

export function Settings() {
    const [settings, setSettings] = useState({
        slaThreshold: 95,
        cronIntervalMinutes: 60,
        retentionDays: 30,
        allowedOrigins: '*',
        telegramBotToken: '',
        adminPassword: '', // Placeholder, usually don't send back
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    useEffect(() => {
        setAuthToken(localStorage.getItem('adminToken') || '');
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await getSettings();
            // Merge with defaults
            setSettings(prev => ({ ...prev, ...data }));
        } catch (e) {
            toast.error('Не удалось загрузить настройки');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await saveSettings(settings);
            toast.success('Настройки сохранены');
        } catch (e) {
            toast.error('Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Layout>
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center gap-3 mb-6">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400">
                        Настройки системы
                    </h1>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    {/* SLA & Monitoring */}
                    <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                        <div className="flex items-center gap-2 mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                            <h3>SLA & Мониторинг</h3>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                                    Порог SLA (%)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={settings.slaThreshold}
                                    onChange={e => setSettings({ ...settings, slaThreshold: Number(e.target.value) })}
                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                                <p className="text-xs text-zinc-500 mt-1">Оповещать если SLA падает ниже этого значения</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                                    Срок хранения логов (дней)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={settings.retentionDays}
                                    onChange={e => setSettings({ ...settings, retentionDays: Number(e.target.value) })}
                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Cron & Tasks */}
                    <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                        <div className="flex items-center gap-2 mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
                            <Clock className="w-5 h-5 text-blue-500" />
                            <h3>Планировщик задач</h3>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                                Интервал обновления подписок (минут)
                            </label>
                            <input
                                type="number"
                                min="5"
                                value={settings.cronIntervalMinutes}
                                onChange={e => setSettings({ ...settings, cronIntervalMinutes: Number(e.target.value) })}
                                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                            <p className="text-xs text-zinc-500 mt-1">Как часто проверять истекающие подписки</p>
                        </div>
                    </div>

                    {/* Security */}
                    <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                        <div className="flex items-center gap-2 mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
                            <Shield className="w-5 h-5 text-green-500" />
                            <h3>Безопасность</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                                    Смена админ-пароля
                                </label>
                                <input
                                    type="password"
                                    placeholder="Новый пароль (оставьте пустым чтобы не менять)"
                                    value={settings.adminPassword}
                                    onChange={e => setSettings({ ...settings, adminPassword: e.target.value })}
                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                                    Allowed Origins (CORS)
                                </label>
                                <input
                                    type="text"
                                    value={settings.allowedOrigins}
                                    onChange={e => setSettings({ ...settings, allowedOrigins: e.target.value })}
                                    placeholder="https://example.com, https://app.com"
                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                        >
                            {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Сохранить настройки
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    );
}
