'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useEvents, DashboardEvent } from '@/lib/useEvents';
import PageShell from '@/components/PageShell';
import Icon from '@/components/Icon';

function lcOf(c: any): string {
  if (c.lifecycle_status) return c.lifecycle_status;
  if (!c.is_active) return 'suspended';
  if (c.plan === 'trial') return 'trial';
  return 'active';
}

const LC: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  trial:     { bg: 'rgba(180,99,10,0.08)',  color: '#b4630a', dot: '#b4630a',  label: 'تجريبي' },
  active:    { bg: 'rgba(10,143,95,0.08)',  color: '#0a8f5f', dot: '#0a8f5f',  label: 'نشط' },
  overdue:   { bg: 'rgba(180,99,10,0.10)',  color: '#b4630a', dot: '#b4630a',  label: 'متأخر' },
  suspended: { bg: 'rgba(184,50,31,0.08)',  color: '#b8321f', dot: '#b8321f',  label: 'موقوف' },
};

const EVENT_ICON_MAP: Record<string, { name: import('@/components/Icon').IconName; color: string }> = {
  payment_received:     { name: 'dollar',         color: '#0a8f5f' },
  payment_failed:       { name: 'x-circle',       color: '#b8321f' },
  company_created:      { name: 'building',       color: 'var(--lv-accent)' },
  subscription_changed: { name: 'refresh',        color: 'var(--lv-accent)' },
  invoice_overdue:      { name: 'alert-triangle', color: '#b4630a' },
  trial_expiring:       { name: 'clock',          color: '#b4630a' },
  connected:            { name: 'check-circle',   color: '#0a8f5f' },
};

const QUICK_LINKS = [
  { href: '/dashboard/billing/invoices',     label: 'الفواتير',              icon: 'invoice'   as const },
  { href: '/dashboard/billing/subscriptions',label: 'الاشتراكات',           icon: 'receipt'   as const },
  { href: '/dashboard/features',             label: 'إدارة الميزات',        icon: 'settings'  as const },
  { href: '/dashboard/billing',              label: 'نظرة عامة — الفوترة',  icon: 'bar-chart' as const },
];

function fmt(n: number) { return n.toLocaleString('en-US'); }
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'الآن';
  if (s < 3600) return `منذ ${Math.floor(s/60)} د`;
  if (s < 86400) return `منذ ${Math.floor(s/3600)} س`;
  return `منذ ${Math.floor(s/86400)} ي`;
}
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

