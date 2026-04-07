'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '../../../lib/api';

type DemoLead = {
  id: string;
  name: string | null;
  phone: string;
  company_name: string | null;
  demo_session_id: string | null;
  ip_address: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: 'جديد',         color: '#3b82f6', bg: '#eff6ff' },
  contacted: { label: 'تم التواصل',   color: '#f59e0b', bg: '#fffbeb' },
  converted: { label: 'تحوّل عميل',   color: '#10b981', bg: '#ecfdf5' },
  ignored:   { label: 'تجاهل',        color: '#6b7280', bg: '#f3f4f6' },
};

const ALL_STATUSES = ['new', 'contacted', 'converted', 'ignored'];

export default function DemoLeadsPage() {
  const [items, setItems]             = useState<DemoLead[]>([]);
  const [total, setTotal]             = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState('');
  const [updating, setUpdating]       = useState<string | null>(null);
  const [notesModal, setNotesModal]   = useState<DemoLead | null>(null);
  const [notesText, setNotesText]     = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [error, setError]             = useState('');

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filter) params.status = filter;
      const res = await adminApi.sa.listDemoLeads(params);
      setItems(res.data?.items || []);
      setTotal(res.data?.total || 0);
      setStatusCounts(res.data?.statusCounts || {});
    } catch (e: any) {
      if (e.message?.includes('session_expired') || e.message?.includes('منتهي') || e.message?.includes('غير صالح')) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.href = '/login';
        return;
      }
      setError(e.message || 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60 s
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function changeStatus(id: string, status: string) {
    setUpdating(id);
    try {
      await adminApi.sa.updateDemoLead(id, { status });
      setItems(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      setStatusCounts(prev => {
        const old = items.find(r => r.id === id)?.status || '';
        const next = { ...prev };
        if (old && next[old] !== undefined) next[old]--;
        if (next[status] !== undefined) next[status]++;
        return next;
      });
    } catch { /* ignore */ }
    finally { setUpdating(null); }
  }

  async function saveNotes() {
    if (!notesModal) return;
    setSavingNotes(true);
    try {
      await adminApi.sa.updateDemoLead(notesModal.id, { notes: notesText });
      setItems(prev => prev.map(r => r.id === notesModal.id ? { ...r, notes: notesText } : r));
      setNotesModal(null);
    } catch { /* ignore */ }
    finally { setSavingNotes(false); }
  }

  function openNotes(item: DemoLead) {
    setNotesModal(item);
    setNotesText(item.notes || '');
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('ar-SA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  if (!token) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  const displayedItems = filter ? items.filter(r => r.status === filter) : items;

  return (
    <div className="fade-in" style={{ color: '#1a1a2e', fontFamily: "'Tajawal', sans-serif" }}>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 24px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: '#1a1a2e', letterSpacing: '-0.02em' }}>قيادات الديمو المباشر</h1>
          <p style={{ color: '#9ca3af', fontSize: 13 }}>
            زوار استخدموا التجربة المجانية المباشرة — إجمالي {total} قيادة
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, padding: '12px 18px', marginBottom: 20, color: '#ef4444', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* STATS STRIP */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'إجمالي',      value: total,                       color: '#1a1a2e' },
            { label: 'جديد',        value: statusCounts.new || 0,       color: '#3b82f6' },
            { label: 'تم التواصل', value: statusCounts.contacted || 0,  color: '#f59e0b' },
            { label: 'تحوّل عميل', value: statusCounts.converted || 0,  color: '#10b981' },
          ].map(k => (
            <div key={k.label} className="card" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.06)', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 500 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* STATUS FILTER TABS */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(0,0,0,.06)' }}>
          {[
            { key: '', label: 'الكل', count: total },
            ...ALL_STATUSES.map(s => ({ key: s, label: STATUS_CONFIG[s].label, count: statusCounts[s] || 0 })),
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: filter === tab.key ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
                background: 'none',
                color: filter === tab.key ? '#1a1a2e' : '#9ca3af',
                border: 'none',
                borderBottom: filter === tab.key ? '2px solid #7c5cfc' : '2px solid transparent',
              }}>
              {tab.label} {tab.count > 0 && <span style={{ color: '#6b7280', marginRight: 4 }}>({tab.count})</span>}
            </button>
          ))}
          <button onClick={load}
            style={{ marginRight: 'auto', padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: '1px solid rgba(0,0,0,.08)', color: '#6b7280' }}>
            تحديث
          </button>
        </div>

        {/* TABLE */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af', fontSize: 13 }}>جاري التحميل...</div>
        ) : displayedItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af', fontSize: 13 }}>
            <p>لا توجد قيادات {filter ? `بحالة "${STATUS_CONFIG[filter]?.label}"` : 'بعد'}</p>
          </div>
        ) : (
          <div style={{ borderRadius: 14, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 140px 160px 130px 120px 90px', gap: 0, background: '#f8f7fc', borderBottom: '1px solid rgba(0,0,0,.06)', padding: '10px 20px' }}>
              {['التاريخ', 'الزائر', 'الجوال', 'الشركة', 'الحالة', 'ملاحظات', 'إجراء'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {displayedItems.map((item, i) => {
              const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;
              return (
                <div key={item.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '150px 1fr 140px 160px 130px 120px 90px',
                    gap: 0, padding: '14px 20px', alignItems: 'center',
                    borderBottom: i < displayedItems.length - 1 ? '1px solid rgba(0,0,0,.04)' : 'none',
                    background: i % 2 === 0 ? '#fff' : '#fafafa',
                  }}
                >
                  {/* Date */}
                  <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{fmt(item.created_at)}</div>

                  {/* Name */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a2e' }}>{item.name || '—'}</div>
                    {item.demo_session_id && (
                      <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'Inter, monospace', marginTop: 2, fontWeight: 500 }}>
                        {item.demo_session_id.slice(0, 8)}...
                      </div>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <a href={`tel:${item.phone}`} style={{ fontSize: 13, color: '#1a1a2e', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
                      {item.phone}
                    </a>
                    <div style={{ marginTop: 4 }}>
                      <a href={`https://wa.me/${item.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                        style={{ fontSize: 11, color: '#22c55e', textDecoration: 'none', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 7, padding: '2px 8px', fontWeight: 500 }}>
                        واتساب
                      </a>
                    </div>
                  </div>

                  {/* Company */}
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>{item.company_name || '—'}</div>

                  {/* Status pill */}
                  <div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: sc.color, background: sc.bg, padding: '2px 10px', borderRadius: 20 }}>
                      {sc.label}
                    </span>
                  </div>

                  {/* Notes */}
                  <div>
                    <button onClick={() => openNotes(item)}
                      style={{
                        fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                        background: 'transparent',
                        border: '1px solid rgba(0,0,0,.08)',
                        color: item.notes ? '#1a1a2e' : '#6b7280',
                        borderRadius: 10, padding: '4px 12px',
                      }}>
                      {item.notes ? 'عرض' : '+ ملاحظة'}
                    </button>
                  </div>

                  {/* Status dropdown + Convert */}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <select
                      value={item.status}
                      disabled={updating === item.id}
                      onChange={e => changeStatus(item.id, e.target.value)}
                      style={{
                        background: '#f8f7fc', border: '1px solid rgba(0,0,0,.08)', color: '#1a1a2e',
                        borderRadius: 10, padding: '5px 8px', fontSize: 12, cursor: 'pointer',
                        fontFamily: 'inherit', outline: 'none', flex: 1,
                        opacity: updating === item.id ? .5 : 1,
                      }}>
                      {ALL_STATUSES.map(s => (
                        <option key={s} value={s} style={{ background: '#fff', color: '#1a1a2e' }}>{STATUS_CONFIG[s].label}</option>
                      ))}
                    </select>
                    {item.status !== 'converted' && (
                      <button
                        onClick={async () => {
                          if (!confirm(`تحويل "${item.name || item.phone}" إلى عميل؟`)) return;
                          try {
                            await adminApi.sa.convertLead(item.id, { plan: 'trial', send_welcome: true });
                            setItems(prev => prev.map(r => r.id === item.id ? { ...r, status: 'converted' } : r));
                          } catch (e: any) { alert(e.message || 'فشل التحويل'); }
                        }}
                        style={{
                          fontSize: 12, padding: '7px 16px', borderRadius: 10,
                          background: '#7c5cfc', border: 'none',
                          color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                          whiteSpace: 'nowrap', fontWeight: 500,
                          boxShadow: '0 2px 8px rgba(124,92,252,.2)',
                        }}
                      >
                        تحويل
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NOTES MODAL */}
      {notesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}
          onClick={e => { if (e.target === e.currentTarget) setNotesModal(null); }}>
          <div style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.12)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#1a1a2e' }}>ملاحظات</h3>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>
              {notesModal.name || '—'} — {notesModal.phone}
            </p>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              rows={5}
              placeholder="أضف ملاحظات حول هذا الزائر..."
              style={{
                width: '100%', background: '#f8f7fc', border: '1px solid rgba(0,0,0,.08)',
                borderRadius: 10, padding: '7px 12px', color: '#1a1a2e', fontSize: 13,
                fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexDirection: 'row' }}>
              <button onClick={saveNotes} disabled={savingNotes}
                style={{ flex: 1, padding: '7px 16px', background: '#7c5cfc', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: savingNotes ? .7 : 1, boxShadow: '0 2px 8px rgba(124,92,252,.2)' }}>
                {savingNotes ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => setNotesModal(null)}
                style={{ padding: '7px 16px', background: 'transparent', color: '#6b7280', border: '1px solid rgba(0,0,0,.08)', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
