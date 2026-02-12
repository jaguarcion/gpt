import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { ApiStatusWidget } from '../components/ApiStatusWidget';
import axios from 'axios';
import { Play, Database, Table as TableIcon, AlertTriangle, RotateCcw } from 'lucide-react';
import { useToast } from '../components/Toast';

interface TableInfo {
    name: string;
    count: number;
}

export function DatabaseExplorer() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const toast = useToast();

    useEffect(() => {
        loadTables();
    }, []);

    const loadTables = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const res = await axios.get('/api/db/tables', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTables(res.data);
        } catch (e) {
            console.error('Failed to load tables', e);
        }
    };

    const runQuery = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setError(null);
        setResults([]);

        try {
            const token = localStorage.getItem('adminToken');
            const res = await axios.post('/api/db/query', { query }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (Array.isArray(res.data)) {
                setResults(res.data);
                toast.success(`Query executed successfully. ${res.data.length} rows returned.`);
            } else {
                // For meta queries that return result object
                setResults([res.data]);
                toast.success('Query executed successfully.');
            }
        } catch (e: any) {
            setError(e.response?.data?.error || e.message);
            toast.error('Query execution failed');
        } finally {
            setLoading(false);
        }
    };

    const shortcuts = [
        { label: 'Select Users', sql: 'SELECT * FROM User LIMIT 10' },
        { label: 'Select Subs', sql: 'SELECT * FROM Subscription LIMIT 10' },
        { label: 'Count Subs', sql: 'SELECT status, COUNT(*) as count FROM Subscription GROUP BY status' },
        { label: 'Recent Logs', sql: 'SELECT * FROM ActivityLog ORDER BY createdAt DESC LIMIT 10' }
    ];

    return (
        <Layout>
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400">
                            Database Explorer
                        </h1>
                        <p className="text-sm text-zinc-500">Прямой доступ к базе данных (SQLite)</p>
                    </div>
                    <ApiStatusWidget />
                </div>

                <div className="grid md:grid-cols-4 gap-6">
                    {/* Sidebar: Tables */}
                    <div className="md:col-span-1 space-y-4">
                        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                            <h3 className="font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                                <Database className="w-4 h-4" /> Tables
                            </h3>
                            <div className="space-y-1">
                                {tables.map(t => (
                                    <button
                                        key={t.name}
                                        onClick={() => setQuery(`SELECT * FROM ${t.name} LIMIT 20`)}
                                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex justify-between items-center group"
                                    >
                                        <span className="flex items-center gap-2">
                                            <TableIcon className="w-3.5 h-3.5 text-zinc-400 group-hover:text-purple-500 transition-colors" />
                                            {t.name}
                                        </span>
                                        <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 tabular-nums">
                                            {t.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30 p-4">
                            <h4 className="text-amber-800 dark:text-amber-400 font-semibold text-sm flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4" /> Caution
                            </h4>
                            <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">
                                Любые изменения через UPDATE/DELETE необратимы. Будьте осторожны при выполнении запросов, изменяющих данные.
                            </p>
                        </div>
                    </div>

                    {/* Main Area: Editor & Results */}
                    <div className="md:col-span-3 space-y-4">
                        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-1">
                            <div className="flex items-center gap-2 p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 mb-0">
                                {shortcuts.map(s => (
                                    <button
                                        key={s.label}
                                        onClick={() => setQuery(s.sql)}
                                        className="text-xs px-3 py-1.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors shadow-sm"
                                    >
                                        {s.label}
                                    </button>
                                ))}
                                <div className="flex-1" />
                                <button
                                    onClick={() => setQuery('')}
                                    className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                                    title="Clear"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                            </div>
                            <textarea
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="w-full h-40 p-4 bg-transparent outline-none font-mono text-sm text-zinc-900 dark:text-zinc-200 resize-y"
                                placeholder="SELECT * FROM ..."
                                spellCheck={false}
                            />
                            <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end bg-zinc-50/30 dark:bg-zinc-900/30 rounded-b-xl">
                                <button
                                    onClick={runQuery}
                                    disabled={loading || !query.trim()}
                                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all shadow-sm ${loading
                                            ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                                            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20 active:translate-y-0.5'
                                        }`}
                                >
                                    <Play className={`w-4 h-4 ${loading ? 'hidden' : ''}`} fill="currentColor" />
                                    {loading ? 'Running...' : 'Execute Query'}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm font-mono">
                                Error: {error}
                            </div>
                        )}

                        {results.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                                <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                    <span className="text-xs font-semibold uppercase text-zinc-500 px-2">Results ({results.length})</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                                            <tr>
                                                {Object.keys(results[0]).map(key => (
                                                    <th key={key} className="px-6 py-3 font-medium whitespace-nowrap">
                                                        {key}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                            {results.map((row, i) => (
                                                <tr key={i} className="bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                                    {Object.values(row).map((val: any, j) => (
                                                        <td key={j} className="px-6 py-3 whitespace-nowrap text-zinc-700 dark:text-zinc-300 font-mono text-xs">
                                                            {val === null ? <span className="text-zinc-400 italic">null</span> :
                                                                typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
