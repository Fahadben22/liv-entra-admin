'use client';
import Link from 'next/link';
import { useBilling } from './layout';
import { fmt, fmtDate, lcOf, daysUntil, PLAN_AR, PLAN_PRICE, PLAN_C, INV_STATUS } from '@/lib/billing-helpers';

function StatCard({ label, value, sub, color = '#0f172a' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '20px 24px', flex: 1 }}>
      <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

export default function BillingOverview() {
  const { companies, stats, invoices, loading } = useBilling();

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>جاري التحميل...</div>;

  const safeCompanies = Array.isArray(companies) ? companies : [];
  const safeInvoices  = Array.isArray(invoices) ? invoices : [];

  const trialCompanies     = safeCompanies.filter(c => lcOf(c) === 'trial');
  const trialsExpiringSoon = trialCompanies.filter(c => c.trial_ends_at && daysUntil(c.trial_ends_at) <= 7);
  const suspendedCompanies = safeCompanies.filter(c => lcOf(c) === 'suspended');
  const overdueInvoices    = safeInvoices.filter(i => i.status === 'overdue');

  const planDist: Record<string, number> = {};
  for (const c of safeCompanies) planDist[c.plan] = (planDist[c.plan] || 0) + 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>نظرة عامة</h2>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard label="إجمالي محصّل"  value={`${fmt(stats?.total_paid_sar || 0)} ر.س`} color="#15803d" />
        <StatCard label="فواتير معلقة"  value={`${fmt(stats?.total_pending_sar || 0)} ر.س`} sub={`${safeInvoices.filter(i => ['draft','sent','issued'].includes(i.status)).length} فاتورة`} color="#c2410c" />
        <StatCard label="شركات نشطة"    value={safeCompanies.filter(c => c.is_active && c.plan !== 'trial').length} />
        <StatCard label="في التجربة"     value={trialCompanies.length} sub={trialsExpiringSoon.length > 0 ? `${trialsExpiringSoon.length} تنتهي هذا الأسبوع` : undefined} color={trialsExpiringSoon.length > 0 ? '#c2410c' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        {/* Plan distribution */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '22px 26px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 20px' }}>توزيع الشركات حسب الخطة</h3>
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
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 8, background: pc.bg, color: pc.color, fontWeight: 600, border: `1px solid ${pc.border}` }}>
                        {PLAN_AR[plan]}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{count} شركة</span>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      {mrr > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>{fmt(mrr)} ر.س/شهر</span>}
                      <span style={{ fontSize: 11, color: '#94a3b8', display: 'block', textAlign: 'left' }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 10, borderRadius: 5, background: '#f1f5f9' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pc.color, borderRadius: 5, opacity: 0.8, transition: 'width .5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {trialsExpiringSoon.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #fde68a', padding: '18px 20px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#854d0e', margin: '0 0 12px' }}>تجارب تنتهي قريبا ({trialsExpiringSoon.length})</p>
              {trialsExpiringSoon.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #fef9c3' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: 0 }}>{c.name}</p>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: daysUntil(c.trial_ends_at) <= 2 ? '#dc2626' : '#854d0e' }}>
                      {daysUntil(c.trial_ends_at)} يوم
                    </span>
                    <Link href={`/dashboard/companies/${c.id}`} style={{ display: 'block', fontSize: 10, color: '#1d4070', textDecoration: 'none', marginTop: 2 }}>ادارة</Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {overdueInvoices.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #fed7aa', padding: '18px 20px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#c2410c', margin: '0 0 12px' }}>فواتير متأخرة ({overdueInvoices.length})</p>
              {overdueInvoices.slice(0, 5).map(inv => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #fff7ed' }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', margin: 0 }}>{inv.companies?.name || inv.company?.name}</p>
                    <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>{inv.invoice_number}</p>
                  </div>
                  <Link href="/dashboard/billing/invoices" style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', textDecoration: 'none' }}>
                    عرض
                  </Link>
                </div>
              ))}
              {overdueInvoices.length > 5 && (
                <Link href="/dashboard/billing/invoices" style={{ marginTop: 8, display: 'block', fontSize: 11, color: '#1d4070', textDecoration: 'none' }}>
                  عرض الكل ({overdueInvoices.length})
                </Link>
              )}
            </div>
          )}

          {suspendedCompanies.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #fecaca', padding: '18px 20px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', margin: '0 0 12px' }}>موقوفة ({suspendedCompanies.length})</p>
              {suspendedCompanies.slice(0, 4).map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #fef2f2' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: 0 }}>{c.name}</p>
                  <Link href={`/dashboard/companies/${c.id}`} style={{ fontSize: 11, color: '#dc2626', textDecoration: 'none' }}>مراجعة</Link>
                </div>
              ))}
            </div>
          )}

          {trialsExpiringSoon.length === 0 && overdueInvoices.length === 0 && suspendedCompanies.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #bbf7d0', padding: '24px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 24, margin: '0 0 8px' }}>✅</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#15803d', margin: 0 }}>لا توجد تنبيهات</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>كل شيء يعمل بشكل طبيعي</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
