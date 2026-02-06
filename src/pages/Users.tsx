import React, { useEffect, useState } from 'react';
import { getSubscriptions, setAuthToken, manualActivateSubscription, updateSubscription, deleteSubscription } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { EditUserModal } from '../components/EditUserModal';
import { ModeToggle } from '../components/ModeToggle';

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
  note: string | null;
  keys: Key[];
}

export function Users() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<Subscription | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin');
      return;
    }
    setAuthToken(token);
  }, []);

  // Reload when page or search changes
  useEffect(() => {
      loadData();
  }, [page, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getSubscriptions(page, limit, searchTerm);
      setSubscriptions(data.subscriptions);
      setTotalPages(data.totalPages);
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

  const handleUpdateUser = async (data: any) => {
      if (!editingUser) return;
      try {
          await updateSubscription(editingUser.id, data);
          setEditingUser(null);
          loadData();
      } catch (e: any) {
          alert('Ошибка обновления: ' + (e.response?.data?.error || e.message));
      }
  };

  const handleDeleteUser = async (id: number) => {
      if (!window.confirm('Вы уверены, что хотите удалить этого пользователя? Это действие нельзя отменить.')) return;
      try {
          await deleteSubscription(id);
          loadData();
      } catch (e: any) {
          alert('Ошибка удаления: ' + (e.response?.data?.error || e.message));
      }
  };

  const handleBulkDelete = async () => {
      if (selectedUsers.length === 0) return;
      if (!window.confirm(`Удалить выбранных пользователей (${selectedUsers.length})?`)) return;
      
      try {
          for (const id of selectedUsers) {
              await deleteSubscription(id);
          }
          setSelectedUsers([]);
          loadData();
      } catch (e: any) {
          alert('Ошибка массового удаления: ' + (e.message));
      }
  };

  const toggleSelectAll = () => {
      if (selectedUsers.length === subscriptions.length) {
          setSelectedUsers([]);
      } else {
          setSelectedUsers(subscriptions.map(s => s.id));
      }
  };

  const toggleSelectUser = (id: number) => {
      if (selectedUsers.includes(id)) {
          setSelectedUsers(selectedUsers.filter(uid => uid !== id));
      } else {
          setSelectedUsers([...selectedUsers, id]);
      }
  };

  const handleExportCSV = () => {
      if (subscriptions.length === 0) return;

      const headers = ['ID', 'Email', 'Type', 'Status', 'Start Date', 'End Date', 'Activations Count', 'Keys'];
      const rows = subscriptions.map(sub => {
          const start = new Date(sub.startDate);
          const monthsToAdd = sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1);
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

  const filteredSubscriptions = subscriptions.filter(sub => 
      sub.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <div className="flex gap-4 items-center">
            {selectedUsers.length > 0 && (
                <button 
                    onClick={handleBulkDelete}
                    className="text-sm px-3 py-1 bg-red-900/50 text-red-400 border border-red-900 hover:bg-red-900 rounded-md transition-colors"
                >
                    Удалить ({selectedUsers.length})
                </button>
            )}
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
            <ModeToggle />
          </div>
        </div>

        {error && (
            <div className="bg-red-500/10 text-red-500 p-4 rounded-md border border-red-500/20">
                {error}
            </div>
        )}

        {/* Search Bar */}
        <div className="relative">
            <input 
                type="text" 
                placeholder="Поиск по Email..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors pl-10"
            />
            <svg className="w-5 h-5 absolute left-3 top-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        </div>

        {loading ? (
            <div className="text-center text-zinc-500 py-10">Загрузка...</div>
        ) : (
            <>
            {/* Mobile View: Cards */}
            <div className="block md:hidden space-y-4">
                {subscriptions.map(sub => {
                    const start = new Date(sub.startDate);
                    const monthsToAdd = sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1);
                    const endDate = new Date(start.setMonth(start.getMonth() + monthsToAdd));
                    const now = new Date();
                    const showExtend = sub.activationsCount < (sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1)) && endDate < now;
                    const displayStatus = endDate < now ? 'completed' : 'active';
                    
                    return (
                        <div key={sub.id} className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-medium text-white">{sub.email}</div>
                                    <div className="text-xs text-zinc-500 font-mono mt-1">ID: {sub.id}</div>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs ${
                                    sub.type === '3m' ? 'bg-purple-500/20 text-purple-400' : 
                                    sub.type === '2m' ? 'bg-green-500/20 text-green-400' :
                                    'bg-blue-500/20 text-blue-400'
                                }`}>
                                    {sub.type === '3m' ? '3 Месяца' : (sub.type === '2m' ? '2 Месяца' : '1 Месяц')}
                                </span>
                            </div>

                            <div className="flex justify-between items-center text-sm">
                                <span className="text-zinc-400">Статус:</span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                    displayStatus === 'active' ? 'bg-green-500/20 text-green-400' : 
                                    displayStatus === 'completed' ? 'bg-zinc-700 text-zinc-300' : 'bg-red-500/20 text-red-400'
                                }`}>
                                    {displayStatus}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                                <div>Старт: {new Date(sub.startDate).toLocaleDateString()}</div>
                                <div>Конец: {endDate.toLocaleDateString()}</div>
                            </div>

                            {sub.note && (
                                <div className="text-xs bg-yellow-500/10 text-yellow-500 p-2 rounded border border-yellow-500/20">
                                    📝 {sub.note}
                                </div>
                            )}

                            <div className="pt-3 border-t border-zinc-800 flex justify-end gap-3">
                                <button 
                                    onClick={() => setEditingUser({ ...sub, status: displayStatus })}
                                    className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded"
                                >
                                    ✏️ Ред.
                                </button>
                                {showExtend && (
                                    <button 
                                        onClick={() => handleManualActivate(sub.id)}
                                        className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
                                    >
                                        Продлить
                                    </button>
                                )}
                                <button 
                                    onClick={() => handleDeleteUser(sub.id)}
                                    className="p-2 text-red-400 bg-red-900/20 rounded"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900 text-zinc-400 uppercase text-xs">
                <tr>
                    <th className="px-6 py-3 w-4">
                        <input 
                            type="checkbox" 
                            checked={selectedUsers.length > 0 && selectedUsers.length === subscriptions.length}
                            onChange={toggleSelectAll}
                            className="rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-0 focus:ring-offset-0"
                        />
                    </th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Тип</th>
                    <th className="px-6 py-3">Заметка</th>
                    <th className="px-6 py-3">Статус</th>
                    <th className="px-6 py-3">Дата старта</th>
                    <th className="px-6 py-3">Дата окончания</th>
                    <th className="px-6 py-3">Ключи</th>
                    <th className="px-6 py-3 text-right">Действия</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                {subscriptions.map((sub) => {
                    const start = new Date(sub.startDate);
                    const monthsToAdd = sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1);
                    const endDate = new Date(start.setMonth(start.getMonth() + monthsToAdd));
                    const now = new Date();
                    const showExtend = sub.activationsCount < (sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1)) && endDate < now;
                    const displayStatus = endDate < now ? 'completed' : 'active';

                    return (
                    <tr key={sub.id} className="hover:bg-zinc-800/50 transition-colors group">
                    <td className="px-6 py-4">
                        <input 
                            type="checkbox" 
                            checked={selectedUsers.includes(sub.id)}
                            onChange={() => toggleSelectUser(sub.id)}
                            className="rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-0 focus:ring-offset-0"
                        />
                    </td>
                    <td className="px-6 py-4 font-medium text-white">{sub.email}</td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                            sub.type === '3m' ? 'bg-purple-500/20 text-purple-400' : 
                            sub.type === '2m' ? 'bg-green-500/20 text-green-400' :
                            'bg-blue-500/20 text-blue-400'
                        }`}>
                        {sub.type === '3m' ? '3 Месяца' : (sub.type === '2m' ? '2 Месяца' : '1 Месяц')}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                        {sub.note ? (
                            <div className="group/note relative">
                                <svg className="w-4 h-4 text-yellow-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover/note:block w-48 p-2 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 shadow-xl z-10 whitespace-normal">
                                    {sub.note}
                                </div>
                            </div>
                        ) : (
                            <span className="text-zinc-700">-</span>
                        )}
                    </td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                            displayStatus === 'active' ? 'bg-green-500/20 text-green-400' : 
                            displayStatus === 'completed' ? 'bg-zinc-700 text-zinc-300' : 'bg-red-500/20 text-red-400'
                        }`}>
                        {displayStatus}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                        {new Date(sub.startDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                        {endDate.toLocaleDateString()}
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
                    <td className="px-6 py-4 text-right flex justify-end gap-2 items-center">
                        <button 
                            onClick={() => setEditingUser({ ...sub, status: displayStatus })}
                            className="text-zinc-500 hover:text-blue-400 transition-colors p-1"
                            title="Редактировать"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        {showExtend && (
                            <button 
                                onClick={() => handleManualActivate(sub.id)}
                                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition-colors"
                            >
                                Продлить
                            </button>
                        )}
                        <button 
                            onClick={() => handleDeleteUser(sub.id)}
                            className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                            title="Удалить"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </td>
                    </tr>
                    );
                })}
                {subscriptions.length === 0 && (
                    <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-zinc-500">Пользователи не найдены</td>
                    </tr>
                )}
                </tbody>
            </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
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
            </>
        )}
      </div>

      {editingUser && (
        <EditUserModal 
            isOpen={true}
            onClose={() => setEditingUser(null)}
            onSave={handleUpdateUser}
            user={editingUser}
        />
      )}
    </div>
  );
}
