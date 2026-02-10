import { useEffect, useRef } from 'react';
import { useSSE, type SSEEvent } from '../hooks/useSSE';
import { useToast } from './Toast';

const eventMessages: Record<string, { type: 'success' | 'error' | 'warning' | 'info'; format: (data: any) => string }> = {
    activation: {
        type: 'success',
        format: (d) => `Активация: ${d.email || 'подписка'} #${d.subscriptionId || ''}`,
    },
    renewal: {
        type: 'success',
        format: (d) => `Продление: ${d.email || 'подписка'} #${d.subscriptionId || ''}`,
    },
    error: {
        type: 'error',
        format: (d) => `Ошибка: ${d.message || d.email || 'неизвестная ошибка'}`,
    },
    key_added: {
        type: 'info',
        format: (d) => `Добавлено ключей: ${d.count || 1}`,
    },
    key_low: {
        type: 'warning',
        format: (d) => `Мало ключей! Осталось: ${d.remaining ?? '?'}`,
    },
    subscription_created: {
        type: 'info',
        format: (d) => `Новая подписка: ${d.email || ''}`,
    },
};

export function SSEToastListener() {
    const toast = useToast();
    const toastRef = useRef(toast);
    toastRef.current = toast;

    useSSE((event: SSEEvent) => {
        const config = eventMessages[event.type];
        if (!config) return;

        const message = config.format(event.data || {});
        toastRef.current.toast(message, config.type, 5000);
    });

    return null;
}
