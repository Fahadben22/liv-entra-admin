'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BASE } from '@/lib/api';

const API = BASE || process.env.NEXT_PUBLIC_API_URL || 'https://liv-entra-api-production.up.railway.app/api/v1';

interface Plan {
  id: string; name: string; name_ar: string;
  price_monthly: number; price_yearly: number;
}

export default function SubscribePageWrapper() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#05081a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#94a3b8' }}>جاري التحميل...</p></div>}><SubscribePage /></Suspense>;
}

function SubscribePage() {
  const searchParams = useSearchParams();
  const planId   = searchParams?.get('plan_id') || '';
  const planName = searchParams?.get('plan') || '';
  const cycle    = searchParams?.get('cycle') || 'monthly';
  const isTrial  = searchParams?.get('trial') === '1';

  const [step, setStep] = useState(1);
  const [plan, setPlan]   = useState<Plan | null>(null);
  const [loading, setLoading]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]     = useState('');
  const [couponCode, setCouponCode] = useState('');

  const [form, setForm] = useState({
    company_name: '', company_name_ar: '', company_slug: '',
    company_city: '', company_cr_number: '',
    company_contact_phone: '', company_contact_email: '',
    admin_name: '', admin_phone: '', admin_email: '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Auto-generate slug from company name
  const handleNameChange = (name: string) => {
    set('company_name', name);
    if (!form.company_slug || form.company_slug === form.company_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')) {
      set('company_slug', name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    }
  };

  // Fetch plan details (match by ID or name)
  useEffect(() => {
    if (!planId && !planName) return;
    fetch(`${API}/public/plans`)
      .then(r => r.json())
      .then(r => {
        const plans = r.data || [];
        const found = planId
          ? plans.find((p: Plan) => p.id === planId)
          : plans.find((p: Plan) => p.name?.toLowerCase() === planName.toLowerCase() || p.name_ar === planName);
        if (found) setPlan(found);
      })
      .catch(() => {});
  }, [planId, planName]);

  const price = plan ? (cycle === 'yearly' ? plan.price_yearly : plan.price_monthly) : 0;
  const vatAmount = Math.round(price * 0.15 * 100) / 100;
  const totalAmount = price + vatAmount;

  const handleSubmit = async () => {
    setErr('');
    if (!form.company_name || !form.company_slug) { setErr('اسم الشركة والمعرّف مطلوبان'); return; }
    if (!form.admin_name || !form.admin_phone) { setErr('اسم المدير ورقم الجوال مطلوبان'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/public/subscribe/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          plan_id: planId,
          billing_cycle: cycle,
          coupon_code: couponCode || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) { setErr(data.message || 'خطأ غير متوقع'); setSubmitting(false); return; }

      // Redirect to Tap Payments
      if (data.data?.redirect_url) {
        window.location.href = data.data.redirect_url;
      } else {
        setErr('لم يتم استلام رابط الدفع');
        setSubmitting(false);
      }
    } catch (e: any) {
      setErr(e.message || 'خطأ في الاتصال');
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1px solid rgba(255,255,255,.12)', background: '#0c1535',
    color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' as const,
    direction: 'rtl' as const,
  };

  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 6 };

  return (
    <div style={{ minHeight: '100vh', background: '#05081a', direction: 'rtl', padding: '40px 24px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>
            {isTrial ? 'تجربة مجانية' : 'إتمام الاشتراك'}
          </h1>
          {plan && (
            <p style={{ fontSize: 14, color: '#94a3b8' }}>
              الخطة: <span style={{ color: '#3b82f6', fontWeight: 700 }}>{plan.name_ar}</span>
              {!isTrial && <> — {totalAmount.toLocaleString()} ر.س {cycle === 'yearly' ? 'سنوياً' : 'شهرياً'}</>}
            </p>
          )}
        </div>

        {/* Steps indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32, justifyContent: 'center' }}>
          {['بيانات الشركة', 'بيانات المدير', isTrial ? 'تأكيد' : 'الدفع'].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: step > i + 1 ? '#15803d' : step === i + 1 ? '#3b82f6' : '#1e293b',
                color: '#fff',
              }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 12, color: step === i + 1 ? '#e2e8f0' : '#64748b' }}>{s}</span>
              {i < 2 && <div style={{ width: 30, height: 1, background: 'rgba(255,255,255,.1)' }} />}
            </div>
          ))}
        </div>

        <div style={{ background: '#0c1535', borderRadius: 20, padding: '32px 28px', border: '1px solid rgba(255,255,255,.08)' }}>
          {/* Step 1: Company details */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>اسم الشركة (إنجليزي) *</label>
                <input value={form.company_name} onChange={e => handleNameChange(e.target.value)} placeholder="My Company" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>اسم الشركة (عربي)</label>
                <input value={form.company_name_ar} onChange={e => set('company_name_ar', e.target.value)} placeholder="شركتي" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>المعرّف (slug) *</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input value={form.company_slug} onChange={e => set('company_slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="my-company" style={{ ...inputStyle, direction: 'ltr' }} />
                </div>
                <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>رابط لوحة التحكم: app.liv-entra.com/{form.company_slug || '...'}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>المدينة</label>
                  <input value={form.company_city} onChange={e => set('company_city', e.target.value)} placeholder="الرياض" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>رقم السجل التجاري</label>
                  <input value={form.company_cr_number} onChange={e => set('company_cr_number', e.target.value)} placeholder="1010000000" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>هاتف الشركة</label>
                  <input value={form.company_contact_phone} onChange={e => set('company_contact_phone', e.target.value)} placeholder="+966500000000" style={{ ...inputStyle, direction: 'ltr' }} />
                </div>
                <div>
                  <label style={labelStyle}>بريد الشركة</label>
                  <input value={form.company_contact_email} onChange={e => set('company_contact_email', e.target.value)} placeholder="info@company.sa" style={{ ...inputStyle, direction: 'ltr' }} />
                </div>
              </div>
              <button onClick={() => {
                if (!form.company_name || !form.company_slug) { setErr('اسم الشركة والمعرّف مطلوبان'); return; }
                setErr(''); setStep(2);
              }}
                style={{ padding: '14px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700, marginTop: 8 }}>
                التالي
              </button>
            </div>
          )}

          {/* Step 2: Admin details */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>اسم المدير *</label>
                <input value={form.admin_name} onChange={e => set('admin_name', e.target.value)} placeholder="أحمد محمد" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>رقم جوال المدير (يُستخدم لتسجيل الدخول) *</label>
                <input value={form.admin_phone} onChange={e => set('admin_phone', e.target.value)} placeholder="05XXXXXXXX" style={{ ...inputStyle, direction: 'ltr' }} />
              </div>
              <div>
                <label style={labelStyle}>البريد الإلكتروني (لإرسال بيانات الدخول)</label>
                <input value={form.admin_email} onChange={e => set('admin_email', e.target.value)} placeholder="admin@company.sa" style={{ ...inputStyle, direction: 'ltr' }} />
              </div>

              {!isTrial && (
                <div>
                  <label style={labelStyle}>كود خصم (اختياري)</label>
                  <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="WELCOME2026" style={{ ...inputStyle, direction: 'ltr' }} />
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={() => setStep(1)}
                  style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer', fontSize: 14 }}>
                  السابق
                </button>
                <button onClick={() => {
                  if (!form.admin_name || !form.admin_phone) { setErr('اسم المدير ورقم الجوال مطلوبان'); return; }
                  setErr(''); setStep(3);
                }}
                  style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700 }}>
                  التالي
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation & payment */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>ملخص الاشتراك</h3>

              {/* Summary */}
              <div style={{ background: '#05081a', borderRadius: 12, padding: '16px 20px' }}>
                {[
                  { l: 'الشركة', v: form.company_name },
                  { l: 'المعرّف', v: form.company_slug },
                  { l: 'المدير', v: `${form.admin_name} — ${form.admin_phone}` },
                  { l: 'الخطة', v: plan?.name_ar || '—' },
                  { l: 'الدورة', v: cycle === 'yearly' ? 'سنوية' : 'شهرية' },
                ].map(item => (
                  <div key={item.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>{item.l}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{item.v}</span>
                  </div>
                ))}
              </div>

              {!isTrial && (
                <div style={{ background: '#05081a', borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>المبلغ</span>
                    <span style={{ fontSize: 13, color: '#e2e8f0' }}>{price.toLocaleString()} ر.س</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>ضريبة القيمة المضافة 15%</span>
                    <span style={{ fontSize: 13, color: '#e2e8f0' }}>{vatAmount.toLocaleString()} ر.س</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,.1)', marginTop: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>الإجمالي</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#3b82f6' }}>{totalAmount.toLocaleString()} ر.س</span>
                  </div>
                </div>
              )}

              {err && <p style={{ fontSize: 13, color: '#f87171', margin: 0, textAlign: 'center' }}>{err}</p>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(2)}
                  style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer', fontSize: 14 }}>
                  تعديل
                </button>
                <button onClick={handleSubmit} disabled={submitting}
                  style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: submitting ? '#1e3a5f' : '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700 }}>
                  {submitting ? 'جاري المعالجة...' : isTrial ? 'بدء التجربة المجانية' : `ادفع ${totalAmount.toLocaleString()} ر.س`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
