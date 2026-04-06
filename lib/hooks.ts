import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Debounce hook ───────────────────────────────────────────────────────────
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── SSE hook for real-time updates ──────────────────────────────────────────
type SSEHandler = (data: Record<string, unknown>) => void;

export function useSSE(url: string | null, handlers: Record<string, SSEHandler>) {
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (!url) return;
    if (esRef.current) esRef.current.close();

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      es.close();
      // Reconnect after 5s
      setTimeout(connect, 5000);
    };
    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const handler = handlersRef.current[parsed.type];
        if (handler) handler(parsed.data || parsed);
      } catch { /* ignore parse errors */ }
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => { esRef.current?.close(); };
  }, [connect]);

  return connected;
}
