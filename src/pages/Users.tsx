import React, { useEffect, useState, useRef } from 'react';
import { getSubscriptions, setAuthToken, manualActivateSubscription, updateSubscription, deleteSubscription } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { EditUserModal } from '../components/EditUserModal';
import { UserHistoryModal } from '../components/UserHistoryModal';
import { Layout } from '../components/Layout';
import { ColumnSelector, useColumnVisibility, type Column } from '../components/ColumnSelector';
import { SkeletonTable } from '../components/Skeleton';
import { TableDensityToggle } from '../components/TableDensityToggle';
import { useTableDensity } from '../hooks/useTableDensity';
import { useToast } from '../components/Toast';
import { useStickyState } from '../hooks/useStickyState';
import { useConfirm } from '../components/ConfirmDialog';
import { useScrollRestore } from '../hooks/useScrollRestore';
import { useSortable } from '../hooks/useSortable';
import { SortableHeader } from '../components/SortableHeader';
import { InlineEdit } from '../components/InlineEdit';
import { RelativeTime } from '../components/RelativeTime';
import { Checkbox } from '../components/Checkbox';

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
  const [searchTerm, setSearchTerm] = useStickyState('users-search', '');
  const [filters, setFilters] = useStickyState('users-filters', {
      status: 'all',
      type: 'all',
      expiring: false,
      dateFrom: '',
      dateTo: '',
      emailProvider: '',
      activationsMin: '',
      activationsMax: ''
  });
  const [showDeepSearch, setShowDeepSearch] = useState(false);
  const [editingUser, setEditingUser] = useState<Subscription | null>(null);
  const [viewingHistoryEmail, setViewingHistoryEmail] = useState<string | null>(null);
  
  // Pagination (persisted)
  const [page, setPage] = useStickyState('users-page', 1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  const navigate = useNavigate();
  const confirm = useConfirm();
  useScrollRestore();

  // Column customization
  const userColumns: Column[] = [
      { key: 'checkbox', label: 'Выбор', required: true },
      { key: 'email', label: 'Email', required: true },
      { key: 'type', label: 'Тип' },
      { key: 'note', label: 'Заметка' },
      { key: 'status', label: 'Статус' },
      { key: 'startDate', label: 'Дата старта' },
      { key: 'endDate', label: 'Дата окончания' },
      { key: 'progress', label: 'Прогресс' },
      { key: 'keys', label: 'Ключи' },
      { key: 'actions', label: 'Действия', required: true },
  ];
  const { visible: visibleCols, toggle: toggleCol, isVisible: isColVisible, reset: resetCols } = useColumnVisibility('users', userColumns);
  const { density, toggle: toggleDensity, cellPadding, headerPadding, fontSize } = useTableDensity();
  const toast = useToast();

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
  }, [page, searchTerm, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getSubscriptions(page, limit, searchTerm, filters);
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
    toast.success('Скопировано');
  };

  const handleManualActivate = async (id: number) => {
      const ok = await confirm({
          title: 'Принудительная активация',
          message: 'Вы уверены, что хотите принудительно активировать следующий период для этой подписки?',
          confirmText: 'Активировать',
          variant: 'warning',
      });
      if (!ok) return;
      
      try {
          await manualActivateSubscription(id);
          toast.success('Успешно активировано!');
          loadData();
      } catch (e: any) {
          toast.error(`Ошибка: ${e.response?.data?.error || e.message}`);
      }
  };

  const handleUpdateUser = async (data: any) => {
      if (!editingUser) return;
      try {
          await updateSubscription(editingUser.id, data);
          setEditingUser(null);
          toast.success('Пользователь обновлён');
          loadData();
      } catch (e: any) {
          toast.error('Ошибка обновления: ' + (e.response?.data?.error || e.message));
      }
  };

  const handleInlineUpdate = async (id: number, field: string, value: string) => {
      try {
          await updateSubscription(id, { [field]: value });
          setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
          toast.success('Обновлено');
      } catch (e: any) {
          toast.error('Ошибка: ' + (e.response?.data?.error || e.message));
          throw e; // rethrow so InlineEdit stays in edit mode
      }
  };

  const deletedRef = useRef<Set<number>>(new Set());

  const handleDeleteUser = async (id: number) => {
      // Optimistic delete with undo
      deletedRef.current.add(id);
      setSubscriptions(prev => prev.filter(s => s.id !== id));

      let undone = false;
      toast.undo('Пользователь удалён', () => {
          undone = true;
          deletedRef.current.delete(id);
          loadData();
      });

      // After grace period, actually delete
      setTimeout(async () => {
          if (undone) return;
          try {
              await deleteSubscription(id);
              deletedRef.current.delete(id);
          } catch (e: any) {
              deletedRef.current.delete(id);
              toast.error('Ошибка удаления: ' + (e.response?.data?.error || e.message));
              loadData();
          }
      }, 5500);
  };

  const handleBulkDelete = async () => {
      if (selectedUsers.length === 0) return;
      const ok = await confirm({
          title: 'Массовое удаление',
          message: `Удалить выбранных пользователей (${selectedUsers.length})? Это действие нельзя отменить.`,
          confirmText: 'Удалить',
          variant: 'danger',
      });
      if (!ok) return;
      
      try {
          for (const id of selectedUsers) {
              await deleteSubscription(id);
          }
          setSelectedUsers([]);
          loadData();
      } catch (e: any) {
          toast.error('Ошибка массового удаления: ' + (e.message));
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

  const { sorted: sortedSubscriptions, sortKey, sortDirection, toggleSort } = useSortable(subscriptions);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Список пользователей (Подписки)</h1>
          </div>
          <div className="flex gap-2 items-center">
            {selectedUsers.length > 0 && (
                <button 
                    onClick={handleBulkDelete}
                    className="text-sm px-3 py-1 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 hover:bg-red-200 dark:hover:bg-red-900 rounded-md transition-colors"
                >
                    Удалить ({selectedUsers.length})
                </button>
            )}
            <TableDensityToggle density={density} onToggle={toggleDensity} />
            <ColumnSelector columns={userColumns} visible={visibleCols} onToggle={toggleCol} onReset={resetCols} />
            <button 
                onClick={handleExportCSV}
                className="text-sm px-3 py-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md transition-colors"
            >
                Скачать CSV
            </button>
          </div>
        </div>

        {error && (
            <div className="bg-red-500/10 text-red-500 p-4 rounded-md border border-red-500/20">
                {error}
            </div>
        )}

        {/* Search and Filters */}
        <div className="space-y-4">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input 
                        type="text" 
                        placeholder="Поиск по Email..." 
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                        className="w-full bg-white dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors pl-10"
                    />
                    <svg className="w-5 h-5 absolute left-3 top-3.5 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <button 
                    onClick={() => setShowDeepSearch(!showDeepSearch)}
                    className={`px-4 py-2 rounded-xl border transition-colors flex items-center gap-2 ${showDeepSearch ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                    Фильтры
                </button>
            </div>

            {showDeepSearch && (
                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">Дата создания (От)</label>
                        <input 
                            type="date" 
                            value={filters.dateFrom}
                            onChange={(e) => { setFilters({...filters, dateFrom: e.target.value}); setPage(1); }}
                            className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">Дата создания (До)</label>
                        <input 
                            type="date" 
                            value={filters.dateTo}
                            onChange={(e) => { setFilters({...filters, dateTo: e.target.value}); setPage(1); }}
                            className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">Почтовый провайдер</label>
                        <select 
                            value={filters.emailProvider}
                            onChange={(e) => { setFilters({...filters, emailProvider: e.target.value}); setPage(1); }}
                            className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        >
                            <option value="">Любой</option>
                            <option value="@gmail.com">Gmail</option>
                            <option value="@mail.ru">Mail.ru</option>
                            <option value="@yandex.ru">Yandex</option>
                            <option value="@outlook.com">Outlook</option>
                            <option value="@icloud.com">iCloud</option>
                            <option value="@proton.me">Proton</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">Кол-во активаций (Мин)</label>
                        <input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            value={filters.activationsMin}
                            onChange={(e) => { setFilters({...filters, activationsMin: e.target.value}); setPage(1); }}
                            className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-4">
                <select 
                    value={filters.status}
                    onChange={(e) => { setFilters({...filters, status: e.target.value}); setPage(1); }}
                    className="bg-white dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-blue-500"
                >
                    <option value="all">Все статусы</option>
                    <option value="active">Активные</option>
                    <option value="completed">Завершенные</option>
                    <option value="expired">Истекшие</option>
                </select>

                <select 
                    value={filters.type}
                    onChange={(e) => { setFilters({...filters, type: e.target.value}); setPage(1); }}
                    className="bg-white dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-blue-500"
                >
                    <option value="all">Все типы</option>
                    <option value="1m">1 Месяц</option>
                    <option value="2m">2 Месяца</option>
                    <option value="3m">3 Месяца</option>
                </select>

                <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 select-none">
                    <input 
                        type="checkbox" 
                        checked={filters.expiring}
                        onChange={(e) => { setFilters({...filters, expiring: e.target.checked}); setPage(1); }}
                        className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Истекают скоро (3 дня)</span>
                </label>
            </div>
        </div>

        {loading ? (
            <SkeletonTable rows={10} cols={7} />
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
                        <div key={sub.id} className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-medium text-zinc-900 dark:text-white">{sub.email}</div>
                                    <div className="text-xs text-zinc-500 font-mono mt-1">ID: {sub.id}</div>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs ${
                                    sub.type === '3m' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 
                                    sub.type === '2m' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                                    'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                }`}>
                                    {sub.type === '3m' ? '3м' : (sub.type === '2m' ? '2м' : '1м')}
                                </span>
                            </div>

                            <div className="flex justify-between items-center text-sm">
                                <span className="text-zinc-600 dark:text-zinc-400">Статус:</span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                    displayStatus === 'active' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 
                                    displayStatus === 'completed' ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                }`}>
                                    {displayStatus}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                <div>Старт: {new Date(sub.startDate).toLocaleDateString()}</div>
                                <div>Конец: {endDate.toLocaleDateString()}</div>
                            </div>

                            {sub.note && (
                                <div className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 p-2 rounded border border-yellow-500/20">
                                    📝 {sub.note}
                                </div>
                            )}

                            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
                                <button 
                                    onClick={() => setViewingHistoryEmail(sub.email)}
                                    className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-200 dark:bg-zinc-800 rounded"
                                    title="История"
                                >
                                    🕒
                                </button>
                                <button 
                                    onClick={() => setEditingUser({ ...sub, status: displayStatus })}
                                    className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-200 dark:bg-zinc-800 rounded"
                                >
                                    ✏️ Ред.
                                </button>
                                {showExtend && (
                                    <button 
                                        onClick={() => handleManualActivate(sub.id)}
                                        className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                    >
                                        Продлить
                                    </button>
                                )}
                                <button 
                                    onClick={() => handleDeleteUser(sub.id)}
                                    className="p-2 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20 rounded hover:bg-red-200 dark:hover:bg-red-900/40"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="max-h-[70vh] overflow-y-auto">
            <table className={`w-full text-left ${fontSize}`}>
                <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 uppercase text-xs sticky top-0 z-10">
                <tr>
                    {isColVisible('checkbox') && <th className={`${headerPadding} w-4`}>
                        <Checkbox
                            checked={selectedUsers.length > 0 && selectedUsers.length === subscriptions.length}
                            indeterminate={selectedUsers.length > 0 && selectedUsers.length < subscriptions.length}
                            onChange={toggleSelectAll}
                        />
                    </th>}
                    {isColVisible('email') && <SortableHeader label="Email" sortKey="email" currentSortKey={sortKey} currentDirection={sortDirection} onSort={toggleSort} className={headerPadding} />}
                    {isColVisible('type') && <SortableHeader label="Тип" sortKey="type" currentSortKey={sortKey} currentDirection={sortDirection} onSort={toggleSort} className={headerPadding} />}
                    {isColVisible('note') && <th className={headerPadding}>Заметка</th>}
                    {isColVisible('status') && <SortableHeader label="Статус" sortKey="status" currentSortKey={sortKey} currentDirection={sortDirection} onSort={toggleSort} className={headerPadding} />}
                    {isColVisible('startDate') && <SortableHeader label="Дата старта" sortKey="startDate" currentSortKey={sortKey} currentDirection={sortDirection} onSort={toggleSort} className={headerPadding} />}
                    {isColVisible('endDate') && <th className={headerPadding}>Дата окончания</th>}
                    {isColVisible('progress') && <th className={headerPadding}>Прогресс</th>}
                    {isColVisible('keys') && <th className={headerPadding}>Ключи</th>}
                    {isColVisible('actions') && <th className={`${headerPadding} text-right`}>Действия</th>}
                </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {sortedSubscriptions.map((sub) => {
                    const start = new Date(sub.startDate);
                    const monthsToAdd = sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1);
                    const endDate = new Date(start.setMonth(start.getMonth() + monthsToAdd));
                    const now = new Date();
                    const showExtend = sub.activationsCount < (sub.type === '3m' ? 3 : (sub.type === '2m' ? 2 : 1)) && endDate < now;
                    const displayStatus = endDate < now ? 'completed' : 'active';

                    return (
                    <tr key={sub.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                    {isColVisible('checkbox') && <td className={cellPadding}>
                        <Checkbox
                            checked={selectedUsers.includes(sub.id)}
                            onChange={() => toggleSelectUser(sub.id)}
                        />
                    </td>}
                    {isColVisible('email') && <td className={`${cellPadding} font-medium text-zinc-900 dark:text-white`}>
                        <InlineEdit value={sub.email} onSave={(v) => handleInlineUpdate(sub.id, 'email', v)} onCopy={(v) => copyToClipboard(v)} />
                    </td>}
                    {isColVisible('type') && <td className={cellPadding}>
                        <span className={`px-2 py-1 rounded text-xs ${
                            sub.type === '3m' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 
                            sub.type === '2m' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                            'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}>
                        {sub.type === '3m' ? '3м' : (sub.type === '2m' ? '2м' : '1м')}
                        </span>
                    </td>}
                    {isColVisible('note') && <td className={cellPadding}>
                        <InlineEdit value={sub.note || ''} onSave={(v) => handleInlineUpdate(sub.id, 'note', v)} placeholder="добавить..." />
                    </td>}
                    {isColVisible('status') && <td className={cellPadding}>
                        <span className={`px-2 py-1 rounded text-xs ${
                            displayStatus === 'active' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 
                            displayStatus === 'completed' ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                        }`}>
                        {displayStatus}
                        </span>
                    </td>}
                    {isColVisible('startDate') && <td className={`${cellPadding} text-zinc-600 dark:text-zinc-400`}>
                        {new Date(sub.startDate).toLocaleDateString('ru-RU')}
                    </td>}
                    {isColVisible('endDate') && <td className={`${cellPadding} text-zinc-600 dark:text-zinc-400`}>
                        <span title={endDate.toLocaleString('ru-RU')}>
                            {endDate.toLocaleDateString('ru-RU')}
                        </span>
                    </td>}
                    {isColVisible('progress') && (() => {
                        const startMs = new Date(sub.startDate).getTime();
                        const endMs = endDate.getTime();
                        const nowMs = now.getTime();
                        const total = endMs - startMs;
                        const elapsed = nowMs - startMs;
                        const pct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 100;
                        const daysLeft = Math.max(0, Math.ceil((endMs - nowMs) / 86400000));
                        const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500';
                        return (
                            <td className={cellPadding}>
                                <div className="flex items-center gap-2 min-w-[100px]">
                                    <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-[10px] text-zinc-500 whitespace-nowrap tabular-nums">{daysLeft}д</span>
                                </div>
                            </td>
                        );
                    })()}
                    {isColVisible('keys') && <td className={cellPadding}>
                        <div className="flex flex-col gap-1">
                            {sub.keys.map(k => (
                                <span 
                                    key={k.id} 
                                    className="font-mono text-xs text-zinc-500 hover:text-blue-500 dark:hover:text-zinc-300 cursor-pointer"
                                    onClick={() => copyToClipboard(k.code)}
                                    title="Нажмите чтобы скопировать"
                                >
                                    {k.code}
                                </span>
                            ))}
                            {sub.keys.length === 0 && <span className="text-zinc-400 dark:text-zinc-600">-</span>}
                        </div>
                    </td>}
                    {isColVisible('actions') && <td className={`${cellPadding} text-right flex justify-end gap-2 items-center`}>
                        <button 
                            onClick={() => setViewingHistoryEmail(sub.email)}
                            className="text-zinc-400 dark:text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-1"
                            title="История активности"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        <button 
                            onClick={() => setEditingUser({ ...sub, status: displayStatus })}
                            className="text-zinc-400 dark:text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-1"
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
                            className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
                            title="Удалить"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </td>}
                    </tr>
                    );
                })}
                {subscriptions.length === 0 && (
                    <tr>
                    <td colSpan={visibleCols.length} className="px-6 py-8 text-center text-zinc-500">Пользователи не найдены</td>
                    </tr>
                )}
                </tbody>
            </table>
            </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <button 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                        ←
                    </button>
                    <span className="px-3 py-1 text-zinc-500">
                        Стр. {page} из {totalPages}
                    </span>
                    <button 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800"
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

      <UserHistoryModal 
        isOpen={!!viewingHistoryEmail}
        onClose={() => setViewingHistoryEmail(null)}
        email={viewingHistoryEmail || ''}
      />

      {/* Floating Bulk Actions Toolbar */}
      {selectedUsers.length > 0 && (
          <div className="sticky bottom-4 z-40 flex justify-center animate-[slideUp_200ms_ease-out] mt-4">
              <div className="flex items-center gap-3 px-5 py-3 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl shadow-2xl border border-zinc-700 dark:border-zinc-600">
                  <span className="text-sm font-medium tabular-nums">
                      Выбрано: <span className="text-blue-400">{selectedUsers.length}</span>
                  </span>
                  <div className="w-px h-5 bg-zinc-700" />
                  <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                  >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Удалить
                  </button>
                  <button
                      onClick={handleExportCSV}
                      className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
                  >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      CSV
                  </button>
                  <div className="w-px h-5 bg-zinc-700" />
                  <button
                      onClick={() => setSelectedUsers([])}
                      className="text-sm px-3 py-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                      Снять выбор
                  </button>
              </div>
          </div>
      )}
    </Layout>
  );
}
