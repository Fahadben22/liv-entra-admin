'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { request } from '@/lib/api';

type Settings = Record<string, any>;

export default function BillingSettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    try {
      const res = await request<any>('GET', '/admin/billing/settings');
      setForm(res?.data || {});
    } catch {}
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await request('PUT', '/admin/billing/settings', form);
      showToast('تم حفظ الإعدادات بنجاح ✓');
    } catch (e: any) { showToast(e.message || 'خطأ'); }
    setSaving(false);
  };

  const C = {
    bg: '#05081a', card: '#0c1535', border: 'rgba(255,255,255,.07)',
    text: '#e2e8f0', text2: '#94a3b8', accent: '#2563eb',
  };

  if (loading) return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text2 }}>جاري التحميل...</div>;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Tajawal', sans-serif", direction: 'rtl' }}>
      {toast && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#059669', color: '#fff', padding: '10px 28px', borderRadius: 10, fontSize: 13, zIndex: 9999, fontWeight: 700 }}>{toast}</div>}

      {/* Nav */}
      <nav style={{ background: 'rgba(5,8,26,.95)', borderBottom: `1px solid ${C.border}`, padding: '12px 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/dashboard" style={{ fontWeight: 800, fontSize: 15, color: '#fff', textDecoration: 'none' }}>LIVENTRA OS</Link>
          <Link href="/dashboard/billing" style={{ fontSize: 13, color: C.text2, textDecoration: 'none' }}>← الفوترة</Link>
          <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>إعدادات الفوترة</span>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>إعدادات الفوترة والفواتير ⚙️</h1>
        <p style={{ color: C.text2, fontSize: 14, marginBottom: 32 }}>خصّص بيانات الشركة، الضريبة، البنك، وتنسيق الفواتير</p>

        {/* Section: Company Identity */}
        <Section title="هوية الشركة" icon="🏢">
          <Row label="اسم الشركة (عربي)" value={form.company_name_ar} onChange={v => set('company_name_ar', v)} />
          <Row label="اسم الشركة (إنجليزي)" value={form.company_name_en} onChange={v => set('company_name_en', v)} />
          <Row label="رابط الشعار (URL)" value={form.logo_url} onChange={v => set('logo_url', v)} placeholder="https://..." />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Row label="اللون الرئيسي" value={form.primary_color} onChange={v => set('primary_color', v)} type="color" />
            <Row label="اللون المميز" value={form.accent_color} onChange={v => set('accent_color', v)} type="color" />
          </div>
        </Section>

        {/* Section: Tax */}
        <Section title="المعلومات الضريبية" icon="🧾">
          <Row label="الرقم الضريبي (VAT)" value={form.vat_number} onChange={v => set('vat_number', v)} />
          <Row label="السجل التجاري (CR)" value={form.cr_number} onChange={v => set('cr_number', v)} />
          <Row label="نسبة ضريبة القيمة المضافة" value={form.vat_rate} onChange={v => set('vat_rate', v)} type="number" placeholder="0.15" />
        </Section>

        {/* Section: Bank */}
        <Section title="التفاصيل البنكية" icon="🏦">
          <Row label="اسم البنك" value={form.bank_name} onChange={v => set('bank_name', v)} />
          <Row label="رقم الحساب" value={form.bank_account} onChange={v => set('bank_account', v)} />
          <Row label="IBAN" value={form.bank_iban} onChange={v => set('bank_iban', v)} />
          <Row label="SWIFT" value={form.bank_swift} onChange={v => set('bank_swift', v)} />
        </Section>

        {/* Section: Payment Terms */}
        <Section title="شروط الدفع" icon="📅">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Row label="أيام السداد الافتراضية" value={form.default_payment_terms} onChange={v => set('default_payment_terms', Number(v))} type="number" />
            <Row label="فترة السماح (أيام)" value={form.grace_period_days} onChange={v => set('grace_period_days', Number(v))} type="number" />
          </div>
        </Section>

        {/* Section: Invoice Customization */}
        <Section title="تخصيص الفواتير" icon="📄">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Row label="بادئة الفاتورة" value={form.invoice_prefix} onChange={v => set('invoice_prefix', v)} />
            <Row label="بادئة عرض السعر" value={form.quotation_prefix} onChange={v => set('quotation_prefix', v)} />
            <Row label="بادئة الإشعار الدائن" value={form.credit_note_prefix} onChange={v => set('credit_note_prefix', v)} />
          </div>
          <Row label="ذيل الفاتورة (عربي)" value={form.invoice_footer_ar} onChange={v => set('invoice_footer_ar', v)} multiline />
          <Row label="ذيل الفاتورة (إنجليزي)" value={form.invoice_footer_en} onChange={v => set('invoice_footer_en', v)} multiline />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Row label="رمز العملة" value={form.currency_code} onChange={v => set('currency_code', v)} />
            <Row label="رمز العملة (عرض)" value={form.currency_symbol} onChange={v => set('currency_symbol', v)} />
          </div>
          <Row label="بريد الرد (Reply-To)" value={form.receipt_reply_to} onChange={v => set('receipt_reply_to', v)} placeholder="billing@company.com" />
        </Section>

        {/* Save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
          <button onClick={save} disabled={saving}
            style={{
              padding: '14px 40px', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 800,
              background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1,
              boxShadow: '0 4px 16px rgba(5,150,105,.4)',
            }}>
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Components ─────────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#0c1535', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: '24px 28px', marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span> {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

function Row({ label, value, onChange, type = 'text', placeholder, multiline }: {
  label: string; value: any; onChange: (v: string) => void; type?: string; placeholder?: string; multiline?: boolean;
}) {
  const style = {
    width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
    border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
    color: '#e2e8f0', fontFamily: 'inherit', boxSizing: 'border-box' as const,
    outline: 'none',
  };

  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>{label}</label>
      {type === 'color' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} style={{ width: 40, height: 36, border: 'none', background: 'none', cursor: 'pointer' }} />
          <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...style, flex: 1 }} />
        </div>
      ) : multiline ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={2} placeholder={placeholder} style={{ ...style, resize: 'vertical' }} />
      ) : (
        <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={style} />
      )}
    </div>
  );
}
