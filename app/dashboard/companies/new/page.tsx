'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { CITIES } from '@/lib/constants';
import { useDebounce } from '@/lib/hooks';
import { useToast } from '@/components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────
type Plan = 'trial' | 'basic' | 'professional' | 'enterprise';

interface FormData {
  // Step 1 — Company Info
  name: string;
  name_ar: string;
  slug: string;
  city: string;
  cr_number: string;
  contact_phone: string;
  contact_email: string;
  // Step 2 — Plan & Limits
  plan: Plan;
  max_units: number;
  max_staff: number;
  trial_days: number;
  billing_cycle: 'monthly' | 'yearly';
  // Step 3 — Admin User
  admin_name: string;
  admin_phone: string;   // PRIMARY login username on app.liv-entra.com
  admin_email: string;   // welcome email only (optional)
}

// CITIES imported from @/lib/constants

const PLANS: { key: Plan; label: string; labelEn: string; color: string; desc: string; features: string[] }[] = [
  {
    key: 'trial', label: 'تجريبي', labelEn: 'Trial', color: '#71717a',
    desc: '30 يوم مجاناً',
    features: ['إدارة العقود','طلبات الصيانة','تتبع المدفوعات','التقارير الأساسية'],
  },
  {
    key: 'basic', label: 'أساسي', labelEn: 'Basic', color: '#3b82f6',
    desc: 'للمكاتب الصغيرة',
    features: ['إدارة العقود','طلبات الصيانة','تتبع المدفوعات','التقارير الأساسية'],
  },
  {
    key: 'professional', label: 'احترافي', labelEn: 'Professional', color: '#7c3aed',
    desc: 'للمكاتب المتوسطة',
    features: ['كل ميزات الأساسي','التحليل الذكي','إشعارات واتساب','تعدد الفروع','التقارير المتقدمة'],
  },
  {
    key: 'enterprise', label: 'مؤسسي', labelEn: 'Enterprise', color: '#b45309',
    desc: 'للشركات الكبيرة',
    features: ['كل الميزات','وصول API','هوية مخصصة','إدارة دورة الوحدة','AI الإيجار (تجريبي)'],
  },
];

const PLAN_DEFAULTS: Record<Plan, { max_units: number; max_staff: number }> = {
  trial:        { max_units: 50,   max_staff: 5 },
  basic:        { max_units: 100,  max_staff: 10 },
  professional: { max_units: 500,  max_staff: 25 },
  enterprise:   { max_units: 9999, max_staff: 100 },
};

const STEPS = [
  { num: 1, label: 'بيانات الشركة' },
  { num: 2, label: 'الخطة والحدود' },
  { num: 3, label: 'إعداد المدير' },
  { num: 4, label: 'مراجعة وإنشاء' },
];

