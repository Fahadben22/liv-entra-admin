'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useEvents, DashboardEvent } from '@/lib/useEvents';
import Icon from '@/components/Icon';

function lcOf(c: any): string {
  if (c.lifecycle_status) return c.lifecycle_status;
  if (!c.is_active) return 'suspended';
  if (c.plan === 'trial') return 'trial';
  return 'active';
}

const LC_BADGE: Record<string, string> = {
  trial:     'warning',
  active:    'success',
  overdue:   'warning',
  suspended: 'danger',
};
const LC_LABEL: Record<string, string> = {
  trial: 'تجريبي', active: 'نشط', overdue: 'متأخر', suspended: 'موقوف',
};
const LC_COLOR: Record<string, string> = {
  trial: 'var(--warning)', active: 'var(--success)',
  overdue: 'var(--warning)', suspended: 'var(--danger)',
};

const EVENT_ICON_MAP: Record<string, { name: import('@/components/Icon').IconName; color: string }> = {
  payment_received:     { name: 'dollar',         color: 'var(--success)' },
  payment_failed:       { name: 'x-circle',       color: 'var(--danger)' },
  company_created:      { name: 'building',       color: 'var(--brand-600)' },
  subscription_changed: { name: 'refresh',        color: 'var(--brand-600)' },
  invoice_overdue:      { name: 'alert-triangle', color: 'var(--warning)' },
  trial_expiring:       { name: 'clock',          color: 'var(--warning)' },
  connected:            { name: 'check-circle',   color: 'var(--success)' },
};

