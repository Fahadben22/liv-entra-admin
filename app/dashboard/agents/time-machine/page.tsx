'use client';
import { useEffect, useState, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type EventType = 'observation' | 'decision' | 'audit' | 'tool_call';

interface TimelineEvent {
  time: string;
  type: EventType;
  agent: string;
  agent_name: string;
  summary: string;
  category: string;
  severity: string;
}

const TYPE_LABELS: Record<EventType, string> = {
  observation: 'رصد', decision: 'قرار', audit: 'تدقيق', tool_call: 'أداة',
};

const TYPE_COLORS: Record<EventType, string> = {
  observation: '#3b82f6', decision: '#8b5cf6', audit: '#f59e0b', tool_call: '#10b981',
};

const AGENT_COLORS: Record<string, string> = {
  it: '#6366f1', sales: '#0ea5e9', marketing: '#ec4899', finance: '#14b8a6',
  product: '#f97316', leasing: '#8b5cf6', collections: '#ef4444',
  ops: '#f59e0b', tenant_exp: '#10b981', owner_rel: '#06b6d4', os_finance: '#84cc16',
};

function tok() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('admin_token') || '';
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

export default function TimeMachinePage() {
  const [date, setDate] = useState(todayStr());
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState<EventType | 'all'>('all');
  const [filterAgent, setFilterAgent] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API}/admin/agents/timeline?date=${date}`, {
      headers: { Authorization: `Bearer ${tok()}` },
    });
    const data = await r.json();
    if (data.success) {
      setEvents(data.data || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const agents = Array.from(new Set(events.map(e => e.agent).filter(a => a !== 'admin'))).sort();

  const visible = events.filter(e => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (filterAgent !== 'all' && e.agent !== filterAgent) return false;
    return true;
  });

  const maxDate = todayStr();
  const minDate = new Date(Date.now() - 90 * 24 * 3_600_000).toISOString().slice(0, 10);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--lv-text-primary)', margin: 0 }}>آلة الزمن</h1>
        <p style={{ fontSize: 13, color: 'var(--lv-text-muted)', margin: '4px 0 0' }}>
          استعراض كل ما حدث في النظام في يوم بعينه — رصد الوكلاء، القرارات، الأدوات، التدقيق
        </p>
      </div>

      {/* Date + filters bar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24, padding: '14px 18px', background: 'var(--lv-card-bg)', border: '1px solid var(--lv-card-border)', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, color: 'var(--lv-text-muted)', fontWeight: 500 }}>التاريخ</label>
          <input
            type="date" value={date} min={minDate} max={maxDate}
            onChange={e => setDate(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--lv-card-border)', background: 'var(--lv-subtle-bg)', color: 'var(--lv-text-primary)', fontSize: 13, fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--lv-card-border)' }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FilterChip label="الكل" active={filterType === 'all'} onClick={() => setFilterType('all')} />
          {(Object.keys(TYPE_LABELS) as EventType[]).map(t => (
            <FilterChip key={t} label={TYPE_LABELS[t]} active={filterType === t}
              color={TYPE_COLORS[t]} onClick={() => setFilterType(t)} />
          ))}
        </div>
        {agents.length > 0 && (
          <>
            <div style={{ width: 1, height: 20, background: 'var(--lv-card-border)' }} />
            <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--lv-card-border)', background: 'var(--lv-subtle-bg)', color: 'var(--lv-text-primary)', fontSize: 12, fontFamily: 'inherit' }}>
              <option value="all">جميع الوكلاء</option>
              {agents.map(a => <option key={a} value={a}>{events.find(e => e.agent === a)?.agent_name || a}</option>)}
            </select>
          </>
        )}
        {!loading && (
          <span style={{ marginRight: 'auto', fontSize: 12, color: 'var(--lv-text-muted)' }}>
            {visible.length} حدث{filterType !== 'all' || filterAgent !== 'all' ? ` من ${total}` : ''}
          </span>
        )}
      </div>

      {/* Timeline */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--lv-text-muted)', fontSize: 14 }}>
          جاري التحميل...
        </div>
      ) : visible.length === 0 ? (
        <EmptyState date={date} minDate={minDate} />
      ) : (
        <div style={{ position: 'relative' }}>
          {/* vertical line */}
          <div style={{ position: 'absolute', right: 19, top: 0, bottom: 0, width: 2, background: 'var(--lv-card-border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {visible.map((ev, i) => (
              <EventRow key={i} event={ev} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EventRow({ event }: { event: TimelineEvent }) {
  const color = event.agent === 'admin' ? '#f59e0b' : (AGENT_COLORS[event.agent] || '#6b7280');
  const typeColor = TYPE_COLORS[event.type] || '#6b7280';

  return (
    <div style={{ display: 'flex', gap: 16, paddingBottom: 16, position: 'relative' }}>
      {/* dot */}
      <div style={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, marginTop: 6, border: '2px solid var(--lv-card-bg)', boxShadow: `0 0 0 2px ${color}33` }} />
      </div>

      {/* card */}
      <div style={{ flex: 1, background: 'var(--lv-card-bg)', border: '1px solid var(--lv-card-border)', borderRadius: 8, padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: typeColor, background: `${typeColor}18`, borderRadius: 4, padding: '2px 7px', fontWeight: 500 }}>
            {TYPE_LABELS[event.type]}
          </span>
          <span style={{ fontSize: 12, color: 'var(--lv-text-secondary)', fontWeight: 500 }}>
            {event.agent_name}
          </span>
          <span style={{ fontSize: 11, color: 'var(--lv-text-muted)', marginRight: 'auto' }}>
            {formatTime(event.time)}
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--lv-text-primary)', margin: 0, lineHeight: 1.5 }}>
          {event.summary}
        </p>
      </div>
    </div>
  );
}

function FilterChip({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  const c = active ? (color || '#4f46e5') : 'transparent';
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', borderRadius: 5,
      border: `1px solid ${active ? (color || '#4f46e5') : 'var(--lv-card-border)'}`,
      background: active ? `${c}18` : 'transparent',
      color: active ? (color || '#4f46e5') : 'var(--lv-text-secondary)',
      fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
    }}>
      {label}
    </button>
  );
}

function EmptyState({ date, minDate }: { date: string; minDate: string }) {
  const tooOld = date < minDate;
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--lv-text-muted)' }}>
      {tooOld ? (
        <>
          <p style={{ fontSize: 15, marginBottom: 6 }}>لا تتوفر بيانات لهذا التاريخ</p>
          <p style={{ fontSize: 13 }}>آلة الزمن تحتفظ بالبيانات لمدة 90 يوماً فقط</p>
        </>
      ) : (
        <p style={{ fontSize: 15 }}>لا توجد أحداث مسجّلة لهذا اليوم</p>
      )}
    </div>
  );
}
