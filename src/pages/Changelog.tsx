import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { FileText, Sparkles, Bug, Wrench, Zap, Star } from 'lucide-react';

interface ChangelogEntry {
    version: string;
    date: string;
    title: string;
    isNew?: boolean;
    changes: Array<{
        type: 'feature' | 'improvement' | 'fix' | 'security';
        text: string;
    }>;
}

const changelog: ChangelogEntry[] = [
    {
        version: '1.5.0',
        date: '2026-02-08',
        title: 'SLA, Календарь и UX-обновления',
        isNew: true,
        changes: [
            { type: 'feature', text: 'SLA-дашборд — отслеживание процента успешных активаций за день/неделю/месяц с круговыми индикаторами' },
            { type: 'feature', text: 'Календарь продлений — визуализация запланированных продлений и истечений подписок' },
            { type: 'feature', text: 'Виджет «Сегодня» в header — быстрая сводка: активации, ошибки, новые за сегодня' },
            { type: 'feature', text: 'Changelog — страница с историей изменений системы (вы сейчас здесь!)' },
            { type: 'improvement', text: 'Анимированные переходы между страницами (fade-in)' },
        ]
    },
    {
        version: '1.4.0',
        date: '2026-02-08',
        title: 'Скелетоны, Toast и Rate Limit',
        changes: [
            { type: 'feature', text: 'Skeleton-загрузка — анимированные плейсхолдеры вместо текста «Загрузка...» на всех страницах' },
            { type: 'feature', text: 'Toast-уведомления — всплывающие сообщения при действиях вместо alert()' },
            { type: 'feature', text: 'Компактный/просторный режим таблиц — переключатель плотности с сохранением в localStorage' },
            { type: 'feature', text: 'Полноэкранные графики — кнопки разворачивания и экспорта PNG' },
            { type: 'feature', text: 'Rate Limit Monitor — отслеживание запросов, топ IP-адресов, блокировок' },
            { type: 'improvement', text: 'Стилизованный скроллбар — тонкий, полупрозрачный, адаптивный к теме' },
        ]
    },
    {
        version: '1.3.0',
        date: '2026-02-07',
        title: 'Уведомления, Health-check и кастомизация таблиц',
        changes: [
            { type: 'feature', text: 'Центр уведомлений — колокольчик в header с непрочитанными событиями и badge' },
            { type: 'feature', text: 'Health-check панель — аптайм, память, БД, бэкапы, cron-задачи' },
            { type: 'feature', text: 'Sticky header таблиц — фиксированный заголовок при скролле' },
            { type: 'feature', text: 'Кастомизация колонок — выбор видимых колонок с сохранением в localStorage' },
        ]
    },
    {
        version: '1.2.0',
        date: '2026-02-06',
        title: 'Склад ключей и расширенная фильтрация',
        changes: [
            { type: 'feature', text: 'Страница «Склад» — burn rate, runway, калькулятор закупки' },
            { type: 'feature', text: 'Расширенные фильтры пользователей — по дате, провайдеру, кол-ву активаций' },
            { type: 'feature', text: 'CSV-экспорт для ключей и пользователей' },
            { type: 'improvement', text: 'Массовое удаление пользователей' },
        ]
    },
    {
        version: '1.1.0',
        date: '2026-02-05',
        title: 'Статистика и бэкапы',
        changes: [
            { type: 'feature', text: 'Страница статистики — графики за 30 дней, когортный анализ' },
            { type: 'feature', text: 'Управление бэкапами — создание, скачивание, удаление' },
            { type: 'feature', text: 'Автоматические бэкапы каждые 4 часа (до 18 копий)' },
            { type: 'feature', text: 'Редактирование пользователей — модалка с изменением подписки' },
            { type: 'security', text: 'Rate limiter (1000 req / 15 min)' },
        ]
    },
    {
        version: '1.0.0',
        date: '2026-02-04',
        title: 'Первый релиз',
        changes: [
            { type: 'feature', text: 'Админ-панель с авторизацией по API-токену' },
            { type: 'feature', text: 'Управление CDK-ключами (добавление, удаление, статус)' },
            { type: 'feature', text: 'Telegram-бот для активации подписок (1м / 2м / 3м)' },
            { type: 'feature', text: 'Автоматическое продление подписок по cron-расписанию' },
            { type: 'feature', text: 'Логирование всех действий' },
            { type: 'feature', text: 'Темная и светлая тема, PWA-поддержка' },
        ]
    },
];

