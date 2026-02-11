import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats, getKeys, addKey, setAuthToken, deleteKey } from '../services/api';
import { Layout } from '../components/Layout';
import { ColumnSelector, useColumnVisibility, type Column } from '../components/ColumnSelector';
import { SkeletonCards, SkeletonTable } from '../components/Skeleton';
import { TableDensityToggle } from '../components/TableDensityToggle';
import { useTableDensity } from '../hooks/useTableDensity';
import { useToast } from '../components/Toast';
import { useScrollRestore } from '../hooks/useScrollRestore';
import { useSortable } from '../hooks/useSortable';
import { SortableHeader } from '../components/SortableHeader';
import { RelativeTime } from '../components/RelativeTime';

export function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [keys, setKeys] = useState<any[]>([]);
  const [newKeyCodes, setNewKeyCodes] = useState('');
  const navigate = useNavigate();
  useScrollRestore();
  
  // New states for pagination and filtering
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  // Column customization
  const keyColumns: Column[] = [
      { key: 'id', label: 'ID' },
      { key: 'code', label: 'Code', required: true },
      { key: 'status', label: 'Status' },
      { key: 'usedBy', label: 'Used By' },
      { key: 'createdAt', label: 'Created At' },
      { key: 'actions', label: 'Действия', required: true },
  ];
  const { visible: visibleCols, toggle: toggleCol, isVisible: isColVisible, reset: resetCols } = useColumnVisibility('keys', keyColumns);
  const { density, toggle: toggleDensity, cellPadding, headerPadding, fontSize } = useTableDensity();
  const toast = useToast();

  const loadData = async (currentPage = page, currentStatus = statusFilter) => {
    try {
        const statsData = await getStats();
        const keysData = await getKeys(currentPage, limit, currentStatus);
        
        setStats(statsData);
        setKeys(keysData.keys);
        setTotalPages(keysData.totalPages);
    } catch (e) {
        console.error("Load data error", e);
        throw e; // Re-throw to handle it in caller
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('adminToken');
    if (!savedToken) {
      navigate('/admin');
      return;
    }
    setAuthToken(savedToken);
    loadData(1, 'all')
      .catch(() => { navigate('/admin'); })
      .finally(() => setLoading(false));
  }, []);

  // Reload when page or filter changes
  useEffect(() => {
      if (!loading) {
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
      toast.success(`Успешно добавлено ключей: ${codes.length}`);
      loadData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message);
    }
  };
  
  const deletedKeysRef = useRef<Set<number>>(new Set());

  const handleDeleteKey = async (id: number) => {
      // Optimistic delete with undo
      deletedKeysRef.current.add(id);
      setKeys(prev => prev.filter(k => k.id !== id));

      let undone = false;
      toast.undo('Ключ удалён', () => {
          undone = true;
          deletedKeysRef.current.delete(id);
          loadData();
      });

      setTimeout(async () => {
          if (undone) return;
          try {
              await deleteKey(id);
              deletedKeysRef.current.delete(id);
          } catch (e: any) {
              deletedKeysRef.current.delete(id);
              toast.error('Ошибка при удалении');
              loadData();
          }
      }, 5500);
  };

  const handleExportCSV = async () => {
    try {
        // Fetch all keys without pagination
        const data = await getKeys(1, -1, statusFilter);
        const allKeys = data.keys || []; // data is { keys: [...], total: ... } if paginated, or just array if not? 
        // Wait, getKeys returns { keys, total... } structure from backend?
        // Let's check backend.
        // Backend: if limit === -1, returns prisma.key.findMany() -> ARRAY directly.
        // If limit !== -1, returns { keys: [], total: ... }
        
        // So we need to handle this.
        const keysArray = Array.isArray(data) ? data : (data.keys || []);
        
        if (keysArray.length === 0) return;

        const headers = ['ID', 'Code', 'Status', 'Used By', 'Created At'];
        const rows = keysArray.map((k: any) => [
            k.id,
            k.code,
            k.status,
            k.usedByEmail || '-',
            new Date(k.createdAt).toLocaleDateString()
        ].join(','));

        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...rows].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `keys_export_${statusFilter}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error('Export error:', e);
        toast.error('Ошибка при экспорте');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const { sorted: sortedKeys, sortKey, sortDirection, toggleSort } = useSortable(keys);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto space-y-8">
          <SkeletonCards count={3} />
          <SkeletonTable rows={8} cols={5} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Управление ключами</h1>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Всего ключей" value={stats.total} />
            <StatCard label="Доступные" value={stats.active} color="text-green-600 dark:text-green-500" />
            <StatCard label="Использованные" value={stats.used} color="text-zinc-600 dark:text-zinc-500" />
          </div>
        )}

        {/* Add Key */}
        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Добавить ключи (массовая загрузка)</h3>
          <div className="flex flex-col gap-4">
            <textarea
              value={newKeyCodes}
              onChange={(e) => setNewKeyCodes(e.target.value)}
              placeholder="Вставьте ключи, каждый с новой строки..."
              rows={5}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none font-mono text-sm"
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
        </div>

        {/* Keys List */}
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex gap-2">
                    <button 
                        onClick={() => { setStatusFilter('all'); setPage(1); }}
                        className={`px-3 py-1 rounded-md text-sm transition-colors ${statusFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                        Все
                    </button>
                    <button 
                        onClick={() => { setStatusFilter('active'); setPage(1); }}
                        className={`px-3 py-1 rounded-md text-sm transition-colors ${statusFilter === 'active' ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/20' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                        Active
                    </button>
                    <button 
                        onClick={() => { setStatusFilter('used'); setPage(1); }}
                        className={`px-3 py-1 rounded-md text-sm transition-colors ${statusFilter === 'used' ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                        Used
                    </button>
                </div>
                <TableDensityToggle density={density} onToggle={toggleDensity} />
                <ColumnSelector columns={keyColumns} visible={visibleCols} onToggle={toggleCol} onReset={resetCols} />
                <button 
                    onClick={handleExportCSV}
                    className="text-sm px-3 py-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-md transition-colors text-zinc-700 dark:text-zinc-300"
                >
                    Скачать CSV
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="max-h-[70vh] overflow-y-auto">
            <table className={`w-full text-left ${fontSize}`}>
                <thead className={`bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 uppercase text-xs sticky top-0 z-10`}>
                <tr>
                    {isColVisible('id') && <SortableHeader label="ID" sortKey="id" currentSortKey={sortKey} currentDirection={sortDirection} onSort={toggleSort} className={headerPadding} />}
                    {isColVisible('code') && <SortableHeader label="Code" sortKey="code" currentSortKey={sortKey} currentDirection={sortDirection} onSort={toggleSort} className={headerPadding} />}
                    {isColVisible('status') && <SortableHeader label="Status" sortKey="status" currentSortKey={sortKey} currentDirection={sortDirection} onSort={toggleSort} className={headerPadding} />}
                    {isColVisible('usedBy') && <SortableHeader label="Used By" sortKey="usedByEmail" currentSortKey={sortKey} currentDirection={sortDirection} onSort={toggleSort} className={headerPadding} />}
                    {isColVisible('createdAt') && <SortableHeader label="Created At" sortKey="createdAt" currentSortKey={sortKey} currentDirection={sortDirection} onSort={toggleSort} className={headerPadding} />}
                    {isColVisible('actions') && <th className={headerPadding}></th>}
                </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {sortedKeys.map((key) => (
                    <tr key={key.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    {isColVisible('id') && <td className={`${cellPadding} font-mono text-zinc-500`}>{key.id}</td>}
                    {isColVisible('code') && <td className={`${cellPadding} font-mono text-zinc-700 dark:text-zinc-300`}>
                        <span 
                        onClick={() => copyToClipboard(key.code)} 
                        className="cursor-pointer hover:text-blue-500 dark:hover:text-white"
                        title="Click to copy"
                        >
                        {key.code}
                        </span>
                    </td>}
                    {isColVisible('status') && <td className={cellPadding}>
                        <span className={`px-2 py-1 rounded text-xs ${key.status === 'active' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>
                        {key.status}
                        </span>
                    </td>}
                    {isColVisible('usedBy') && <td className={`${cellPadding} text-zinc-600 dark:text-zinc-400`}>{key.usedByEmail || '-'}</td>}
                    {isColVisible('createdAt') && <td className={`${cellPadding} text-zinc-500`}><RelativeTime date={key.createdAt} /></td>}
                    {isColVisible('actions') && <td className={`${cellPadding} text-right`}>
                        <button 
                            onClick={() => handleDeleteKey(key.id)}
                            className="text-zinc-400 hover:text-red-500 transition-colors"
                            title="Удалить"
                        >
                            ✕
                        </button>
                    </td>}
                    </tr>
                ))}
                {keys.length === 0 && (
                    <tr>
                    <td colSpan={visibleCols.length} className="px-6 py-8 text-center text-zinc-500">Нет ключей</td>
                    </tr>
                )}
                </tbody>
            </table>
            </div>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
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
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ label, value, color }: { label: string, value: number, color?: string }) {
  // If color is not provided, default to zinc-900 (light) / white (dark)
  const valueColor = color || 'text-zinc-900 dark:text-white';
  
  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="text-zinc-500 text-sm mb-1">{label}</div>
      <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}
