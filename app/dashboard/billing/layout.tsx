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
  loading: boolean;
  reload: () => Promise<void>;
  showToast: (m: string) => void;
}

const BillingContext = createContext<BillingCtx>({
  companies: [], stats: null, invoices: [], gateways: [],
  loading: true, reload: async () => {}, showToast: () => {},
});

export const useBilling = () => useContext(BillingContext);

// ─── Navigation links ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/dashboard/billing',               label: 'نظرة عامة',      icon: '📊' },
  { href: '/dashboard/billing/invoices',       label: 'الفواتير',       icon: '🧾' },
  { href: '/dashboard/billing/quotations',     label: 'عروض الأسعار',   icon: '📋' },
  { href: '/dashboard/billing/gateways',       label: 'بوابات الدفع',   icon: '💳' },
  { href: '/dashboard/billing/subscriptions',  label: 'الاشتراكات',     icon: '🔄' },
  { href: '/dashboard/billing/coupons',        label: 'أكواد الخصم',    icon: '🏷️' },
  { href: '/dashboard/billing/credit-notes',   label: 'إشعارات دائنة',  icon: '📝' },
  { href: '/dashboard/template-center',        label: 'مركز القوالب',   icon: '📨' },
  { href: '/dashboard/billing/settings',       label: 'الإعدادات',      icon: '⚙️' },
];

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [companies, setCompanies] = useState<any[]>([]);
  const [stats,     setStats]     = useState<any>(null);
  const [invoices,  setInvoices]  = useState<any[]>([]);
  const [gateways,  setGateways]  = useState<any[]>([]);
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
    ]);
    if (results[0].status === 'fulfilled') setCompanies(toArr((results[0].value as any)?.data));
    if (results[1].status === 'fulfilled' && results[1].value) setStats((results[1].value as any)?.data ?? null);
    if (results[2].status === 'fulfilled') {
      const invData = (results[2].value as any)?.data;
      setInvoices(toArr(invData?.invoices ?? invData));
    }
    if (results[3].status === 'fulfilled') setGateways(toArr((results[3].value as any)?.data));
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
    <BillingContext.Provider value={{ companies, stats, invoices, gateways, loading, reload: load, showToast }}>
      <div style={{ minHeight: '100vh', background: '#f1f5f9', direction: 'rtl' }}>
        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: 'white', padding: '10px 24px', borderRadius: 10, fontSize: 13, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
            {toast}
          </div>
        )}

        {/* Top nav */}
        <div style={{ background: '#0f172a', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
          <Link href="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>الفوترة والاشتراكات</span>
        </div>

        {/* Stats banner */}
        <div style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)', padding: '22px 32px' }}>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', maxWidth: 1400, margin: '0 auto', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 11, color: '#93c5fd', margin: '0 0 4px' }}>MRR المقدّر</p>
              <p style={{ fontSize: 30, fontWeight: 700, color: 'white', margin: 0 }}>
                {fmt(stats?.mrr || estimatedMrr)} <span style={{ fontSize: 14, color: '#93c5fd' }}>ر.س</span>
              </p>
            </div>
            <div style={{ width: 1, height: 50, background: 'rgba(255,255,255,.15)' }} />
            {[
              { l: 'ARR',          v: `${fmt(stats?.arr || (stats?.mrr || estimatedMrr) * 12)} ر.س`, c: '#a7f3d0' },
              { l: 'فواتير معلقة', v: `${fmt(stats?.total_pending_sar || 0)} ر.س`,                  c: '#fde68a' },
              { l: 'متأخرة',       v: `${overdueCount} فاتورة`,                                      c: '#fca5a5' },
              { l: 'في التجربة',   v: trialCount,                                                    c: '#c7d2fe' },
              { l: 'موقوفة',       v: suspendedCount,                                                c: '#fca5a5' },
            ].map(k => (
              <div key={k.l} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 20, fontWeight: 700, color: k.c as string, margin: 0 }}>{k.v}</p>
                <p style={{ fontSize: 11, color: '#93c5fd', margin: '3px 0 0' }}>{k.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ display: 'flex', maxWidth: 1400, margin: '0 auto', padding: '0 16px', gap: 0 }}>
          {/* Sidebar nav */}
          <nav style={{ width: 200, minWidth: 200, padding: '20px 0', borderLeft: '1px solid #e2e8f0' }}>
            {NAV_ITEMS.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard/billing' && pathname?.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 16px', fontSize: 13, textDecoration: 'none',
                    color: active ? '#1d4070' : '#64748b',
                    background: active ? '#eff6ff' : 'transparent',
                    fontWeight: active ? 700 : 400,
                    borderRadius: '0 8px 8px 0',
                    marginBottom: 2,
                  }}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.label === 'الفواتير' && overdueCount > 0 && (
                    <span style={{ marginRight: 'auto', fontSize: 10, padding: '1px 6px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>{overdueCount}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Main content */}
          <main style={{ flex: 1, padding: '24px 28px', minHeight: 'calc(100vh - 200px)' }}>
            {children}
          </main>
        </div>
      </div>
    </BillingContext.Provider>
  );
}
