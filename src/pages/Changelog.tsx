import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
        version: '1.8.0',
        date: '2026-02-08',
        title: 'SLA, Календарь и UX-обновления',
        isNew: true,
        changes: [
            { type: 'feature', text: 'SLA-дашборд — отслеживание процента успешных активаций за день/неделю/месяц с круговыми индикаторами' },
            { type: 'feature', text: 'Календарь продлений — визуализация запланированных nextActivationDate и дат истечения подписок' },
            { type: 'feature', text: 'Виджет «Сегодня» в header — быстрая сводка: активации, ошибки, новые пользователи за сегодня' },
            { type: 'feature', text: 'Changelog — страница с историей изменений системы с таймлайном и badge "NEW"' },
            { type: 'improvement', text: 'Анимированные переходы между страницами (fade + slide-up, 200ms)' },
        ]
    },
    {
        version: '1.7.0',
        date: '2026-02-08',
        title: 'Скелетоны, Toast-уведомления и Rate Limit Monitor',
        changes: [
            { type: 'feature', text: 'Skeleton-загрузка — 6 вариантов анимированных плейсхолдеров для таблиц, карточек, графиков и логов' },
            { type: 'feature', text: 'Toast-уведомления — всплывающие сообщения (success/error/warning/info) вместо alert()' },
            { type: 'feature', text: 'Компактный/просторный режим таблиц — переключатель плотности с сохранением в localStorage' },
            { type: 'feature', text: 'Полноэкранные графики — кнопки разворачивания на весь экран и экспорта в PNG (2x DPI)' },
            { type: 'feature', text: 'Rate Limit Monitor — трекинг запросов по IP, топ IP-адресов, последние блокировки, авто-обновление каждые 15с' },
            { type: 'improvement', text: 'Стилизованный скроллбар — тонкий (6px), полупрозрачный, адаптивный к light/dark теме' },
        ]
    },
    {
        version: '1.6.0',
        date: '2026-02-08',
        title: 'Центр уведомлений и Health-check',
        changes: [
            { type: 'feature', text: 'Центр уведомлений — колокольчик в header с dropdown: ошибки активации, мало ключей, бэкап устарел, подписки истекают' },
            { type: 'feature', text: 'Health-check панель — аптайм сервера, память процесса/ОС (progress bars), размер БД, бэкапы, cron-задачи' },
            { type: 'feature', text: 'Sticky header для таблиц — фиксированный заголовок при скролле длинных таблиц' },
            { type: 'feature', text: 'Кастомизация колонок — выбор видимых колонок в таблицах ключей и пользователей, сохранение в localStorage' },
        ]
    },
    {
        version: '1.5.0',
        date: '2026-02-08',
        title: 'Расширенная фильтрация и orphan-ключи в статистике',
        changes: [
            { type: 'feature', text: 'Расширенные фильтры пользователей — по дате создания, почтовому провайдеру, количеству активаций' },
            { type: 'feature', text: 'Orphan-ключи в статистике — использованные ключи без подписки теперь учитываются в графиках и когортах' },
            { type: 'fix', text: 'Исправлена сериализация когорт (BigInt → Number) для корректного JSON-ответа' },
            { type: 'fix', text: 'Конвертация дат статистики в московский часовой пояс (Europe/Moscow)' },
        ]
    },
    {
        version: '1.4.0',
        date: '2026-02-07',
        title: 'Аудит-логи и оптимизация активации',
        changes: [
            { type: 'feature', text: 'Тип лога AUDIT — отдельный аудит-трейл для всех действий администратора' },
            { type: 'improvement', text: 'Ранний возврат при успешной активации — не ждём завершения pending, если success уже true' },
            { type: 'feature', text: 'Request logger middleware — логирование всех запросов на активацию с IP и email' },
            { type: 'fix', text: 'Скрипт для исправления связей key-subscription (mismatch fix)' },
        ]
    },
    {
        version: '1.3.0',
        date: '2026-02-06',
        title: 'Склад ключей, бэкапы и UI-улучшения',
        changes: [
            { type: 'feature', text: 'Страница «Склад» (Inventory) — burn rate за 7 дней, runway, калькулятор закупки ключей, график расхода за 30 дней' },
            { type: 'feature', text: 'Управление бэкапами — создание/скачивание/удаление через UI, автобэкап каждые 4 часа (до 18 копий)' },
            { type: 'feature', text: 'Поддержка 2-месячной подписки — новый план «2m» в боте и админке' },
            { type: 'feature', text: 'Lifetime activations tracking — учёт общего количества активаций за всё время по пользователю' },
            { type: 'feature', text: 'Светлая тема — полная поддержка light mode во всех компонентах админки' },
            { type: 'feature', text: 'Общий Layout компонент — единая навигация, ApiStatusWidget в header, ModeToggle' },
            { type: 'feature', text: 'Заметки к подпискам — текстовое поле note в модалке редактирования' },
            { type: 'improvement', text: 'Build optimization — manual chunks для vendor (React), charts (Recharts), ui (Lucide)' },
            { type: 'fix', text: 'Защита от дублирующих активаций — in-memory lock (processingLocks Set) + проверка по времени (< 2 мин)' },
            { type: 'fix', text: 'Hover-фон кнопки ModeToggle в light mode' },
        ]
    },
    {
        version: '1.2.0',
        date: '2026-02-06',
        title: 'Статистика, PWA и когортный анализ',
        changes: [
            { type: 'feature', text: 'Страница статистики — линейные графики подключений за 30 дней (Recharts), группировка по типу подписки' },
            { type: 'feature', text: 'Когортный анализ — статистика удержания по месяцам регистрации (retained 1+, retained 2+)' },
            { type: 'feature', text: 'PWA-поддержка — Service Worker, manifest, оффлайн-доступ (vite-plugin-pwa)' },
            { type: 'feature', text: 'CSV-экспорт для ключей и подписок пользователей' },
            { type: 'improvement', text: 'Замена SVG-чарта на Recharts (LineChart вместо самописного BarChart)' },
            { type: 'fix', text: 'Исправлено имя таблицы subscriptions в SQL-запросе когорт' },
            { type: 'fix', text: 'Авторизация и redirect на страницу статистики' },
        ]
    },
    {
        version: '1.1.0',
        date: '2026-02-05',
        title: 'Управление пользователями, логи и продления',
        changes: [
            { type: 'feature', text: 'Страница Activity Logs — фильтрация по типу и поиск, автообновление каждые 10 сек' },
            { type: 'feature', text: 'Планировщик продлений (cron) — автоматическая активация следующего ключа для 2м/3м подписок' },
            { type: 'feature', text: 'Session upsert — обновление сессии при повторной активации вместо создания дубликата' },
            { type: 'feature', text: 'Ручная активация из админки — кнопка «Продлить» для подписок с просроченным периодом' },
            { type: 'feature', text: 'Прогресс-симуляция в боте — анимированные сообщения с этапами активации' },
            { type: 'improvement', text: 'Оптимизация поллинга — интервал уменьшен до 1с вместо 2с, пропущена проверка ключа (skip key check)' },
            { type: 'fix', text: 'BigInt сериализация — поддержка telegramId в JSON-ответах' },
            { type: 'fix', text: 'Динамический статус пользователя — расчёт active/completed по дате окончания вместо статичного поля' },
            { type: 'fix', text: 'Корректная логика кнопки «Продлить» — проверка истечения endDate' },
        ]
    },
    {
        version: '1.0.0',
        date: '2026-02-04',
        title: 'Первый релиз — CDK Activator',
        changes: [
            { type: 'feature', text: 'Админ-панель с авторизацией по Bearer API-токену, сохранение в localStorage' },
            { type: 'feature', text: 'Управление CDK-ключами — добавление (single + bulk), удаление, статус (active/used), пагинация' },
            { type: 'feature', text: 'Страница пользователей — список подписок с email, типом, датами, привязанными ключами' },
            { type: 'feature', text: 'Telegram-бот (Telegraf) — выбор плана (1м/3м), приём JSON-сессии, автоактивация через API' },
            { type: 'feature', text: 'Система подписок — модели Key, Session, Subscription, ActivityLog (Prisma + SQLite)' },
            { type: 'feature', text: 'Интеграция с freespaces.gmailshop.top — активация ключей через внешний API с поллингом статуса' },
            { type: 'feature', text: 'Страница ручной активации (Home) — ввод CDK + JSON сессии, лог-консоль процесса' },
            { type: 'security', text: 'Helmet.js для secure HTTP headers' },
            { type: 'security', text: 'Rate limiter — 1000 запросов / 15 мин на IP (express-rate-limit)' },
            { type: 'security', text: 'CORS-конфигурация через ALLOWED_ORIGINS и авторизация бота через ALLOWED_TELEGRAM_USERS' },
            { type: 'improvement', text: 'Русская локализация интерфейса' },
            { type: 'fix', text: 'Trust proxy для корректного определения IP за Nginx' },
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
    const navigate = useNavigate();

    // Auth check
    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            navigate('/admin');
            return;
        }
    }, []);

    // Mark as seen
    useEffect(() => {
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
