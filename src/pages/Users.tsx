import React, { useEffect, useState } from 'react';
import { getSubscriptions, setAuthToken, manualActivateSubscription } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';

interface Key {
  id: number;
  code: string;
  status: string;
  createdAt: string;
}

interface Subscription {
  id: number;
  email: string;
  type: string;
  startDate: string;
  nextActivationDate: string | null;
  status: string;
  activationsCount: number;
  keys: Key[];
}

export function Users() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin');
      return;
    }
    setAuthToken(token);
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await getSubscriptions();
      setSubscriptions(data);
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки данных');
      if (e.response?.status === 401) {
          navigate('/admin');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleManualActivate = async (id: number) => {
      if (!window.confirm('Вы уверены, что хотите принудительно активировать следующий период для этой подписки?')) return;
      
      try {
          await manualActivateSubscription(id);
          alert('Успешно активировано!');
          loadData();
      } catch (e: any) {
          alert(`Ошибка: ${e.response?.data?.error || e.message}`);
      }
  };

  const handleExportCSV = () => {
      if (subscriptions.length === 0) return;

      const headers = ['ID', 'Email', 'Type', 'Status', 'Start Date', 'End Date', 'Activations Count', 'Keys'];
      const rows = subscriptions.map(sub => {
          const start = new Date(sub.startDate);
          const monthsToAdd = sub.type === '3m' ? 3 : 1;
          const endDate = new Date(start.setMonth(start.getMonth() + monthsToAdd));
          const keys = sub.keys.map(k => k.code).join('; ');

          return [
              sub.id,
              sub.email,
              sub.type,
              sub.status,
              new Date(sub.startDate).toLocaleDateString(),
              endDate.toLocaleDateString(),
              sub.activationsCount,
              keys
          ].join(',');
      });

      const csvContent = "data:text/csv;charset=utf-8," 
          + [headers.join(','), ...rows].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "subscriptions_export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-zinc-400 hover:text-white transition-colors">
              ← Назад
            </Link>
            <h1 className="text-2xl font-bold">Список пользователей (Подписки)</h1>
          </div>
          <div className="flex gap-4">
            <button 
                onClick={handleExportCSV}
                className="text-sm px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
            >
                Скачать CSV
            </button>
            <button 
                onClick={() => { localStorage.removeItem('adminToken'); navigate('/admin'); }}
                className="text-sm text-zinc-400 hover:text-white"
            >
                Выйти
            </button>
          </div>
        </div>

        {error && (
            <div className="bg-red-500/10 text-red-500 p-4 rounded-md border border-red-500/20">
                {error}
            </div>
        )}

        {loading ? (
            <div className="text-center text-zinc-500 py-10">Загрузка...</div>
        ) : (
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900 text-zinc-400 uppercase text-xs">
                <tr>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Тип</th>
                    <th className="px-6 py-3">Статус</th>
                    <th className="px-6 py-3">Дата старта</th>
                    <th className="px-6 py-3">Дата окончания</th>
                    <th className="px-6 py-3">Ключи</th>
                    <th className="px-6 py-3"></th>
                </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                {subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{sub.email}</td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${sub.type === '3m' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {sub.type === '3m' ? '3 Месяца' : '1 Месяц'}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                            sub.status === 'active' ? 'bg-green-500/20 text-green-400' : 
                            sub.status === 'completed' ? 'bg-zinc-700 text-zinc-300' : 'bg-red-500/20 text-red-400'
                        }`}>
                        {sub.status}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                        {new Date(sub.startDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                        {(() => {
                            const start = new Date(sub.startDate);
                            const monthsToAdd = sub.type === '3m' ? 3 : 1;
                            const endDate = new Date(start.setMonth(start.getMonth() + monthsToAdd));
                            return endDate.toLocaleDateString();
                        })()}
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                            {sub.keys.map(k => (
                                <span 
                                    key={k.id} 
                                    className="font-mono text-xs text-zinc-500 cursor-pointer hover:text-zinc-300"
                                    onClick={() => copyToClipboard(k.code)}
                                    title="Нажмите чтобы скопировать"
                                >
                                    {k.code}
                                </span>
                            ))}
                            {sub.keys.length === 0 && <span className="text-zinc-600">-</span>}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                        {sub.status === 'active' && sub.type === '3m' && sub.activationsCount < 3 && (
                            <button 
                                onClick={() => handleManualActivate(sub.id)}
                                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition-colors"
                            >
                                Продлить
                            </button>
                        )}
                    </td>
                    </tr>
                ))}
                {subscriptions.length === 0 && (
                    <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">Нет подписок</td>
                    </tr>
                )}
                </tbody>
            </table>
            </div>
        )}
      </div>
    </div>
  );
}
