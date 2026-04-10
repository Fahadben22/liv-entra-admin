'use client';
import Link from 'next/link';
import { useBilling } from './layout';
import { fmt, fmtDate, lcOf, daysUntil, PLAN_AR, PLAN_PRICE, PLAN_C, INV_STATUS } from '@/lib/billing-helpers';

const MONTH_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function buildRevenueChart(invoices: any[]) {
  const now = new Date();
  const months: { key: string; label: string; paid: number; pending: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: MONTH_AR[d.getMonth()], paid: 0, pending: 0 });
  }
  for (const inv of invoices) {
    const dt = inv.paid_at || inv.issued_at || inv.created_at;
    if (!dt) continue;
    const d = new Date(dt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const m = months.find(x => x.key === key);
    if (!m) continue;
    const amt = Number(inv.total_sar || inv.total_amount_sar || 0);
    if (inv.status === 'paid') m.paid += amt;
    else if (['issued', 'sent', 'overdue', 'pending'].includes(inv.status)) m.pending += amt;
  }
  return months;
}

export default function BillingOverview() {
  const { companies, stats, invoices, metrics, loading } = useBilling();

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: '#6b7280' }}>جاري التحميل...</div>;

  const safeCompanies = Array.isArray(companies) ? companies : [];
  const safeInvoices  = Array.isArray(invoices) ? invoices : [];
  const m = metrics || {};

  const trialsExpiringSoon = safeCompanies.filter(c => lcOf(c) === 'trial' && c.trial_ends_at && daysUntil(c.trial_ends_at) <= 7);
  const suspendedCompanies = safeCompanies.filter(c => lcOf(c) === 'suspended');
  const overdueInvoices    = safeInvoices.filter(i => i.status === 'overdue');

  const planDist: Record<string, number> = {};
  for (const c of safeCompanies) planDist[c.plan] = (planDist[c.plan] || 0) + 1;

  const chartData = buildRevenueChart(safeInvoices);
  const maxRev = Math.max(...chartData.map(mo => mo.paid + mo.pending), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1E293B' }}>نظرة عامة</h2>

      {/* ── KPI Row (4 cards with colored left border) ────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'MRR', value: `${fmt(m.mrr || stats?.mrr || 0)} ر.س`, color: '#2563EB', sub: `ARR: ${fmt(m.arr || 0)}` },
          { label: 'إجمالي محصّل', value: `${fmt(m.collected_this_month || stats?.total_paid_sar || 0)} ر.س`, color: '#16a34a', sub: 'هذا الشهر' },
          { label: 'فواتير معلقة', value: `${fmt(stats?.total_pending_sar || 0)} ر.س`, color: '#c2410c', sub: `${safeInvoices.filter(i => ['draft','sent','issued'].includes(i.status)).length} فاتورة` },
          { label: 'معدل الانسحاب', value: `${m.churn_rate || 0}%`, color: (m.churn_rate||0) > 5 ? '#dc2626' : '#1E293B', sub: `NRR: ${m.nrr || 100}%` },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '18px 20px', borderRight: `3px solid ${k.color}` }}>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 8px', fontWeight: 600, letterSpacing: '.04em' }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#1E293B', margin: 0, lineHeight: 1 }}>{k.value}</p>
            {k.sub && <p style={{ fontSize: 10, color: '#9ca3af', margin: '6px 0 0' }}>{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Revenue Chart (full width) ───────────────────────────── */}
      <div className="card" style={{ padding: '22px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#1E293B' }}>الإيرادات (آخر 12 شهر)</h3>
          <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#16a34a', display: 'inline-block' }} /> محصّل
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#c2410c', opacity: .4, display: 'inline-block' }} /> معلق
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 180 }}>
          {chartData.map(mo => {
            const paidH = Math.round((mo.paid / maxRev) * 160);
            const pendH = Math.round((mo.pending / maxRev) * 160);
            return (
              <div key={mo.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 160, width: '100%', gap: 1 }}>
                  {mo.pending > 0 && <div style={{ height: pendH, background: '#c2410c', opacity: .35, borderRadius: '4px 4px 0 0', minHeight: 3 }} title={`معلق: ${fmt(Math.round(mo.pending))} ر.س`} />}
                  <div style={{ height: paidH, background: '#16a34a', borderRadius: mo.pending > 0 ? '0 0 4px 4px' : '4px', minHeight: paidH > 0 ? 3 : 0 }} title={`محصّل: ${fmt(Math.round(mo.paid))} ر.س`} />
                </div>
                <span style={{ fontSize: 9, color: '#9ca3af', marginTop: 6, fontWeight: 500 }}>{mo.label.slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Three-column insights ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {/* Plan Distribution */}
        <div className="card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 18px', color: '#1E293B' }}>توزيع الخطط</h3>
          {['enterprise', 'professional', 'basic', 'trial'].map(plan => {
            const count = planDist[plan] || 0;
            const pct = Math.round((count / Math.max(safeCompanies.length, 1)) * 100);
            const pc = PLAN_C[plan] || PLAN_C.basic;
            return (
              <div key={plan} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 7, background: pc.bg, color: pc.color, fontWeight: 600, border: `1px solid ${pc.border}` }}>{PLAN_AR[plan]}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{count}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: '#f0f0f0' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pc.color, borderRadius: 3, opacity: 0.7, transition: 'width .5s' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* A/R Aging */}
        <div className="card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 18px', color: '#1E293B' }}>تقادم الذمم</h3>
          {(() => {
            const aging = m.aging || {};
            const buckets = [
              { label: 'حالي', value: aging.current || 0, color: '#16a34a' },
              { label: '1-30 يوم', value: aging.d30 || 0, color: '#f59e0b' },
              { label: '31-60', value: aging.d60 || 0, color: '#f97316' },
              { label: '61-90', value: aging.d90 || 0, color: '#ef4444' },
              { label: '+90', value: aging.d90plus || 0, color: '#dc2626' },
            ];
            const total = buckets.reduce((s, b) => s + b.value, 0);
            return (
              <>
                {buckets.map(b => {
                  const pct = total > 0 ? Math.round((b.value / total) * 100) : 0;
                  return (
                    <div key={b.label} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>{b.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: b.color }}>{fmt(Math.round(b.value))}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: '#f0f0f0' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: b.color, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(0,0,0,.06)', marginTop: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>الإجمالي</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{fmt(Math.round(total))} ر.س</span>
                </div>
              </>
            );
          })()}
        </div>

        {/* SaaS Metrics */}
        <div className="card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 18px', color: '#1E293B' }}>مقاييس SaaS</h3>
          {[
            { label: 'ARPU', value: `${fmt(m.arpu || 0)} ر.س`, desc: 'متوسط الإيراد / عميل' },
            { label: 'LTV', value: `${fmt(m.ltv || 0)} ر.س`, desc: 'القيمة الدائمة' },
            { label: 'NRR', value: `${m.nrr || 100}%`, desc: 'صافي الاحتفاظ' },
            { label: 'عملاء يدفعون', value: `${m.total_paying || 0}`, desc: `من ${safeCompanies.length} شركة` },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
              <div>
                <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: 9, color: '#9ca3af', margin: '2px 0 0' }}>{item.desc}</p>
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', margin: 0 }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Compact Alerts Row ────────────────────────────────────── */}
      {(trialsExpiringSoon.length > 0 || overdueInvoices.length > 0 || suspendedCompanies.length > 0) && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {trialsExpiringSoon.length > 0 && (
            <Link href="/dashboard/billing/subscriptions?status=trial" className="card" style={{ flex: 1, minWidth: 200, padding: '14px 18px', textDecoration: 'none', borderRight: '3px solid #f59e0b' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#854d0e', margin: 0 }}>⚠️ {trialsExpiringSoon.length} تجربة تنتهي قريباً</p>
            </Link>
          )}
          {overdueInvoices.length > 0 && (
            <Link href="/dashboard/billing/invoices?status=overdue" className="card" style={{ flex: 1, minWidth: 200, padding: '14px 18px', textDecoration: 'none', borderRight: '3px solid #f97316' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#c2410c', margin: 0 }}>🔴 {overdueInvoices.length} فاتورة متأخرة</p>
            </Link>
          )}
          {suspendedCompanies.length > 0 && (
            <Link href="/dashboard/companies?status=suspended" className="card" style={{ flex: 1, minWidth: 200, padding: '14px 18px', textDecoration: 'none', borderRight: '3px solid #ef4444' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', margin: 0 }}>⛔ {suspendedCompanies.length} موقوفة</p>
            </Link>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          div[style*="repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
          div[style*="1fr 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          div[style*="repeat(2"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
