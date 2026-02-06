import React, { useEffect, useState } from 'react';
import { getSystemResources } from '../services/api';

interface SystemResources {
    memory: {
        total: number;
        free: number;
        used: number;
        usage: number;
    };
    cpu: {
        model: string;
        cores: number;
        load: number[];
    };
    uptime: number;
    platform: string;
}

export function SystemResourcesWidget() {
    const [resources, setResources] = useState<SystemResources | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchResources = async () => {
            try {
                const data = await getSystemResources();
                setResources(data);
            } catch (error) {
                console.error('Failed to fetch system resources', error);
            } finally {
                setLoading(false);
            }
        };

        fetchResources();
        const interval = setInterval(fetchResources, 5000); // Update every 5 seconds
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="text-zinc-500 text-sm">Loading resources...</div>;
    if (!resources) return null;

    const formatBytes = (bytes: number) => {
        const gb = bytes / (1024 * 1024 * 1024);
        return `${gb.toFixed(2)} GB`;
    };

    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    };

    return (
        <div className="bg-white dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">System Resources</h3>
            
            {/* Memory */}
            <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-500">
                    <span>RAM Usage</span>
                    <span>{resources.memory.usage}%</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                            resources.memory.usage > 90 ? 'bg-red-500' : 
                            resources.memory.usage > 70 ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${resources.memory.usage}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Used: {formatBytes(resources.memory.used)}</span>
                    <span>Total: {formatBytes(resources.memory.total)}</span>
                </div>
            </div>

            {/* CPU */}
            <div className="space-y-1">
                 <div className="flex justify-between text-xs text-zinc-500">
                    <span>CPU Load</span>
                    <span title="1 min load average">{resources.cpu.load[0].toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-zinc-400 truncate" title={resources.cpu.model}>
                    {resources.cpu.model}
                </div>
            </div>

            {/* Uptime */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                <div className="flex justify-between text-xs text-zinc-500">
                    <span>Uptime</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">{formatUptime(resources.uptime)}</span>
                </div>
            </div>
             <div className="flex justify-between text-xs text-zinc-500">
                    <span>OS</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">{resources.platform}</span>
                </div>
        </div>
    );
}
