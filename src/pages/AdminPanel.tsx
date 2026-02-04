import React, { useState, useEffect } from 'react';
import { getStats, getKeys, addKey, setAuthToken, deleteKey } from '../services/api';
import { LogEntry } from '../components/LogConsole';
import { Link } from 'react-router-dom';

export function AdminPanel() {
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [keys, setKeys] = useState<any[]>([]);
  const [newKeyCodes, setNewKeyCodes] = useState('');
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  
  // New states for pagination and filtering
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  const handleLogin = async () => {
    if (!token) return;
    setAuthToken(token);
    try {
      await loadData();
      setIsAuthenticated(true);
      localStorage.setItem('adminToken', token);
    } catch (e: any) {
      console.error('Login error:', e);
      // If error is 401 or 403, it's token error. 
      // If network error, axios throws different error.
      if (e.response && (e.response.status === 401 || e.response.status === 403)) {
         setMessage({ text: 'Неверный токен', type: 'error' });
      } else {
         setMessage({ text: 'Ошибка сети или сервера', type: 'error' });
      }
    }
  };

  const loadData = async (currentPage = page, currentStatus = statusFilter) => {
    try {
        const statsData = await getStats();
        const keysData = await getKeys(currentPage, limit, currentStatus);
        
        setStats(statsData);
        setKeys(keysData.keys);
        setTotalPages(keysData.totalPages);
    } catch (e) {
        console.error("Load data error", e);
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
      setToken(savedToken);
      setAuthToken(savedToken);
      loadData(1, 'all') // Initial load
        .then(() => setIsAuthenticated(true))
        .catch(() => {
          localStorage.removeItem('adminToken');
          setIsAuthenticated(false);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Reload when page or filter changes
  useEffect(() => {
      if (isAuthenticated) {
          loadData();
      }
  }, [page, statusFilter]);

  const handleAddKey = async () => {
    try {
      if (!newKeyCodes.trim()) return;
      
      const codes = newKeyCodes.split('\n').map(k => k.trim()).filter(k => k.length > 0);
      
      if (codes.length === 0) return;

      await addKey(codes);
      setNewKeyCodes('');
      setMessage({ text: `Успешно добавлено ключей: ${codes.length}`, type: 'success' });
      loadData();
    } catch (e: any) {
      setMessage({ text: e.response?.data?.error || e.message, type: 'error' });
    }
  };
  
  const handleDeleteKey = async (id: number) => {
      if (!window.confirm('Вы уверены, что хотите удалить этот ключ?')) return;
      try {
          await deleteKey(id);
          loadData(); // Reload list
      } catch (e: any) {
          setMessage({ text: 'Ошибка при удалении', type: 'error' });
      }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500">Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900/50 p-8 rounded-xl border border-zinc-800 shadow-xl max-w-md w-full space-y-4">
          <h2 className="text-xl font-bold text-zinc-100 text-center">Admin Login</h2>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter API Token"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleLogin}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Войти
          </button>
          {message && <div className={`text-sm text-center ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{message.text}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <Link 
                to="/admin/users" 
                className="text-blue-400 hover:text-blue-300 font-medium text-sm px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20 transition-all hover:bg-blue-500/20"
            >
                Список пользователей →
            </Link>
          </div>
          <button 
            onClick={() => { setIsAuthenticated(false); localStorage.removeItem('adminToken'); }}
            className="text-sm text-zinc-400 hover:text-white"
          >
            Выйти
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Всего ключей" value={stats.total} />
            <StatCard label="Активные" value={stats.active} color="text-green-500" />
            <StatCard label="Использованные" value={stats.used} color="text-zinc-500" />
          </div>
        )}

        {/* Add Key */}
        <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 space-y-4">
          <h3 className="text-lg font-medium">Добавить ключи (массовая загрузка)</h3>
          <div className="flex flex-col gap-4">
            <textarea
              value={newKeyCodes}
              onChange={(e) => setNewKeyCodes(e.target.value)}
              placeholder="Вставьте ключи, каждый с новой строки..."
              rows={5}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none font-mono text-sm"
            />
            <div className="flex justify-end">
              <button
                onClick={handleAddKey}
                className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
              >
                Добавить ключи
              </button>
            </div>
          </div>
          {message && <div className={`text-sm ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{message.text}</div>}
        </div>

        {/* Keys List */}
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex gap-2">
                    <button 
                        onClick={() => { setStatusFilter('all'); setPage(1); }}
                        className={`px-3 py-1 rounded-md text-sm transition-colors ${statusFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Все
                    </button>
                    <button 
                        onClick={() => { setStatusFilter('active'); setPage(1); }}
                        className={`px-3 py-1 rounded-md text-sm transition-colors ${statusFilter === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Active
                    </button>
                    <button 
                        onClick={() => { setStatusFilter('used'); setPage(1); }}
                        className={`px-3 py-1 rounded-md text-sm transition-colors ${statusFilter === 'used' ? 'bg-zinc-700 text-zinc-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Used
                    </button>
                </div>
            </div>

            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900 text-zinc-400 uppercase text-xs">
                <tr>
                    <th className="px-6 py-3">ID</th>
                    <th className="px-6 py-3">Code</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Used By</th>
                    <th className="px-6 py-3">Created At</th>
                    <th className="px-6 py-3"></th>
                </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                {keys.map((key) => (
                    <tr key={key.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-zinc-500">{key.id}</td>
                    <td className="px-6 py-4 font-mono text-zinc-300">
                        <span 
                        onClick={() => copyToClipboard(key.code)} 
                        className="cursor-pointer hover:text-white"
                        title="Click to copy"
                        >
                        {key.code}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${key.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-400'}`}>
                        {key.status}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">{key.usedByEmail || '-'}</td>
                    <td className="px-6 py-4 text-zinc-500">{new Date(key.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                        <button 
                            onClick={() => handleDeleteKey(key.id)}
                            className="text-zinc-600 hover:text-red-500 transition-colors"
                            title="Удалить"
                        >
                            ✕
                        </button>
                    </td>
                    </tr>
                ))}
                {keys.length === 0 && (
                    <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">Нет ключей</td>
                    </tr>
                )}
                </tbody>
            </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <button 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 disabled:opacity-50 hover:bg-zinc-800"
                    >
                        ←
                    </button>
                    <span className="px-3 py-1 text-zinc-500">
                        Стр. {page} из {totalPages}
                    </span>
                    <button 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 disabled:opacity-50 hover:bg-zinc-800"
                    >
                        →
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-white' }: { label: string, value: number, color?: string }) {
  return (
    <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
      <div className="text-zinc-500 text-sm mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
