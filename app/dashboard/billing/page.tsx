'use client';
import Link from 'next/link';
import { useBilling } from './layout';
import { fmt, fmtDate, lcOf, daysUntil, PLAN_AR, PLAN_PRICE, PLAN_C, INV_STATUS } from '@/lib/billing-helpers';

function StatCard({ label, value, sub, color = '#1a1a2e' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: '18px 22px', flex: 1 }}>
      <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px', fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, color, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

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
  const { companies, stats, invoices, loading } = useBilling();

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: '#6b7280' }}>جاري التحميل...</div>;

  const safeCompanies = Array.isArray(companies) ? companies : [];
  const safeInvoices  = Array.isArray(invoices) ? invoices : [];

  const trialCompanies     = safeCompanies.filter(c => lcOf(c) === 'trial');
  const trialsExpiringSoon = trialCompanies.filter(c => c.trial_ends_at && daysUntil(c.trial_ends_at) <= 7);
  const suspendedCompanies = safeCompanies.filter(c => lcOf(c) === 'suspended');
  const overdueInvoices    = safeInvoices.filter(i => i.status === 'overdue');

  const planDist: Record<string, number> = {};
  for (const c of safeCompanies) planDist[c.plan] = (planDist[c.plan] || 0) + 1;

  // Revenue chart data
  const chartData = buildRevenueChart(safeInvoices);
  const maxRev = Math.max(...chartData.map(m => m.paid + m.pending), 1);

  // Churn: suspended / (active + suspended) last 30 days
  const activeCount = safeCompanies.filter(c => c.is_active && c.plan !== 'trial').length;
  const suspCount   = suspendedCompanies.length;
  const churnRate   = activeCount + suspCount > 0 ? Math.round((suspCount / (activeCount + suspCount)) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: '#1a1a2e' }}>نظرة عامة</h2>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard label="MRR" value={`${fmt(stats?.mrr || 0)} ر.س`} sub="الإيرادات الشهرية المتكررة" color="#16a34a" />
        <StatCard label="إجمالي محصّل" value={`${fmt(stats?.total_paid_sar || 0)} ر.س`} color="#16a34a" />
        <StatCard label="فواتير معلقة" value={`${fmt(stats?.total_pending_sar || 0)} ر.س`} sub={`${safeInvoices.filter(i => ['draft','sent','issued'].includes(i.status)).length} فاتورة`} color="#c2410c" />
        <StatCard label="معدل الانسحاب" value={`${churnRate}%`} sub={`${suspCount} موقوفة من ${activeCount + suspCount}`} color={churnRate > 5 ? '#dc2626' : '#1a1a2e'} />
      </div>

      {/* Revenue chart */}
      <div className="card" style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: '22px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#1a1a2e' }}>الإيرادات (آخر 12 شهر)</h3>
          <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#16a34a', display: 'inline-block' }} /> محصّل
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#c2410c', opacity: .4, display: 'inline-block' }} /> معلق
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160 }}>
          {chartData.map(m => {
            const paidH = Math.round((m.paid / maxRev) * 140);
            const pendH = Math.round((m.pending / maxRev) * 140);
            return (
              <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 140, width: '100%', gap: 1 }}>
                  {m.pending > 0 && (
                    <div style={{ height: pendH, background: '#c2410c', opacity: .35, borderRadius: '4px 4px 0 0', minHeight: pendH > 0 ? 3 : 0 }} title={`معلق: ${fmt(Math.round(m.pending))} ر.س`} />
                  )}
                  <div style={{ height: paidH, background: '#16a34a', borderRadius: m.pending > 0 ? '0 0 4px 4px' : '4px', minHeight: paidH > 0 ? 3 : 0 }} title={`محصّل: ${fmt(Math.round(m.paid))} ر.س`} />
                </div>
                <span style={{ fontSize: 9, color: '#9ca3af', marginTop: 6, fontWeight: 500 }}>{m.label.slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        {/* Plan distribution */}
        <div className="card" style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: '22px 26px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 20px', color: '#1a1a2e' }}>توزيع الشركات حسب الخطة</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {['enterprise', 'professional', 'basic', 'trial'].map(plan => {
              const count = planDist[plan] || 0;
              const pct   = Math.round((count / Math.max(safeCompanies.length, 1)) * 100);
              const pc    = PLAN_C[plan] || PLAN_C.basic;
              const mrr   = count * (PLAN_PRICE[plan] || 0);
              return (
                <div key={plan}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 7, background: pc.bg, color: pc.color, fontWeight: 600, border: `1px solid ${pc.border}` }}>
                        {PLAN_AR[plan]}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{count} شركة</span>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      {mrr > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>{fmt(mrr)} ر.س/شهر</span>}
                      <span style={{ fontSize: 11, color: '#6b7280', display: 'block', textAlign: 'left' }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: '#f0f0f0' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pc.color, borderRadius: 3, opacity: 0.7, transition: 'width .5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {trialsExpiringSoon.length > 0 && (
            <div className="card" style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: '18px 20px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#854d0e', margin: '0 0 12px' }}>تجارب تنتهي قريبا ({trialsExpiringSoon.length})</p>
              {trialsExpiringSoon.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>{c.name}</p>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: daysUntil(c.trial_ends_at) <= 2 ? '#dc2626' : '#854d0e' }}>
                      {daysUntil(c.trial_ends_at)} يوم
                    </span>
                    <Link href={`/dashboard/companies/${c.id}`} style={{ display: 'block', fontSize: 10, color: '#6b7280', textDecoration: 'none', marginTop: 2 }}>ادارة</Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {overdueInvoices.length > 0 && (
            <div className="card" style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: '18px 20px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#c2410c', margin: '0 0 12px' }}>فواتير متأخرة ({overdueInvoices.length})</p>
              {overdueInvoices.slice(0, 5).map(inv => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>{inv.companies?.name || inv.company?.name}</p>
                    <p style={{ fontSize: 10, color: '#6b7280', margin: 0 }}>{inv.invoice_number} &middot; {fmt(inv.total_sar)} ر.س</p>
                  </div>
                  <Link href="/dashboard/billing/invoices" style={{ fontSize: 10, padding: '4px 8px', borderRadius: 7, background: '#f8f7fc', border: '1px solid rgba(0,0,0,.08)', color: '#6b7280', textDecoration: 'none' }}>
                    عرض
                  </Link>
                </div>
              ))}
              {overdueInvoices.length > 5 && (
                <Link href="/dashboard/billing/invoices" style={{ marginTop: 8, display: 'block', fontSize: 11, color: '#6b7280', textDecoration: 'none' }}>
                  عرض الكل ({overdueInvoices.length})
                </Link>
              )}
            </div>
          )}

          {suspendedCompanies.length > 0 && (
            <div className="card" style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: '18px 20px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', margin: '0 0 12px' }}>موقوفة ({suspendedCompanies.length})</p>
              {suspendedCompanies.slice(0, 4).map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>{c.name}</p>
                  <Link href={`/dashboard/companies/${c.id}`} style={{ fontSize: 11, color: '#dc2626', textDecoration: 'none' }}>مراجعة</Link>
                </div>
              ))}
            </div>
          )}

          {trialsExpiringSoon.length === 0 && overdueInvoices.length === 0 && suspendedCompanies.length === 0 && (
            <div className="card" style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: '24px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#16a34a', margin: '0 0 4px' }}>لا توجد تنبيهات</p>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>كل شيء يعمل بشكل طبيعي</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
