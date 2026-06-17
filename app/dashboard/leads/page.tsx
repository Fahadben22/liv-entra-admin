'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Check, Search } from 'lucide-react';
import { adminApi } from '../../../lib/api';

type DemoRequest = {
  id: string; name: string; phone: string; email: string | null;
  units_count: string | null; message: string | null;
  status: string; notes: string | null; created_at: string; updated_at: string;
};

type ScrapedLead = {
  id: string; full_name: string; phone: string | null; email: string | null;
  notes: string | null; status: string; score: number | null;
  created_at: string; last_contact: string | null;
};

const DEMO_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  new:        { label: 'جديد',       color: '#3b82f6', bg: '#eff6ff' },
  contacted:  { label: 'تم التواصل', color: '#f59e0b', bg: '#fffbeb' },
  demo_done:  { label: 'تم العرض',   color: '#60A5FA', bg: '#f5f3ff' },
  converted:  { label: 'تحوّل عميل', color: '#10b981', bg: '#ecfdf5' },
  lost:       { label: 'خسارة',      color: '#ef4444', bg: '#fef2f2' },
};

const SCRAPED_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  new:          { label: 'جديد',           color: '#3b82f6', bg: '#eff6ff' },
  contacted:    { label: 'تم التواصل',     color: '#f59e0b', bg: '#fffbeb' },
  demo_booked:  { label: 'حجز عرض',       color: '#60A5FA', bg: '#f5f3ff' },
  negotiating:  { label: 'تفاوض',          color: '#a855f7', bg: '#faf5ff' },
  contracted:   { label: 'تحوّل عميل',    color: '#10b981', bg: '#ecfdf5' },
  lost:         { label: 'خسارة',          color: '#ef4444', bg: '#fef2f2' },
};

const ALL_DEMO_STATUSES   = ['new', 'contacted', 'demo_done', 'converted', 'lost'];
const ALL_SCRAPED_STATUSES = ['new', 'contacted', 'demo_booked', 'negotiating', 'contracted', 'lost'];

