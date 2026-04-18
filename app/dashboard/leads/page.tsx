'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: 'جديد',         color: '#3b82f6', bg: '#eff6ff' },
  contacted:   { label: 'تم التواصل',   color: '#f59e0b', bg: '#fffbeb' },
  demo_done:   { label: 'تم العرض',     color: '#60A5FA', bg: '#f5f3ff' },
  converted:   { label: 'تحوّل عميل',   color: '#10b981', bg: '#ecfdf5' },
  lost:        { label: 'خسارة',        color: '#ef4444', bg: '#fef2f2' },
};

const ALL_STATUSES = ['new', 'contacted', 'demo_done', 'converted', 'lost'];

export default function LeadsPage() {
  const router = useRouter();
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

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); }
  }, [router]);

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

  const filteredCount: Record<string, number> = {};
  ALL_STATUSES.forEach(s => { filteredCount[s] = items.filter(r => r.status === s).length; });

  return (
    <div className="fade-in" style={{ color: 'var(--lv-fg)', fontFamily: "'Tajawal', sans-serif" }}>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 24px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: 'var(--lv-fg)', letterSpacing: '-0.02em' }}>طلبات حجز العرض</h1>
          <p style={{ color: 'var(--lv-muted)', fontSize: 13 }}>العملاء المحتملون الذين تقدموا من الموقع — إجمالي {total} طلب</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, padding: '12px 18px', marginBottom: 20, color: '#ef4444', fontSize: 13 }}>{error}</div>
        )}

        {/* STATS STRIP */}
        {stats && (
          <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 24 }}>
            {[
              { label: 'إجمالي الطلبات',   value: stats.total,                         color: 'var(--lv-fg)' },
              { label: 'جديد',              value: stats.statusCounts?.new || 0,        color: '#3b82f6' },
              { label: 'تم التواصل',        value: stats.statusCounts?.contacted || 0,  color: '#f59e0b' },
              { label: 'تحوّل عميل',        value: stats.statusCounts?.converted || 0,  color: '#10b981' },
              { label: 'معدل التحويل',      value: `${stats.conversionRate || 0}%`,     color: '#60A5FA' },
            ].map(k => (
              <div key={k.label} className="card card-lift" style={{ background: 'var(--lv-panel)', border: '1px solid var(--lv-line)', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--lv-shadow-sm)' }}>
                <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginBottom: 6, fontWeight: 500 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* STATUS FILTER TABS */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--lv-line)' }}>
          {[{ key: '', label: 'الكل', count: items.length }, ...ALL_STATUSES.map(s => ({ key: s, label: STATUS_CONFIG[s].label, count: filteredCount[s] }))].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: filter === tab.key ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
                background: 'none',
                color: filter === tab.key ? 'var(--lv-fg)' : 'var(--lv-muted)',
                border: 'none',
                borderBottom: filter === tab.key ? '2px solid var(--lv-accent)' : '2px solid transparent',
              }}
            >
              {tab.label} {tab.count > 0 && <span style={{ color: 'var(--lv-muted)', marginRight: 4 }}>({tab.count})</span>}
            </button>
          ))}
          <button onClick={load} style={{ marginRight: 'auto', padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: '1px solid var(--lv-line)', color: 'var(--lv-muted)' }}>
            تحديث
          </button>
        </div>

        {/* TABLE */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--lv-muted)', fontSize: 13 }}>جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--lv-muted)', fontSize: 13 }}>
            <p>لا توجد طلبات {filter ? `بحالة "${STATUS_CONFIG[filter]?.label}"` : 'بعد'}</p>
          </div>
        ) : (
          <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--lv-panel)', boxShadow: 'var(--lv-shadow-sm)' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 160px 130px 70px 100px 220px', gap: 0, background: 'var(--lv-bg)', borderBottom: '1px solid var(--lv-line)', padding: '10px 20px' }}>
              {['التاريخ', 'العميل', 'البريد', 'الجوال', 'الوحدات', 'الحالة', 'الإجراءات'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 500, color: 'var(--lv-muted)' }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {items.map((item, i) => {
              const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;
              return (
                <div key={item.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '120px 1fr 160px 130px 70px 100px 220px',
                    gap: 0, padding: '14px 20px', alignItems: 'center',
                    borderBottom: i < items.length - 1 ? '1px solid var(--lv-line)' : 'none',
                    background: i % 2 === 0 ? 'var(--lv-panel)' : 'var(--lv-bg)',
                  }}
                >
                  {/* Date */}
                  <div style={{ fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500 }}>{fmt(item.created_at)}</div>

                  {/* Name */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--lv-fg)' }}>{item.name}</div>
                    {item.message && <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginTop: 2, fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.message}</div>}
                  </div>

                  {/* Email */}
                  <div>
                    {item.email ? (
                      <a href={`mailto:${item.email}`} style={{ fontSize: 12, color: 'var(--lv-accent)', textDecoration: 'none', direction: 'ltr', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</a>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500 }}>—</span>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <a href={`tel:${item.phone}`} style={{ fontSize: 12, color: 'var(--lv-fg)', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>{item.phone}</a>
                    <div style={{ marginTop: 4 }}>
                      <a href={`https://wa.me/${item.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                        style={{ fontSize: 11, color: '#22c55e', textDecoration: 'none', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 7, padding: '2px 8px', fontWeight: 500 }}>
                        واتساب
                      </a>
                    </div>
                  </div>

                  {/* Units */}
                  <div style={{ fontSize: 13, color: 'var(--lv-muted)' }}>{item.units_count || '—'}</div>

                  {/* Status pill */}
                  <div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: sc.color, background: sc.bg, padding: '2px 10px', borderRadius: 20 }}>
                      {sc.label}
                    </span>
                  </div>

                  {/* Actions: status select + notes + convert */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select
                      value={item.status}
                      disabled={updating === item.id}
                      onChange={e => changeStatus(item.id, e.target.value)}
                      style={{
                        background: 'var(--lv-bg)', border: '1px solid var(--lv-line)', color: 'var(--lv-fg)',
                        borderRadius: 8, padding: '5px 6px', fontSize: 11, cursor: 'pointer',
                        fontFamily: 'inherit', outline: 'none', flex: '0 0 90px',
                        opacity: updating === item.id ? .5 : 1,
                      }}
                    >
                      {ALL_STATUSES.map(s => (
                        <option key={s} value={s} style={{ background: 'var(--lv-panel)', color: 'var(--lv-fg)' }}>{STATUS_CONFIG[s].label}</option>
                      ))}
                    </select>
                    <button onClick={() => openNotes(item)}
                      style={{
                        fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                        background: item.notes ? 'var(--lv-bg)' : 'transparent',
                        border: '1px solid var(--lv-line)',
                        color: item.notes ? 'var(--lv-fg)' : 'var(--lv-muted)',
                        borderRadius: 8, padding: '5px 8px', whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                      {item.notes ? '📋' : '+ ملاحظة'}
                    </button>
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
                          fontSize: 11, padding: '5px 10px', borderRadius: 8,
                          background: 'var(--lv-accent)', border: 'none',
                          color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                          whiteSpace: 'nowrap', fontWeight: 600, flexShrink: 0,
                        }}
                      >
                        تحويل ✓
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
          <div style={{ background: 'var(--lv-panel)', boxShadow: 'var(--lv-shadow-panel)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--lv-fg)' }}>ملاحظات</h3>
            <p style={{ fontSize: 13, color: 'var(--lv-muted)', marginBottom: 20 }}>{notesModal.name} — {notesModal.phone}</p>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              rows={5}
              placeholder="أضف ملاحظات حول هذا العميل..."
              style={{
                width: '100%', background: 'var(--lv-bg)', border: '1px solid var(--lv-line)',
                borderRadius: 10, padding: '7px 12px', color: 'var(--lv-fg)', fontSize: 13,
                fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexDirection: 'row' }}>
              <button onClick={saveNotes} disabled={savingNotes}
                style={{ flex: 1, padding: '7px 16px', background: 'var(--lv-accent)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: savingNotes ? .7 : 1, boxShadow: '0 2px 8px rgba(124,92,252,.2)' }}>
                {savingNotes ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => setNotesModal(null)}
                style={{ padding: '7px 16px', background: 'transparent', color: 'var(--lv-muted)', border: '1px solid var(--lv-line)', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
