'use client';
import { useState, useEffect, useCallback } from 'react';
import { request } from '@/lib/api';

interface AgendaItem {
  id: string;
  from_agent: string;
  agent_name: string;
  subject: string;
  message: string;
  action_type: 'approval' | 'decision' | 'info' | 'urgent';
  status: 'pending' | 'approved' | 'rejected' | 'dismissed';
  decision_note: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  decided_at: string | null;
}

const AGENT_COLORS: Record<string, string> = {
  it:           '#2563EB',
  sales:        '#059669',
  marketing:    '#7c5cfc',
  finance:      '#d97706',
  product:      '#db2777',
  meeting_room: '#0891b2',
  reea:         '#1e293b',
};

const ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  approval: { label: 'موافقة مطلوبة', color: '#dc2626', bg: '#fef2f2' },
  decision: { label: 'قرار مطلوب',    color: '#d97706', bg: '#fffbeb' },
  urgent:   { label: 'عاجل',          color: '#dc2626', bg: '#fef2f2' },
  info:     { label: 'للعلم',         color: '#6b7280', bg: '#f9fafb' },
};

function timeAgo(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (diff < 60)   return `منذ ${diff} دقيقة`;
  if (diff < 1440) return `منذ ${Math.floor(diff / 60)} ساعة`;
  return `منذ ${Math.floor(diff / 1440)} يوم`;
}

// ── ItemCard is a top-level component so it never remounts when parent state changes ──
interface CardProps {
  item: AgendaItem;
  isExpanded: boolean;
  note: string;
  busy: string | null;
  onToggle: (id: string) => void;
  onNoteChange: (id: string, val: string) => void;
  onDecide: (id: string, action: 'approve' | 'reject' | 'dismiss') => void;
}

