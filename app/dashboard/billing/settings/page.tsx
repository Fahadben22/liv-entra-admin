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
      showToast('تم حفظ الإعدادات بنجاح');
    } catch (e: any) { showToast(e.message || 'خطأ'); }
    setSaving(false);
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#a1a1aa' }}>جاري التحميل...</div>;

  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#18181b', color: '#fff', padding: '10px 28px', borderRadius: 7, fontSize: 13, zIndex: 9999 }}>{toast}</div>}

      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#18181b' }}>إعدادات الفوترة والفواتير</h1>
      <p style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 28 }}>خصّص بيانات الشركة، الضريبة، البنك، وتنسيق الفواتير</p>

      {/* Section: Company Identity */}
      <Section title="هوية الشركة">
        <Row label="اسم الشركة (عربي)" value={form.company_name_ar} onChange={v => set('company_name_ar', v)} />
        <Row label="اسم الشركة (إنجليزي)" value={form.company_name_en} onChange={v => set('company_name_en', v)} />
        <Row label="رابط الشعار (URL)" value={form.logo_url} onChange={v => set('logo_url', v)} placeholder="https://..." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Row label="اللون الرئيسي" value={form.primary_color} onChange={v => set('primary_color', v)} type="color" />
          <Row label="اللون المميز" value={form.accent_color} onChange={v => set('accent_color', v)} type="color" />
        </div>
      </Section>

      {/* Section: Tax */}
      <Section title="المعلومات الضريبية">
        <Row label="الرقم الضريبي (VAT)" value={form.vat_number} onChange={v => set('vat_number', v)} />
        <Row label="السجل التجاري (CR)" value={form.cr_number} onChange={v => set('cr_number', v)} />
        <Row label="نسبة ضريبة القيمة المضافة" value={form.vat_rate} onChange={v => set('vat_rate', v)} type="number" placeholder="0.15" />
      </Section>

      {/* Section: Bank */}
      <Section title="التفاصيل البنكية">
        <Row label="اسم البنك" value={form.bank_name} onChange={v => set('bank_name', v)} />
        <Row label="رقم الحساب" value={form.bank_account} onChange={v => set('bank_account', v)} />
        <Row label="IBAN" value={form.bank_iban} onChange={v => set('bank_iban', v)} />
        <Row label="SWIFT" value={form.bank_swift} onChange={v => set('bank_swift', v)} />
      </Section>

      {/* Section: Payment Terms */}
      <Section title="شروط الدفع">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Row label="أيام السداد الافتراضية" value={form.default_payment_terms} onChange={v => set('default_payment_terms', Number(v))} type="number" />
          <Row label="فترة السماح (أيام)" value={form.grace_period_days} onChange={v => set('grace_period_days', Number(v))} type="number" />
        </div>
      </Section>

      {/* Section: Invoice Customization */}
      <Section title="تخصيص الفواتير">
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28 }}>
        <button onClick={save} disabled={saving}
          style={{
            padding: '10px 32px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600,
            background: '#18181b', color: '#fff',
            cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1,
          }}>
          {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </div>
    </div>
  );
}

// ── Components ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: '24px 28px', marginBottom: 20 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: '#18181b' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

function Row({ label, value, onChange, type = 'text', placeholder, multiline }: {
  label: string; value: any; onChange: (v: string) => void; type?: string; placeholder?: string; multiline?: boolean;
}) {
  const style: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 7, fontSize: 13,
    border: '1px solid #e5e5e5', background: '#fff',
    color: '#18181b', fontFamily: 'inherit', boxSizing: 'border-box',
    outline: 'none',
  };

  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>{label}</label>
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
