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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: 'جديد',         color: '#3b82f6', bg: 'rgba(59,130,246,.12)' },
  contacted:   { label: 'تم التواصل',   color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  demo_done:   { label: 'تم العرض',     color: '#8b5cf6', bg: 'rgba(139,92,246,.12)' },
  converted:   { label: 'تحوّل عميل',   color: '#22c55e', bg: 'rgba(34,197,94,.12)'  },
  lost:        { label: 'خسارة',        color: '#ef4444', bg: 'rgba(239,68,68,.12)'  },
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

  const C = {
    bg: '#05081a', card: '#0c1535', border: 'rgba(255,255,255,.07)',
    text: '#e2e8f0', text2: '#94a3b8', accent: '#2563eb', accent2: '#0ea5e9',
  };

  const filteredCount: Record<string, number> = {};
  ALL_STATUSES.forEach(s => { filteredCount[s] = items.filter(r => r.status === s).length; });

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Tajawal', sans-serif", direction: 'rtl' }}>

      {/* NAV */}
      <nav style={{ background: 'rgba(5,8,26,.95)', borderBottom: `1px solid ${C.border}`, padding: '12px 24px', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20, flexDirection: 'row' }}>
          <Link href="/dashboard" style={{ fontWeight: 800, fontSize: 15, letterSpacing: 1.5, color: '#fff', fontFamily: 'Inter, sans-serif', textDecoration: 'none' }}>LIVENTRA OS</Link>
          <div style={{ display: 'flex', gap: 20, marginRight: 'auto', flexDirection: 'row' }}>
            {[
              { href: '/dashboard/companies',       label: 'الشركات' },
              { href: '/dashboard/billing',         label: 'الفواتير' },
              { href: '/dashboard/audit',           label: 'التدقيق' },
              { href: '/dashboard/features',        label: 'الميزات' },
              { href: '/dashboard/intelligence',    label: '🧠 الذكاء' },
              { href: '/dashboard/security-center', label: '🛡️ الأمان' },
              { href: '/dashboard/template-center', label: '📨 القوالب' },
              { href: '/dashboard/landing-page',    label: '🌐 الموقع' },
              { href: '/dashboard/leads',           label: '📋 طلبات العرض' },
              { href: '/dashboard/demo-leads',      label: '⚡ قيادات الديمو' },
            ].map(n => (
              <Link key={n.href} href={n.href} style={{ fontSize: 13, color: n.href === '/dashboard/leads' ? '#fff' : C.text2, fontWeight: n.href === '/dashboard/leads' ? 700 : 400, textDecoration: 'none' }}>{n.label}</Link>
            ))}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '40px 24px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>طلبات حجز العرض</h1>
          <p style={{ color: C.text2, fontSize: 14 }}>العملاء المحتملون الذين تقدموا من الموقع — إجمالي {total} طلب</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, padding: '14px 20px', marginBottom: 24, color: '#fca5a5', fontSize: 14 }}>{error}</div>
        )}

        {/* STATS STRIP */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'إجمالي الطلبات',   value: stats.total,                         color: C.accent,  icon: '📋' },
              { label: 'جديد',              value: stats.statusCounts?.new || 0,        color: '#3b82f6', icon: '🆕' },
              { label: 'تم التواصل',        value: stats.statusCounts?.contacted || 0,  color: '#f59e0b', icon: '📞' },
              { label: 'تحوّل عميل',        value: stats.statusCounts?.converted || 0,  color: '#22c55e', icon: '🎉' },
              { label: 'معدل التحويل',      value: `${stats.conversionRate || 0}%`,     color: '#a78bfa', icon: '📈' },
            ].map(k => (
              <div key={k.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: C.text2 }}>{k.label}</span>
                  <span style={{ fontSize: 16 }}>{k.icon}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* STATUS FILTER TABS */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexDirection: 'row', flexWrap: 'wrap' }}>
          {[{ key: '', label: 'الكل', count: items.length }, ...ALL_STATUSES.map(s => ({ key: s, label: STATUS_CONFIG[s].label, count: filteredCount[s] }))].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              style={{
                padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
                background: filter === tab.key ? C.accent : 'rgba(255,255,255,.05)',
                color: filter === tab.key ? '#fff' : C.text2,
                border: filter === tab.key ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
              }}
            >
              {tab.label} {tab.count > 0 && <span style={{ opacity: .7, marginRight: 4 }}>({tab.count})</span>}
            </button>
          ))}
          <button onClick={load} style={{ marginRight: 'auto', padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(255,255,255,.05)', border: `1px solid ${C.border}`, color: C.text2 }}>
            تحديث ↻
          </button>
        </div>

        {/* TABLE */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.text2 }}>جاري التحميل…</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.text2 }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: .3 }}>📋</div>
            <p>لا توجد طلبات {filter ? `بحالة "${STATUS_CONFIG[filter]?.label}"` : 'بعد'}</p>
          </div>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 130px 120px 130px 160px 80px', gap: 0, background: 'rgba(255,255,255,.03)', borderBottom: `1px solid ${C.border}`, padding: '12px 20px' }}>
              {['التاريخ', 'العميل', 'الجوال', 'الوحدات', 'الحالة', 'ملاحظات', 'إجراء'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: 1, textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {items.map((item, i) => {
              const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;
              return (
                <div key={item.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '160px 1fr 130px 120px 130px 160px 80px',
                    gap: 0, padding: '16px 20px', alignItems: 'center',
                    borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Date */}
                  <div style={{ fontSize: 12, color: C.text2 }}>{fmt(item.created_at)}</div>

                  {/* Name + email */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</div>
                    {item.email && <div style={{ fontSize: 12, color: C.text2 }}>{item.email}</div>}
                    {item.message && <div style={{ fontSize: 11, color: C.text2, marginTop: 2, opacity: .7, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.message}</div>}
                  </div>

                  {/* Phone */}
                  <div>
                    <a href={`tel:${item.phone}`} style={{ fontSize: 13, color: C.accent2, textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>{item.phone}</a>
                    <div style={{ marginTop: 4 }}>
                      <a href={`https://wa.me/${item.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                        style={{ fontSize: 11, color: '#22c55e', textDecoration: 'none', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 6, padding: '2px 8px' }}>
                        واتساب
                      </a>
                    </div>
                  </div>

                  {/* Units */}
                  <div style={{ fontSize: 13, color: C.text2 }}>{item.units_count || '—'}</div>

                  {/* Status badge */}
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: sc.color, background: sc.bg, border: `1px solid ${sc.color}33`, borderRadius: 8, padding: '4px 10px' }}>
                      {sc.label}
                    </span>
                  </div>

                  {/* Notes */}
                  <div>
                    <button onClick={() => openNotes(item)}
                      style={{
                        fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                        background: item.notes ? 'rgba(245,158,11,.1)' : 'rgba(255,255,255,.05)',
                        border: item.notes ? '1px solid rgba(245,158,11,.3)' : `1px solid ${C.border}`,
                        color: item.notes ? '#f59e0b' : C.text2,
                        borderRadius: 8, padding: '4px 12px',
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
                        background: '#060e24', border: `1px solid ${C.border}`, color: C.text,
                        borderRadius: 8, padding: '5px 8px', fontSize: 12, cursor: 'pointer',
                        fontFamily: 'inherit', outline: 'none', flex: 1,
                        opacity: updating === item.id ? .5 : 1,
                      }}
                    >
                      {ALL_STATUSES.map(s => (
                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
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
                          fontSize: 10, padding: '5px 8px', borderRadius: 6,
                          background: 'rgba(5,150,105,.15)', border: '1px solid rgba(5,150,105,.3)',
                          color: '#059669', cursor: 'pointer', fontFamily: 'inherit',
                          whiteSpace: 'nowrap', fontWeight: 700,
                        }}
                      >
                        تحويل لعميل ←
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}
          onClick={e => { if (e.target === e.currentTarget) setNotesModal(null); }}>
          <div style={{ background: '#0c1535', border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: 32, width: '100%', maxWidth: 480 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>ملاحظات</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>{notesModal.name} — {notesModal.phone}</p>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              rows={5}
              placeholder="أضف ملاحظات حول هذا العميل…"
              style={{
                width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 10, padding: '12px 14px', color: '#e2e8f0', fontSize: 14,
                fontFamily: 'inherit', outline: 'none', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexDirection: 'row' }}>
              <button onClick={saveNotes} disabled={savingNotes}
                style={{ flex: 1, padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: savingNotes ? .7 : 1 }}>
                {savingNotes ? 'جاري الحفظ…' : 'حفظ'}
              </button>
              <button onClick={() => setNotesModal(null)}
                style={{ padding: '12px 20px', background: 'rgba(255,255,255,.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
