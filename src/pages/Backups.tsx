import React, { useEffect, useState } from 'react';
import { getBackups, createBackup, deleteBackup, downloadBackupUrl, setAuthToken } from '../services/api';
import { Layout } from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

interface Backup {
    name: string;
    size: number;
    created: string;
}

export function Backups() {
    const [backups, setBackups] = useState<Backup[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const toast = useToast();
    const confirm = useConfirm();

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            navigate('/admin');
            return;
        }
        setAuthToken(token);
        loadBackups();
    }, []);

    const loadBackups = async () => {
        setLoading(true);
        try {
            const data = await getBackups();
            setBackups(data);
        } catch (e: any) {
            setError(e.message || 'Ошибка загрузки бэкапов');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBackup = async () => {
        setCreating(true);
        try {
            await createBackup();
            toast.success('Бэкап успешно создан');
            await loadBackups();
        } catch (e: any) {
            toast.error('Ошибка создания бэкапа: ' + e.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteBackup = async (filename: string) => {
        const ok = await confirm({
            title: 'Удалить бэкап',
            message: `Удалить бэкап ${filename}?`,
            confirmText: 'Удалить',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            await deleteBackup(filename);
            toast.success('Бэкап удалён');
            setBackups(prev => prev.filter(b => b.name !== filename));
        } catch (e: any) {
            toast.error('Ошибка удаления: ' + e.message);
        }
    };

    const handleDownload = (filename: string) => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;
        
        // Use fetch with blob to handle download with auth header if needed, 
        // but since download is simple GET, we can construct URL.
        // However, our API requires Bearer token. Browser standard navigation doesn't attach headers.
        // We need to fetch as blob and create object URL.
        
        fetch(downloadBackupUrl(filename), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
        })
        .catch(err => toast.error('Ошибка скачивания: ' + err.message));
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <Layout>
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Резервные копии базы данных</h1>
                    <button 
                        onClick={handleCreateBackup}
                        disabled={creating}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {creating ? 'Создание...' : 'Создать бэкап сейчас'}
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 text-red-500 p-4 rounded-md border border-red-500/20">
                        {error}
                    </div>
                )}

                {loading ? (
                    <SkeletonTable rows={5} cols={4} />
                ) : (
                    <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-3">Имя файла</th>
                                    <th className="px-6 py-3">Дата создания</th>
                                    <th className="px-6 py-3">Размер</th>
                                    <th className="px-6 py-3 text-right">Действия</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {backups.map((backup) => (
                                    <tr key={backup.name} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-4 font-medium font-mono text-zinc-900 dark:text-zinc-300">
                                            {backup.name}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                                            {new Date(backup.created).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                                            {formatSize(backup.size)}
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-3">
                                            <button 
                                                onClick={() => handleDownload(backup.name)}
                                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                Скачать
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteBackup(backup.name)}
                                                className="text-red-600 dark:text-red-400 hover:underline"
                                            >
                                                Удалить
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {backups.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">Бэкапов пока нет</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Layout>
    );
}
