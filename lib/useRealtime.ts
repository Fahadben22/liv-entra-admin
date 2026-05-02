'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface RealtimeOptions {
  table: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
}

export function useRealtime<T extends Record<string, unknown>>(options: RealtimeOptions) {
  const { table, filter, event = '*' } = options;

  const [lastEvent, setLastEvent] = useState<{ type: string; record: T } | null>(null);
  const [connected, setConnected]   = useState(false);

  const onPayload = useCallback(
    (payload: { new: unknown; old: unknown; eventType: string }) => {
      const record = (payload.new ?? payload.old) as T;
      setLastEvent({ type: payload.eventType, record });
    },
    [],
  );

  useEffect(() => {
    if (!supabase) return;

    const name = `rt:${table}:${filter ?? '*'}`;
    const channel = supabase
      .channel(name)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event, schema: 'public', table, ...(filter ? { filter } : {}) },
        onPayload,
      )
      .subscribe((status: string) => setConnected(status === 'SUBSCRIBED'));

    return () => void supabase?.removeChannel(channel);
  }, [table, filter, event, onPayload]);

  return { lastEvent, connected };
}