const QUICK_LINKS = [
  { href: '/dashboard/billing/invoices',      label: 'الفواتير',             icon: 'invoice'   as const },
  { href: '/dashboard/billing/subscriptions', label: 'الاشتراكات',           icon: 'receipt'   as const },
  { href: '/dashboard/features',              label: 'إدارة الميزات',        icon: 'settings'  as const },
  { href: '/dashboard/billing',               label: 'نظرة عامة — الفوترة', icon: 'bar-chart' as const },
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
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--ink-200)', borderTopColor: 'var(--brand-600)', animation: 'spin .7s linear infinite' }} />
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
    { label: 'MRR',           value: fmt(m.mrr || 0),                  unit: 'ر.س', color: 'var(--brand-600)',  sub: `ARR: ${fmt(m.arr || 0)}` },
    { label: 'ARPU',          value: fmt(m.arpu || 0),                 unit: 'ر.س', color: 'var(--success)',    sub: `LTV: ${fmt(m.ltv || 0)}` },
    { label: 'الانسحاب',      value: `${m.churn_rate || 0}%`,          unit: '',    color: (m.churn_rate||0) > 5 ? 'var(--danger)' : (m.churn_rate||0) > 3 ? 'var(--warning)' : 'var(--success)', sub: `NRR: ${m.nrr || 100}%` },
    { label: 'عملاء يدفعون', value: `${m.total_paying || 0}`,          unit: '',    color: 'var(--brand-600)',  sub: `من ${companies.length}` },
    { label: 'محصّل الشهر',  value: fmt(m.collected_this_month || 0), unit: 'ر.س', color: 'var(--success)',    sub: '' },
    { label: 'معرّض للخطر',  value: fmt(m.at_risk_revenue || 0),      unit: 'ر.س', color: (m.at_risk_revenue||0) > 0 ? 'var(--warning)' : 'var(--text-muted)', sub: '' },
  ];

  return (
    <div style={{ direction: 'rtl', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>لوحة التحكم</h1>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 3, marginBottom: 0 }}>
            {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isConnected && (
            <span className="le-badge success dot">مباشر</span>
          )}
          <Link href="/dashboard/companies/new" className="le-btn primary sm" style={{ textDecoration: 'none' }}>
            <Icon name="plus" size={13} color="white" />
            إضافة شركة
          </Link>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {kpis.map((k, i) => (
          <div key={k.label} className="le-card elevated" style={{ padding: '18px 16px', borderInlineStart: `3px solid ${k.color}`, animationDelay: `${i * 0.04}s` }}>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label}</p>
            <p className="num" style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: 'var(--text-1)', margin: 0, lineHeight: 1 }}>
              <bdi dir="ltr">{k.value}</bdi>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 400, marginInlineStart: 4 }}>{k.unit}</span>
            </p>
            {k.sub && <p className="num" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: '6px 0 0' }}><bdi dir="ltr">{k.sub}</bdi></p>}
          </div>
        ))}
      </div>

      {/* ── Lifecycle pipeline ── */}
      <div className="le-card">
        <div className="le-card-h">
          <span className="le-card-t">دورة حياة الشركات</span>
          <Link href="/dashboard/companies" className="le-btn ghost sm" style={{ textDecoration: 'none' }}>
            عرض الكل
            <Icon name="arrow-left" size={12} color="var(--text-2)" />
          </Link>
        </div>
        <div className="le-card-b">
          {/* Stacked bar */}
          <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
            {[
              { key: 'active',    count: byStage.active.length,    color: 'var(--success)' },
              { key: 'trial',     count: byStage.trial.length,     color: 'var(--warning)' },
              { key: 'overdue',   count: byStage.overdue.length,   color: '#f59e0b' },
              { key: 'suspended', count: byStage.suspended.length, color: 'var(--danger)' },
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
          {/* Legend */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {(['active','trial','overdue','suspended'] as const).map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: LC_COLOR[k] }} />
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{LC_LABEL[k]}</span>
                <span className="num" style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-1)' }}><bdi dir="ltr">{byStage[k].length}</bdi></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Two-col: activity + alerts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>

        {/* Real-time activity feed */}
        <div className="le-card">
          <div className="le-card-h">
            <span className="le-card-t">النشاط المباشر</span>
            <span className={`le-badge ${isConnected ? 'success' : 'neutral'}`} style={{ fontSize: 'var(--fs-xs)' }}>
              {isConnected ? 'متصل' : 'غير متصل'}
            </span>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {events.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
                في انتظار الأحداث...
              </div>
            ) : (
              events.filter(e => e.type !== 'connected' && e.type !== 'ping').map((ev: DashboardEvent, i: number) => {
                const cfg = EVENT_ICON_MAP[ev.type] || { name: 'activity' as const, color: 'var(--text-muted)' };
                return (
                  <div key={`${ev.at}-${i}`} className="lv-table-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: `${cfg.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name={cfg.name} size={14} color={cfg.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.company || ev.name || ev.invoice || ev.type}
                      </p>
                      <p className="num" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        {ev.amount ? `${fmt(Number(ev.amount))} ر.س` : ''} {ev.plan || ''} {ev.method || ''}
                      </p>
                    </div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>{ev.at ? timeAgo(ev.at) : ''}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Alerts + quick links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {byStage.overdue.length > 0 && (
            <Link href="/dashboard/billing/invoices?status=overdue" className="le-card" style={{ padding: '14px 16px', textDecoration: 'none', display: 'block', borderInlineStart: '3px solid var(--warning)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="alert-triangle" size={18} color="var(--warning)" />
                <div>
                  <p style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--warning)', margin: 0 }}><bdi dir="ltr">{byStage.overdue.length}</bdi> فواتير متأخرة</p>
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: '2px 0 0' }}>تحتاج متابعة فورية</p>
                </div>
              </div>
            </Link>
          )}
          {trialsExpiring.length > 0 && (
            <Link href="/dashboard/billing/subscriptions?status=trial" className="le-card" style={{ padding: '14px 16px', textDecoration: 'none', display: 'block', borderInlineStart: '3px solid var(--warning)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="clock" size={18} color="var(--warning)" />
                <div>
                  <p style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--warning)', margin: 0 }}><bdi dir="ltr">{trialsExpiring.length}</bdi> تجارب تنتهي قريباً</p>
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: '2px 0 0' }}>خلال 7 أيام</p>
                </div>
              </div>
            </Link>
          )}
          {byStage.suspended.length > 0 && (
            <Link href="/dashboard/companies?status=suspended" className="le-card" style={{ padding: '14px 16px', textDecoration: 'none', display: 'block', borderInlineStart: '3px solid var(--danger)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="x-circle" size={18} color="var(--danger)" />
                <div>
                  <p style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--danger)', margin: 0 }}><bdi dir="ltr">{byStage.suspended.length}</bdi> شركات موقوفة</p>
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: '2px 0 0' }}>بسبب عدم الدفع</p>
                </div>
              </div>
            </Link>
          )}
          {byStage.overdue.length === 0 && trialsExpiring.length === 0 && byStage.suspended.length === 0 && (
            <div className="le-card" style={{ padding: '24px 16px', textAlign: 'center' }}>
              <Icon name="check-circle" size={28} color="var(--success)" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--success)', margin: 0 }}>لا توجد تنبيهات</p>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: '4px 0 0' }}>كل شيء يعمل بشكل طبيعي</p>
            </div>
          )}

          {/* Quick links */}
          <div className="le-card">
            <div className="le-card-h">
              <span className="le-card-t" style={{ fontSize: 'var(--fs-sm)' }}>وصول سريع</span>
            </div>
            <div style={{ padding: '6px 8px' }}>
              {QUICK_LINKS.map(link => (
                <Link key={link.href} href={link.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 'var(--r-md)', fontSize: 'var(--fs-md)', color: 'var(--text-1)', textDecoration: 'none', transition: 'background .1s', marginBottom: 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-100)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon name={link.icon} size={14} color="var(--text-3)" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
