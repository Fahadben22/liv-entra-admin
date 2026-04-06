'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '../../../lib/api';

type DemoRequest = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  units_count: string | null;
  message: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new:         { label: 'جديد',         color: '#3b82f6' },
  contacted:   { label: 'تم التواصل',   color: '#f59e0b' },
  demo_done:   { label: 'تم العرض',     color: '#a78bfa' },
  converted:   { label: 'تحوّل عميل',   color: '#22c55e' },
  lost:        { label: 'خسارة',        color: '#ef4444' },
};

const ALL_STATUSES = ['new', 'contacted', 'demo_done', 'converted', 'lost'];

export default function LeadsPage() {
  const [items, setItems]           = useState<DemoRequest[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('');
  const [updating, setUpdating]     = useState<string | null>(null);
  const [notesModal, setNotesModal] = useState<DemoRequest | null>(null);
  const [notesText, setNotesText]   = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [error, setError]           = useState('');
  const [stats, setStats]           = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [listRes, statsRes] = await Promise.allSettled([
        adminApi.sa.listDemoRequests(filter || undefined),
        adminApi.sa.getDemoRequestStats(),
      ]);
      if (listRes.status === 'fulfilled') {
        setItems(listRes.value.data?.items || []);
        setTotal(listRes.value.data?.total || 0);
      }
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
    } catch (e: any) {
      setError(e.message || 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function changeStatus(id: string, status: string) {
    setUpdating(id);
    try {
      await adminApi.sa.updateDemoRequest(id, { status });
      setItems(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch { /* ignore */ }
    finally { setUpdating(null); }
  }

  async function saveNotes() {
    if (!notesModal) return;
    setSavingNotes(true);
    try {
      await adminApi.sa.updateDemoRequest(notesModal.id, { notes: notesText });
      setItems(prev => prev.map(r => r.id === notesModal.id ? { ...r, notes: notesText } : r));
      setNotesModal(null);
    } catch { /* ignore */ }
    finally { setSavingNotes(false); }
  }

  function openNotes(item: DemoRequest) {
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

  const filteredCount: Record<string, number> = {};
  ALL_STATUSES.forEach(s => { filteredCount[s] = items.filter(r => r.status === s).length; });

  return (
    <div className="fade-in" style={{ color: '#fafafa', fontFamily: "'Tajawal', sans-serif" }}>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 24px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: '#fafafa', letterSpacing: '-0.02em' }}>طلبات حجز العرض</h1>
          <p style={{ color: '#a1a1aa', fontSize: 13 }}>العملاء المحتملون الذين تقدموا من الموقع — إجمالي {total} طلب</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, padding: '12px 18px', marginBottom: 20, color: '#ef4444', fontSize: 13 }}>{error}</div>
        )}

        {/* STATS STRIP */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 24 }}>
            {[
              { label: 'إجمالي الطلبات',   value: stats.total,                         color: '#fafafa' },
              { label: 'جديد',              value: stats.statusCounts?.new || 0,        color: '#3b82f6' },
              { label: 'تم التواصل',        value: stats.statusCounts?.contacted || 0,  color: '#f59e0b' },
              { label: 'تحوّل عميل',        value: stats.statusCounts?.converted || 0,  color: '#22c55e' },
              { label: 'معدل التحويل',      value: `${stats.conversionRate || 0}%`,     color: '#a78bfa' },
            ].map(k => (
              <div key={k.label} className="glass" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 6, fontWeight: 500 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* STATUS FILTER TABS */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          {[{ key: '', label: 'الكل', count: items.length }, ...ALL_STATUSES.map(s => ({ key: s, label: STATUS_CONFIG[s].label, count: filteredCount[s] }))].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: filter === tab.key ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
                background: 'none',
                color: filter === tab.key ? '#fafafa' : '#52525b',
                border: 'none',
                borderBottom: filter === tab.key ? '2px solid #6366f1' : '2px solid transparent',
              }}
            >
              {tab.label} {tab.count > 0 && <span style={{ color: '#52525b', marginRight: 4 }}>({tab.count})</span>}
            </button>
          ))}
          <button onClick={load} style={{ marginRight: 'auto', padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', color: '#a1a1aa' }}>
            تحديث
          </button>
        </div>

        {/* TABLE */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#a1a1aa', fontSize: 13 }}>جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#a1a1aa', fontSize: 13 }}>
            <p>لا توجد طلبات {filter ? `بحالة "${STATUS_CONFIG[filter]?.label}"` : 'بعد'}</p>
          </div>
        ) : (
          <div style={{ borderRadius: 10, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 180px 130px 80px 110px 140px 80px', gap: 0, background: 'rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '10px 20px' }}>
              {['التاريخ', 'العميل', 'البريد', 'الجوال', 'الوحدات', 'الحالة', 'ملاحظات', 'إجراء'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 500, color: '#52525b' }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {items.map((item, i) => {
              const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;
              return (
                <div key={item.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '130px 1fr 180px 130px 80px 110px 140px 80px',
                    gap: 0, padding: '14px 20px', alignItems: 'center',
                    borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,.03)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)',
                  }}
                >
                  {/* Date */}
                  <div style={{ fontSize: 11, color: '#52525b', fontWeight: 500 }}>{fmt(item.created_at)}</div>

                  {/* Name */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#fafafa' }}>{item.name}</div>
                    {item.message && <div style={{ fontSize: 11, color: '#52525b', marginTop: 2, fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.message}</div>}
                  </div>

                  {/* Email */}
                  <div>
                    {item.email ? (
                      <a href={`mailto:${item.email}`} style={{ fontSize: 13, color: '#6366f1', textDecoration: 'none', direction: 'ltr', display: 'block' }}>{item.email}</a>
                    ) : (
                      <span style={{ fontSize: 11, color: '#52525b', fontWeight: 500 }}>—</span>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <a href={`tel:${item.phone}`} style={{ fontSize: 13, color: '#fafafa', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>{item.phone}</a>
                    <div style={{ marginTop: 4 }}>
                      <a href={`https://wa.me/${item.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                        style={{ fontSize: 11, color: '#22c55e', textDecoration: 'none', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 7, padding: '2px 8px', fontWeight: 500 }}>
                        واتساب
                      </a>
                    </div>
                  </div>

                  {/* Units */}
                  <div style={{ fontSize: 13, color: '#a1a1aa' }}>{item.units_count || '—'}</div>

                  {/* Status dot + label */}
                  <div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: sc.color }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, display: 'inline-block', boxShadow: `0 0 6px ${sc.color}66` }} />
                      {sc.label}
                    </span>
                  </div>

                  {/* Notes */}
                  <div>
                    <button onClick={() => openNotes(item)}
                      style={{
                        fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                        background: 'rgba(255,255,255,.04)',
                        border: '1px solid rgba(255,255,255,.08)',
                        color: item.notes ? '#fafafa' : '#52525b',
                        borderRadius: 7, padding: '4px 12px',
                      }}>
                      {item.notes ? 'عرض الملاحظات' : '+ ملاحظة'}
                    </button>
                  </div>

                  {/* Status update dropdown */}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <select
                      value={item.status}
                      disabled={updating === item.id}
                      onChange={e => changeStatus(item.id, e.target.value)}
                      style={{
                        background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', color: '#fafafa',
                        borderRadius: 7, padding: '5px 8px', fontSize: 12, cursor: 'pointer',
                        fontFamily: 'inherit', outline: 'none', flex: 1,
                        opacity: updating === item.id ? .5 : 1,
                      }}
                    >
                      {ALL_STATUSES.map(s => (
                        <option key={s} value={s} style={{ background: '#18181b', color: '#fafafa' }}>{STATUS_CONFIG[s].label}</option>
                      ))}
                    </select>
                    {item.status !== 'converted' && (
                      <button
                        onClick={async () => {
                          if (!confirm(`تحويل "${item.name}" إلى عميل؟`)) return;
                          try {
                            await adminApi.sa.convertLead(item.id, { plan: 'trial', send_welcome: true });
                            setItems(prev => prev.map(r => r.id === item.id ? { ...r, status: 'converted' } : r));
                          } catch (e: any) { alert(e.message || 'فشل التحويل'); }
                        }}
                        style={{
                          fontSize: 12, padding: '7px 16px', borderRadius: 7,
                          background: '#6366f1', border: 'none',
                          color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                          whiteSpace: 'nowrap', fontWeight: 500,
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}
          onClick={e => { if (e.target === e.currentTarget) setNotesModal(null); }}>
          <div style={{ background: '#18181b', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#fafafa' }}>ملاحظات</h3>
            <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 20 }}>{notesModal.name} — {notesModal.phone}</p>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              rows={5}
              placeholder="أضف ملاحظات حول هذا العميل..."
              style={{
                width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 8, padding: '7px 12px', color: '#fafafa', fontSize: 13,
                fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexDirection: 'row' }}>
              <button onClick={saveNotes} disabled={savingNotes}
                style={{ flex: 1, padding: '7px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: savingNotes ? .7 : 1 }}>
                {savingNotes ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => setNotesModal(null)}
                style={{ padding: '7px 16px', background: 'rgba(255,255,255,.04)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
