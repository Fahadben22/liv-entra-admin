'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

function lcOf(c: any): string {
  if (c.lifecycle_status) return c.lifecycle_status;
  if (!c.is_active) return 'suspended';
  if (c.plan === 'trial') return 'trial';
  return 'active';
}
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

const PLAN_AR: Record<string,string> = { trial:'تجريبي', basic:'أساسي', professional:'احترافي', enterprise:'مؤسسي' };
const PLAN_PRICE: Record<string,number> = { trial: 0, basic: 299, professional: 699, enterprise: 1499 };
const PLAN_C: Record<string,{bg:string;color:string;border:string}> = {
  trial:        { bg:'#f0fdf4', color:'#15803d', border:'#bbf7d0' },
  basic:        { bg:'#f8fafc', color:'#475569', border:'#e2e8f0' },
  professional: { bg:'#eff6ff', color:'#1d4070', border:'#bfdbfe' },
  enterprise:   { bg:'#fef3c7', color:'#92400e', border:'#fde68a' },
};

// Billing stage per company
function billingStage(c: any): { label:string; color:string; bg:string; priority:number } {
  const stage = lcOf(c);
  if (stage === 'suspended') return { label: 'موقوف',          color:'#dc2626', bg:'#fef2f2', priority:4 };
  if (stage === 'overdue')   return { label: 'مديونية',        color:'#f97316', bg:'#fff7ed', priority:3 };
  if (stage === 'trial') {
    const days = c.trial_ends_at ? daysUntil(c.trial_ends_at) : 999;
    if (days <= 3)  return { label: 'تجربة تنتهي قريباً', color:'#dc2626', bg:'#fef2f2', priority:3 };
    if (days <= 7)  return { label: 'تجربة تنتهي هذا الأسبوع', color:'#f97316', bg:'#fff7ed', priority:2 };
    return { label: 'في التجربة', color:'#854d0e', bg:'#fefce8', priority:1 };
  }
  if (stage === 'active' && c.plan !== 'trial') return { label: 'اشتراك نشط', color:'#15803d', bg:'#f0fdf4', priority:0 };
  return { label: 'نشط', color:'#15803d', bg:'#f0fdf4', priority:0 };
}

const TABS = ['نظرة عامة', 'جدول الفوترة', 'الخطط'] as const;
type Tab = typeof TABS[number];

