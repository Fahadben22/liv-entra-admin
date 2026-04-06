'use client';
import Link from 'next/link';
import { useBilling } from './layout';
import { fmt, fmtDate, lcOf, daysUntil, PLAN_AR, PLAN_PRICE, PLAN_C, INV_STATUS } from '@/lib/billing-helpers';

function StatCard({ label, value, sub, color = '#18181b' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', padding: '18px 22px', flex: 1 }}>
      <p style={{ fontSize: 11, color: '#a1a1aa', margin: '0 0 6px', fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, color, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#71717a', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

export default function BillingOverview() {
  const { companies, stats, invoices, loading } = useBilling();

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: '#a1a1aa' }}>جاري التحميل...</div>;

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
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: '#18181b' }}>نظرة عامة</h2>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard label="إجمالي محصّل"  value={`${fmt(stats?.total_paid_sar || 0)} ر.س`} color="#16a34a" />
        <StatCard label="فواتير معلقة"  value={`${fmt(stats?.total_pending_sar || 0)} ر.س`} sub={`${safeInvoices.filter(i => ['draft','sent','issued'].includes(i.status)).length} فاتورة`} color="#c2410c" />
        <StatCard label="شركات نشطة"    value={safeCompanies.filter(c => c.is_active && c.plan !== 'trial').length} />
        <StatCard label="في التجربة"     value={trialCompanies.length} sub={trialsExpiringSoon.length > 0 ? `${trialsExpiringSoon.length} تنتهي هذا الأسبوع` : undefined} color={trialsExpiringSoon.length > 0 ? '#c2410c' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        {/* Plan distribution */}
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', padding: '22px 26px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 20px', color: '#18181b' }}>توزيع الشركات حسب الخطة</h3>
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
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{count} شركة</span>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      {mrr > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>{fmt(mrr)} ر.س/شهر</span>}
                      <span style={{ fontSize: 11, color: '#a1a1aa', display: 'block', textAlign: 'left' }}>{pct}%</span>
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
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', padding: '18px 20px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#854d0e', margin: '0 0 12px' }}>تجارب تنتهي قريبا ({trialsExpiringSoon.length})</p>
              {trialsExpiringSoon.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#18181b', margin: 0 }}>{c.name}</p>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: daysUntil(c.trial_ends_at) <= 2 ? '#dc2626' : '#854d0e' }}>
                      {daysUntil(c.trial_ends_at)} يوم
                    </span>
                    <Link href={`/dashboard/companies/${c.id}`} style={{ display: 'block', fontSize: 10, color: '#18181b', textDecoration: 'none', marginTop: 2 }}>ادارة</Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {overdueInvoices.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', padding: '18px 20px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#c2410c', margin: '0 0 12px' }}>فواتير متأخرة ({overdueInvoices.length})</p>
              {overdueInvoices.slice(0, 5).map(inv => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#18181b', margin: 0 }}>{inv.companies?.name || inv.company?.name}</p>
                    <p style={{ fontSize: 10, color: '#a1a1aa', margin: 0 }}>{inv.invoice_number}</p>
                  </div>
                  <Link href="/dashboard/billing/invoices" style={{ fontSize: 10, padding: '4px 8px', borderRadius: 7, background: '#fafafa', border: '1px solid #e5e5e5', color: '#18181b', textDecoration: 'none' }}>
                    عرض
                  </Link>
                </div>
              ))}
              {overdueInvoices.length > 5 && (
                <Link href="/dashboard/billing/invoices" style={{ marginTop: 8, display: 'block', fontSize: 11, color: '#18181b', textDecoration: 'none' }}>
                  عرض الكل ({overdueInvoices.length})
                </Link>
              )}
            </div>
          )}

          {suspendedCompanies.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', padding: '18px 20px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', margin: '0 0 12px' }}>موقوفة ({suspendedCompanies.length})</p>
              {suspendedCompanies.slice(0, 4).map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#18181b', margin: 0 }}>{c.name}</p>
                  <Link href={`/dashboard/companies/${c.id}`} style={{ fontSize: 11, color: '#dc2626', textDecoration: 'none' }}>مراجعة</Link>
                </div>
              ))}
            </div>
          )}

          {trialsExpiringSoon.length === 0 && overdueInvoices.length === 0 && suspendedCompanies.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', padding: '24px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#16a34a', margin: '0 0 4px' }}>لا توجد تنبيهات</p>
              <p style={{ fontSize: 11, color: '#71717a', margin: 0 }}>كل شيء يعمل بشكل طبيعي</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
