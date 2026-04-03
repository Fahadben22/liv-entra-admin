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
  new:       { label: 'جديد',         color: '#3b82f6', bg: 'rgba(59,130,246,.12)' },
  contacted: { label: 'تم التواصل',   color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  converted: { label: 'تحوّل عميل',   color: '#22c55e', bg: 'rgba(34,197,94,.12)'  },
  ignored:   { label: 'تجاهل',        color: '#94a3b8', bg: 'rgba(148,163,184,.12)' },
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

  const C = {
    bg: '#05081a', card: '#0c1535', border: 'rgba(255,255,255,.07)',
    text: '#e2e8f0', text2: '#94a3b8', accent: '#2563eb', accent2: '#0ea5e9',
  };

  const displayedItems = filter ? items.filter(r => r.status === filter) : items;

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
              <Link key={n.href} href={n.href}
                style={{
                  fontSize: 13,
                  color: n.href === '/dashboard/demo-leads' ? '#fff' : C.text2,
                  fontWeight: n.href === '/dashboard/demo-leads' ? 700 : 400,
                  textDecoration: 'none',
                }}>
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '40px 24px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>قيادات الديمو المباشر ⚡</h1>
          <p style={{ color: C.text2, fontSize: 14 }}>
            زوار استخدموا التجربة المجانية المباشرة — إجمالي {total} قيادة
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, padding: '14px 20px', marginBottom: 24, color: '#fca5a5', fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* STATS STRIP */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'إجمالي',      value: total,                       color: C.accent,  icon: '⚡' },
            { label: 'جديد',        value: statusCounts.new || 0,       color: '#3b82f6', icon: '🆕' },
            { label: 'تم التواصل', value: statusCounts.contacted || 0,  color: '#f59e0b', icon: '📞' },
            { label: 'تحوّل عميل', value: statusCounts.converted || 0,  color: '#22c55e', icon: '🎉' },
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

        {/* STATUS FILTER TABS */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexDirection: 'row', flexWrap: 'wrap' }}>
          {[
            { key: '', label: 'الكل', count: total },
            ...ALL_STATUSES.map(s => ({ key: s, label: STATUS_CONFIG[s].label, count: statusCounts[s] || 0 })),
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              style={{
                padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
                background: filter === tab.key ? C.accent : 'rgba(255,255,255,.05)',
                color: filter === tab.key ? '#fff' : C.text2,
                border: filter === tab.key ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
              }}>
              {tab.label} {tab.count > 0 && <span style={{ opacity: .7, marginRight: 4 }}>({tab.count})</span>}
            </button>
          ))}
          <button onClick={load}
            style={{ marginRight: 'auto', padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(255,255,255,.05)', border: `1px solid ${C.border}`, color: C.text2 }}>
            تحديث ↻
          </button>
        </div>

        {/* TABLE */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.text2 }}>جاري التحميل…</div>
        ) : displayedItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.text2 }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: .3 }}>⚡</div>
            <p>لا توجد قيادات {filter ? `بحالة "${STATUS_CONFIG[filter]?.label}"` : 'بعد'}</p>
          </div>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 140px 160px 130px 120px 90px', gap: 0, background: 'rgba(255,255,255,.03)', borderBottom: `1px solid ${C.border}`, padding: '12px 20px' }}>
              {['التاريخ', 'الزائر', 'الجوال', 'الشركة', 'الحالة', 'ملاحظات', 'إجراء'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: C.text2, letterSpacing: 1 }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {displayedItems.map((item, i) => {
              const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;
              return (
                <div key={item.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '150px 1fr 140px 160px 130px 120px 90px',
                    gap: 0, padding: '16px 20px', alignItems: 'center',
                    borderBottom: i < displayedItems.length - 1 ? `1px solid ${C.border}` : 'none',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Date */}
                  <div style={{ fontSize: 12, color: C.text2 }}>{fmt(item.created_at)}</div>

                  {/* Name */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{item.name || '—'}</div>
                    {item.demo_session_id && (
                      <div style={{ fontSize: 10, color: C.text2, fontFamily: 'Inter, monospace', marginTop: 2, opacity: .6 }}>
                        {item.demo_session_id.slice(0, 8)}…
                      </div>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <a href={`tel:${item.phone}`} style={{ fontSize: 13, color: C.accent2, textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
                      {item.phone}
                    </a>
                    <div style={{ marginTop: 4 }}>
                      <a href={`https://wa.me/${item.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                        style={{ fontSize: 11, color: '#22c55e', textDecoration: 'none', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 6, padding: '2px 8px' }}>
                        واتساب
                      </a>
                    </div>
                  </div>

                  {/* Company */}
                  <div style={{ fontSize: 13, color: C.text2 }}>{item.company_name || '—'}</div>

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
                      {item.notes ? 'عرض' : '+ ملاحظة'}
                    </button>
                  </div>

                  {/* Status dropdown */}
                  <div>
                    <select
                      value={item.status}
                      disabled={updating === item.id}
                      onChange={e => changeStatus(item.id, e.target.value)}
                      style={{
                        background: '#060e24', border: `1px solid ${C.border}`, color: C.text,
                        borderRadius: 8, padding: '5px 8px', fontSize: 12, cursor: 'pointer',
                        fontFamily: 'inherit', outline: 'none', width: '100%',
                        opacity: updating === item.id ? .5 : 1,
                      }}>
                      {ALL_STATUSES.map(s => (
                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                      ))}
                    </select>
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
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
              {notesModal.name || '—'} — {notesModal.phone}
            </p>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              rows={5}
              placeholder="أضف ملاحظات حول هذا الزائر…"
              style={{
                width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 10, padding: '12px 14px', color: '#e2e8f0', fontSize: 14,
                fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
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