export default function AdminDashboard() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [metrics,   setMetrics]   = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const { events, isConnected } = useEvents(15);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      adminApi.listCompanies(),
      adminApi.sa.mrrStats(),
    ]);
    if (results[0].status === 'fulfilled') setCompanies((results[0].value as any)?.data || []);
    if (results[1].status === 'fulfilled') setMetrics((results[1].value as any)?.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--lv-line-strong)', borderTopColor: 'var(--lv-accent)', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const byStage = {
    trial:     companies.filter(c => lcOf(c) === 'trial'),
    active:    companies.filter(c => lcOf(c) === 'active'),
    overdue:   companies.filter(c => lcOf(c) === 'overdue'),
    suspended: companies.filter(c => lcOf(c) === 'suspended'),
  };
  const m = metrics || {};
  const trialsExpiring = byStage.trial.filter(c => c.trial_ends_at && daysUntil(c.trial_ends_at) <= 7 && daysUntil(c.trial_ends_at) >= 0);

  const kpis = [
    { label: 'MRR',           value: fmt(m.mrr || 0),                  unit: 'ر.س', color: 'var(--lv-accent)',  sub: `ARR: ${fmt(m.arr || 0)}` },
    { label: 'ARPU',          value: fmt(m.arpu || 0),                 unit: 'ر.س', color: '#0a8f5f',           sub: `LTV: ${fmt(m.ltv || 0)}` },
    { label: 'الانسحاب',      value: `${m.churn_rate || 0}%`,          unit: '',    color: (m.churn_rate||0) > 5 ? '#b8321f' : (m.churn_rate||0) > 3 ? '#b4630a' : '#0a8f5f', sub: `NRR: ${m.nrr || 100}%` },
    { label: 'عملاء يدفعون', value: `${m.total_paying || 0}`,          unit: '',    color: 'var(--lv-accent)',  sub: `من ${companies.length}` },
    { label: 'محصّل الشهر',  value: fmt(m.collected_this_month || 0), unit: 'ر.س', color: '#0a8f5f',           sub: '' },
    { label: 'معرّض للخطر',  value: fmt(m.at_risk_revenue || 0),      unit: 'ر.س', color: (m.at_risk_revenue||0) > 0 ? '#b4630a' : 'var(--lv-muted)', sub: '' },
  ];

  return (
    <PageShell
      eyebrow="لوحة التحكم"
      title="نظرة عامة"
      subtitle={new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isConnected && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#0a8f5f', background: 'rgba(10,143,95,0.1)', padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0a8f5f', animation: 'pulse-dot 2s infinite' }} />
              مباشر
            </span>
          )}
          <Link href="/dashboard/companies/new"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 16px', borderRadius: 8, background: 'var(--lv-fg)', color: 'var(--lv-bg)', textDecoration: 'none', fontWeight: 600 }}>
            <Icon name="plus" size={14} color="var(--lv-bg)" />
            إضافة شركة
          </Link>
        </div>
      }
    >
      {/* KPI strip */}
      <div className="stagger-enter" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {kpis.map((k, i) => (
          <div key={k.label} className="card fade-in" style={{ padding: '18px 16px', animationDelay: `${i * 0.04}s`, borderInlineStart: `3px solid ${k.color}` }}>
            <p style={{ fontSize: 10.5, color: 'var(--lv-muted)', margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--lv-font-ui)' }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--lv-fg)', margin: 0, lineHeight: 1, fontFamily: 'var(--lv-font-num)' }}>
              <bdi dir="ltr">{k.value}</bdi>
              <span style={{ fontSize: 11, color: 'var(--lv-muted)', fontWeight: 400, marginInlineStart: 4 }}>{k.unit}</span>
            </p>
            {k.sub && <p style={{ fontSize: 10.5, color: 'var(--lv-muted)', margin: '6px 0 0', fontFamily: 'var(--lv-font-mono)' }}><bdi dir="ltr">{k.sub}</bdi></p>}
          </div>
        ))}
      </div>

      {/* Lifecycle pipeline */}
      <div className="card" style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--lv-fg)', fontFamily: 'var(--lv-font-ar)' }}>دورة حياة الشركات</h2>
          <Link href="/dashboard/companies" style={{ fontSize: 12, color: 'var(--lv-accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            عرض الكل
            <Icon name="arrow-left" size={12} color="var(--lv-accent)" />
          </Link>
        </div>
        <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
          {[
            { key: 'active',    count: byStage.active.length,    color: '#0a8f5f' },
            { key: 'trial',     count: byStage.trial.length,     color: '#b4630a' },
            { key: 'overdue',   count: byStage.overdue.length,   color: '#b4630a' },
            { key: 'suspended', count: byStage.suspended.length, color: '#b8321f' },
          ].map(seg => {
            const pct = companies.length ? (seg.count / companies.length) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div key={seg.key} style={{ width: `${pct}%`, background: seg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: seg.count > 0 ? 36 : 0, transition: 'width .5s' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{seg.count}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'نشط',     count: byStage.active.length,    color: '#0a8f5f' },
            { label: 'تجريبي',  count: byStage.trial.length,     color: '#b4630a' },
            { label: 'متأخر',   count: byStage.overdue.length,   color: '#b4630a' },
            { label: 'موقوف',   count: byStage.suspended.length, color: '#b8321f' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
              <span style={{ fontSize: 12, color: 'var(--lv-muted)' }}>{l.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lv-fg)', fontFamily: 'var(--lv-font-mono)' }}><bdi dir="ltr">{l.count}</bdi></span>
            </div>
          ))}
        </div>
      </div>

      {/* Two-col: activity + alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

        {/* Real-time activity feed */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--lv-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--lv-fg)' }}>النشاط المباشر</h2>
            <span style={{ fontSize: 11, color: isConnected ? '#0a8f5f' : 'var(--lv-muted)', fontWeight: 500 }}>
              {isConnected ? 'متصل' : 'غير متصل'}
            </span>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {events.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--lv-muted)', fontSize: 12 }}>
                في انتظار الأحداث...
              </div>
            ) : (
              events.filter(e => e.type !== 'connected' && e.type !== 'ping').map((ev: DashboardEvent, i: number) => {
                const cfg = EVENT_ICON_MAP[ev.type] || { name: 'activity' as const, color: 'var(--lv-muted)' };
                return (
                  <div key={`${ev.at}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--lv-line)', animation: i === 0 ? 'fadeIn .4s ease' : undefined }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `${cfg.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name={cfg.name} size={14} color={cfg.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--lv-fg)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.company || ev.name || ev.invoice || ev.type}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '2px 0 0', fontFamily: 'var(--lv-font-mono)' }}>
                        {ev.amount ? `${fmt(Number(ev.amount))} ر.س` : ''} {ev.plan || ''} {ev.method || ''}
                      </p>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--lv-muted)', flexShrink: 0 }}>{ev.at ? timeAgo(ev.at) : ''}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Alerts + quick links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {byStage.overdue.length > 0 && (
            <Link href="/dashboard/billing/invoices?status=overdue" className="card" style={{ padding: '14px 16px', textDecoration: 'none', borderInlineStart: '3px solid #b4630a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="alert-triangle" size={18} color="#b4630a" />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#b4630a', margin: 0 }}><bdi dir="ltr">{byStage.overdue.length}</bdi> فواتير متأخرة</p>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '2px 0 0' }}>تحتاج متابعة فورية</p>
                </div>
              </div>
            </Link>
          )}
          {trialsExpiring.length > 0 && (
            <Link href="/dashboard/billing/subscriptions?status=trial" className="card" style={{ padding: '14px 16px', textDecoration: 'none', borderInlineStart: '3px solid #b4630a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="clock" size={18} color="#b4630a" />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#b4630a', margin: 0 }}><bdi dir="ltr">{trialsExpiring.length}</bdi> تجارب تنتهي قريباً</p>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '2px 0 0' }}>خلال 7 أيام</p>
                </div>
              </div>
            </Link>
          )}
          {byStage.suspended.length > 0 && (
            <Link href="/dashboard/companies?status=suspended" className="card" style={{ padding: '14px 16px', textDecoration: 'none', borderInlineStart: '3px solid #b8321f' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="x-circle" size={18} color="#b8321f" />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#b8321f', margin: 0 }}><bdi dir="ltr">{byStage.suspended.length}</bdi> شركات موقوفة</p>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '2px 0 0' }}>بسبب عدم الدفع</p>
                </div>
              </div>
            </Link>
          )}
          {byStage.overdue.length === 0 && trialsExpiring.length === 0 && byStage.suspended.length === 0 && (
            <div className="card" style={{ padding: '24px 16px', textAlign: 'center' }}>
              <Icon name="check-circle" size={28} color="#0a8f5f" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: '#0a8f5f', margin: 0 }}>لا توجد تنبيهات</p>
              <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '4px 0 0' }}>كل شيء يعمل بشكل طبيعي</p>
            </div>
          )}

          {/* Quick links */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--lv-font-ui)' }}>وصول سريع</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {QUICK_LINKS.map(link => (
                <Link key={link.href} href={link.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 7, fontSize: 13, color: 'var(--lv-muted)', textDecoration: 'none', transition: 'background .1s' }}
                  className="lv-nav-item">
                  <Icon name={link.icon} size={14} color="var(--lv-muted)" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .kpi-row { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 900px) {
          .two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </PageShell>
  );
}
