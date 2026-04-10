'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useEvents, DashboardEvent } from '@/lib/useEvents';

function lcOf(c: any): string {
  if (c.lifecycle_status) return c.lifecycle_status;
  if (!c.is_active) return 'suspended';
  if (c.plan === 'trial') return 'trial';
  return 'active';
}

const LC: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  trial:     { bg: '#fef9c3', color: '#854d0e', dot: '#f59e0b', label: 'تجريبي' },
  active:    { bg: '#dcfce7', color: '#15803d', dot: '#22c55e', label: 'نشط' },
  overdue:   { bg: '#ffedd5', color: '#c2410c', dot: '#f97316', label: 'متأخر' },
  suspended: { bg: '#fee2e2', color: '#dc2626', dot: '#ef4444', label: 'موقوف' },
};

const PLAN_AR: Record<string, string> = { trial: 'تجريبي', basic: 'أساسي', professional: 'احترافي', enterprise: 'مؤسسي' };

function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }
function fmt(n: number) { return n.toLocaleString('ar-SA'); }
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'الآن';
  if (s < 3600) return `منذ ${Math.floor(s/60)} د`;
  if (s < 86400) return `منذ ${Math.floor(s/3600)} س`;
  return `منذ ${Math.floor(s/86400)} ي`;
}

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  payment_received:     { icon: '💰', color: '#16a34a' },
  payment_failed:       { icon: '❌', color: '#ef4444' },
  company_created:      { icon: '🏢', color: '#2563EB' },
  subscription_changed: { icon: '🔄', color: '#0ea5e9' },
  invoice_overdue:      { icon: '⏰', color: '#f97316' },
  trial_expiring:       { icon: '⚠️', color: '#f59e0b' },
  connected:            { icon: '🟢', color: '#10b981' },
};

