'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

const PAY_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: '#fff7ed', color: '#c2410c', label: 'معلق'   },
  paid:     { bg: '#f0fdf4', color: '#15803d', label: 'مدفوع'  },
  failed:   { bg: '#fef2f2', color: '#dc2626', label: 'فاشل'   },
  refunded: { bg: '#eff6ff', color: '#1d4070', label: 'مُسترد' },
  waived:   { bg: '#f1f5f9', color: '#64748b', label: 'مُعفى'  },
};

const TABS = ['الفواتير', 'خطط الاشتراك', 'MRR'] as const;
type Tab = typeof TABS[number];

export default function BillingPage() {
  const router = useRouter();
  const [tab,      setTab]      = useState<Tab>('الفواتير');
  const [payments, setPayments] = useState<any[]>([]);
  const [plans,    setPlans]    = useState<any[]>([]);
  const [mrr,      setMrr]      = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [actioning, setActioning] = useState<string | null>(null);
  const [toast,    setToast]    = useState('');

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    setLoading(true);
    const results = await Promise.allSettled([
      adminApi.sa.listPayments({ limit: '100' }),
      adminApi.sa.listPlans(),
      adminApi.sa.mrrStats(),
    ]);
    if (results[0].status === 'fulfilled') setPayments((results[0].value as any)?.data || []);
    if (results[1].status === 'fulfilled') setPlans((results[1].value as any)?.data || []);
    if (results[2].status === 'fulfilled') setMrr((results[2].value as any)?.data);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleMarkPaid = async (id: string) => {
    const ref = prompt('رقم مرجع الدفع (اختياري):') ?? '';
    setActioning(id);
    try {
      await adminApi.sa.markPaymentPaid(id, ref);
      showToast('تم تسجيل الدفع ✓');
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setActioning(null);
  };

  const handleWaive = async (id: string) => {
    const reason = prompt('سبب الإعفاء:');
    if (!reason) return;
    setActioning(id);
    try {
      await adminApi.sa.waivePayment(id, reason);
      showToast('تم الإعفاء ✓');
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setActioning(null);
  };

  const filteredPayments = payments.filter(p => filter === 'all' || p.status === filter);

  // Count per status
  const counts = payments.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', direction: 'rtl' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: 'white', padding: '10px 24px', borderRadius: 10, fontSize: 13, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
          {toast}
        </div>
      )}

      {/* Nav */}
      <div style={{ background: '#0f172a', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>محرك الفوترة والاشتراكات</span>
        </div>
      </div>

      {/* MRR summary bar */}
      {mrr && (
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#1d4070)', padding: '18px 32px', display: 'flex', gap: 40, alignItems: 'center' }}>
          {[
            { l: 'MRR الحالي',    v: `${(mrr.current_mrr||0).toLocaleString('ar-SA')} ر.س`, highlight: true },
            { l: 'ARR',            v: `${(mrr.arr||0).toLocaleString('ar-SA')} ر.س` },
            { l: 'اشتراكات نشطة', v: mrr.active_subscriptions || 0 },
            { l: 'متأخرات',        v: mrr.overdue_subscriptions || 0, warn: true },
            { l: 'متوسط العميل',   v: `${(mrr.avg_revenue_per_tenant||0).toLocaleString('ar-SA')} ر.س` },
            { l: 'إجمالي معلق',   v: `${totalPending.toLocaleString('ar-SA')} ر.س`, warn: totalPending > 0 },
          ].map(k => (
            <div key={k.l} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#93c5fd', margin: '0 0 4px' }}>{k.l}</p>
              <p style={{ fontSize: k.highlight ? 22 : 16, fontWeight: 700, color: (k as any).warn ? '#fca5a5' : 'white', margin: 0 }}>{k.v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 32px', display: 'flex', gap: 4 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ fontSize: 13, padding: '14px 18px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t ? 700 : 400, color: tab === t ? '#0f172a' : '#64748b', borderBottom: tab === t ? '2px solid #1d4070' : '2px solid transparent', transition: 'all .15s' }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>جاري التحميل...</div>
        ) : (
          <>
            {/* ── الفواتير ── */}
            {tab === 'الفواتير' && (
              <>
                {/* Status filter */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                  {[
                    { k: 'all',     l: `الكل (${payments.length})` },
                    { k: 'pending', l: `معلق (${counts.pending || 0})` },
                    { k: 'paid',    l: `مدفوع (${counts.paid || 0})` },
                    { k: 'failed',  l: `فاشل (${counts.failed || 0})` },
                    { k: 'waived',  l: `معفى (${counts.waived || 0})` },
                  ].map(t => (
                    <button key={t.k} onClick={() => setFilter(t.k)}
                      style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer',
                        background: filter === t.k ? '#0f172a' : 'white',
                        color:      filter === t.k ? 'white'   : '#475569',
                        borderColor: filter === t.k ? '#0f172a' : '#e2e8f0',
                        fontWeight: filter === t.k ? 600 : 400 }}>
                      {t.l}
                    </button>
                  ))}
                </div>

                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['الشركة', 'المبلغ', 'الحالة', 'طريقة الدفع', 'الفترة', 'إجراءات'].map(h => (
                          <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map((p, i) => {
                        const sc = PAY_STATUS[p.status] || PAY_STATUS.pending;
                        const isActing = actioning === p.id;
                        return (
                          <tr key={p.id} style={{ borderBottom: i < filteredPayments.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <td style={{ padding: '12px 18px' }}>
                              <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: '#0f172a' }}>{p.company?.name || '—'}</p>
                              <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{p.company?.slug}</p>
                            </td>
                            <td style={{ padding: '12px 18px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                              {Number(p.amount || 0).toLocaleString('ar-SA')} {p.currency || 'ر.س'}
                            </td>
                            <td style={{ padding: '12px 18px' }}>
                              <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 600 }}>
                                {sc.label}
                              </span>
                            </td>
                            <td style={{ padding: '12px 18px', fontSize: 12, color: '#475569' }}>
                              {p.payment_method === 'manual' ? 'يدوي' : p.payment_method}
                              {p.payment_ref && <span style={{ fontSize: 10, color: '#94a3b8', display: 'block' }}>{p.payment_ref}</span>}
                            </td>
                            <td style={{ padding: '12px 18px', fontSize: 11, color: '#64748b', direction: 'ltr', textAlign: 'right' }}>
                              {p.period_start ? new Date(p.period_start).toLocaleDateString('ar-SA') : '—'} ←
                              {p.period_end   ? new Date(p.period_end).toLocaleDateString('ar-SA')   : '—'}
                            </td>
                            <td style={{ padding: '12px 18px' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {p.status === 'pending' && (
                                  <>
                                    <button onClick={() => handleMarkPaid(p.id)} disabled={isActing}
                                      style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                      {isActing ? '...' : 'دفع ✓'}
                                    </button>
                                    <button onClick={() => handleWaive(p.id)} disabled={isActing}
                                      style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                      إعفاء
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredPayments.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 13 }}>
                            لا توجد فواتير
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── خطط الاشتراك ── */}
            {tab === 'خطط الاشتراك' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 20 }}>
                {plans.map(p => (
                  <div key={p.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{p.name_ar}</h3>
                        <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0', direction: 'ltr', textAlign: 'right' }}>{p.name}</p>
                      </div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: p.is_active ? '#f0fdf4' : '#fef2f2', color: p.is_active ? '#15803d' : '#dc2626' }}>
                        {p.is_active ? 'نشط' : 'معطل'}
                      </span>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        {Number(p.price_monthly || 0).toLocaleString('ar-SA')}
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}> ر.س/شهر</span>
                      </p>
                      {p.price_yearly && (
                        <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                          {Number(p.price_yearly).toLocaleString('ar-SA')} ر.س/سنة
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                      {[
                        { l: 'مستخدمون', v: p.max_users === 999 ? '∞' : p.max_users },
                        { l: 'عقارات',   v: p.max_properties === 999 ? '∞' : p.max_properties },
                        { l: 'وحدات',    v: p.max_units === 9999 ? '∞' : p.max_units },
                        { l: 'عقود',     v: p.max_contracts === 9999 ? '∞' : p.max_contracts },
                      ].map(m => (
                        <div key={m.l} style={{ padding: '8px 12px', borderRadius: 8, background: '#f8fafc', textAlign: 'center' }}>
                          <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>{m.v}</p>
                          <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>{m.l}</p>
                        </div>
                      ))}
                    </div>
                    {Array.isArray(p.features) && p.features.length > 0 && (
                      <div>
                        {p.features.slice(0, 4).map((f: string) => (
                          <div key={f} style={{ fontSize: 11, color: '#475569', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: '#15803d' }}>✓</span> {f.replace(/\./g, ' ')}
                          </div>
                        ))}
                        {p.features.length > 4 && (
                          <p style={{ fontSize: 10, color: '#94a3b8', margin: '6px 0 0' }}>+{p.features.length - 4} ميزات أخرى</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── MRR ── */}
            {tab === 'MRR' && mrr && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
                {[
                  { l: 'MRR الحالي',           v: `${(mrr.current_mrr||0).toLocaleString('ar-SA')} ر.س`,  color: '#15803d' },
                  { l: 'MRR الشهر الماضي',      v: `${(mrr.prev_mrr||0).toLocaleString('ar-SA')} ر.س`,     color: '#64748b' },
                  { l: 'ARR (سنوي متوقع)',      v: `${(mrr.arr||0).toLocaleString('ar-SA')} ر.س`,          color: '#1d4070' },
                  { l: 'اشتراكات نشطة',         v: mrr.active_subscriptions || 0,                           color: '#0f172a' },
                  { l: 'اشتراكات متأخرة',       v: mrr.overdue_subscriptions || 0,                          color: '#dc2626' },
                  { l: 'اشتراكات موقوفة',       v: mrr.suspended_subscriptions || 0,                        color: '#854d0e' },
                  { l: 'متوسط إيراد العميل',    v: `${(mrr.avg_revenue_per_tenant||0).toLocaleString('ar-SA')} ر.س`, color: '#7c3aed' },
                  { l: 'توقع الشهر القادم',     v: `${(mrr.projected_mrr||mrr.current_mrr||0).toLocaleString('ar-SA')} ر.س`, color: '#0f172a' },
                ].map(k => (
                  <div key={k.l} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '22px 26px', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px' }}>{k.l}</p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: k.color, margin: 0 }}>{k.v}</p>
                  </div>
                ))}

                {/* Plan breakdown */}
                {mrr.by_plan && (
                  <div style={{ gridColumn: '1/-1', background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '22px 26px' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>توزيع الإيراد حسب الخطة</h3>
                    <div style={{ display: 'flex', gap: 16 }}>
                      {Object.entries(mrr.by_plan).map(([plan, data]: [string, any]) => {
                        const pct = mrr.current_mrr > 0 ? Math.round((data.mrr / mrr.current_mrr) * 100) : 0;
                        return (
                          <div key={plan} style={{ flex: 1, padding: '16px', borderRadius: 10, background: '#f8fafc', textAlign: 'center' }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: '0 0 4px' }}>{plan}</p>
                            <p style={{ fontSize: 22, fontWeight: 700, color: '#1d4070', margin: '0 0 4px' }}>{data.count}</p>
                            <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 8px' }}>شركات</p>
                            <p style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>{(data.mrr||0).toLocaleString('ar-SA')} ر.س</p>
                            <div style={{ height: 5, borderRadius: 3, background: '#e2e8f0' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: '#1d4070', borderRadius: 3 }} />
                            </div>
                            <p style={{ fontSize: 10, color: '#94a3b8', margin: '4px 0 0' }}>{pct}%</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