// Convert name to URL-safe slug (Latin only — strips Arabic, falls back to timestamp)
function toSlug(name: string) {
  const latin = name
    .trim()
    .toLowerCase()
    .replace(/[\u0600-\u06FF]/g, '')   // remove Arabic characters
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanumeric → hyphen
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  // If the name is entirely Arabic, generate a timestamp-based slug
  return latin || `co-${Date.now().toString(36)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function NewCompanyPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState<any>(null);
  const [slugManual, setSlugManual] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);

  const [form, setForm] = useState<FormData>({
    name: '', name_ar: '', slug: '', city: 'الرياض', cr_number: '',
    contact_phone: '', contact_email: '',
    plan: 'trial', max_units: 50, max_staff: 5, trial_days: 30,
    billing_cycle: 'monthly',
    admin_name: '', admin_phone: '', admin_email: '',
  });

  // Debounced slug check
  const debouncedSlug = useDebounce(form.slug, 500);
  useEffect(() => {
    if (!debouncedSlug || debouncedSlug.length < 2) { setSlugAvailable(null); return; }
    let cancelled = false;
    setSlugChecking(true);
    adminApi.sa.checkSlug(debouncedSlug).then((res: any) => {
      if (!cancelled) { setSlugAvailable(res?.data?.available ?? null); setSlugChecking(false); }
    }).catch(() => { if (!cancelled) { setSlugAvailable(null); setSlugChecking(false); } });
    return () => { cancelled = true; };
  }, [debouncedSlug]);

  // Auto-fill slug from name unless manually edited
  useEffect(() => {
    if (!slugManual && form.name) {
      setForm(p => ({ ...p, slug: toSlug(form.name) }));
    }
  }, [form.name, slugManual]);

  // When plan changes, update limits to defaults (unless user already customised)
  function handlePlanChange(plan: Plan) {
    setForm(p => ({ ...p, plan, ...PLAN_DEFAULTS[plan] }));
  }

  function set(k: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));
  }

  // ─── Validation per step ────────────────────────────────────────────────────
  function validate(s: number): string {
    if (s === 1) {
      if (!form.name.trim())   return 'اسم الشركة مطلوب';
      if (!form.slug.trim())   return 'رابط النظام مطلوب';
      if (!/^[a-z0-9-]+$/.test(form.slug)) return 'رابط النظام: أحرف إنجليزية صغيرة وأرقام وشرطة فقط';
    }
    if (s === 2) {
      if (form.max_units < 1)  return 'الحد الأقصى للوحدات يجب أن يكون أكبر من صفر';
      if (form.max_staff < 1)  return 'الحد الأقصى للموظفين يجب أن يكون أكبر من صفر';
    }
    if (s === 1) {
      if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email))
        return 'البريد الإلكتروني للتواصل غير صالح';
    }
    if (s === 3) {
      if (!form.admin_phone.trim()) return 'رقم جوال المدير مطلوب — يُستخدم كاسم المستخدم للدخول';
      if (!/^(\+?(966|971|973|968|965|974)|05)\d{7,10}$/.test(form.admin_phone.replace(/\s/g, '')))
        return 'رقم الجوال يجب أن يبدأ بـ 05 أو رمز دولي صحيح (+966, +971, ...)';
      if (form.admin_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email))
        return 'البريد الإلكتروني غير صالح';
    }
    return '';
  }

  function next() {
    const e = validate(step);
    if (e) { setErr(e); return; }
    setErr('');
    setStep(s => s + 1);
  }

  function back() { setErr(''); setStep(s => s - 1); }

  // ─── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const e = validate(3);
    if (e) { setErr(e); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        name: form.name, name_ar: form.name_ar, slug: form.slug,
        plan: form.plan, max_units: form.max_units, max_staff: form.max_staff,
        city: form.city, cr_number: form.cr_number,
        contact_phone: form.contact_phone, contact_email: form.contact_email,
        admin_name: form.admin_name,
        admin_phone: form.admin_phone,
        admin_email: form.admin_email,
        trial_days: form.plan === 'trial' ? form.trial_days : undefined,
        billing_cycle: form.billing_cycle,
      };
      const res: any = await adminApi.createCompany(payload);
      setSuccess(res?.data);
    } catch (e: any) { setErr(e.message); setSaving(false); }
  }

  // ─── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ background: '#09090b' }}>
        <Header />
        <div style={{ padding: 32, maxWidth: 560, margin: '0 auto' }}>
          <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: 36, border: '1px solid rgba(255,255,255,.06)', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(99,102,241,.15)', border: '1px solid rgba(99,102,241,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 20, color: '#6366f1' }}>✓</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fafafa', margin: '0 0 6px' }}>تم إنشاء الشركة بنجاح</h2>
            <p style={{ fontSize: 13, color: '#52525b', margin: '0 0 28px' }}>
              {form.admin_email
                ? `سيصل بريد الترحيب قريباً إلى ${form.admin_email}`
                : 'شارك رابط الدخول ورقم الجوال مع مدير الشركة'}
            </p>
            <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '18px 22px', textAlign: 'right', marginBottom: 24 }}>
              <p style={{ fontSize: 11, color: '#a1a1aa', margin: '0 0 14px', fontWeight: 500, letterSpacing: '0.05em' }}>بيانات الدخول</p>
              {[
                ['اسم الشركة',              success.company?.name || form.name],
                ['رابط تسجيل الدخول',       success.login_url || `https://app.liv-entra.com/${form.slug}`],
                ['اسم المستخدم',            success.staff?.phone || form.admin_phone],
                ['طريقة الدخول',            'OTP — رمز التحقق يُرسل إلى رقم الجوال'],
                ...(form.admin_email ? [['البريد الإلكتروني', success.staff?.email || form.admin_email]] : []),
                ...(form.admin_email ? [['حالة البريد', 'جاري الإرسال في الخلفية']] : []),
              ].map(([k, v]) => (
                <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                  <span style={{ fontSize: 12, color: '#52525b' }}>{k}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa', direction: 'ltr', fontFamily: 'monospace' }}>{v as string}</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 7, padding: '10px 14px', textAlign: 'right', marginBottom: 24, fontSize: 12, color: '#6366f1' }}>
              الدخول عبر OTP — يُرسَل رمز التحقق إلى الجوال المسجّل عند كل تسجيل دخول
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setSuccess(null); setStep(1); setForm({ name: '', name_ar: '', slug: '', city: 'الرياض', cr_number: '', contact_phone: '', contact_email: '', plan: 'trial', max_units: 50, max_staff: 5, trial_days: 30, billing_cycle: 'monthly', admin_name: '', admin_phone: '', admin_email: '' }); setSlugManual(false); }}
                style={{ flex: 1, padding: '11px', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, fontSize: 12, cursor: 'pointer', background: 'rgba(255,255,255,.04)', color: '#a1a1aa', fontWeight: 500 }}>
                إضافة شركة أخرى
              </button>
              <button onClick={() => router.push('/dashboard/companies')}
                style={{ flex: 2, padding: '11px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                عرض جميع الشركات
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentPlan = PLANS.find(p => p.key === form.plan)!;

  return (
    <div style={{ background: '#09090b' }}>
      <Header />

      {/* Progress bar — dots style */}
      <div style={{ background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '0 24px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', alignItems: 'stretch', gap: 0 }}>
          {STEPS.map((s, i) => {
            const done = step > s.num;
            const active = step === s.num;
            return (
              <div key={s.num} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 8px 12px', position: 'relative', cursor: done ? 'pointer' : 'default' }}
                onClick={() => done ? setStep(s.num) : undefined}>
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div style={{ position: 'absolute', top: 24, left: 0, width: '50%', height: 1, background: done || step > s.num ? '#6366f1' : 'rgba(255,255,255,.06)', zIndex: 0 }} />
                )}
                {i > 0 && (
                  <div style={{ position: 'absolute', top: 24, right: 0, width: '50%', height: 1, background: done ? '#6366f1' : 'rgba(255,255,255,.06)', zIndex: 0 }} />
                )}
                {/* Dot */}
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: active ? '#6366f1' : done ? '#6366f1' : 'transparent',
                  color: active || done ? '#fff' : '#52525b',
                  border: active || done ? '2px solid #6366f1' : '2px solid rgba(255,255,255,.08)',
                  fontSize: 10, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 1, position: 'relative', transition: 'all 0.2s',
                }}>
                  {done ? '✓' : s.num}
                </div>
                <span style={{ fontSize: 10, color: active ? '#fafafa' : done ? '#fafafa' : '#52525b', marginTop: 4, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '28px 20px', maxWidth: 700, margin: '0 auto' }}>
        {err && (
          <div style={{ background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 7, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#dc2626' }}>
            {err}
          </div>
        )}

        {/* ── STEP 1: Company Info ─────────────────────────────────────────── */}
        {step === 1 && (
          <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: 28, border: '1px solid rgba(255,255,255,.06)' }}>
            <StepHeader title="بيانات الشركة" sub="المعلومات الأساسية لتسجيل الشركة في النظام" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="اسم الشركة *" hint="سيظهر في واجهة المستخدمين">
                  <input value={form.name} onChange={set('name')} placeholder="مثال: شركة الأفق للعقارات" style={inp()} />
                </Field>
              </div>
              <Field label="الاسم بالعربي" hint="للعرض في التقارير">
                <input value={form.name_ar} onChange={set('name_ar')} placeholder="شركة الأفق للعقارات" style={inp()} />
              </Field>
              <Field label="المدينة">
                <select value={form.city} onChange={set('city')} style={inp()}>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>

              {/* Slug */}
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="معرّف النظام (Slug) *" hint="يُستخدم داخلياً لتمييز الشركة — يتولد تلقائياً من الاسم">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input value={form.slug} onChange={e => { setSlugManual(true); setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-') })); }}
                      placeholder="مثال: al-ofuq-realestate" dir="ltr"
                      style={{ ...inp(), flex: 1, fontFamily: 'monospace', fontSize: 13 }} />
                    {slugManual && (
                      <button type="button" onClick={() => { setSlugManual(false); setForm(p => ({ ...p, slug: toSlug(form.name) })); }}
                        style={{ padding: '7px 12px', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: 'rgba(255,255,255,.04)', color: '#a1a1aa', whiteSpace: 'nowrap' }}>
                        إعادة توليد
                      </button>
                    )}
                  </div>
                  {form.slug && (
                    <div style={{ marginTop: 6, padding: '6px 10px', background: slugAvailable === false ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.04)', borderRadius: 7, fontSize: 11, color: slugAvailable === false ? '#dc2626' : '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,.06)' }}>
                      <span>معرّف الشركة: <strong dir="ltr">{form.slug}</strong></span>
                      <span>{slugChecking ? '...' : slugAvailable === true ? 'متاح' : slugAvailable === false ? 'مستخدم' : ''}</span>
                    </div>
                  )}
                </Field>
              </div>

              <Field label="رقم السجل التجاري">
                <input value={form.cr_number} onChange={set('cr_number')} placeholder="1234567890" style={inp()} />
              </Field>
              <Field label="هاتف الشركة">
                <input value={form.contact_phone} onChange={set('contact_phone')} placeholder="0512345678" dir="ltr" style={inp()} />
              </Field>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="بريد الشركة">
                  <input type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="info@company.com" dir="ltr" style={inp()} />
                </Field>
              </div>
            </div>
            <NavButtons onNext={next} />
          </div>
        )}

        {/* ── STEP 2: Plan & Limits ────────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: 28, border: '1px solid rgba(255,255,255,.06)' }}>
            <StepHeader title="الخطة والحدود" sub="اختر الخطة المناسبة وحدد حدود الاستخدام" />

            {/* Plan cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              {PLANS.map(p => {
                const active = form.plan === p.key;
                return (
                  <div key={p.key} onClick={() => handlePlanChange(p.key)}
                    style={{ border: `1.5px solid ${active ? '#6366f1' : 'rgba(255,255,255,.06)'}`, borderRadius: 8, padding: '16px 18px', cursor: 'pointer', background: active ? 'rgba(99,102,241,.1)' : 'rgba(255,255,255,.03)', transition: 'all 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: active ? '#fafafa' : '#a1a1aa' }}>{p.label}</span>
                      <span style={{ fontSize: 10, color: '#52525b', background: 'rgba(255,255,255,.04)', padding: '2px 8px', borderRadius: 7, border: '1px solid rgba(255,255,255,.06)' }}>{p.desc}</span>
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                      {p.features.map(f => (
                        <li key={f} style={{ fontSize: 11, color: '#52525b', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: active ? '#6366f1' : '#52525b', display: 'inline-block' }} /> {f}
                        </li>
                      ))}
                    </ul>
                    {active && <div style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: '#6366f1' }}>✓ محدد</div>}
                  </div>
                );
              })}
            </div>

            {/* Limits */}
            <div style={{ border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '18px 20px', marginBottom: 4 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', margin: '0 0 14px' }}>حدود الاستخدام</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="الحد الأقصى للوحدات" hint="عدد الشقق / الوحدات المسموح بها">
                  <input type="number" min={1} max={9999} value={form.max_units} onChange={set('max_units')} style={inp()} />
                </Field>
                <Field label="الحد الأقصى للموظفين" hint="عدد حسابات الموظفين">
                  <input type="number" min={1} max={999} value={form.max_staff} onChange={set('max_staff')} style={inp()} />
                </Field>
                {form.plan === 'trial' && (
                  <Field label="مدة التجربة (أيام)" hint="بعدها تنتهي الفترة التجريبية">
                    <input type="number" min={1} max={90} value={form.trial_days} onChange={set('trial_days')} style={inp()} />
                  </Field>
                )}
              </div>
            </div>

            <NavButtons onBack={back} onNext={next} />
          </div>
        )}

        {/* ── STEP 3: Admin User ───────────────────────────────────────────── */}
        {step === 3 && (
          <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: 28, border: '1px solid rgba(255,255,255,.06)' }}>
            <StepHeader title="إعداد مدير النظام" sub="بيانات الشخص المسؤول عن إدارة الشركة في النظام" />

            {/* Phone-login callout */}
            <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 7, padding: '12px 16px', marginBottom: 22 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#fafafa', margin: '0 0 2px' }}>رقم الجوال هو اسم المستخدم</p>
              <p style={{ fontSize: 11, color: '#52525b', margin: 0 }}>
                يستخدم النظام رقم الجوال فقط لتسجيل الدخول في <strong>app.liv-entra.com</strong> — يُرسل رمز OTP عبر الجوال
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="اسم المدير">
                  <input value={form.admin_name} onChange={set('admin_name')} placeholder="مثال: محمد العمري" style={inp()} />
                </Field>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="رقم الجوال * (اسم المستخدم)" hint="يبدأ بـ 05 أو +966 أو 966">
                  <input value={form.admin_phone} onChange={set('admin_phone')} placeholder="0512345678" dir="ltr"
                    style={{ ...inp(), border: '1.5px solid #6366f1' }} />
                </Field>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="البريد الإلكتروني" hint="اختياري — لإرسال بريد الترحيب فقط">
                  <input type="email" value={form.admin_email} onChange={set('admin_email')} placeholder="admin@company.com" dir="ltr" style={inp()} />
                </Field>
              </div>
            </div>

            <NavButtons onBack={back} onNext={next} />
          </div>
        )}

        {/* ── STEP 4: Review ───────────────────────────────────────────────── */}
        {step === 4 && (
          <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: 28, border: '1px solid rgba(255,255,255,.06)' }}>
            <StepHeader title="مراجعة وإنشاء" sub="تأكد من البيانات قبل إنشاء الشركة" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              {/* Company */}
              <ReviewCard title="بيانات الشركة" onEdit={() => setStep(1)} rows={[
                ['الاسم', form.name],
                ['الاسم بالعربي', form.name_ar || '—'],
                ['المعرّف', form.slug],
                ['المدينة', form.city],
                ['السجل التجاري', form.cr_number || '—'],
                ['هاتف الشركة', form.contact_phone || '—'],
              ]} />
              {/* Plan */}
              <ReviewCard title={`الخطة — ${currentPlan.label}`} onEdit={() => setStep(2)} rows={[
                ['الخطة', currentPlan.label],
                ['الحد الأقصى للوحدات', String(form.max_units)],
                ['الحد الأقصى للموظفين', String(form.max_staff)],
                ...(form.plan === 'trial' ? [['مدة التجربة', `${form.trial_days} يوم`] as [string, string]] : []),
              ]} />
              {/* Admin */}
              <ReviewCard title="مدير النظام" onEdit={() => setStep(3)} rows={[
                ['الاسم', form.admin_name || '—'],
                ['رقم الجوال (اسم المستخدم)', form.admin_phone],
                ['البريد الإلكتروني', form.admin_email || 'غير محدد'],
              ]} style={{ gridColumn: 'span 2' }} />
            </div>

            {err && (
              <div style={{ background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 7, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
                {err}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={back} style={{ flex: 1, padding: '12px', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,.04)', color: '#a1a1aa', fontWeight: 500 }}>
                ← رجوع
              </button>
              <button onClick={handleSubmit} disabled={saving}
                style={{ flex: 3, padding: '12px', background: saving ? '#52525b' : '#6366f1', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {saving ? <><Spinner /> جاري الإنشاء...</> : 'إنشاء الشركة وإرسال بريد الترحيب'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header() {
  return (
    <div style={{ background: 'rgba(255,255,255,.03)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid rgba(255,255,255,.06)', backdropFilter: 'blur(12px)' }}>
      <Link href="/dashboard/companies" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: 13 }}>← الشركات</Link>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#fafafa' }}>إضافة شركة جديدة</span>
    </div>
  );
}

function StepHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', margin: '0 0 4px' }}>{title}</h2>
      <p style={{ fontSize: 12, color: '#52525b', margin: 0 }}>{sub}</p>
      <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '16px 0 0' }} />
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 5, fontWeight: 500 }}>{label}</label>
      {hint && <p style={{ fontSize: 10, color: '#52525b', margin: '-3px 0 5px' }}>{hint}</p>}
      {children}
    </div>
  );
}

function inp(extra?: React.CSSProperties): React.CSSProperties {
  return { width: '100%', padding: '9px 11px', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'rgba(255,255,255,.04)', color: '#fafafa', ...extra };
}

function NavButtons({ onBack, onNext }: { onBack?: () => void; onNext?: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
      {onBack && (
        <button type="button" onClick={onBack} style={{ flex: 1, padding: '11px', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,.04)', color: '#a1a1aa', fontWeight: 500 }}>
          ← رجوع
        </button>
      )}
      {!onBack && <div style={{ flex: 1 }} />}
      {onNext && (
        <button type="button" onClick={onNext} style={{ flex: 2, padding: '11px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          التالي ←
        </button>
      )}
    </div>
  );
}

function ReviewCard({ title, rows, onEdit, style }: { title: string; rows: [string, string][]; onEdit: () => void; style?: React.CSSProperties }) {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '16px 18px', position: 'relative', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{title}</span>
        <button onClick={onEdit} style={{ fontSize: 10, color: '#a1a1aa', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, padding: '3px 10px', cursor: 'pointer' }}>تعديل</button>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.03)' }}>
          <span style={{ fontSize: 11, color: '#52525b' }}>{k}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#fafafa', direction: 'ltr', maxWidth: '60%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #ffffff44', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
