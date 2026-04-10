'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { BASE } from './api';

const API = BASE || process.env.NEXT_PUBLIC_API_URL || 'https://liv-entra-api-production.up.railway.app/api/v1';

export interface DashboardEvent {
  type: string;
  at: string;
  [key: string]: any;
}

/**
 * useEvents — connects to the admin SSE event stream.
 * Returns the latest events (max 30) and connection status.
 * Auto-reconnects on disconnect with exponential backoff.
 */
export function useEvents(maxEvents = 30) {
  const [events, setEvents]       = useState<DashboardEvent[]>([]);
  const [isConnected, setConnected] = useState(false);
  const esRef  = useRef<EventSource | null>(null);
  const retryRef = useRef(0);

  const connect = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) return;

    // EventSource doesn't support headers — pass token as query param
    const url = `${API}/admin/events/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      retryRef.current = 0;
    };

    // Listen to named events
    const eventTypes = [
      'connected', 'payment_received', 'payment_failed',
      'company_created', 'subscription_changed',
      'invoice_overdue', 'trial_expiring', 'plan_changed',
    ];

    eventTypes.forEach(type => {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setEvents(prev => [data, ...prev].slice(0, maxEvents));
        } catch { /* ignore parse errors */ }
      });
    });

    // Also listen to generic message events (fallback)
    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type && data.type !== 'ping') {
          setEvents(prev => [data, ...prev].slice(0, maxEvents));
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Reconnect with backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * Math.pow(2, retryRef.current), 30000);
      retryRef.current++;
      setTimeout(connect, delay);
    };
  }, [maxEvents]);

  useEffect(() => {
    connect();
    return () => { esRef.current?.close(); };
  }, [connect]);

  return { events, isConnected, lastEvent: events[0] || null };
}