export default function LeadsPage() {
  const router = useRouter();

  // ─── Tab ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'demo' | 'scraped'>('demo');

  // ─── Demo requests state ─────────────────────────────────────────────────
  const [demoItems, setDemoItems]   = useState<DemoRequest[]>([]);
  const [demoTotal, setDemoTotal]   = useState(0);
  const [demoFilter, setDemoFilter] = useState('');
  const [demoStats, setDemoStats]   = useState<any>(null);
  const [demoUpdating, setDemoUpdating] = useState<string | null>(null);
  const [notesModal, setNotesModal]     = useState<DemoRequest | null>(null);
  const [notesText, setNotesText]       = useState('');
  const [savingNotes, setSavingNotes]   = useState(false);

  // ─── Scraped leads state ──────────────────────────────────────────────────
  const [scrapedItems, setScrapedItems]     = useState<ScrapedLead[]>([]);
  const [scrapedTotal, setScrapedTotal]     = useState(0);
  const [scrapedFilter, setScrapedFilter]   = useState('');
  const [scrapedSearch, setScrapedSearch]   = useState('');
  const [scrapedUpdating, setScrapedUpdating] = useState<string | null>(null);
  const [scrapedNotesModal, setScrapedNotesModal] = useState<ScrapedLead | null>(null);
  const [scrapedNotesText, setScrapedNotesText]   = useState('');
  const [savingScrapedNotes, setSavingScrapedNotes] = useState(false);

  // ─── Shared ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); }
  }, [router]);

  const loadDemo = useCallback(async () => {
    try {
      const [listRes, statsRes] = await Promise.allSettled([
        adminApi.sa.listDemoRequests(demoFilter || undefined),
        adminApi.sa.getDemoRequestStats(),
      ]);
      if (listRes.status === 'fulfilled') {
        setDemoItems(listRes.value.data?.items || []);
        setDemoTotal(listRes.value.data?.total || 0);
      }
      if (statsRes.status === 'fulfilled') setDemoStats(statsRes.value.data);
    } catch (e: any) { setError(e.message || 'فشل التحميل'); }
    finally { setLoading(false); }
  }, [demoFilter]);

  const loadScraped = useCallback(async () => {
    try {
      const res = await adminApi.sa.listScrapedLeads(scrapedFilter || undefined);
      setScrapedItems(res.data?.items || []);
      setScrapedTotal(res.data?.total || 0);
    } catch (e: any) { setError(e.message || 'فشل التحميل'); }
    finally { setLoading(false); }
  }, [scrapedFilter]);

  useEffect(() => { if (activeTab === 'demo')    { setLoading(true); loadDemo();    } }, [activeTab, loadDemo]);
  useEffect(() => { if (activeTab === 'scraped') { setLoading(true); loadScraped(); } }, [activeTab, loadScraped]);

  useEffect(() => {
    const t = setInterval(() => { if (activeTab === 'demo') loadDemo(); else loadScraped(); }, 60_000);
    return () => clearInterval(t);
  }, [activeTab, loadDemo, loadScraped]);

  async function changeDemoStatus(id: string, status: string) {
    setDemoUpdating(id);
    try {
      await adminApi.sa.updateDemoRequest(id, { status });
      setDemoItems(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch { /* ignore */ }
    finally { setDemoUpdating(null); }
  }

  async function saveDemoNotes() {
    if (!notesModal) return;
    setSavingNotes(true);
    try {
      await adminApi.sa.updateDemoRequest(notesModal.id, { notes: notesText });
      setDemoItems(prev => prev.map(r => r.id === notesModal.id ? { ...r, notes: notesText } : r));
      setNotesModal(null);
    } catch { /* ignore */ }
    finally { setSavingNotes(false); }
  }

  async function changeScrapedStatus(id: string, status: string) {
    setScrapedUpdating(id);
    try {
      await adminApi.sa.updateScrapedLead(id, { status });
      setScrapedItems(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch { /* ignore */ }
    finally { setScrapedUpdating(null); }
  }

  async function saveScrapedNotes() {
    if (!scrapedNotesModal) return;
    setSavingScrapedNotes(true);
    try {
      await adminApi.sa.updateScrapedLead(scrapedNotesModal.id, { notes: scrapedNotesText });
      setScrapedItems(prev => prev.map(r => r.id === scrapedNotesModal.id ? { ...r, notes: scrapedNotesText } : r));
      setScrapedNotesModal(null);
    } catch { /* ignore */ }
    finally { setSavingScrapedNotes(false); }
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('ar-SA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const visibleScraped = scrapedItems.filter(r =>
    !scrapedSearch || r.full_name?.includes(scrapedSearch) || r.phone?.includes(scrapedSearch) || r.notes?.includes(scrapedSearch)
  );

  const demoFilteredCount: Record<string, number> = {};
  ALL_DEMO_STATUSES.forEach(s => { demoFilteredCount[s] = demoItems.filter(r => r.status === s).length; });

  const scrapedCountByStatus: Record<string, number> = {};
  ALL_SCRAPED_STATUSES.forEach(s => { scrapedCountByStatus[s] = scrapedItems.filter(r => r.status === s).length; });

  return (
    <div className="fade-in" style={{ color: 'var(--lv-fg)', fontFamily: "'Tajawal', sans-serif" }}>
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 24px' }}>

        {/* PAGE HEADER */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: 'var(--lv-fg)', letterSpacing: '-0.02em' }}>العملاء المحتملون</h1>
          <p style={{ color: 'var(--lv-muted)', fontSize: 13 }}>طلبات التجربة الواردة + العملاء المستخلصون بالوكيل</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, padding: '12px 18px', marginBottom: 20, color: '#ef4444', fontSize: 13 }}>{error}</div>
        )}

        {/* MAIN TABS */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '2px solid var(--lv-line)' }}>
          {[
            { key: 'demo',    label: 'طلبات التجربة',     count: demoTotal },
            { key: 'scraped', label: 'عملاء مستخلصون',    count: scrapedTotal },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              style={{
                padding: '11px 22px', fontSize: 13, fontWeight: activeTab === t.key ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit', background: 'none',
                color: activeTab === t.key ? 'var(--lv-accent)' : 'var(--lv-muted)',
                border: 'none',
                borderBottom: activeTab === t.key ? '2px solid var(--lv-accent)' : '2px solid transparent',
                marginBottom: -2,
              }}>
              {t.label}
              {t.count > 0 && <span style={{ marginRight: 6, background: activeTab === t.key ? 'var(--lv-accent)' : 'var(--lv-line)', color: activeTab === t.key ? '#fff' : 'var(--lv-muted)', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{t.count}</span>}
            </button>
          ))}
          <button onClick={() => activeTab === 'demo' ? loadDemo() : loadScraped()}
            style={{ marginRight: 'auto', padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: '1px solid var(--lv-line)', color: 'var(--lv-muted)', alignSelf: 'center' }}>
            تحديث
          </button>
        </div>

        {/* ─── TAB: DEMO REQUESTS ─────────────────────────────────────────── */}
        {activeTab === 'demo' && (
          <>
            {demoStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 24 }}>
                {[
                  { label: 'إجمالي الطلبات', value: demoStats.total,                        color: 'var(--lv-fg)' },
                  { label: 'جديد',            value: demoStats.statusCounts?.new || 0,       color: '#3b82f6' },
                  { label: 'تم التواصل',      value: demoStats.statusCounts?.contacted || 0, color: '#f59e0b' },
                  { label: 'تحوّل عميل',      value: demoStats.statusCounts?.converted || 0, color: '#10b981' },
                  { label: 'معدل التحويل',    value: `${demoStats.conversionRate || 0}%`,    color: '#60A5FA' },
                ].map(k => (
                  <div key={k.label} className="card card-lift" style={{ background: 'var(--lv-panel)', border: '1px solid var(--lv-line)', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--lv-shadow-sm)' }}>
                    <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginBottom: 6, fontWeight: 500 }}>{k.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--lv-line)' }}>
              {[{ key: '', label: 'الكل', count: demoItems.length }, ...ALL_DEMO_STATUSES.map(s => ({ key: s, label: DEMO_STATUS[s].label, count: demoFilteredCount[s] }))].map(tab => (
                <button key={tab.key} onClick={() => setDemoFilter(tab.key)}
                  style={{
                    padding: '9px 16px', fontSize: 12, fontWeight: demoFilter === tab.key ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'inherit', background: 'none',
                    color: demoFilter === tab.key ? 'var(--lv-fg)' : 'var(--lv-muted)',
                    border: 'none', borderBottom: demoFilter === tab.key ? '2px solid var(--lv-accent)' : '2px solid transparent',
                  }}>
                  {tab.label} {tab.count > 0 && <span style={{ color: 'var(--lv-muted)', marginRight: 4 }}>({tab.count})</span>}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--lv-muted)', fontSize: 13 }}>جاري التحميل...</div>
            ) : demoItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--lv-muted)', fontSize: 13 }}>
                لا توجد طلبات {demoFilter ? `بحالة "${DEMO_STATUS[demoFilter]?.label}"` : 'بعد'}
              </div>
            ) : (
              <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--lv-panel)', boxShadow: 'var(--lv-shadow-sm)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 160px 130px 70px 100px 220px', background: 'var(--lv-bg)', borderBottom: '1px solid var(--lv-line)', padding: '10px 20px' }}>
                  {['التاريخ', 'العميل', 'البريد', 'الجوال', 'الوحدات', 'الحالة', 'الإجراءات'].map(h => (
                    <div key={h} style={{ fontSize: 11, fontWeight: 500, color: 'var(--lv-muted)' }}>{h}</div>
                  ))}
                </div>
                {demoItems.map((item, i) => {
                  const sc = DEMO_STATUS[item.status] || DEMO_STATUS.new;
                  return (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 160px 130px 70px 100px 220px', padding: '14px 20px', alignItems: 'center', borderBottom: i < demoItems.length - 1 ? '1px solid var(--lv-line)' : 'none', background: i % 2 === 0 ? 'var(--lv-panel)' : 'var(--lv-bg)' }}>
                      <div style={{ fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500 }}>{fmt(item.created_at)}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--lv-fg)' }}>{item.name}</div>
                        {item.message && <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginTop: 2, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.message}</div>}
                      </div>
                      <div>{item.email ? <a href={`mailto:${item.email}`} style={{ fontSize: 12, color: 'var(--lv-accent)', textDecoration: 'none', direction: 'ltr', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</a> : <span style={{ fontSize: 11, color: 'var(--lv-muted)' }}>—</span>}</div>
                      <div>
                        <a href={`tel:${item.phone}`} style={{ fontSize: 12, color: 'var(--lv-fg)', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>{item.phone}</a>
                        <div style={{ marginTop: 4 }}><a href={`https://wa.me/${item.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener" style={{ fontSize: 11, color: '#22c55e', textDecoration: 'none', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 7, padding: '2px 8px', fontWeight: 500 }}>واتساب</a></div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--lv-muted)' }}>{item.units_count || '—'}</div>
                      <div><span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 500, color: sc.color, background: sc.bg, padding: '2px 10px', borderRadius: 20 }}>{sc.label}</span></div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select value={item.status} disabled={demoUpdating === item.id} onChange={e => changeDemoStatus(item.id, e.target.value)}
                          style={{ background: 'var(--lv-bg)', border: '1px solid var(--lv-line)', color: 'var(--lv-fg)', borderRadius: 8, padding: '5px 6px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', flex: '0 0 90px', opacity: demoUpdating === item.id ? .5 : 1 }}>
                          {ALL_DEMO_STATUSES.map(s => <option key={s} value={s} style={{ background: 'var(--lv-panel)', color: 'var(--lv-fg)' }}>{DEMO_STATUS[s].label}</option>)}
                        </select>
                        <button onClick={() => { setNotesModal(item); setNotesText(item.notes || ''); }}
                          style={{ fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, background: item.notes ? 'var(--lv-bg)' : 'transparent', border: '1px solid var(--lv-line)', color: item.notes ? 'var(--lv-fg)' : 'var(--lv-muted)', borderRadius: 8, padding: '5px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {item.notes ? <ClipboardList size={14} /> : '+ ملاحظة'}
                        </button>
                        {item.status !== 'converted' && (
                          <button onClick={async () => {
                            if (!confirm(`تحويل "${item.name}" إلى عميل؟`)) return;
                            try { await adminApi.sa.convertLead(item.id, { plan: 'trial', send_welcome: true }); setDemoItems(prev => prev.map(r => r.id === item.id ? { ...r, status: 'converted' } : r)); } catch (e: any) { alert(e.message || 'فشل التحويل'); }
                          }}
                            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, background: 'var(--lv-accent)', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', fontWeight: 600, flexShrink: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>تحويل <Check size={12} /></span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ─── TAB: SCRAPED LEADS ─────────────────────────────────────────── */}
        {activeTab === 'scraped' && (
          <>
            {/* Stats strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'إجمالي المستخلصين', value: scrapedTotal, color: 'var(--lv-fg)' },
                { label: 'جديد',               value: scrapedCountByStatus.new || 0,        color: '#3b82f6' },
                { label: 'تم التواصل',         value: scrapedCountByStatus.contacted || 0,  color: '#f59e0b' },
                { label: 'تحوّل عميل',         value: scrapedCountByStatus.contracted || 0, color: '#10b981' },
              ].map(k => (
                <div key={k.label} style={{ background: 'var(--lv-panel)', border: '1px solid var(--lv-line)', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--lv-shadow-sm)' }}>
                  <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginBottom: 6, fontWeight: 500 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Filters row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--lv-line)', flex: 1 }}>
                {[{ key: '', label: 'الكل' }, ...ALL_SCRAPED_STATUSES.map(s => ({ key: s, label: SCRAPED_STATUS[s].label }))].map(tab => (
                  <button key={tab.key} onClick={() => setScrapedFilter(tab.key)}
                    style={{ padding: '8px 14px', fontSize: 11, fontWeight: scrapedFilter === tab.key ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', background: 'none', color: scrapedFilter === tab.key ? 'var(--lv-fg)' : 'var(--lv-muted)', border: 'none', borderBottom: scrapedFilter === tab.key ? '2px solid var(--lv-accent)' : '2px solid transparent' }}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Search size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--lv-muted)', pointerEvents: 'none' }} />
                <input value={scrapedSearch} onChange={e => setScrapedSearch(e.target.value)} placeholder="بحث بالاسم أو الجوال..."
                  style={{ background: 'var(--lv-bg)', border: '1px solid var(--lv-line)', borderRadius: 10, padding: '7px 10px 7px 32px', fontSize: 12, color: 'var(--lv-fg)', fontFamily: 'inherit', outline: 'none', width: 200, direction: 'rtl' }} />
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--lv-muted)', fontSize: 13 }}>جاري التحميل...</div>
            ) : visibleScraped.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--lv-muted)', fontSize: 14 }}>
                <p style={{ fontWeight: 500, marginBottom: 8 }}>لا يوجد عملاء مستخلصون</p>
                <p style={{ fontSize: 12 }}>اطلب من وكيل المبيعات تشغيل scrapeGoogleMaps للبدء</p>
              </div>
            ) : (
              <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--lv-panel)', boxShadow: 'var(--lv-shadow-sm)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 140px 130px 80px 100px 180px', background: 'var(--lv-bg)', borderBottom: '1px solid var(--lv-line)', padding: '10px 20px' }}>
                  {['نقاط', 'العميل', 'البريد', 'الجوال', 'التاريخ', 'الحالة', 'الإجراءات'].map(h => (
                    <div key={h} style={{ fontSize: 11, fontWeight: 500, color: 'var(--lv-muted)' }}>{h}</div>
                  ))}
                </div>
                {visibleScraped.map((item, i) => {
                  const sc = SCRAPED_STATUS[item.status] || SCRAPED_STATUS.new;
                  const scoreColor = (item.score || 0) >= 70 ? '#10b981' : (item.score || 0) >= 50 ? '#f59e0b' : 'var(--lv-muted)';
                  const notesPreview = item.notes?.replace(/مصدر البحث:.*?\|?\s*/g, '').split('|').filter(Boolean)[0]?.trim();
                  return (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 140px 130px 80px 100px 180px', padding: '14px 20px', alignItems: 'center', borderBottom: i < visibleScraped.length - 1 ? '1px solid var(--lv-line)' : 'none', background: i % 2 === 0 ? 'var(--lv-panel)' : 'var(--lv-bg)' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: scoreColor }}>{item.score ?? '—'}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--lv-fg)' }}>{item.full_name}</div>
                        {notesPreview && <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginTop: 2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notesPreview}</div>}
                      </div>
                      <div>{item.email ? <a href={`mailto:${item.email}`} style={{ fontSize: 12, color: 'var(--lv-accent)', textDecoration: 'none', direction: 'ltr', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</a> : <span style={{ fontSize: 11, color: 'var(--lv-muted)' }}>—</span>}</div>
                      <div>
                        {item.phone ? <>
                          <a href={`tel:${item.phone}`} style={{ fontSize: 12, color: 'var(--lv-fg)', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>{item.phone}</a>
                          <div style={{ marginTop: 4 }}><a href={`https://wa.me/${item.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener" style={{ fontSize: 11, color: '#22c55e', textDecoration: 'none', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 7, padding: '2px 8px', fontWeight: 500 }}>واتساب</a></div>
                        </> : <span style={{ fontSize: 11, color: 'var(--lv-muted)' }}>—</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--lv-muted)' }}>{fmt(item.created_at)}</div>
                      <div><span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 500, color: sc.color, background: sc.bg, padding: '2px 10px', borderRadius: 20 }}>{sc.label}</span></div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select value={item.status} disabled={scrapedUpdating === item.id} onChange={e => changeScrapedStatus(item.id, e.target.value)}
                          style={{ background: 'var(--lv-bg)', border: '1px solid var(--lv-line)', color: 'var(--lv-fg)', borderRadius: 8, padding: '5px 6px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', flex: '0 0 90px', opacity: scrapedUpdating === item.id ? .5 : 1 }}>
                          {ALL_SCRAPED_STATUSES.map(s => <option key={s} value={s} style={{ background: 'var(--lv-panel)', color: 'var(--lv-fg)' }}>{SCRAPED_STATUS[s].label}</option>)}
                        </select>
                        <button onClick={() => { setScrapedNotesModal(item); setScrapedNotesText(item.notes || ''); }}
                          style={{ fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, background: item.notes ? 'var(--lv-bg)' : 'transparent', border: '1px solid var(--lv-line)', color: item.notes ? 'var(--lv-fg)' : 'var(--lv-muted)', borderRadius: 8, padding: '5px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {item.notes ? <ClipboardList size={14} /> : '+ ملاحظة'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* DEMO NOTES MODAL */}
      {notesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }} onClick={e => { if (e.target === e.currentTarget) setNotesModal(null); }}>
          <div style={{ background: 'var(--lv-panel)', boxShadow: 'var(--lv-shadow-panel)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--lv-fg)' }}>ملاحظات</h3>
            <p style={{ fontSize: 13, color: 'var(--lv-muted)', marginBottom: 20 }}>{notesModal.name} — {notesModal.phone}</p>
            <textarea value={notesText} onChange={e => setNotesText(e.target.value)} rows={5} placeholder="أضف ملاحظات..."
              style={{ width: '100%', background: 'var(--lv-bg)', border: '1px solid var(--lv-line)', borderRadius: 10, padding: '7px 12px', color: 'var(--lv-fg)', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={saveDemoNotes} disabled={savingNotes} style={{ flex: 1, padding: '7px 16px', background: 'var(--lv-accent)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: savingNotes ? .7 : 1 }}>{savingNotes ? 'جاري الحفظ...' : 'حفظ'}</button>
              <button onClick={() => setNotesModal(null)} style={{ padding: '7px 16px', background: 'transparent', color: 'var(--lv-muted)', border: '1px solid var(--lv-line)', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* SCRAPED NOTES MODAL */}
      {scrapedNotesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }} onClick={e => { if (e.target === e.currentTarget) setScrapedNotesModal(null); }}>
          <div style={{ background: 'var(--lv-panel)', boxShadow: 'var(--lv-shadow-panel)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--lv-fg)' }}>ملاحظات</h3>
            <p style={{ fontSize: 13, color: 'var(--lv-muted)', marginBottom: 20 }}>{scrapedNotesModal.full_name} — {scrapedNotesModal.phone || '—'}</p>
            <textarea value={scrapedNotesText} onChange={e => setScrapedNotesText(e.target.value)} rows={5} placeholder="أضف ملاحظات..."
              style={{ width: '100%', background: 'var(--lv-bg)', border: '1px solid var(--lv-line)', borderRadius: 10, padding: '7px 12px', color: 'var(--lv-fg)', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={saveScrapedNotes} disabled={savingScrapedNotes} style={{ flex: 1, padding: '7px 16px', background: 'var(--lv-accent)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: savingScrapedNotes ? .7 : 1 }}>{savingScrapedNotes ? 'جاري الحفظ...' : 'حفظ'}</button>
              <button onClick={() => setScrapedNotesModal(null)} style={{ padding: '7px 16px', background: 'transparent', color: 'var(--lv-muted)', border: '1px solid var(--lv-line)', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