const LAST_SEEN_KEY = 'changelog-last-seen';

export function getChangelogBadge(): boolean {
    try {
        const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
        if (!lastSeen) return true;
        return changelog.some(e => e.isNew && e.version !== lastSeen);
    } catch { return false; }
}

export function Changelog() {
    const [expandedVersion, setExpandedVersion] = useState<string | null>(changelog[0]?.version || null);

    // Mark as seen
    React.useEffect(() => {
        const latest = changelog.find(e => e.isNew);
        if (latest) localStorage.setItem(LAST_SEEN_KEY, latest.version);
    }, []);

    const typeIcon = (type: string) => {
        switch (type) {
            case 'feature': return <Sparkles className="w-3.5 h-3.5 text-blue-500" />;
            case 'improvement': return <Zap className="w-3.5 h-3.5 text-yellow-500" />;
            case 'fix': return <Bug className="w-3.5 h-3.5 text-green-500" />;
            case 'security': return <Wrench className="w-3.5 h-3.5 text-red-500" />;
            default: return <Star className="w-3.5 h-3.5 text-zinc-400" />;
        }
    };

    const typeLabel = (type: string) => {
        switch (type) {
            case 'feature': return 'Новое';
            case 'improvement': return 'Улучшение';
            case 'fix': return 'Исправление';
            case 'security': return 'Безопасность';
            default: return type;
        }
    };

    const typeBg = (type: string) => {
        switch (type) {
            case 'feature': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
            case 'improvement': return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
            case 'fix': return 'bg-green-500/10 text-green-600 dark:text-green-400';
            case 'security': return 'bg-red-500/10 text-red-600 dark:text-red-400';
            default: return 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400';
        }
    };

    return (
        <Layout>
            <div className="max-w-3xl mx-auto space-y-8">
                <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-purple-500" />
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Что нового</h1>
                </div>

                {/* Timeline */}
                <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-[19px] top-8 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800" />

                    <div className="space-y-6">
                        {changelog.map((entry) => {
                            const isExpanded = expandedVersion === entry.version;
                            return (
                                <div key={entry.version} className="relative pl-12">
                                    {/* Timeline dot */}
                                    <div className={`absolute left-3 top-3 w-3.5 h-3.5 rounded-full border-2 ${
                                        entry.isNew
                                            ? 'bg-blue-500 border-blue-300 dark:border-blue-700 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                                            : 'bg-zinc-300 dark:bg-zinc-700 border-zinc-200 dark:border-zinc-800'
                                    }`} />

                                    <button
                                        onClick={() => setExpandedVersion(isExpanded ? null : entry.version)}
                                        className="w-full text-left"
                                    >
                                        <div className={`bg-white dark:bg-zinc-900/50 rounded-xl border transition-colors ${
                                            entry.isNew ? 'border-blue-200 dark:border-blue-900/40' : 'border-zinc-200 dark:border-zinc-800'
                                        } ${isExpanded ? 'shadow-lg' : 'hover:shadow-md'}`}>
                                            <div className="px-5 py-4 flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono text-sm font-bold text-zinc-900 dark:text-white">v{entry.version}</span>
                                                    {entry.isNew && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">NEW</span>
                                                    )}
                                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{entry.title}</span>
                                                </div>
                                                <span className="text-xs text-zinc-400 whitespace-nowrap">{entry.date}</span>
                                            </div>

                                            {isExpanded && (
                                                <div className="px-5 pb-5 pt-1 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                                                    {entry.changes.map((change, idx) => (
                                                        <div key={idx} className="flex items-start gap-2.5 py-1">
                                                            <div className="mt-0.5">{typeIcon(change.type)}</div>
                                                            <div className="flex-1">
                                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-2 ${typeBg(change.type)}`}>
                                                                    {typeLabel(change.type)}
                                                                </span>
                                                                <span className="text-sm text-zinc-700 dark:text-zinc-300">{change.text}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
