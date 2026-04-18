'use client';
import { useEffect, useState, useRef } from 'react';

const SSE_URL = 'https://liv-entra-api-production.up.railway.app/api/v1/admin/events/stream';

export interface DashboardEvent {
  type: string;
  at: string;
  [key: string]: any;
}

/**
 * useEvents — connects to the admin SSE event stream.
 * Returns the latest events and connection status.
 * Auto-reconnects on disconnect with exponential backoff.
 */
export function useEvents(maxEvents = 30) {
  const [events, setEvents]     = useState<DashboardEvent[]>([]);
  const [isConnected, setConnected] = useState(false);
  const esRef    = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRef   = useRef(maxEvents);
  maxRef.current = maxEvents;

  useEffect(() => {
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      // Clean up any existing connection
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      const token = localStorage.getItem('admin_token');
      if (!token) {
        // No token — retry in 3s (user might be logging in)
        timerRef.current = setTimeout(connect, 3000);
        return;
      }

      const url = `${SSE_URL}?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        if (destroyed) return;
        setConnected(true);
        retryRef.current = 0;
      };

      const handle = (e: MessageEvent) => {
        if (destroyed) return;
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'connected') return; // skip ack
          setEvents(prev => [data, ...prev].slice(0, maxRef.current));
        } catch { /* ignore parse errors */ }
      };

      // Named event listeners
      [
        'payment_received', 'payment_failed', 'company_created',
        'subscription_changed', 'invoice_overdue', 'trial_expiring',
        'plan_changed', 'client_activity',
      ].forEach(type => es.addEventListener(type, handle));

      // Fallback for unnamed messages
      es.onmessage = handle;

      es.onerror = () => {
        if (destroyed) return;
        setConnected(false);
        es.close();
        esRef.current = null;
        const delay = Math.min(1000 * Math.pow(2, retryRef.current), 30000);
        retryRef.current++;
        timerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      setConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { events, isConnected, lastEvent: events[0] || null };
}
