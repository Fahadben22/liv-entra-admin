'use client';
import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { request, adminApi } from '@/lib/api';
import { fmt, lcOf, PLAN_PRICE } from '@/lib/billing-helpers';

// ─── Billing context — shared data for all billing sub-pages ─────────────────
interface BillingCtx {
  companies: any[];
  stats: any;
  invoices: any[];
  gateways: any[];
  metrics: any;
  loading: boolean;
  reload: () => Promise<void>;
  showToast: (m: string) => void;
}

const BillingContext = createContext<BillingCtx>({
  companies: [], stats: null, invoices: [], gateways: [], metrics: null,
  loading: true, reload: async () => {}, showToast: () => {},
});

export const useBilling = () => useContext(BillingContext);

// ─── Navigation links ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/dashboard/billing',               label: 'نظرة عامة' },
  { href: '/dashboard/billing/invoices',       label: 'الفواتير' },
  { href: '/dashboard/billing/quotations',     label: 'عروض الأسعار' },
  { href: '/dashboard/billing/gateways',       label: 'بوابات الدفع' },
  { href: '/dashboard/billing/subscriptions',  label: 'الاشتراكات' },
  { href: '/dashboard/billing/coupons',        label: 'أكواد الخصم' },
  { href: '/dashboard/billing/credit-notes',   label: 'إشعارات دائنة' },
  { href: '/dashboard/template-center',        label: 'مركز القوالب' },
  { href: '/dashboard/billing/settings',       label: 'الإعدادات' },
  { href: '/pricing',                          label: 'صفحة الأسعار' },
  { href: '/subscribe',                        label: 'صفحة الاشتراك' },
];

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [companies, setCompanies] = useState<any[]>([]);
  const [stats,     setStats]     = useState<any>(null);
  const [invoices,  setInvoices]  = useState<any[]>([]);
  const [gateways,  setGateways]  = useState<any[]>([]);
  const [metrics,   setMetrics]   = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState('');

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    setLoading(true);
    const toArr = (v: any): any[] => Array.isArray(v) ? v : [];
    const results = await Promise.allSettled([
      adminApi.listCompanies(),
      request<any>('GET', '/admin/billing/stats').catch(() => null),
      request<any>('GET', '/admin/billing/invoices?limit=200').catch(() => null),
      request<any>('GET', '/admin/billing/gateways').catch(() => null),
      adminApi.sa.mrrStats().catch(() => null),
    ]);
    if (results[0].status === 'fulfilled') setCompanies(toArr((results[0].value as any)?.data));
    if (results[1].status === 'fulfilled' && results[1].value) setStats((results[1].value as any)?.data ?? null);
    if (results[2].status === 'fulfilled') {
      const invData = (results[2].value as any)?.data;
      setInvoices(toArr(invData?.invoices ?? invData));
    }
    if (results[3].status === 'fulfilled') setGateways(toArr((results[3].value as any)?.data));
    if (results[4].status === 'fulfilled' && results[4].value) setMetrics((results[4].value as any)?.data ?? null);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const safeCompanies = Array.isArray(companies) ? companies : [];
  const safeInvoices  = Array.isArray(invoices)  ? invoices  : [];
  const overdueCount  = safeInvoices.filter(i => i.status === 'overdue').length;
  const trialCount    = safeCompanies.filter(c => lcOf(c) === 'trial').length;
  const suspendedCount = safeCompanies.filter(c => lcOf(c) === 'suspended').length;
  const estimatedMrr  = safeCompanies.filter(c => c.plan && c.plan !== 'trial' && c.is_active)
    .reduce((s, c) => s + (PLAN_PRICE[c.plan] || 0), 0);

  return (
    <BillingContext.Provider value={{ companies, stats, invoices, gateways, metrics, loading, reload: load, showToast }}>
      <div style={{ background: '#fff', minHeight: '100vh' }}>
        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#fff', color: '#1E293B', padding: '10px 24px', borderRadius: 10, fontSize: 13, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,.1)', border: '1px solid rgba(0,0,0,.08)' }}>
            {toast}
          </div>
        )}

        {/* Top bar */}
        <div style={{ background: '#fff', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid rgba(0,0,0,.06)', position: 'sticky', top: 0, zIndex: 50 }}>
          <Link href="/dashboard" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>الفوترة والاشتراكات</span>
        </div>

        {/* Stats banner */}
        <div style={{ background: '#F1F5F9', borderBottom: '1px solid rgba(0,0,0,.06)', padding: '18px 32px' }}>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', maxWidth: 1400, margin: '0 auto', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px', fontWeight: 500 }}>MRR المقدّر</p>
              <p style={{ fontSize: 26, fontWeight: 600, color: '#1E293B', margin: 0 }}>
                {fmt(stats?.mrr || estimatedMrr)} <span style={{ fontSize: 13, color: '#6b7280' }}>ر.س</span>
              </p>
            </div>
            <div style={{ width: 1, height: 40, background: 'rgba(0,0,0,.06)' }} />
            {[
              { l: 'ARR',          v: `${fmt(stats?.arr || (stats?.mrr || estimatedMrr) * 12)} ر.س`, c: '#16a34a' },
              { l: 'فواتير معلقة', v: `${fmt(stats?.total_pending_sar || 0)} ر.س`,                  c: '#d97706' },
              { l: 'متأخرة',       v: `${overdueCount} فاتورة`,                                      c: '#dc2626' },
              { l: 'في التجربة',   v: trialCount,                                                    c: '#1E293B' },
              { l: 'موقوفة',       v: suspendedCount,                                                c: '#dc2626' },
            ].map(k => (
              <div key={k.l} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 18, fontWeight: 600, color: k.c as string, margin: 0 }}>{k.v}</p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: '3px 0 0', fontWeight: 500 }}>{k.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ display: 'flex', maxWidth: 1400, margin: '0 auto', padding: '0 16px', gap: 0 }}>
          {/* Sidebar nav */}
          <nav style={{ width: 200, minWidth: 200, padding: '20px 0', borderLeft: '1px solid rgba(0,0,0,.06)', background: '#F1F5F9' }}>
            {NAV_ITEMS.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard/billing' && pathname?.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 16px', fontSize: 13, textDecoration: 'none',
                    color: active ? '#2563EB' : '#6b7280',
                    background: active ? 'rgba(124,92,252,.08)' : 'transparent',
                    fontWeight: active ? 600 : 400,
                    borderRadius: '0 7px 7px 0',
                    marginBottom: 2,
                    borderRight: active ? '2px solid #2563EB' : '2px solid transparent',
                  }}>
                  <span>{item.label}</span>
                  {item.label === 'الفواتير' && overdueCount > 0 && (
                    <span style={{ marginRight: 'auto', fontSize: 10, padding: '1px 6px', borderRadius: 20, background: 'rgba(239,68,68,.1)', color: '#dc2626', fontWeight: 600 }}>{overdueCount}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Main content */}
          <main style={{ flex: 1, padding: '24px 28px' }}>
            {children}
          </main>
        </div>
      </div>
    </BillingContext.Provider>
  );
}