function ItemCard({ item, isExpanded, note, busy, onToggle, onNoteChange, onDecide }: CardProps) {
  const isPending  = item.status === 'pending';
  const actionMeta = ACTION_LABELS[item.action_type] || ACTION_LABELS.decision;
  const color      = AGENT_COLORS[item.from_agent] || '#6b7280';

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: isPending ? '1px solid rgba(220,38,38,.2)' : '1px solid rgba(0,0,0,.06)',
      overflow: 'hidden', marginBottom: 10,
      boxShadow: isPending ? '0 2px 8px rgba(220,38,38,.06)' : '0 1px 3px rgba(0,0,0,.04)',
    }}>

      {/* ── Header row (clickable) ── */}
      <div
        onClick={() => onToggle(item.id)}
        style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
      >
        {/* Avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#fff',
        }}>
          {item.agent_name.slice(0, 2)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{item.agent_name}</span>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: actionMeta.bg, color: actionMeta.color, fontWeight: 600 }}>
              {actionMeta.label}
            </span>
            {!isPending && (
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 600,
                background: item.status === 'approved' ? '#dcfce7' : item.status === 'rejected' ? '#fee2e2' : '#f3f4f6',
                color:      item.status === 'approved' ? '#166534' : item.status === 'rejected' ? '#dc2626' : '#6b7280',
              }}>
                {item.status === 'approved' ? '✓ موافقة' : item.status === 'rejected' ? '✗ رفض' : 'مُغلق'}
              </span>
            )}
            <span style={{ fontSize: 10, color: '#9ca3af', marginRight: 'auto' }}>{timeAgo(item.created_at)}</span>
          </div>
          <p style={{ fontSize: 13, fontWeight: isPending ? 600 : 400, color: '#1e293b', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.subject}
          </p>
          {!isExpanded && (
            <p style={{ fontSize: 11, color: '#6b7280', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.message.slice(0, 90)}{item.message.length > 90 ? '…' : ''}
            </p>
          )}
        </div>
        <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0, marginTop: 2 }}>{isExpanded ? '▲' : '▼'}</span>
      </div>

      {/* ── Expanded body ── */}
      {isExpanded && (
        <div
          style={{ padding: '14px 18px 16px', borderTop: '1px solid rgba(0,0,0,.05)' }}
          onClick={e => e.stopPropagation()}
        >
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: '0 0 16px' }}>
            {item.message}
          </p>

          {item.decision_note && (
            <div style={{ background: '#f8faff', borderRadius: 8, padding: '10px 14px', marginBottom: 14, border: '1px solid rgba(37,99,235,.1)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', margin: '0 0 4px' }}>ملاحظتك:</p>
              <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>{item.decision_note}</p>
            </div>
          )}

          {isPending && (
            <>
              <textarea
                value={note}
                onChange={e => onNoteChange(item.id, e.target.value)}
                onClick={e => e.stopPropagation()}
                onFocus={e => e.stopPropagation()}
                placeholder="ملاحظة اختيارية — تُرسل للوكيل مع القرار..."
                rows={3}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  border: '1px solid rgba(0,0,0,.1)', fontSize: 13, lineHeight: 1.6,
                  resize: 'vertical', boxSizing: 'border-box', direction: 'rtl',
                  marginBottom: 12, background: '#fff', outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={e => { e.stopPropagation(); onDecide(item.id, 'approve'); }}
                  disabled={busy === item.id + 'approve'}
                  style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: busy ? .6 : 1 }}
                >
                  {busy === item.id + 'approve' ? '...' : '✓ موافقة'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDecide(item.id, 'reject'); }}
                  disabled={busy === item.id + 'reject'}
                  style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: busy ? .6 : 1 }}
                >
                  {busy === item.id + 'reject' ? '...' : '✗ رفض'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDecide(item.id, 'dismiss'); }}
                  disabled={!!busy}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(0,0,0,.08)', background: '#fff', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}
                >
                  تجاهل
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AgendaPage() {
  const [items, setItems]         = useState<AgendaItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<'pending' | 'all'>('pending');
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [busy, setBusy]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === 'pending' ? '?status=pending' : '';
      const res = await request<any>('GET', `/admin/agenda${params}`);
      setItems(res?.data || []);
    } catch {}
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function handleToggle(id: string) {
    setExpanded(prev => prev === id ? null : id);
  }

  function handleNoteChange(id: string, val: string) {
    setNoteInputs(prev => ({ ...prev, [id]: val }));
  }

  async function handleDecide(id: string, action: 'approve' | 'reject' | 'dismiss') {
    setBusy(id + action);
    try {
      await request('POST', `/admin/agenda/${id}/${action}`, { note: noteInputs[id] || undefined });
      setItems(prev => prev.map(i => i.id === id ? {
        ...i,
        status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'dismissed',
        decision_note: noteInputs[id] || null,
      } : i));
      setExpanded(null);
    } catch {}
    setBusy(null);
  }

  const pending = items.filter(i => i.status === 'pending');
  const decided = items.filter(i => i.status !== 'pending');

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px', direction: 'rtl' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>الأجندة</h1>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>التصعيدات والقرارات المطلوبة منك من الوكلاء</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {pending.length > 0 && (
            <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', fontWeight: 700, border: '1px solid rgba(220,38,38,.2)' }}>
              {pending.length} بانتظار قرارك
            </span>
          )}
          <button
            onClick={() => setFilter(f => f === 'pending' ? 'all' : 'pending')}
            style={{ fontSize: 11, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(0,0,0,.08)', background: '#fff', color: '#6b7280', cursor: 'pointer' }}
          >
            {filter === 'pending' ? 'عرض الكل' : 'المعلقة فقط'}
          </button>
          <button
            onClick={load}
            style={{ fontSize: 11, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(0,0,0,.08)', background: '#fff', color: '#6b7280', cursor: 'pointer' }}
          >
            تحديث
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 13 }}>جاري التحميل...</div>
      )}

      {!loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>لا توجد بنود معلقة — كل شيء تم البت فيه</p>
        </div>
      )}

      {!loading && pending.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 10, letterSpacing: 1 }}>
            بانتظار قرارك ({pending.length})
          </p>
          {pending.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              isExpanded={expanded === item.id}
              note={noteInputs[item.id] || ''}
              busy={busy}
              onToggle={handleToggle}
              onNoteChange={handleNoteChange}
              onDecide={handleDecide}
            />
          ))}
        </>
      )}

      {!loading && filter === 'all' && decided.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 10, marginTop: 24, letterSpacing: 1 }}>
            تم البت فيها ({decided.length})
          </p>
          {decided.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              isExpanded={expanded === item.id}
              note={noteInputs[item.id] || ''}
              busy={busy}
              onToggle={handleToggle}
              onNoteChange={handleNoteChange}
              onDecide={handleDecide}
            />
          ))}
        </>
      )}
    </div>
  );
}