export default function BillingPage() {
  const router = useRouter();
  const [tab,       setTab]       = useState<Tab>('نظرة عامة');
  const [companies, setCompanies] = useState<any[]>([]);
  const [stats,     setStats]     = useState<any>(null);
  const [saPayments, setSaPayments] = useState<any[]>([]);
  const [plans,      setPlans]    = useState<any[]>([]);
  const [loading,    setLoading]  = useState(true);
  const [actioning,  setActioning] = useState<string|null>(null);
  const [toast,      setToast]    = useState('');

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    setLoading(true);
    const results = await Promise.allSettled([
      adminApi.listCompanies(),                                 // always works
      adminApi.getStats(),                                      // always works
      adminApi.sa.listPayments({ limit: '50' }),                // needs migration
      adminApi.sa.listPlans(),                                  // needs migration
    ]);
    if (results[0].status === 'fulfilled') setCompanies((results[0].value as any)?.data || []);
    if (results[1].status === 'fulfilled') setStats((results[1].value as any)?.data);
    if (results[2].status === 'fulfilled') setSaPayments((results[2].value as any)?.data || []);
    if (results[3].status === 'fulfilled') setPlans((results[3].value as any)?.data || []);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleMarkPaid = async (id: string) => {
    const ref = prompt('رقم مرجع الدفع:') ?? '';
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

  // Compute billing metrics from real company data
  const payingCompanies   = companies.filter(c => c.plan && c.plan !== 'trial' && c.is_active);
  const trialCompanies    = companies.filter(c => lcOf(c) === 'trial');
  const suspendedCompanies = companies.filter(c => lcOf(c) === 'suspended');
  const trialsExpiringSoon = trialCompanies.filter(c => c.trial_ends_at && daysUntil(c.trial_ends_at) <= 7);

  // MRR from plan prices × active subscriptions (estimate if no sa.billing data)
  const estimatedMrr = payingCompanies.reduce((s, c) => s + (PLAN_PRICE[c.plan] || 0), 0);
  const totalRevenue  = stats?.total_revenue || 0;

  // Plan distribution
  const planDist: Record<string, number> = {};
  for (const c of companies) planDist[c.plan] = (planDist[c.plan] || 0) + 1;
  const maxPlanCount = Math.max(...Object.values(planDist), 1);

  // Billing timeline: companies sorted by billing urgency
  const billingTimeline = [...companies]
    .map(c => ({ ...c, _billing: billingStage(c) }))
    .sort((a, b) => b._billing.priority - a._billing.priority);

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', direction: 'rtl' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: 'white', padding: '10px 24px', borderRadius: 10, fontSize: 13, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
          {toast}
        </div>
      )}

      {/* Nav */}
      <div style={{ background: '#0f172a', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
        <Link href="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>الفوترة والاشتراكات</span>
      </div>

      {/* Revenue banner */}
      <div style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)', padding: '22px 32px' }}>
        <div style={{ display: 'flex', gap: 48, alignItems: 'center', maxWidth: 1400, margin: '0 auto' }}>
          <div>
            <p style={{ fontSize: 11, color: '#93c5fd', margin: '0 0 4px' }}>MRR المقدّر (بناءً على الخطط)</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: 'white', margin: 0 }}>
              {estimatedMrr.toLocaleString('ar-SA')} ر.س
            </p>
          </div>
          <div style={{ width: 1, height: 50, background: 'rgba(255,255,255,.15)' }} />
          {[
            { l: 'إجمالي محصّل',     v: `${totalRevenue.toLocaleString('ar-SA')} ر.س`,     c: '#a7f3d0' },
            { l: 'اشتراكات مدفوعة',  v: payingCompanies.length,                              c: 'white' },
            { l: 'في التجربة',        v: trialCompanies.length,                               c: '#fde68a' },
            { l: 'يحتاج انتباهاً',   v: suspendedCompanies.length + trialsExpiringSoon.length, c: '#fca5a5' },
          ].map(k => (
            <div key={k.l} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: k.c as string, margin: 0 }}>{k.v}</p>
              <p style={{ fontSize: 11, color: '#93c5fd', margin: '3px 0 0' }}>{k.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 32px' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ fontSize: 13, padding: '14px 18px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t ? 700 : 400, color: tab === t ? '#0f172a' : '#64748b', borderBottom: tab === t ? '2px solid #1d4070' : '2px solid transparent' }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>جاري التحميل...</div>
        ) : (
          <>
            {/* ── نظرة عامة ── */}
            {tab === 'نظرة عامة' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
                {/* Plan distribution */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '22px 26px' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 20px' }}>توزيع الشركات حسب الخطة</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {['enterprise', 'professional', 'basic', 'trial'].map(plan => {
                      const count = planDist[plan] || 0;
                      const pct   = Math.round((count / Math.max(companies.length, 1)) * 100);
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
                              {mrr > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>{mrr.toLocaleString('ar-SA')} ر.س/شهر</span>}
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

                {/* Alerts requiring action */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Trials expiring */}
                  {trialsExpiringSoon.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #fde68a', padding: '18px 20px' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#854d0e', margin: '0 0 12px' }}>⏳ تجارب تنتهي قريباً ({trialsExpiringSoon.length})</p>
                      {trialsExpiringSoon.map(c => (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #fef9c3' }}>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: 0 }}>{c.name}</p>
                            <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>{c.plan}</p>
                          </div>
                          <div style={{ textAlign: 'left' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: daysUntil(c.trial_ends_at) <= 2 ? '#dc2626' : '#854d0e' }}>
                              {daysUntil(c.trial_ends_at)} يوم
                            </span>
                            <Link href={`/dashboard/companies/${c.id}`} style={{ display: 'block', fontSize: 10, color: '#1d4070', textDecoration: 'none', marginTop: 2 }}>ترقية →</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suspended */}
                  {suspendedCompanies.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #fecaca', padding: '18px 20px' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', margin: '0 0 12px' }}>🔴 شركات موقوفة ({suspendedCompanies.length})</p>
                      {suspendedCompanies.slice(0, 5).map(c => (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #fef2f2' }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: 0 }}>{c.name}</p>
                          <Link href={`/dashboard/companies/${c.id}`} style={{ fontSize: 11, color: '#dc2626', textDecoration: 'none' }}>مراجعة →</Link>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SA payments if migration ran */}
                  {saPayments.filter(p => p.status === 'pending').length > 0 && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #fed7aa', padding: '18px 20px' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#c2410c', margin: '0 0 8px' }}>💳 فواتير معلقة ({saPayments.filter(p=>p.status==='pending').length})</p>
                      <p style={{ fontSize: 11, color: '#94a3b8' }}>راجع تبويب "جدول الفوترة"</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── جدول الفوترة ── */}
            {tab === 'جدول الفوترة' && (
              <>
                {/* Billing lifecycle table (from company data — always available) */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: saPayments.length > 0 ? 24 : 0 }}>
                  <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>حالة الفوترة — جميع الشركات</h3>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['الشركة', 'الخطة', 'حالة الفوترة', 'القيمة الشهرية', 'نهاية التجربة', 'إجراء'].map(h => (
                          <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {billingTimeline.map((c, i) => {
                        const bs  = c._billing;
                        const pc  = PLAN_C[c.plan] || PLAN_C.basic;
                        const mrr = PLAN_PRICE[c.plan] || 0;
                        return (
                          <tr key={c.id} style={{ borderBottom: i < billingTimeline.length-1 ? '1px solid #f1f5f9' : 'none' }}>
                            <td style={{ padding: '12px 18px' }}>
                              <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#0f172a' }}>{c.name}</p>
                              <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>{c.slug}</p>
                            </td>
                            <td style={{ padding: '12px 18px' }}>
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: pc.bg, color: pc.color, fontWeight: 500, border: `1px solid ${pc.border}` }}>
                                {PLAN_AR[c.plan] || c.plan}
                              </span>
                            </td>
                            <td style={{ padding: '12px 18px' }}>
                              <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: bs.bg, color: bs.color, fontWeight: 600 }}>
                                {bs.label}
                              </span>
                            </td>
                            <td style={{ padding: '12px 18px', fontSize: 13, fontWeight: 700, color: mrr > 0 ? '#15803d' : '#94a3b8' }}>
                              {mrr > 0 ? `${mrr.toLocaleString('ar-SA')} ر.س` : 'مجاني'}
                            </td>
                            <td style={{ padding: '12px 18px', fontSize: 11, color: '#64748b', direction: 'ltr', textAlign: 'right' }}>
                              {c.trial_ends_at ? (
                                <span style={{ color: daysUntil(c.trial_ends_at) <= 3 ? '#dc2626' : '#64748b' }}>
                                  {new Date(c.trial_ends_at).toLocaleDateString('ar-SA')}
                                  {daysUntil(c.trial_ends_at) >= 0 && ` (${daysUntil(c.trial_ends_at)}ي)`}
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '12px 18px' }}>
                              <Link href={`/dashboard/companies/${c.id}`}
                                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, border: '1px solid #e2e8f0', color: '#1d4070', textDecoration: 'none' }}>
                                إدارة ↗
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* SA payments (if migration has run) */}
                {saPayments.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9' }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>فواتير النظام ({saPayments.length})</h3>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['الشركة','المبلغ','الحالة','الفترة','إجراء'].map(h=>(
                            <th key={h} style={{ padding:'10px 18px',textAlign:'right',fontSize:11,fontWeight:600,color:'#64748b',borderBottom:'1px solid #e2e8f0' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {saPayments.map((p,i) => {
                          const STATUS_C: Record<string,{bg:string;color:string;label:string}> = {
                            pending:{bg:'#fff7ed',color:'#c2410c',label:'معلق'},
                            paid:   {bg:'#f0fdf4',color:'#15803d',label:'مدفوع'},
                            failed: {bg:'#fef2f2',color:'#dc2626',label:'فاشل'},
                            waived: {bg:'#f1f5f9',color:'#64748b',label:'معفى'},
                          };
                          const sc = STATUS_C[p.status] || STATUS_C.pending;
                          const isAct = actioning === p.id;
                          return (
                            <tr key={p.id} style={{ borderBottom: i<saPayments.length-1 ? '1px solid #f1f5f9':'none' }}>
                              <td style={{ padding:'12px 18px',fontSize:13,fontWeight:600,color:'#0f172a' }}>{p.company?.name || '—'}</td>
                              <td style={{ padding:'12px 18px',fontSize:14,fontWeight:700,color:'#0f172a' }}>{Number(p.amount||0).toLocaleString('ar-SA')} ر.س</td>
                              <td style={{ padding:'12px 18px' }}>
                                <span style={{ fontSize:11,padding:'3px 9px',borderRadius:20,background:sc.bg,color:sc.color,fontWeight:600 }}>{sc.label}</span>
                              </td>
                              <td style={{ padding:'12px 18px',fontSize:11,color:'#94a3b8',direction:'ltr',textAlign:'right' }}>
                                {p.period_start ? new Date(p.period_start).toLocaleDateString('ar-SA') : '—'}
                              </td>
                              <td style={{ padding:'12px 18px' }}>
                                {p.status === 'pending' && (
                                  <div style={{ display:'flex',gap:6 }}>
                                    <button onClick={()=>handleMarkPaid(p.id)} disabled={isAct}
                                      style={{ fontSize:11,padding:'5px 10px',borderRadius:7,background:'#f0fdf4',border:'1px solid #bbf7d0',color:'#15803d',cursor:'pointer' }}>
                                      {isAct?'...':'دفع ✓'}
                                    </button>
                                    <button onClick={()=>handleWaive(p.id)} disabled={isAct}
                                      style={{ fontSize:11,padding:'5px 10px',borderRadius:7,background:'#f8fafc',border:'1px solid #e2e8f0',color:'#64748b',cursor:'pointer' }}>
                                      إعفاء
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ── الخطط ── */}
            {tab === 'الخطط' && (
              <>
                {/* Static plan cards (always shown) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
                  {[
                    { name:'trial',       nameAr:'تجريبي',    price:0,    users:3,  units:10,   color:'#15803d',  bg:'#f0fdf4',  border:'#bbf7d0' },
                    { name:'basic',       nameAr:'أساسي',     price:299,  users:5,  units:50,   color:'#475569',  bg:'#f8fafc',  border:'#e2e8f0' },
                    { name:'professional',nameAr:'احترافي',   price:699,  users:15, units:200,  color:'#1d4070',  bg:'#eff6ff',  border:'#bfdbfe' },
                    { name:'enterprise',  nameAr:'مؤسسي',     price:1499, users:999,units:9999, color:'#92400e',  bg:'#fef3c7',  border:'#fde68a' },
                  ].map(p => {
                    const count = planDist[p.name] || 0;
                    return (
                      <div key={p.name} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${p.border}`, padding: '22px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                          <div>
                            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: p.color }}>{p.nameAr}</h3>
                            <p style={{ fontSize: 10, color: '#94a3b8', margin: '3px 0 0', direction: 'ltr', textAlign: 'right' }}>{p.name}</p>
                          </div>
                          <span style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', padding: '4px 10px', borderRadius: 20, background: p.bg }}>
                            {count}
                          </span>
                        </div>
                        <p style={{ fontSize: 26, fontWeight: 700, color: p.color, margin: '0 0 4px' }}>
                          {p.price > 0 ? `${p.price.toLocaleString('ar-SA')} ر.س` : 'مجاني'}
                          {p.price > 0 && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>/شهر</span>}
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 14 }}>
                          <div style={{ padding: '8px', borderRadius: 8, background: p.bg, textAlign: 'center' }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: p.color, margin: 0 }}>{p.users >= 999 ? '∞' : p.users}</p>
                            <p style={{ fontSize: 9, color: '#94a3b8', margin: '2px 0 0' }}>مستخدم</p>
                          </div>
                          <div style={{ padding: '8px', borderRadius: 8, background: p.bg, textAlign: 'center' }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: p.color, margin: 0 }}>{p.units >= 9999 ? '∞' : p.units}</p>
                            <p style={{ fontSize: 9, color: '#94a3b8', margin: '2px 0 0' }}>وحدة</p>
                          </div>
                        </div>
                        {p.price > 0 && count > 0 && (
                          <p style={{ fontSize: 11, color: '#15803d', fontWeight: 600, margin: '12px 0 0', textAlign: 'center' }}>
                            {(p.price * count).toLocaleString('ar-SA')} ر.س / شهر
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Dynamic plans from DB if migration ran */}
                {plans.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '20px 24px' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>الخطط المُعرَّفة في النظام ({plans.length})</h3>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {plans.map(p => (
                        <div key={p.id} style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fafafa', minWidth: 160 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 2px' }}>{p.name_ar || p.name}</p>
                          <p style={{ fontSize: 20, fontWeight: 700, color: '#1d4070', margin: '4px 0' }}>{Number(p.price_monthly||0).toLocaleString('ar-SA')} ر.س</p>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: p.is_active?'#f0fdf4':'#fef2f2', color: p.is_active?'#15803d':'#dc2626' }}>
                            {p.is_active?'نشط':'معطل'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
