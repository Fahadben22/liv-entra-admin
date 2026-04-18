'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '../../../lib/api';

type BehaviorEvent = { type: string; page: string; detail: string; timestamp: string; dwell_ms: number };

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
  city?: string | null;
  property_count?: string | null;
  unit_count?: string | null;
  pain_points?: string[] | null;
  behavioral_data?: BehaviorEvent[] | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: 'جديد',         color: '#3b82f6', bg: '#eff6ff' },
  contacted: { label: 'تم التواصل',   color: '#f59e0b', bg: '#fffbeb' },
  converted: { label: 'تحوّل عميل',   color: '#10b981', bg: '#ecfdf5' },
  ignored:   { label: 'تجاهل',        color: '#6b7280', bg: '#f3f4f6' },
};

const ALL_STATUSES = ['new', 'contacted', 'converted', 'ignored'];

function BehaviorInsights({ lead }: { lead: DemoLead }) {
  const events = lead.behavioral_data || [];
  if (events.length === 0 && !lead.city && !lead.pain_points?.length) return <p style={{ fontSize: 11, color: 'var(--lv-muted)', padding: '12px 0' }}>لا توجد بيانات سلوكية</p>;

  // Compute insights
  const pageVisits = events.filter(e => e.type === 'page_visit');
  const scenarioStarts = events.filter(e => e.type === 'scenario_start');
  const scenarioCompletes = events.filter(e => e.type === 'scenario_complete');
  const spotlights = events.filter(e => e.type === 'spotlight_view');
  const conversionOpens = events.filter(e => e.type === 'conversion_panel_open');
  const totalDwell = events.reduce((s, e) => s + (e.dwell_ms || 0), 0);

  // Pages visited with time
  const pageMap: Record<string, { count: number; totalDwell: number }> = {};
  for (const e of pageVisits) {
    const p = e.page || 'unknown';
    if (!pageMap[p]) pageMap[p] = { count: 0, totalDwell: 0 };
    pageMap[p].count++;
    pageMap[p].totalDwell += e.dwell_ms || 0;
  }
  const topPages = Object.entries(pageMap).sort((a, b) => b[1].totalDwell - a[1].totalDwell).slice(0, 8);

  const PAGE_AR: Record<string, string> = {
    '/dashboard': 'لوحة التحكم', '/dashboard/payments': 'المدفوعات', '/dashboard/portfolio': 'المحفظة',
    '/dashboard/contracts': 'العقود', '/dashboard/financial': 'المالية', '/dashboard/intelligence': 'الذكاء الاصطناعي',
    '/dashboard/analytics': 'التحليلات', '/dashboard/lifecycle': 'دورة الحياة', '/dashboard/properties': 'العقارات',
    '/dashboard/units': 'الوحدات', '/dashboard/maintenance': 'الصيانة', '/dashboard/owners': 'الملاك',
    '/dashboard/renewal': 'التجديد', '/dashboard/tenants': 'المستأجرين',
  };

  return (
    <div style={{ padding: '16px 20px', background: 'var(--lv-bg)', borderTop: '1px solid var(--lv-line)' }}>
      {/* Context from intake */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {lead.city && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 8, background: '#eff6ff', color: '#1d4070', fontWeight: 600 }}>{lead.city}</span>}
        {lead.property_count && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 8, background: '#f0fdf4', color: '#15803d', fontWeight: 600 }}>{lead.property_count} عقار</span>}
        {lead.unit_count && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 8, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>{lead.unit_count} وحدة</span>}
        {(lead.pain_points || []).map(p => <span key={p} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontWeight: 600 }}>{p}</span>)}
      </div>

      {/* Behavioral stats */}
      <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'صفحات زارها', value: pageVisits.length, color: '#3b82f6' },
          { label: 'سيناريوهات بدأها', value: scenarioStarts.length, color: 'var(--lv-accent)' },
          { label: 'سيناريوهات أكملها', value: scenarioCompletes.length, color: '#10b981' },
          { label: 'لحظات إعجاب', value: spotlights.length, color: '#f59e0b' },
          { label: 'فتح صفحة الاشتراك', value: conversionOpens.length, color: '#dc2626' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center', padding: '8px', borderRadius: 10, background: 'var(--lv-panel)', border: '1px solid var(--lv-line)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: 'var(--lv-muted)', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Heatmap — top pages by dwell time */}
      {topPages.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--lv-fg)', marginBottom: 6 }}>خريطة الاهتمام (حسب وقت التصفح)</p>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {topPages.map(([page, data]) => {
              const pct = Math.min(100, Math.round((data.totalDwell / Math.max(totalDwell, 1)) * 100));
              const intensity = Math.min(1, pct / 30);
              return (
                <div key={page} style={{
                  padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                  background: `rgba(124,92,252,${0.08 + intensity * 0.25})`,
                  color: intensity > 0.5 ? 'var(--lv-accent)' : 'var(--lv-muted)',
                  border: `1px solid rgba(124,92,252,${intensity * 0.3})`,
                }}>
                  {PAGE_AR[page] || page.split('/').pop()} · {Math.round(data.totalDwell / 1000)}ث
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Engagement score */}
      {events.length > 0 && (() => {
        const score = Math.min(100,
          pageVisits.length * 2 +
          Math.floor(totalDwell / 30000) +
          scenarioStarts.length * 5 +
          scenarioCompletes.length * 10 +
          conversionOpens.length * 15 +
          spotlights.length * 3
        );
        const level = score >= 60 ? { label: 'مرتفع', color: '#10b981', bg: '#ecfdf5' } : score >= 30 ? { label: 'متوسط', color: '#f59e0b', bg: '#fffbeb' } : { label: 'منخفض', color: '#6b7280', bg: '#f3f4f6' };
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--lv-fg)' }}>مستوى الاهتمام:</span>
            <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${score}%`, background: level.color, borderRadius: 3, transition: 'width .3s' }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: level.color, padding: '2px 8px', borderRadius: 6, background: level.bg }}>{score}/100 {level.label}</span>
          </div>
        );
      })()}

      {/* Scenario funnel */}
      {scenarioStarts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--lv-fg)', marginBottom: 6 }}>مسار السيناريوهات</p>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '6px', borderRadius: 8, background: 'rgba(124,92,252,.08)', border: '1px solid rgba(124,92,252,.15)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lv-accent)' }}>{scenarioStarts.length}</div>
              <div style={{ fontSize: 9, color: 'var(--lv-muted)' }}>بدأ</div>
            </div>
            <span style={{ color: '#d1d5db', fontSize: 14 }}>→</span>
            <div style={{ flex: 1, textAlign: 'center', padding: '6px', borderRadius: 8, background: scenarioCompletes.length > 0 ? 'rgba(16,185,129,.08)' : 'rgba(0,0,0,.03)', border: `1px solid ${scenarioCompletes.length > 0 ? 'rgba(16,185,129,.15)' : 'rgba(0,0,0,.06)'}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: scenarioCompletes.length > 0 ? '#10b981' : 'var(--lv-muted)' }}>{scenarioCompletes.length}</div>
              <div style={{ fontSize: 9, color: 'var(--lv-muted)' }}>أكمل</div>
            </div>
            <span style={{ color: '#d1d5db', fontSize: 14 }}>→</span>
            <div style={{ flex: 1, textAlign: 'center', padding: '6px', borderRadius: 8, background: conversionOpens.length > 0 ? 'rgba(245,158,11,.08)' : 'rgba(0,0,0,.03)', border: `1px solid ${conversionOpens.length > 0 ? 'rgba(245,158,11,.15)' : 'rgba(0,0,0,.06)'}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: conversionOpens.length > 0 ? '#f59e0b' : 'var(--lv-muted)' }}>{conversionOpens.length}</div>
              <div style={{ fontSize: 9, color: 'var(--lv-muted)' }}>فتح الاشتراك</div>
            </div>
          </div>
        </div>
      )}

      {/* AI Agent summary */}
      {events.length > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(124,92,252,0.05), rgba(37,99,235,0.05))', border: '1px solid rgba(124,92,252,0.15)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--lv-accent)', marginBottom: 4 }}>ملخص للوكيل الذكي</p>
          <p style={{ fontSize: 11, color: 'var(--lv-muted)', lineHeight: 1.6, margin: 0 }}>
            الزائر من {lead.city || '—'} · {lead.property_count || '—'} عقار · {lead.unit_count || '—'} وحدة ·
            تحدياته: {(lead.pain_points || []).join('، ') || 'لم يحدد'} ·
            زار {pageVisits.length} صفحة · أكمل {scenarioCompletes.length}/{scenarioStarts.length} سيناريو ·
            {conversionOpens.length > 0 ? 'فتح صفحة الاشتراك' : 'لم يفتح صفحة الاشتراك'} ·
            إجمالي وقت التصفح: {Math.round(totalDwell / 60000)} دقيقة
          </p>
        </div>
      )}
    </div>
  );
}

export default function DemoLeadsPage() {
  const [items, setItems]             = useState<DemoLead[]>([]);
  const [total, setTotal]             = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
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

  const displayedItems = filter ? items.filter(r => r.status === filter) : items;

  return (
    <div className="fade-in" style={{ color: 'var(--lv-fg)', fontFamily: "'Tajawal', sans-serif" }}>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 24px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: 'var(--lv-fg)', letterSpacing: '-0.02em' }}>قيادات الديمو المباشر</h1>
          <p style={{ color: 'var(--lv-muted)', fontSize: 13 }}>
            زوار استخدموا التجربة المجانية المباشرة — إجمالي {total} قيادة
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, padding: '12px 18px', marginBottom: 20, color: '#ef4444', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* STATS STRIP */}
        <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'إجمالي',      value: total,                       color: 'var(--lv-fg)' },
            { label: 'جديد',        value: statusCounts.new || 0,       color: '#3b82f6' },
            { label: 'تم التواصل', value: statusCounts.contacted || 0,  color: '#f59e0b' },
            { label: 'تحوّل عميل', value: statusCounts.converted || 0,  color: '#10b981' },
          ].map(k => (
            <div key={k.label} className="card card-lift" style={{ background: 'var(--lv-panel)', border: '1px solid var(--lv-line)', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--lv-shadow-sm)' }}>
              <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginBottom: 6, fontWeight: 500 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* STATUS FILTER TABS */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--lv-line)' }}>
          {[
            { key: '', label: 'الكل', count: total },
            ...ALL_STATUSES.map(s => ({ key: s, label: STATUS_CONFIG[s].label, count: statusCounts[s] || 0 })),
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: filter === tab.key ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
                background: 'none',
                color: filter === tab.key ? 'var(--lv-fg)' : 'var(--lv-muted)',
                border: 'none',
                borderBottom: filter === tab.key ? '2px solid var(--lv-accent)' : '2px solid transparent',
              }}>
              {tab.label} {tab.count > 0 && <span style={{ color: 'var(--lv-muted)', marginRight: 4 }}>({tab.count})</span>}
            </button>
          ))}
          <button onClick={load}
            style={{ marginRight: 'auto', padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: '1px solid var(--lv-line)', color: 'var(--lv-muted)' }}>
            تحديث
          </button>
        </div>

        {/* TABLE */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--lv-muted)', fontSize: 13 }}>جاري التحميل...</div>
        ) : displayedItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--lv-muted)', fontSize: 13 }}>
            <p>لا توجد قيادات {filter ? `بحالة "${STATUS_CONFIG[filter]?.label}"` : 'بعد'}</p>
          </div>
        ) : (
          <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--lv-panel)', boxShadow: 'var(--lv-shadow-sm)' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 130px 150px 100px 220px', gap: 0, background: 'var(--lv-bg)', borderBottom: '1px solid var(--lv-line)', padding: '10px 20px' }}>
              {['التاريخ', 'الزائر', 'الجوال', 'الشركة', 'الحالة', 'الإجراءات'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 500, color: 'var(--lv-muted)' }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {displayedItems.map((item, i) => {
              const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;
              const hasData = (item.behavioral_data?.length || 0) > 0 || item.city || (item.pain_points?.length || 0) > 0;
              const isExpanded = expandedLead === item.id;
              return (
                <div key={item.id} style={{ borderBottom: i < displayedItems.length - 1 ? '1px solid var(--lv-line)' : 'none' }}>
                <div
                  style={{
                    display: 'grid', gridTemplateColumns: '120px 1fr 130px 150px 100px 220px',
                    gap: 0, padding: '14px 20px', alignItems: 'center',
                    background: isExpanded ? 'var(--lv-bg)' : i % 2 === 0 ? 'var(--lv-panel)' : 'var(--lv-bg)',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Date */}
                  <div style={{ fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500 }}>{fmt(item.created_at)}</div>

                  {/* Name — click to expand */}
                  <div onClick={() => hasData && setExpandedLead(isExpanded ? null : item.id)} style={{ cursor: hasData ? 'pointer' : 'default' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--lv-fg)' }}>{item.name || '—'}</span>
                      {hasData && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: isExpanded ? 'var(--lv-accent)' : 'rgba(124,92,252,0.1)', color: isExpanded ? '#fff' : 'var(--lv-accent)', fontWeight: 700 }}>{isExpanded ? '▲' : '▼ بيانات'}</span>}
                    </div>
                    {item.demo_session_id && (
                      <div style={{ fontSize: 11, color: 'var(--lv-muted)', fontFamily: 'Inter, monospace', marginTop: 2, fontWeight: 500 }}>
                        {item.demo_session_id.slice(0, 8)}...
                      </div>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <a href={`tel:${item.phone}`} style={{ fontSize: 12, color: 'var(--lv-fg)', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
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
                  <div style={{ fontSize: 12, color: 'var(--lv-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.company_name || '—'}</div>

                  {/* Status pill */}
                  <div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: sc.color, background: sc.bg, padding: '2px 10px', borderRadius: 20 }}>
                      {sc.label}
                    </span>
                  </div>

                  {/* Actions: status select + notes + convert — all in one row */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select
                      value={item.status}
                      disabled={updating === item.id}
                      onChange={e => { e.stopPropagation(); changeStatus(item.id, e.target.value); }}
                      style={{
                        background: 'var(--lv-bg)', border: '1px solid var(--lv-line)', color: 'var(--lv-fg)',
                        borderRadius: 8, padding: '5px 6px', fontSize: 11, cursor: 'pointer',
                        fontFamily: 'inherit', outline: 'none', flex: '0 0 90px',
                        opacity: updating === item.id ? .5 : 1,
                      }}>
                      {ALL_STATUSES.map(s => (
                        <option key={s} value={s} style={{ background: 'var(--lv-panel)', color: 'var(--lv-fg)' }}>{STATUS_CONFIG[s].label}</option>
                      ))}
                    </select>
                    <button onClick={e => { e.stopPropagation(); openNotes(item); }}
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
                        onClick={async e => {
                          e.stopPropagation();
                          if (!confirm(`تحويل "${item.name || item.phone}" إلى عميل؟`)) return;
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
                {isExpanded && <BehaviorInsights lead={item} />}
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
            <p style={{ fontSize: 13, color: 'var(--lv-muted)', marginBottom: 20 }}>
              {notesModal.name || '—'} — {notesModal.phone}
            </p>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              rows={5}
              placeholder="أضف ملاحظات حول هذا الزائر..."
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
