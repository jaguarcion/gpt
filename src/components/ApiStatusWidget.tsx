import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface ApiStatus {
    online: boolean;
    latency: number;
    message: string;
}

export function ApiStatusWidget() {
    const [status, setStatus] = useState<ApiStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    const checkStatus = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await axios.get('http://localhost:3001/api/status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStatus(response.data);
        } catch (e) {
            setStatus({ online: false, latency: 0, message: 'Connection Error' });
        } finally {
            setLoading(false);
        }
    };

    if (loading && !status) return <div className="text-zinc-500 text-xs">Checking API...</div>;

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${status?.online ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
            <div className="flex flex-col">
                <span className="text-xs font-medium text-zinc-300">
                    API: {status?.online ? 'Online' : 'Offline'}
                </span>
                {status?.online && (
                    <span className="text-[10px] text-zinc-500">{status.latency}ms</span>
                )}
            </div>
        </div>
    );
}
