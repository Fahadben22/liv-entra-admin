'use client';
import { useState, useEffect, useCallback } from 'react';
import { request } from '@/lib/api';

interface QueueItem {
  id: string;
  source: 'agenda' | 'action' | 'report';
  from_agent: string;
  agent_name: string;
  action_type: string;
  subject: string;
  message: string;
  created_at: string;
  metadata: Record<string, any> | null;
  priority_score: number;
}

interface Metrics {
  totalPending: number;
  totalResolvedToday: number;
  byAgent: {
    pending: Record<string, number>;
    resolved: Record<string, number>;
    avgHours: Record<string, number>;
  };
}

const AGENT_COLORS: Record<string, string> = {
  it:               '#2563EB',
  sales:            '#059669',
  marketing:        '#7c5cfc',
  finance:          '#d97706',
  product:          '#db2777',
  meeting_room:     '#0891b2',
  reea:             '#1e293b',
  lina_sla_monitor: '#0891b2',
  ops:              '#64748b',
  collections:      '#9333ea',
  leasing:          '#16a34a',
  'tenant-exp':     '#0d9488',
  'owner-rel':      '#ca8a04',
  'os-finance':     '#d97706',
};

const ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  approval: { label: 'موافقة مطلوبة', color: '#dc2626', bg: '#fef2f2' },
  decision: { label: 'قرار مطلوب',    color: '#d97706', bg: '#fffbeb' },
  urgent:   { label: 'عاجل',          color: '#dc2626', bg: '#fef2f2' },
  info:     { label: 'للعلم',         color: '#6b7280', bg: '#f9fafb' },
  alert:    { label: 'تنبيه تلقائي',  color: '#0891b2', bg: '#ecfeff' },
};

const SOURCE_LABELS: Record<string, string> = {
  agenda: 'أجندة',
  action: 'إجراء',
  report: 'تقرير',
};

const SOURCE_COLORS: Record<string, string> = {
  agenda: '#6366f1',
  action: '#16a34a',
  report: '#0891b2',
};

function timeAgo(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (diff < 60)   return `منذ ${diff} دقيقة`;
  if (diff < 1440) return `منذ ${Math.floor(diff / 60)} ساعة`;
  return `منذ ${Math.floor(diff / 1440)} يوم`;
}

function isStale(ts: string) {
  return Date.now() - new Date(ts).getTime() > 24 * 60 * 60 * 1000;
}

function avgHoursDisplay(metrics: Metrics | null) {
  if (!metrics) return '—';
  const vals = Object.values(metrics.byAgent.avgHours);
  if (!vals.length) return '—';
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  return `${avg.toFixed(1)} س`;
}

interface CardProps {
  item: QueueItem;
  isExpanded: boolean;
  note: string;
  busy: string | null;
  onToggle: (id: string) => void;
  onNoteChange: (id: string, val: string) => void;
  onDecide: (item: QueueItem, action: 'approve' | 'reject' | 'dismiss') => void;
}

