import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { setAuthToken, validateOneKey } from '../services/api';
import { useToast } from '../components/Toast';
import { ShieldCheck, SearchCheck, Copy } from 'lucide-react';

interface ValidationResult {
    code: string;
    status: 'Valid' | 'NoValid';
    reason: string;
    checkedAt: string;
}

export function KeyValidation() {
    const navigate = useNavigate();
    const toast = useToast();
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [processed, setProcessed] = useState(0);
    const [results, setResults] = useState<ValidationResult[]>([]);
    const [summary, setSummary] = useState({ total: 0, valid: 0, noValid: 0, duplicateInPayload: 0 });

    const parseKeys = (text: string) => {
        const normalized = text
            .split(/[\s,;]+/)
            .map(s => s.trim())
            .filter(Boolean);

        const unique = [...new Set(normalized)];
        return {
            normalized,
            unique,
            duplicateInPayload: normalized.length - unique.length
        };
    };

    const parsedCount = useMemo(() => {
        return parseKeys(input).normalized.length;
    }, [input]);

    const handleValidate = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            if (!token) {
                navigate('/login');
                return;
            }
            setAuthToken(token);

            if (!input.trim()) {
                toast.error('Введите ключи для проверки');
                return;
            }

            const parsed = parseKeys(input);
            if (parsed.unique.length === 0) {
                toast.error('Не найдено ключей для проверки');
                return;
            }

            setLoading(true);
            setProcessed(0);
            setResults([]);
            setSummary({
                total: parsed.unique.length,
                valid: 0,
                noValid: 0,
                duplicateInPayload: parsed.duplicateInPayload
            });

            let valid = 0;
            let noValid = 0;

            for (const code of parsed.unique) {
                const data = await validateOneKey(code);
                const row: ValidationResult = data?.result || {
                    code,
                    status: 'NoValid',
                    reason: 'Пустой ответ от сервера',
                    checkedAt: new Date().toISOString()
                };

                if (row.status === 'Valid') valid++;
                else noValid++;

                setResults(prev => [...prev, row]);
                setProcessed(prev => prev + 1);
                setSummary(prev => ({
                    ...prev,
                    valid,
                    noValid
                }));
            }

            toast.success(`Проверка завершена. Valid: ${valid}, NoValid: ${noValid}`);
        } catch (e: any) {
            toast.error(e.response?.data?.error || e.message || 'Ошибка проверки');
        } finally {
            setLoading(false);
        }
    };

    const copyNoValid = async () => {
        const text = results
            .filter(r => r.status === 'NoValid')
            .map(r => r.code)
            .join('\n');

        if (!text) {
            toast.error('NoValid ключи не найдены');
            return;
        }

        await navigator.clipboard.writeText(text);
        toast.success('NoValid ключи скопированы');
    };

    return (
        <Layout>
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-blue-500" />
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Проверка ключей</h1>
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-4">
                    <p className="text-sm text-zinc-500">Вставьте ключи (новая строка, пробел, запятая или ;). Результаты получат статус только двух типов: Valid или NoValid.</p>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        rows={8}
                        placeholder="Вставьте ключи для массовой проверки"
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none font-mono text-sm"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-zinc-500">Найдено ключей во вводе: {parsedCount}</span>
                        {loading && (
                            <span className="text-xs text-blue-500">Проверено: {processed}/{summary.total}</span>
                        )}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleValidate}
                                disabled={loading}
                                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                                <SearchCheck className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
                                {loading ? 'Проверяем...' : 'Проверить'}
                            </button>
                            <button
                                onClick={copyNoValid}
                                className="inline-flex items-center gap-2 rounded-md bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            >
                                <Copy className="w-4 h-4" />
                                Скопировать NoValid
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label="Всего" value={summary.total} />
                    <Stat label="Valid" value={summary.valid} color="text-green-600 dark:text-green-400" />
                    <Stat label="NoValid" value={summary.noValid} color="text-red-600 dark:text-red-400" />
                    <Stat label="Дубли во вводе" value={summary.duplicateInPayload} />
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500">Результат проверки</div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50 dark:bg-zinc-900/70 text-zinc-500">
                                <tr>
                                    <th className="px-4 py-3">Ключ</th>
                                    <th className="px-4 py-3">Статус</th>
                                    <th className="px-4 py-3">Причина</th>
                                    <th className="px-4 py-3">Время проверки</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {results.map((row) => (
                                    <tr key={`${row.code}-${row.checkedAt}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                                        <td className="px-4 py-3 font-mono text-xs md:text-sm text-zinc-900 dark:text-zinc-100 break-all">{row.code}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border ${row.status === 'Valid'
                                                ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50'
                                                : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50'
                                                }`}>
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.reason || '-'}</td>
                                        <td className="px-4 py-3 text-zinc-500">{new Date(row.checkedAt).toLocaleString('ru-RU')}</td>
                                    </tr>
                                ))}
                                {results.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-10 text-center text-zinc-500">Пока нет результатов. Введите ключи и нажмите Проверить.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

function Stat({ label, value, color = 'text-zinc-900 dark:text-zinc-100' }: { label: string; value: number; color?: string }) {
    return (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-3">
            <div className="text-xs text-zinc-500">{label}</div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
        </div>
    );
}