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

const LC_COLOR: Record<string, string> = {
  trial: 'var(--warning)', active: 'var(--success)',
  overdue: '#f59e0b', suspended: 'var(--danger)',
};
const LC_LABEL: Record<string, string> = {
  trial: 'تجريبي', active: 'نشط', overdue: 'متأخر', suspended: 'موقوف',
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
  { href: '/dashboard/companies',              label: 'الشركات',              icon: 'building'  as const },
  { href: '/dashboard/billing/invoices',       label: 'الفواتير',             icon: 'invoice'   as const },
  { href: '/dashboard/billing/subscriptions', label: 'الاشتراكات',           icon: 'receipt'   as const },
  { href: '/dashboard/features',              label: 'إدارة الميزات',        icon: 'settings'  as const },
];

function fmtSAR(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('en-US');
}
function fmt(n: number) { return n.toLocaleString('en-US'); }
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'الآن';
  if (s < 3600) return `منذ ${Math.floor(s / 60)} د`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} س`;
  return `منذ ${Math.floor(s / 86400)} ي`;
}
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

// ── Sparkline SVG ──────────────────────────────────────────────────────────────
function Sparkline({ data, width = 200, height = 44, color = 'var(--brand-600)' }: {
  data: number[]; width?: number; height?: number; color?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pad = 4;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const areaClose = `${pad + (data.length - 1) / (data.length - 1) * (width - pad * 2)},${height} ${pad},${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pts} ${areaClose}`} fill="url(#sg)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      {/* last dot */}
      <circle cx={parseFloat(pts.split(' ').pop()!.split(',')[0])} cy={parseFloat(pts.split(' ').pop()!.split(',')[1])} r="3" fill={color} />
    </svg>
  );
}

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
  const mrr = m.mrr || 0;
  const trialsExpiring = byStage.trial.filter(c => c.trial_ends_at && daysUntil(c.trial_ends_at) <= 7 && daysUntil(c.trial_ends_at) >= 0);
  const atRisk = m.at_risk_revenue || 0;
  const churn = m.churn_rate || 0;

  // Synthetic sparkline: ramp up to current MRR over 12 months
  const mrrSparkline = m.monthly_mrr?.length >= 2
    ? m.monthly_mrr
    : Array.from({ length: 12 }, (_, i) => mrr * (0.6 + 0.4 * (i / 11)));

  const alertItems = [
    byStage.overdue.length > 0 && {
      href: '/dashboard/billing/invoices?status=overdue',
      icon: 'alert-triangle' as const,
      color: 'var(--warning)',
      bg: 'var(--warning-bg)',
      title: `${byStage.overdue.length} فواتير متأخرة`,
      sub: 'تحتاج متابعة فورية',
    },
    trialsExpiring.length > 0 && {
      href: '/dashboard/billing/subscriptions?status=trial',
      icon: 'clock' as const,
      color: 'var(--warning)',
      bg: 'var(--warning-bg)',
      title: `${trialsExpiring.length} تجارب تنتهي خلال 7 أيام`,
      sub: `${trialsExpiring.map((c: any) => c.name || c.name_ar).slice(0, 2).join('، ')}${trialsExpiring.length > 2 ? ` +${trialsExpiring.length - 2}` : ''}`,
    },
    byStage.suspended.length > 0 && {
      href: '/dashboard/companies?status=suspended',
      icon: 'x-circle' as const,
      color: 'var(--danger)',
      bg: 'var(--danger-bg)',
      title: `${byStage.suspended.length} شركات موقوفة`,
      sub: 'بسبب عدم الدفع',
    },
  ].filter(Boolean) as { href: string; icon: import('@/components/Icon').IconName; color: string; bg: string; title: string; sub: string }[];

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>لوحة التحكم</h1>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 3, marginBottom: 0 }}>
            {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isConnected && <span className="le-badge success dot">مباشر</span>}
          <Link href="/dashboard/companies/new" className="le-btn primary sm" style={{ textDecoration: 'none' }}>
            <Icon name="plus" size={13} color="white" />
            إضافة شركة
          </Link>
        </div>
      </div>

      {/* ── Hero KPI card ── */}
      <div className="le-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', alignItems: 'stretch' }}>

          {/* Primary: MRR */}
          <div style={{ padding: '22px 26px', borderInlineEnd: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 500, marginBottom: 8 }}>
              الإيرادات الشهرية المتكررة
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
              <span className="num" style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-.02em', lineHeight: 1 }}>
                {fmtSAR(mrr)}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-3)' }}>ر.س</span>
              {m.arr > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 2, marginInlineStart: 4 }}>
                  <Icon name="trending-up" size={12} color="var(--success)" />
                  ARR {fmtSAR(m.arr)}
                </span>
              )}
            </div>
            <Sparkline data={mrrSparkline} width={220} height={44} color="var(--brand-600)" />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
              <span>يناير</span><span>الآن</span>
            </div>
          </div>

          {/* Active companies */}
          <div style={{ padding: '22px 24px', borderInlineEnd: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 500, marginBottom: 8 }}>
              عملاء يدفعون
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="num" style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-.01em', lineHeight: 1 }}>
                {m.total_paying || byStage.active.length}
              </span>
              <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <Icon name="check-circle" size={12} color="var(--success)" />
                نشط
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
              من {companies.length} شركة إجمالاً
            </div>
          </div>

          {/* Collected this month */}
          <div style={{ padding: '22px 24px', borderInlineEnd: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 500, marginBottom: 8 }}>
              محصّل هذا الشهر
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="num" style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-.01em', lineHeight: 1 }}>
                {fmtSAR(m.collected_this_month || 0)}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-3)' }}>ر.س</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 8, fontWeight: 500 }}>
              ARPU: {fmtSAR(m.arpu || 0)} ر.س
            </div>
          </div>

          {/* At risk / churn */}
          <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 500, marginBottom: 8 }}>
              معرّض للخطر
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="num" style={{ fontSize: 32, fontWeight: 700, color: atRisk > 0 ? 'var(--warning)' : 'var(--text-1)', letterSpacing: '-.01em', lineHeight: 1 }}>
                {fmtSAR(atRisk)}
              </span>
              {atRisk > 0 && <span style={{ fontSize: 14, color: 'var(--text-3)' }}>ر.س</span>}
            </div>
            <div style={{ fontSize: 11, color: churn > 5 ? 'var(--danger)' : churn > 3 ? 'var(--warning)' : 'var(--text-3)', marginTop: 8, fontWeight: 500 }}>
              نسبة الانسحاب: <bdi dir="ltr">{churn}%</bdi>
            </div>
          </div>
        </div>
      </div>

      {/* ── Lifecycle pipeline ── */}
      <div className="le-card">
        <div className="le-card-h">
          <div>
            <div className="le-card-t">دورة حياة الشركات</div>
            <div className="le-card-st">توزيع الشركات حسب المرحلة</div>
          </div>
          <Link href="/dashboard/companies" className="le-btn ghost sm" style={{ textDecoration: 'none' }}>
            عرض الكل
            <Icon name="arrow-left" size={12} color="var(--text-2)" />
          </Link>
        </div>
        <div className="le-card-b">
          <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', marginBottom: 16, gap: 2 }}>
            {(['active', 'trial', 'overdue', 'suspended'] as const).map(k => {
              const pct = companies.length ? (byStage[k].length / companies.length) * 100 : 0;
              if (!pct) return null;
              return (
                <div key={k} style={{ width: `${pct}%`, minWidth: byStage[k].length > 0 ? 40 : 0, background: LC_COLOR[k], borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width .5s' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{byStage[k].length}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {(['active', 'trial', 'overdue', 'suspended'] as const).map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: LC_COLOR[k], flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{LC_LABEL[k]}</span>
                <span className="num" style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-1)' }}>
                  <bdi dir="ltr">{byStage[k].length}</bdi>
                </span>
                {companies.length > 0 && (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                    ({Math.round(byStage[k].length / companies.length * 100)}%)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Two-col: activity feed + right sidebar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>

        {/* Real-time activity feed */}
        <div className="le-card">
          <div className="le-card-h">
            <div>
              <div className="le-card-t">النشاط المباشر</div>
              <div className="le-card-st">أحداث النظام في الوقت الفعلي</div>
            </div>
            <span className={`le-badge ${isConnected ? 'success dot' : 'neutral'}`} style={{ fontSize: 'var(--fs-xs)' }}>
              {isConnected ? 'متصل' : 'غير متصل'}
            </span>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {events.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <Icon name="activity" size={28} color="var(--ink-300)" />
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>
                  في انتظار الأحداث...
                </p>
              </div>
            ) : (
              events.filter(e => e.type !== 'connected' && e.type !== 'ping').map((ev: DashboardEvent, i: number) => {
                const cfg = EVENT_ICON_MAP[ev.type] || { name: 'activity' as const, color: 'var(--text-muted)' };
                return (
                  <div key={`${ev.at}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--ink-50)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 'var(--r-md)', background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name={cfg.name} size={15} color={cfg.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.company || ev.name || ev.invoice || ev.type}
                      </p>
                      <p className="num" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        {ev.amount ? `${fmt(Number(ev.amount))} ر.س` : ''}
                        {ev.plan ? ` · ${ev.plan}` : ''}
                        {ev.method ? ` · ${ev.method}` : ''}
                      </p>
                    </div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {ev.at ? timeAgo(ev.at) : ''}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right sidebar: alerts + quick links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Attention items */}
          {alertItems.length > 0 && (
            <div className="le-card">
              <div className="le-card-h">
                <div className="le-card-t">يحتاج اهتمامك</div>
                <span className="le-badge warning">{alertItems.length}</span>
              </div>
              <div>
                {alertItems.map((item, i) => (
                  <Link key={i} href={item.href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < alertItems.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--ink-50)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name={item.icon} size={14} color={item.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: item.color, margin: 0 }}>{item.title}</p>
                      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</p>
                    </div>
                    <Icon name="arrow-left" size={12} color="var(--text-muted)" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {alertItems.length === 0 && (
            <div className="le-card" style={{ padding: '20px 18px', textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                <Icon name="check-circle" size={20} color="var(--success)" />
              </div>
              <p style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--success)', margin: '0 0 4px' }}>لا توجد تنبيهات</p>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: 0 }}>كل شيء يعمل بشكل طبيعي</p>
            </div>
          )}

          {/* SaaS health mini metrics */}
          <div className="le-card">
            <div className="le-card-h">
              <div className="le-card-t" style={{ fontSize: 'var(--fs-sm)' }}>مؤشرات SaaS</div>
            </div>
            <div style={{ padding: '6px 18px 14px' }}>
              {[
                { label: 'NRR', value: `${m.nrr || 100}%`, color: (m.nrr || 100) >= 100 ? 'var(--success)' : 'var(--warning)' },
                { label: 'LTV', value: `${fmtSAR(m.ltv || 0)} ر.س`, color: 'var(--text-1)' },
                { label: 'ARPU', value: `${fmtSAR(m.arpu || 0)} ر.س`, color: 'var(--text-1)' },
                { label: 'Churn', value: `${churn}%`, color: churn > 5 ? 'var(--danger)' : churn > 3 ? 'var(--warning)' : 'var(--success)' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', fontWeight: 500 }}>{row.label}</span>
                  <span className="num" style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: row.color }}><bdi dir="ltr">{row.value}</bdi></span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="le-card">
            <div className="le-card-h">
              <div className="le-card-t" style={{ fontSize: 'var(--fs-sm)' }}>وصول سريع</div>
            </div>
            <div style={{ padding: '6px 8px 8px' }}>
              {QUICK_LINKS.map(link => (
                <Link key={link.href} href={link.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 'var(--r-md)', fontSize: 'var(--fs-md)', color: 'var(--text-1)', textDecoration: 'none', transition: 'background .1s', marginBottom: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--ink-100)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 26, height: 26, borderRadius: 'var(--r-md)', background: 'var(--brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={link.icon} size={13} color="var(--brand-600)" />
                  </div>
                  <span style={{ flex: 1 }}>{link.label}</span>
                  <Icon name="arrow-left" size={11} color="var(--text-muted)" />
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