export default function AdminDashboard() {
  const router = useRouter();
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
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #DBEAFE', borderTopColor: '#2563EB', animation: 'spin .7s linear infinite' }} />
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

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1E293B', margin: 0 }}>لوحة التحكم</h1>
            {isConnected && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', animation: 'pulse-dot 2s infinite' }} />
                مباشر
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
            {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/dashboard/companies/new"
          style={{ fontSize: 12, padding: '10px 22px', borderRadius: 10, background: '#2563EB', color: '#fff', textDecoration: 'none', fontWeight: 600, boxShadow: '0 2px 8px rgba(124,92,252,.2)' }}>
          + إضافة شركة
        </Link>
      </div>

      {/* ── Revenue KPIs (6-col) ─────────────────────────────────── */}
      <div className="stagger-enter" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'MRR', value: `${fmt(m.mrr || 0)}`, unit: 'ر.س', color: '#2563EB', sub: `ARR: ${fmt(m.arr || 0)}` },
          { label: 'ARPU', value: `${fmt(m.arpu || 0)}`, unit: 'ر.س', color: '#10b981', sub: `LTV: ${fmt(m.ltv || 0)}` },
          { label: 'الانسحاب', value: `${m.churn_rate || 0}%`, unit: '', color: (m.churn_rate||0) > 5 ? '#ef4444' : (m.churn_rate||0) > 3 ? '#f59e0b' : '#10b981', sub: `NRR: ${m.nrr || 100}%` },
          { label: 'عملاء يدفعون', value: `${m.total_paying || 0}`, unit: '', color: '#0ea5e9', sub: `من ${companies.length}` },
          { label: 'محصّل الشهر', value: `${fmt(m.collected_this_month || 0)}`, unit: 'ر.س', color: '#16a34a', sub: '' },
          { label: 'معرّض للخطر', value: `${fmt(m.at_risk_revenue || 0)}`, unit: 'ر.س', color: (m.at_risk_revenue||0) > 0 ? '#f97316' : '#9ca3af', sub: '' },
        ].map((k, i) => (
          <div key={k.label} className="card fade-in" style={{ padding: '18px 16px', animationDelay: `${i * 0.04}s`, borderRight: `3px solid ${k.color}` }}>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#1E293B', margin: 0, lineHeight: 1 }}>
              {k.value} <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>{k.unit}</span>
            </p>
            {k.sub && <p style={{ fontSize: 10, color: '#9ca3af', margin: '6px 0 0' }}>{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Lifecycle Pipeline (horizontal bar) ──────────────────── */}
      <div className="card" style={{ padding: '18px 22px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#1E293B' }}>دورة حياة الشركات</h2>
          <Link href="/dashboard/companies" style={{ fontSize: 11, color: '#2563EB', textDecoration: 'none' }}>عرض الكل →</Link>
        </div>
        {/* Segmented bar */}
        <div style={{ display: 'flex', height: 32, borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
          {[
            { key: 'active', count: byStage.active.length, color: '#22c55e' },
            { key: 'trial', count: byStage.trial.length, color: '#f59e0b' },
            { key: 'overdue', count: byStage.overdue.length, color: '#f97316' },
            { key: 'suspended', count: byStage.suspended.length, color: '#ef4444' },
          ].map(seg => {
            const pct = companies.length ? (seg.count / companies.length) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div key={seg.key} style={{ width: `${pct}%`, background: seg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: seg.count > 0 ? 40 : 0, transition: 'width .5s' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{seg.count}</span>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'نشط', count: byStage.active.length, color: '#22c55e' },
            { label: 'تجريبي', count: byStage.trial.length, color: '#f59e0b' },
            { label: 'متأخر', count: byStage.overdue.length, color: '#f97316' },
            { label: 'موقوف', count: byStage.suspended.length, color: '#ef4444' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
              <span style={{ fontSize: 11, color: '#6b7280' }}>{l.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{l.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-Column: Activity Feed + Alerts ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>

        {/* Real-time Activity Feed */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#1E293B' }}>النشاط المباشر</h2>
            <span style={{ fontSize: 10, color: isConnected ? '#16a34a' : '#9ca3af', fontWeight: 500 }}>
              {isConnected ? 'متصل' : 'غير متصل'}
            </span>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {events.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                في انتظار الأحداث...
              </div>
            ) : (
              events.filter(e => e.type !== 'connected' && e.type !== 'ping').map((ev: DashboardEvent, i: number) => {
                const cfg = EVENT_ICONS[ev.type] || { icon: '📋', color: '#6b7280' };
                return (
                  <div key={`${ev.at}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,.03)', animation: i === 0 ? 'fadeIn .4s ease' : undefined }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{cfg.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.company || ev.name || ev.invoice || ev.type}
                      </p>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0' }}>
                        {ev.amount ? `${fmt(Number(ev.amount))} ر.س` : ''} {ev.plan || ''} {ev.method || ''}
                      </p>
                    </div>
                    <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{ev.at ? timeAgo(ev.at) : ''}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Alerts & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Overdue invoices */}
          {byStage.overdue.length > 0 && (
            <Link href="/dashboard/billing/invoices?status=overdue" className="card" style={{ padding: '16px 18px', textDecoration: 'none', borderRight: '3px solid #f97316' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🔴</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#c2410c', margin: 0 }}>{byStage.overdue.length} فواتير متأخرة</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>تحتاج متابعة فورية</p>
                </div>
              </div>
            </Link>
          )}

          {/* Trials expiring */}
          {trialsExpiring.length > 0 && (
            <Link href="/dashboard/billing/subscriptions?status=trial" className="card" style={{ padding: '16px 18px', textDecoration: 'none', borderRight: '3px solid #f59e0b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🟡</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#854d0e', margin: 0 }}>{trialsExpiring.length} تجارب تنتهي قريباً</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>خلال 7 أيام</p>
                </div>
              </div>
            </Link>
          )}

          {/* Suspended */}
          {byStage.suspended.length > 0 && (
            <Link href="/dashboard/companies?status=suspended" className="card" style={{ padding: '16px 18px', textDecoration: 'none', borderRight: '3px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>⛔</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', margin: 0 }}>{byStage.suspended.length} شركات موقوفة</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>بسبب عدم الدفع</p>
                </div>
              </div>
            </Link>
          )}

          {/* All clear */}
          {byStage.overdue.length === 0 && trialsExpiring.length === 0 && byStage.suspended.length === 0 && (
            <div className="card" style={{ padding: '28px 18px', textAlign: 'center' }}>
              <span style={{ fontSize: 28 }}>✅</span>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#16a34a', margin: '8px 0 0' }}>لا توجد تنبيهات</p>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>كل شيء يعمل بشكل طبيعي</p>
            </div>
          )}

          {/* Quick links */}
          <div className="card" style={{ padding: '14px 18px' }}>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 10px', fontWeight: 600 }}>وصول سريع</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { href: '/dashboard/billing/invoices', label: 'الفواتير', icon: '📄' },
                { href: '/dashboard/billing/subscriptions', label: 'الاشتراكات', icon: '💳' },
                { href: '/dashboard/features', label: 'إدارة المميزات', icon: '⚙️' },
                { href: '/dashboard/billing', label: 'نظرة عامة — الفوترة', icon: '📊' },
              ].map(link => (
                <Link key={link.href} href={link.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, fontSize: 12, color: '#6b7280', textDecoration: 'none', transition: 'background .12s' }}>
                  <span>{link.icon}</span> {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          div[style*="repeat(6"] { grid-template-columns: repeat(3, 1fr) !important; }
          div[style*="1fr 360px"] { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          div[style*="repeat(3"] { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
