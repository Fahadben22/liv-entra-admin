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
const BILLING_NAV = [
  { href: '/dashboard/billing',               label: 'نظرة عامة' },
  { href: '/dashboard/billing/invoices',       label: 'الفواتير' },
  { href: '/dashboard/billing/quotations',     label: 'عروض الأسعار' },
  { href: '/dashboard/billing/gateways',       label: 'بوابات الدفع' },
  { href: '/dashboard/billing/subscriptions',  label: 'الاشتراكات' },
  { href: '/dashboard/billing/coupons',        label: 'أكواد الخصم' },
  { href: '/dashboard/billing/credit-notes',   label: 'إشعارات دائنة' },
  { href: '/dashboard/billing/settings',       label: 'الإعدادات' },
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

  const safeCompanies  = Array.isArray(companies) ? companies : [];
  const safeInvoices   = Array.isArray(invoices)  ? invoices  : [];
  const overdueCount   = safeInvoices.filter(i => i.status === 'overdue').length;
  const trialCount     = safeCompanies.filter(c => lcOf(c) === 'trial').length;
  const suspendedCount = safeCompanies.filter(c => lcOf(c) === 'suspended').length;
  const estimatedMrr   = safeCompanies
    .filter(c => c.plan && c.plan !== 'trial' && c.is_active)
    .reduce((s, c) => s + (PLAN_PRICE[c.plan] || 0), 0);

  return (
    <BillingContext.Provider value={{ companies, stats, invoices, gateways, metrics, loading, reload: load, showToast }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--lv-panel)', color: 'var(--lv-fg)',
          padding: '10px 24px', borderRadius: 10, fontSize: 13, zIndex: 9999,
          boxShadow: 'var(--lv-shadow-panel)', border: '1px solid var(--lv-line-strong)',
        }}>
          {toast}
        </div>
      )}

      {/* ── Stats strip ── */}
      <div style={{
        background: 'var(--lv-panel)',
        borderBottom: '1px solid var(--lv-line)',
        padding: '14px 32px',
        marginBottom: 0,
      }}>
        <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 2px', fontWeight: 500 }}>MRR المقدّر</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--lv-fg)', margin: 0, fontFamily: 'var(--lv-font-num)' }}>
              <bdi dir="ltr">{fmt(stats?.mrr || estimatedMrr)}</bdi>
              <span style={{ fontSize: 12, color: 'var(--lv-muted)', marginInlineStart: 4 }}>ر.س</span>
            </p>
          </div>
          <div style={{ width: 1, height: 32, background: 'var(--lv-line)' }} />
          {[
            { l: 'ARR',          v: `${fmt(stats?.arr || (stats?.mrr || estimatedMrr) * 12)} ر.س`, c: 'var(--lv-success)' },
            { l: 'فواتير معلقة', v: `${fmt(stats?.total_pending_sar || 0)} ر.س`,                  c: 'var(--lv-warn)' },
            { l: 'متأخرة',       v: `${overdueCount} فاتورة`,                                      c: 'var(--lv-danger)' },
            { l: 'في التجربة',   v: trialCount,                                                    c: 'var(--lv-fg)' },
            { l: 'موقوفة',       v: suspendedCount,                                                c: 'var(--lv-danger)' },
          ].map(k => (
            <div key={k.l} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: k.c as string, margin: 0, fontFamily: 'var(--lv-font-num)' }}>
                <bdi dir="ltr">{k.v}</bdi>
              </p>
              <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '2px 0 0', fontWeight: 500 }}>{k.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Horizontal tab nav ── */}
      <div style={{
        background: 'var(--lv-panel)',
        borderBottom: '1px solid var(--lv-line-strong)',
        paddingInline: 32,
        display: 'flex',
        gap: 2,
        overflowX: 'auto',
      }}>
        {BILLING_NAV.map(item => {
          const active = pathname === item.href ||
            (item.href !== '/dashboard/billing' && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '12px 14px',
                fontSize: 12.5,
                fontWeight: active ? 600 : 400,
                textDecoration: 'none',
                color: active ? 'var(--lv-accent)' : 'var(--lv-muted)',
                borderBottom: active ? '2px solid var(--lv-accent)' : '2px solid transparent',
                whiteSpace: 'nowrap',
                transition: 'color .15s',
                position: 'relative',
              }}
            >
              {item.label}
              {item.label === 'الفواتير' && overdueCount > 0 && (
                <span style={{
                  fontSize: 10, padding: '1px 5px', borderRadius: 10,
                  background: 'rgba(184,50,31,0.1)', color: 'var(--lv-danger)', fontWeight: 700,
                }}>{overdueCount}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* ── Page content ── */}
      <div style={{ padding: '24px 32px' }}>
        {children}
      </div>
    </BillingContext.Provider>
  );
}