function QueueCard({ item, isExpanded, note, busy, onToggle, onNoteChange, onDecide }: CardProps) {
  const actionMeta = ACTION_LABELS[item.action_type] || ACTION_LABELS.decision;
  const agentColor = AGENT_COLORS[item.from_agent] || '#6b7280';
  const srcColor   = SOURCE_COLORS[item.source] || '#6b7280';
  const isBusy     = busy === item.id;

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 12,
      border: '1px solid rgba(220,38,38,.18)',
      overflow: 'hidden',
      marginBottom: 10,
      boxShadow: '0 2px 8px rgba(220,38,38,.05)',
    }}>
      <div
        onClick={() => onToggle(item.id)}
        style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: agentColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#fff',
        }}>
          {item.agent_name.slice(0, 2)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{item.agent_name}</span>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: actionMeta.bg, color: actionMeta.color, fontWeight: 600 }}>
              {actionMeta.label}
            </span>
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'var(--ink-100)', color: srcColor, fontWeight: 600 }}>
              {SOURCE_LABELS[item.source]}
            </span>
            {isStale(item.created_at) && (
              <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6, background: 'var(--ink-100)', color: 'var(--text-muted)', fontWeight: 600 }}>قديم</span>
            )}
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.subject}
          </p>
          {!isExpanded && (
            <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.message}
            </p>
          )}
        </div>

        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(item.created_at)}</span>
      </div>

      {isExpanded && (
        <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '12px 0 14px', whiteSpace: 'pre-wrap' }}>{item.message}</p>

          {item.source === 'agenda' && (
            <>
              <textarea
                value={note}
                onChange={e => onNoteChange(item.id, e.target.value)}
                placeholder="ملاحظة اختيارية..."
                rows={2}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical',
                  border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px',
                  fontSize: 12, fontFamily: 'inherit', marginBottom: 12,
                  outline: 'none', color: 'var(--text-1)',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  disabled={isBusy}
                  onClick={() => onDecide(item, 'approve')}
                  style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#22c55e', color: '#fff', opacity: isBusy ? .5 : 1 }}
                >
                  {isBusy ? '...' : 'موافقة'}
                </button>
                <button
                  disabled={isBusy}
                  onClick={() => onDecide(item, 'reject')}
                  style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#ef4444', color: '#fff', opacity: isBusy ? .5 : 1 }}
                >
                  رفض
                </button>
                <button
                  disabled={isBusy}
                  onClick={() => onDecide(item, 'dismiss')}
                  style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'var(--surface)', color: 'var(--text-2)', opacity: isBusy ? .5 : 1 }}
                >
                  تجاهل
                </button>
              </div>
            </>
          )}

          {item.source === 'action' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={isBusy}
                onClick={() => onDecide(item, 'approve')}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#22c55e', color: '#fff', opacity: isBusy ? .5 : 1 }}
              >
                {isBusy ? '...' : 'موافقة'}
              </button>
              <button
                disabled={isBusy}
                onClick={() => onDecide(item, 'reject')}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#ef4444', color: '#fff', opacity: isBusy ? .5 : 1 }}
              >
                رفض
              </button>
            </div>
          )}

          {item.source === 'report' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={isBusy}
                onClick={() => onDecide(item, 'approve')}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#22c55e', color: '#fff', opacity: isBusy ? .5 : 1 }}
              >
                {isBusy ? '...' : 'اعتماد التقرير'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TYPE_FILTERS = [
  { key: 'all',      label: 'الكل' },
  { key: 'urgent',   label: 'عاجل' },
  { key: 'approval', label: 'موافقة' },
  { key: 'decision', label: 'قرار' },
  { key: 'info',     label: 'للعلم' },
  { key: 'alert',    label: 'تنبيه' },
];

const SOURCE_FILTERS = [
  { key: 'all',    label: 'كل المصادر' },
  { key: 'agenda', label: 'أجندة' },
  { key: 'action', label: 'إجراءات' },
  { key: 'report', label: 'تقارير' },
];

export default function MissionControlPage() {
  const [items, setItems]           = useState<QueueItem[]>([]);
  const [metrics, setMetrics]       = useState<Metrics | null>(null);
  const [loading, setLoading]       = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [srcFilter, setSrcFilter]   = useState('all');
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [busy, setBusy]             = useState<string | null>(null);
  const [notes, setNotes]           = useState<Record<string, string>>({});
  const [correlations, setCorrelations] = useState<any[]>([]);
  const [intelOpen, setIntelOpen]   = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, mRes, cRes] = await Promise.allSettled([
        request('GET', '/admin/mission-control/queue'),
        request('GET', '/admin/mission-control/metrics'),
        request('GET', '/admin/agents/correlations'),
      ]);
      if (qRes.status === 'fulfilled') setItems((qRes.value as any)?.data || []);
      if (mRes.status === 'fulfilled') setMetrics((mRes.value as any)?.data || null);
      if (cRes.status === 'fulfilled') setCorrelations((cRes.value as any)?.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDecide = useCallback(async (item: QueueItem, action: 'approve' | 'reject' | 'dismiss') => {
    setBusy(item.id);
    try {
      if (item.source === 'agenda') {
        await request('POST', `/admin/agenda/${item.id}/${action}`, { note: notes[item.id] || null });
      } else if (item.source === 'action') {
        if (action === 'approve') {
          await request('POST', `/admin/agents/meeting-room/approve-action/${item.id}`);
        } else {
          await request('POST', `/admin/agents/meeting-room/reject-action/${item.id}`);
        }
      } else if (item.source === 'report') {
        await request('POST', `/admin/agents/meeting-room/approve-report/${item.id}`);
      }
      setItems(prev => prev.filter(i => i.id !== item.id));
      setExpanded(null);
      // refresh metrics
      const mRes = await request('GET', '/admin/mission-control/metrics').catch(() => null);
      if (mRes) setMetrics((mRes as any)?.data || null);
    } catch {
      // item stays in list on error
    } finally {
      setBusy(null);
    }
  }, [notes]);

  const filtered = items.filter(i => {
    if (typeFilter !== 'all' && i.action_type !== typeFilter) return false;
    if (srcFilter  !== 'all' && i.source       !== srcFilter)  return false;
    return true;
  });

  const totalAvgHours = avgHoursDisplay(metrics);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px', direction: 'rtl' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>مركز الأوامر</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>التصعيدات والموافقات المطلوبة من جميع الوكلاء</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="le-btn secondary sm"
        >
          {loading ? 'جاري التحميل...' : 'تحديث'}
        </button>
      </div>

      {/* ── Metrics strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'معلق',       value: metrics?.totalPending       ?? '—', color: '#ef4444' },
          { label: 'تمت اليوم',  value: metrics?.totalResolvedToday ?? '—', color: '#22c55e' },
          { label: 'متوسط وقت', value: totalAvgHours,                      color: '#6366f1' },
        ].map(tile => (
          <div key={tile.label} className="le-card" style={{ padding: '16px 20px', textAlign: 'center', borderRadius: 14 }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: tile.color, margin: '0 0 4px' }}>{String(tile.value)}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{tile.label}</p>
          </div>
        ))}
      </div>

      {/* ── Cross-agent intel strip ── */}
      {correlations.length > 0 && (
        <div style={{ marginBottom: 20, border: '1px solid #fde68a', borderRadius: 14, overflow: 'hidden', background: '#fffbeb' }}>
          <div
            onClick={() => setIntelOpen(o => !o)}
            style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>تنبيهات الذكاء المتقاطع</span>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>{correlations.length}</span>
            </div>
            <span style={{ fontSize: 10, color: '#a16207' }}>{intelOpen ? 'طي' : 'عرض'}</span>
          </div>
          {intelOpen && (
            <div style={{ borderTop: '1px solid #fde68a', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {correlations.map(c => (
                <div key={c.id} style={{
                  padding: '10px 14px', borderRadius: 10,
                  border: `1px solid ${c.severity === 'high' ? 'rgba(220,38,38,.2)' : 'rgba(217,119,6,.2)'}`,
                  background: c.severity === 'high' ? '#fef2f2' : '#fff7ed',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.severity === 'high' ? '#dc2626' : '#d97706' }}>
                      {c.severity === 'high' ? 'عالي' : 'متوسط'}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{(c.agent_names || []).join(' + ')}</span>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 4px' }}>{c.insight}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-2)', margin: 0 }}>{c.recommendation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {TYPE_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: typeFilter === f.key ? 'var(--brand-600)' : 'var(--ink-100)',
              color:      typeFilter === f.key ? '#fff'             : 'var(--text-2)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {SOURCE_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setSrcFilter(f.key)}
            style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: srcFilter === f.key ? 'var(--brand-600)' : 'var(--ink-100)',
              color:      srcFilter === f.key ? '#fff'             : 'var(--text-2)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Queue ── */}
      {loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>جاري التحميل...</div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>
          {items.length === 0 ? 'لا توجد بنود معلقة' : 'لا توجد نتائج للفلتر المحدد'}
        </div>
      )}

      {filtered.map(item => (
        <QueueCard
          key={item.id}
          item={item}
          isExpanded={expanded === item.id}
          note={notes[item.id] || ''}
          busy={busy}
          onToggle={id => setExpanded(prev => prev === id ? null : id)}
          onNoteChange={(id, val) => setNotes(prev => ({ ...prev, [id]: val }))}
          onDecide={handleDecide}
        />
      ))}
    </div>
  );
}
