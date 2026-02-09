import { useEffect, useRef, useCallback, useState } from 'react';

export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

type SSEHandler = (event: SSEEvent) => void;

export function useSSE(onEvent?: SSEHandler) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    // Close existing connection
    if (sourceRef.current) {
      sourceRef.current.close();
    }

    const url = `/api/events?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    source.onopen = () => {
      setConnected(true);
    };

    source.onmessage = (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);
        if (event.type === 'connected') {
          setConnected(true);
          return;
        }
        setLastEvent(event);
        onEventRef.current?.(event);
      } catch {
        // ignore parse errors
      }
    };

    source.onerror = () => {
      setConnected(false);
      source.close();
      sourceRef.current = null;

      // Reconnect after 5 seconds
      reconnectTimeout.current = setTimeout(() => {
        connect();
      }, 5000);
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [connect]);

  return { connected, lastEvent };
}
