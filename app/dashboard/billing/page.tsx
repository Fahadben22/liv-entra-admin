'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { request, adminApi, BASE } from '@/lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function lcOf(c: any): string {
  if (c.lifecycle_status) return c.lifecycle_status;
  if (!c.is_active) return 'suspended';
  if (c.plan === 'trial') return 'trial';
  return 'active';
}
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }
function fmt(n: any) { return Number(n || 0).toLocaleString('ar-SA'); }
function fmtDate(iso: string) { return iso ? new Date(iso).toLocaleDateString('ar-SA') : '—'; }

const PLAN_AR: Record<string, string> = { trial: 'تجريبي', basic: 'أساسي', professional: 'احترافي', enterprise: 'مؤسسي' };
const PLAN_PRICE: Record<string, number> = { trial: 0, basic: 299, professional: 699, enterprise: 1499 };
const PLAN_C: Record<string, { bg: string; color: string; border: string }> = {
  trial:        { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  basic:        { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
  professional: { bg: '#eff6ff', color: '#1d4070', border: '#bfdbfe' },
  enterprise:   { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
};

const INV_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  draft:   { label: 'مسودة',   bg: '#f8fafc', color: '#64748b' },
  issued:  { label: 'مُصدرة',  bg: '#eff6ff', color: '#1d4070' },
  overdue: { label: 'متأخرة',  bg: '#fff7ed', color: '#c2410c' },
  paid:    { label: 'مدفوعة',  bg: '#f0fdf4', color: '#15803d' },
  waived:  { label: 'معفوة',   bg: '#f1f5f9', color: '#64748b' },
  void:    { label: 'ملغاة',   bg: '#fef2f2', color: '#dc2626' },
};

const DUNNING: Record<number, string> = {
  0: '—', 1: 'تذكير ٣ أيام', 2: 'تذكير ٧ أيام', 3: 'إشعار نهائي', 4: 'موقوف',
};

const GW_LABELS: Record<string, string> = {
  stripe: 'Stripe', payfort: 'PayFort', telr: 'Telr', tap: 'Tap Payments',
};

const TABS = ['الفواتير', 'عروض الأسعار', 'القوالب', 'نظرة عامة', 'بوابات الدفع', 'الإعدادات'] as const;
type Tab = typeof TABS[number];

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#0f172a' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '20px 24px', flex: 1 }}>
      <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

// ─── Company billing drawer ────────────────────────────────────────────────────
function CompanyDrawer({ companyId, onClose, showToast }: { companyId: string; onClose: () => void; showToast: (m: string) => void }) {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request<any>('GET', `/admin/billing/company/${companyId}`)
      .then(r => setData(r?.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <div style={{ width: 480, background: '#fff', height: '100%', overflowY: 'auto', padding: '28px 28px', direction: 'rtl' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>سجل الفوترة — {data?.company?.name || '...'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8' }}>×</button>
        </div>
        {loading ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', paddingTop: 60 }}>جاري التحميل...</p>
        ) : data ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#15803d', margin: 0 }}>{fmt(data.total_paid || 0)}</p>
                <p style={{ fontSize: 10, color: '#64748b', margin: '4px 0 0' }}>إجمالي المدفوع (ر.س)</p>
              </div>
              <div style={{ background: '#fff7ed', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#c2410c', margin: 0 }}>{fmt(data.total_outstanding || 0)}</p>
                <p style={{ fontSize: 10, color: '#64748b', margin: '4px 0 0' }}>مبالغ معلقة (ر.س)</p>
              </div>
            </div>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px', color: '#64748b' }}>الفواتير ({data.invoices?.length || 0})</h3>
            {(data.invoices || []).map((inv: any) => {
              const sc = INV_STATUS[inv.status] || INV_STATUS.draft;
              return (
                <div key={inv.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{inv.invoice_number}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 600 }}>{sc.label}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
                    <span>{fmt(inv.total_sar || inv.total_amount_sar)} ر.س</span>
                    <span>استحقاق: {fmtDate(inv.due_date)}</span>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <p style={{ color: '#dc2626', textAlign: 'center', paddingTop: 60 }}>فشل تحميل البيانات</p>
        )}
      </div>
    </div>
  );
}

// ─── Mark Paid Modal ───────────────────────────────────────────────────────────
function MarkPaidModal({ invoice, onClose, onDone }: { invoice: any; onClose: () => void; onDone: () => void }) {
  const [ref, setRef]       = useState('');
  const [notes, setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState('');

  const submit = async () => {
    if (!ref.trim()) { setErr('أدخل مرجع الدفع'); return; }
    setLoading(true);
    try {
      await request('PATCH', `/admin/billing/invoices/${invoice.id}/mark-paid`, { payment_ref: ref, notes });
      onDone();
    } catch (e: any) { setErr(e.message || 'خطأ'); }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 380, direction: 'rtl' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>تسجيل دفع</h3>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 20px' }}>{invoice.invoice_number} — {fmt(invoice.total_sar || invoice.total_amount_sar)} ر.س</p>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>مرجع الدفع *</label>
        <input value={ref} onChange={e => setRef(e.target.value)} placeholder="رقم الحوالة / رقم المعاملة"
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, direction: 'rtl', boxSizing: 'border-box', marginBottom: 12 }} />
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>ملاحظات (اختياري)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, direction: 'rtl', boxSizing: 'border-box', marginBottom: 16, resize: 'vertical' }} />
        {err && <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>إلغاء</button>
          <button onClick={submit} disabled={loading}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#15803d', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {loading ? '...' : 'تأكيد الدفع ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Invoice Modal ──────────────────────────────────────────────────────
function CreateInvoiceModal({ companies, onClose, onDone }: { companies: any[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm]       = useState({ company_id: '', description: '', amount_sar: '', payment_terms: '15', notes: '', period_start: new Date().toISOString().split('T')[0], period_end: new Date(Date.now() + 30*86400000).toISOString().split('T')[0] });
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.company_id || !form.amount_sar) { setErr('الشركة والمبلغ مطلوبان'); return; }
    setLoading(true);
    try {
      await request('POST', '/admin/billing/invoices', {
        company_id:    form.company_id,
        description:   form.description || 'اشتراك شهري',
        amount_sar:    Number(form.amount_sar),
        payment_terms: Number(form.payment_terms),
        period_start:  form.period_start,
        period_end:    form.period_end,
        notes:         form.notes || undefined,
      });
      onDone();
    } catch (e: any) { setErr(e.message || 'خطأ'); }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 420, direction: 'rtl' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 20px' }}>إنشاء فاتورة</h3>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>الشركة *</label>
        <select value={form.company_id} onChange={e => set('company_id', e.target.value)}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, direction: 'rtl', boxSizing: 'border-box', marginBottom: 12 }}>
          <option value="">اختر شركة...</option>
          {(Array.isArray(companies) ? companies : []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>الوصف</label>
        <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="اشتراك شهري — الخطة الاحترافية"
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, direction: 'rtl', boxSizing: 'border-box', marginBottom: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>المبلغ (ر.س) *</label>
            <input type="number" value={form.amount_sar} onChange={e => set('amount_sar', e.target.value)} placeholder="699"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>أيام السداد</label>
            <select value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }}>
              {['7','10','15','30','45'].map(d => <option key={d} value={d}>{d} يوم</option>)}
            </select>
          </div>
        </div>
        {/* Period dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>بداية الفترة</label>
            <input type="date" value={form.period_start} onChange={e => set('period_start', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>نهاية الفترة</label>
            <input type="date" value={form.period_end} onChange={e => set('period_end', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* VAT Preview */}
        {form.amount_sar && Number(form.amount_sar) > 0 && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: '#64748b' }}>المجموع الفرعي</span>
              <span style={{ fontWeight: 600 }}>{Number(form.amount_sar).toLocaleString()} ر.س</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: '#64748b' }}>ضريبة القيمة المضافة 15%</span>
              <span style={{ fontWeight: 600 }}>{(Number(form.amount_sar) * 0.15).toLocaleString(undefined, {minimumFractionDigits:2})} ر.س</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
              <span>الإجمالي شامل الضريبة</span>
              <span style={{ color: '#059669' }}>{(Number(form.amount_sar) * 1.15).toLocaleString(undefined, {minimumFractionDigits:2})} ر.س</span>
            </div>
          </div>
        )}

        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>ملاحظات</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, direction: 'rtl', boxSizing: 'border-box', marginBottom: 16, resize: 'vertical' }} />
        {err && <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>إلغاء</button>
          <button onClick={submit} disabled={loading}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1d4070', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {loading ? '...' : 'إنشاء الفاتورة'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const router = useRouter();
  const [tab,          setTab]         = useState<Tab>('الفواتير');
  const [companies,    setCompanies]   = useState<any[]>([]);
  const [stats,        setStats]       = useState<any>(null);
  const [invoices,     setInvoices]    = useState<any[]>([]);
  const [gateways,     setGateways]    = useState<any[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [actioning,    setActioning]   = useState<string | null>(null);
  const [toast,        setToast]       = useState('');
  const [markPaidInv,  setMarkPaidInv] = useState<any>(null);
  const [showCreate,   setShowCreate]  = useState(false);
  const [drawerCompId, setDrawerCompId] = useState<string | null>(null);
  const [gwSaving,     setGwSaving]    = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search,       setSearch]      = useState('');

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    setLoading(true);
    const toArr = (v: any): any[] => Array.isArray(v) ? v : [];
    const results = await Promise.allSettled([
      adminApi.listCompanies(),
      request<any>('GET', '/admin/billing/stats').catch(() => null),
      request<any>('GET', '/admin/billing/invoices?limit=100').catch(() => null),
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

  // Quick actions
  const handleVoid = async (id: string, invNum: string) => {
    if (!confirm(`هل تريد إلغاء الفاتورة ${invNum}؟`)) return;
    const reason = prompt('سبب الإلغاء:');
    if (!reason) return;
    setActioning(id);
    try {
      await request('POST', `/admin/billing/invoices/${id}/void`, { reason });
      showToast('تم إلغاء الفاتورة ✓');
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setActioning(null);
  };

  const handleWaive = async (id: string, invNum: string) => {
    const reason = prompt(`سبب إعفاء الفاتورة ${invNum}:`);
    if (!reason) return;
    setActioning(id);
    try {
      await request('PATCH', `/admin/billing/invoices/${id}/waive`, { reason });
      showToast('تم الإعفاء ✓');
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setActioning(null);
  };

  const handleResend = async (id: string) => {
    setActioning(id);
    try {
      await request('POST', `/admin/billing/invoices/${id}/send`, {});
      showToast('تم إعادة إرسال الفاتورة ✓');
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setActioning(null);
  };

  const handleGwSave = async (provider: string, patch: any) => {
    setGwSaving(provider);
    try {
      await request('PUT', `/admin/billing/gateways/${provider}`, patch);
      showToast('تم حفظ الإعدادات ✓');
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setGwSaving(null);
  };

  // Derived — always safe even if state is temporarily non-array
  const safeInvoices  = Array.isArray(invoices)  ? invoices  : [];
  const safeCompanies = Array.isArray(companies) ? companies : [];

  const filteredInvoices = safeInvoices.filter(inv => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.company?.name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const trialCompanies     = safeCompanies.filter(c => lcOf(c) === 'trial');
  const trialsExpiringSoon = trialCompanies.filter(c => c.trial_ends_at && daysUntil(c.trial_ends_at) <= 7);
  const suspendedCompanies = safeCompanies.filter(c => lcOf(c) === 'suspended');
  const overdueInvoices    = safeInvoices.filter(i => i.status === 'overdue');

  const planDist: Record<string, number> = {};
  for (const c of safeCompanies) planDist[c.plan] = (planDist[c.plan] || 0) + 1;
  const estimatedMrr = safeCompanies.filter(c => c.plan && c.plan !== 'trial' && c.is_active)
    .reduce((s, c) => s + (PLAN_PRICE[c.plan] || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', direction: 'rtl' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: 'white', padding: '10px 24px', borderRadius: 10, fontSize: 13, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
          {toast}
        </div>
      )}

      {/* Modals */}
      {markPaidInv && (
        <MarkPaidModal invoice={markPaidInv} onClose={() => setMarkPaidInv(null)} onDone={async () => { showToast('تم تسجيل الدفع ✓'); setMarkPaidInv(null); await load(); }} />
      )}
      {showCreate && (
        <CreateInvoiceModal companies={companies} onClose={() => setShowCreate(false)} onDone={async () => { showToast('تم إنشاء الفاتورة ✓'); setShowCreate(false); await load(); }} />
      )}
      {drawerCompId && (
        <CompanyDrawer companyId={drawerCompId} onClose={() => setDrawerCompId(null)} showToast={showToast} />
      )}

      {/* Nav */}
      <div style={{ background: '#0f172a', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
        <Link href="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>الفوترة والاشتراكات</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1d4070', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          + فاتورة جديدة
        </button>
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
            { l: 'ARR',               v: `${fmt(stats?.arr || (stats?.mrr || estimatedMrr) * 12)} ر.س`, c: '#a7f3d0' },
            { l: 'فواتير معلقة',      v: `${fmt(stats?.pending_amount || 0)} ر.س`,                     c: '#fde68a' },
            { l: 'متأخرة',            v: `${overdueInvoices.length} فاتورة`,                             c: '#fca5a5' },
            { l: 'في التجربة',        v: trialCompanies.length,                                          c: '#c7d2fe' },
            { l: 'موقوفة',            v: suspendedCompanies.length,                                      c: '#fca5a5' },
          ].map(k => (
            <div key={k.l} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: k.c as string, margin: 0 }}>{k.v}</p>
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
            {t === 'الفواتير' && overdueInvoices.length > 0 && (
              <span style={{ marginRight: 6, fontSize: 10, padding: '2px 6px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>{overdueInvoices.length}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>جاري التحميل...</div>
        ) : (
          <>
            {/* ═══ الفواتير ═══ */}
            {tab === 'الفواتير' && (
              <>
                {/* Filters */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالشركة أو رقم الفاتورة..."
                    style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, direction: 'rtl', minWidth: 220 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['all', 'issued', 'overdue', 'paid', 'waived', 'void'] as const).map(s => (
                      <button key={s} onClick={() => setStatusFilter(s)}
                        style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid ' + (statusFilter === s ? '#1d4070' : '#e2e8f0'), background: statusFilter === s ? '#1d4070' : '#fff', color: statusFilter === s ? '#fff' : '#64748b', fontSize: 11, cursor: 'pointer', fontWeight: statusFilter === s ? 700 : 400 }}>
                        {s === 'all' ? 'الكل' : INV_STATUS[s]?.label}
                        {s !== 'all' && (
                          <span style={{ marginRight: 4 }}>({safeInvoices.filter(i => i.status === s).length})</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  {filteredInvoices.length === 0 ? (
                    <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>لا توجد فواتير</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['رقم الفاتورة', 'الشركة', 'المبلغ', 'الحالة', 'الاستحقاق', 'التذكير', 'إجراء'].map(h => (
                            <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvoices.map((inv, i) => {
                          const sc   = INV_STATUS[inv.status] || INV_STATUS.draft;
                          const isAct = actioning === inv.id;
                          const isActionable = ['issued', 'overdue'].includes(inv.status);
                          return (
                            <tr key={inv.id} style={{ borderBottom: i < filteredInvoices.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                              <td style={{ padding: '12px 18px' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4070', fontFamily: 'monospace' }}>{inv.invoice_number}</span>
                              </td>
                              <td style={{ padding: '12px 18px' }}>
                                <button onClick={() => setDrawerCompId(inv.company_id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'right' }}>
                                  <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: 0 }}>{inv.company?.name || inv.company_id}</p>
                                  <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>{PLAN_AR[inv.company?.plan] || inv.company?.plan || ''}</p>
                                </button>
                              </td>
                              <td style={{ padding: '12px 18px' }}>
                                <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>{fmt(inv.total_sar || inv.total_amount_sar)} ر.س</p>
                                {inv.vat_sar || inv.vat_amount_sar > 0 && <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>شامل {fmt(inv.vat_sar || inv.vat_amount_sar)} ض.ق.م</p>}
                              </td>
                              <td style={{ padding: '12px 18px' }}>
                                <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 600 }}>{sc.label}</span>
                              </td>
                              <td style={{ padding: '12px 18px', fontSize: 12, color: inv.status === 'overdue' ? '#c2410c' : '#64748b', direction: 'ltr', textAlign: 'right' }}>
                                {fmtDate(inv.due_date)}
                              </td>
                              <td style={{ padding: '12px 18px', fontSize: 11, color: '#64748b' }}>
                                {DUNNING[inv.dunning_step] || '—'}
                              </td>
                              <td style={{ padding: '12px 18px' }}>
                                {isActionable ? (
                                  <div style={{ display: 'flex', gap: 5 }}>
                                    <button onClick={() => setMarkPaidInv(inv)} disabled={isAct}
                                      style={{ fontSize: 10, padding: '5px 8px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                      دفع ✓
                                    </button>
                                    <button onClick={() => handleResend(inv.id)} disabled={isAct}
                                      style={{ fontSize: 10, padding: '5px 8px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4070', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                      {isAct ? '...' : 'إرسال'}
                                    </button>
                                    <button onClick={() => handleWaive(inv.id, inv.invoice_number)} disabled={isAct}
                                      style={{ fontSize: 10, padding: '5px 8px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                      إعفاء
                                    </button>
                                    <button onClick={() => handleVoid(inv.id, inv.invoice_number)} disabled={isAct}
                                      style={{ fontSize: 10, padding: '5px 8px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                      إلغاء
                                    </button>
                                    <a href={`${BASE}/admin/billing/invoices/${inv.id}/pdf`} target="_blank" rel="noopener"
                                      style={{ fontSize: 10, padding: '5px 8px', borderRadius: 6, background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-block' }}>
                                      📄 PDF
                                    </a>
                                    {inv.status === 'paid' && (
                                      <a href={`${BASE}/admin/billing/invoices/${inv.id}/receipt`} target="_blank" rel="noopener"
                                        style={{ fontSize: 10, padding: '5px 8px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-block' }}>
                                        🧾 إيصال
                                      </a>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: 5 }}>
                                    <a href={`${BASE}/admin/billing/invoices/${inv.id}/pdf`} target="_blank" rel="noopener"
                                      style={{ fontSize: 10, padding: '5px 8px', borderRadius: 6, background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-block' }}>
                                      📄 PDF
                                    </a>
                                    {inv.status === 'paid' && (
                                      <a href={`${BASE}/admin/billing/invoices/${inv.id}/receipt`} target="_blank" rel="noopener"
                                        style={{ fontSize: 10, padding: '5px 8px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-block' }}>
                                        🧾 إيصال
                                      </a>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {/* ═══ نظرة عامة ═══ */}
            {tab === 'نظرة عامة' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Stats row */}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <StatCard label="إجمالي محصّل"  value={`${fmt(stats?.total_collected || 0)} ر.س`} color="#15803d" />
                  <StatCard label="فواتير معلقة"  value={`${fmt(stats?.pending_amount || 0)} ر.س`} sub={`${safeInvoices.filter(i => i.status === 'issued').length} فاتورة`} color="#c2410c" />
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
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#854d0e', margin: '0 0 12px' }}>⏳ تجارب تنتهي قريباً ({trialsExpiringSoon.length})</p>
                        {trialsExpiringSoon.map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #fef9c3' }}>
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: 0 }}>{c.name}</p>
                            </div>
                            <div style={{ textAlign: 'left' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: daysUntil(c.trial_ends_at) <= 2 ? '#dc2626' : '#854d0e' }}>
                                {daysUntil(c.trial_ends_at)} يوم
                              </span>
                              <Link href={`/dashboard/companies/${c.id}`} style={{ display: 'block', fontSize: 10, color: '#1d4070', textDecoration: 'none', marginTop: 2 }}>إدارة →</Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {overdueInvoices.length > 0 && (
                      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #fed7aa', padding: '18px 20px' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#c2410c', margin: '0 0 12px' }}>📋 فواتير متأخرة ({overdueInvoices.length})</p>
                        {overdueInvoices.slice(0, 5).map(inv => (
                          <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #fff7ed' }}>
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', margin: 0 }}>{inv.company?.name}</p>
                              <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>{inv.invoice_number}</p>
                            </div>
                            <button onClick={() => setMarkPaidInv(inv)}
                              style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', cursor: 'pointer' }}>
                              دفع ✓
                            </button>
                          </div>
                        ))}
                        {overdueInvoices.length > 5 && (
                          <button onClick={() => { setTab('الفواتير'); setStatusFilter('overdue'); }}
                            style={{ marginTop: 8, fontSize: 11, color: '#1d4070', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            عرض الكل ({overdueInvoices.length}) →
                          </button>
                        )}
                      </div>
                    )}

                    {suspendedCompanies.length > 0 && (
                      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #fecaca', padding: '18px 20px' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', margin: '0 0 12px' }}>🔴 موقوفة ({suspendedCompanies.length})</p>
                        {suspendedCompanies.slice(0, 4).map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #fef2f2' }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: 0 }}>{c.name}</p>
                            <Link href={`/dashboard/companies/${c.id}`} style={{ fontSize: 11, color: '#dc2626', textDecoration: 'none' }}>مراجعة →</Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ بوابات الدفع ═══ */}
            {tab === 'بوابات الدفع' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe', padding: '14px 18px', fontSize: 12, color: '#1d4070', lineHeight: 1.6 }}>
                  ℹ️ بوابات الدفع معدّة للتكامل المستقبلي. لتفعيل بوابة، أدخل مفاتيح API وفعّلها. سيتعامل النظام تلقائياً مع الـ webhooks على
                  <code style={{ fontSize: 11, background: '#dbeafe', padding: '1px 5px', borderRadius: 4, margin: '0 4px' }}>/billing/webhook/:provider</code>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(380px,1fr))', gap: 16 }}>
                  {(gateways.length > 0 ? gateways : [
                    { provider: 'stripe',  is_active: false, is_sandbox: true, config: {} },
                    { provider: 'payfort', is_active: false, is_sandbox: true, config: {} },
                    { provider: 'telr',    is_active: false, is_sandbox: true, config: {} },
                    { provider: 'tap',     is_active: false, is_sandbox: true, config: {} },
                  ]).map((gw: any) => (
                    <GatewayCard key={gw.provider} gateway={gw} saving={gwSaving === gw.provider}
                      onSave={(patch) => handleGwSave(gw.provider, patch)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

            {/* ═══ القوالب ═══ */}
            {tab === 'القوالب' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                <Link href="/dashboard/billing/templates" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '16px 32px', borderRadius: 12,
                  background: '#1d4070', color: '#fff', fontSize: 15, fontWeight: 700,
                  textDecoration: 'none', boxShadow: '0 4px 16px rgba(29,64,112,.3)',
                }}>
                  📨 مركز القوالب
                </Link>
              </div>
            )}

            {/* ═══ عروض الأسعار ═══ */}
            {tab === 'عروض الأسعار' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                <Link href="/dashboard/billing/quotations" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '16px 32px', borderRadius: 12,
                  background: '#1d4070', color: '#fff', fontSize: 15, fontWeight: 700,
                  textDecoration: 'none', boxShadow: '0 4px 16px rgba(29,64,112,.3)',
                }}>
                  📋 إدارة عروض الأسعار
                </Link>
              </div>
            )}

            {/* ═══ الإعدادات ═══ */}
            {tab === 'الإعدادات' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                <Link href="/dashboard/billing/settings" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '16px 32px', borderRadius: 12,
                  background: '#1d4070', color: '#fff', fontSize: 15, fontWeight: 700,
                  textDecoration: 'none', boxShadow: '0 4px 16px rgba(29,64,112,.3)',
                }}>
                  ⚙️ فتح إعدادات الفوترة
                </Link>
              </div>
            )}
      </div>
    </div>
  );
}

// ─── Gateway config card ───────────────────────────────────────────────────────
function GatewayCard({ gateway, saving, onSave }: { gateway: any; saving: boolean; onSave: (patch: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [active,   setActive]   = useState(gateway.is_active || false);
  const [sandbox,  setSandbox]  = useState(gateway.is_sandbox !== false);
  const [keys,     setKeys]     = useState<Record<string, string>>(gateway.config || {});
  const setKey = (k: string, v: string) => setKeys(prev => ({ ...prev, [k]: v }));

  const CONFIG_FIELDS: Record<string, { label: string; key: string; placeholder: string }[]> = {
    stripe:  [{ label: 'Secret Key', key: 'secret_key', placeholder: 'sk_...' }, { label: 'Webhook Secret', key: 'webhook_secret', placeholder: 'whsec_...' }],
    payfort: [{ label: 'Merchant ID', key: 'merchant_id', placeholder: 'TESTMERCHANT' }, { label: 'Access Code', key: 'access_code', placeholder: '' }, { label: 'SHA Request Phrase', key: 'sha_request', placeholder: '' }],
    telr:    [{ label: 'Store ID', key: 'store_id', placeholder: '12345' }, { label: 'Auth Key', key: 'auth_key', placeholder: '' }],
    tap:     [{ label: 'Secret Key', key: 'secret_key', placeholder: 'sk_...' }, { label: 'Publishable Key', key: 'publishable_key', placeholder: 'pk_...' }],
  };

  const fields = CONFIG_FIELDS[gateway.provider] || [];

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${active ? '#bbf7d0' : '#e2e8f0'}`, padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            {gateway.provider === 'stripe' ? '💳' : gateway.provider === 'payfort' ? '🏦' : gateway.provider === 'telr' ? '🔷' : '🟢'}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{GW_LABELS[gateway.provider]}</p>
            <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>{gateway.provider}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: active ? '#f0fdf4' : '#f8fafc', color: active ? '#15803d' : '#64748b', fontWeight: 600, border: `1px solid ${active ? '#bbf7d0' : '#e2e8f0'}` }}>
            {active ? 'مفعّل' : 'معطّل'}
          </span>
          <button onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94a3b8' }}>
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              تفعيل البوابة
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={sandbox} onChange={e => setSandbox(e.target.checked)} />
              وضع الاختبار (Sandbox)
            </label>
          </div>
          {fields.map(f => (
            <div key={f.key} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, color: '#64748b' }}>{f.label}</label>
              <input value={keys[f.key] || ''} onChange={e => setKey(f.key, e.target.value)} placeholder={f.placeholder}
                type="password"
                style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' }} />
            </div>
          ))}
          <button onClick={() => onSave({ is_active: active, is_sandbox: sandbox, config: keys })} disabled={saving}
            style={{ width: '100%', padding: '9px', borderRadius: 8, border: 'none', background: '#1d4070', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginTop: 6 }}>
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </>
      )}
    </div>
  );
}
