'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CountryPrice { amount: number; cur_ar: string; cur_en: string; }
interface PricingPlan {
  slug?: string;
  name_ar: string; name_en: string;
  price_sar: number; units: number;
  highlighted?: boolean;
  prices?: Record<string, CountryPrice>;
  features_ar: string[]; features_en: string[];
}
interface LandingFeature { icon: string; title_ar: string; title_en: string; desc_ar: string; desc_en: string; }
interface LandingContent {
  id: string;
  hero_title_ar: string; hero_title_en: string;
  hero_subtitle_ar: string; hero_subtitle_en: string;
  hero_cta_ar: string; hero_cta_en: string; hero_cta_url: string;
  stats: { label_ar: string; label_en: string; value: string; icon: string }[];
  features: LandingFeature[];
  pricing_plans: PricingPlan[];
  contact_whatsapp: string; contact_email: string;
  meta_title: string; meta_description: string;
  is_published: boolean; updated_at: string; updated_by: string;
}

// ─── Country config ───────────────────────────────────────────────────────────
const COUNTRIES: { code: string; label: string; cur_ar: string; cur_en: string }[] = [
  { code: 'SA', label: 'السعودية', cur_ar: 'ريال',   cur_en: 'SAR' },
  { code: 'AE', label: 'الإمارات', cur_ar: 'درهم',   cur_en: 'AED' },
  { code: 'KW', label: 'الكويت',   cur_ar: 'دينار',  cur_en: 'KWD' },
  { code: 'QA', label: 'قطر',      cur_ar: 'ريال',   cur_en: 'QAR' },
  { code: 'OM', label: 'عُمان',    cur_ar: 'ريال',   cur_en: 'OMR' },
  { code: 'BH', label: 'البحرين',  cur_ar: 'دينار',  cur_en: 'BHD' },
  { code: 'JO', label: 'الأردن',   cur_ar: 'دينار',  cur_en: 'JOD' },
  { code: 'EG', label: 'مصر',      cur_ar: 'جنيه',   cur_en: 'EGP' },
];

const EMPTY_PRICES: Record<string, CountryPrice> = Object.fromEntries(
  COUNTRIES.map(c => [c.code, { amount: 0, cur_ar: c.cur_ar, cur_en: c.cur_en }])
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page:    { color: '#1E293B', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  topbar:  { borderBottom: '1px solid rgba(0,0,0,.08)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  logo:    { color: '#1E293B', fontWeight: 600, fontSize: 18, letterSpacing: '-0.02em' as const },
  body:    { maxWidth: 1000, margin: '0 auto', padding: '32px 16px' },
  card:    { background: '#fff', border: 'none', borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)' },
  sectionTitle: { fontSize: 13, fontWeight: 600 as const, color: '#1E293B', letterSpacing: '-0.02em' as const, marginBottom: 16, marginTop: 0 },
  label:   { fontSize: 11, color: '#6b7280', fontWeight: 500 as const, marginBottom: 4, display: 'block' },
  input:   { width: '100%', background: '#F1F5F9', border: '1px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '10px 12px', color: '#1E293B', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const },
  row2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  saveBtn: { background: '#2563EB', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  saveRow: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 24 },
  badge:   (ok: boolean) => ({ background: ok ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.1)', color: ok ? '#16a34a' : '#dc2626', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, border: ok ? '1px solid rgba(22,163,74,.2)' : '1px solid rgba(220,38,38,.2)' }),
  addBtn:  { background: 'transparent', color: '#6b7280', border: '1px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '6px 14px', cursor: 'pointer', fontSize: 12 },
  removeBtn: { background: 'rgba(220,38,38,.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,.2)', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', fontSize: 12 },
  itemCard: { background: '#F1F5F9', border: '1px solid rgba(0,0,0,.06)', borderRadius: 10, padding: 16, marginBottom: 12 },
  planCard: (highlighted: boolean) => ({
    background: highlighted ? 'rgba(37,99,235,.03)' : '#F8FAFC',
    border: `2px solid ${highlighted ? '#2563EB' : 'rgba(0,0,0,.06)'}`,
    borderRadius: 12, padding: 20, marginBottom: 16,
  }),
  countryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
  countryCell: { background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 8, padding: '10px 12px' },
};

// ─── PLAN TIER COLOR ──────────────────────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  trial: '#22c55e', basic: '#6b7280', professional: '#2563EB', enterprise: '#f59e0b',
};

export default function LandingPageCMS() {
  const [data,   setData]   = useState<LandingContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');
  const [tab,    setTab]    = useState<'hero' | 'stats' | 'features' | 'pricing' | 'contact'>('hero');

  const load = useCallback(async () => {
    try {
      const res: any = await adminApi.sa.getLanding();
      // Ensure every plan has a complete prices object
      const d: LandingContent = res.data;
      if (d?.pricing_plans) {
        d.pricing_plans = d.pricing_plans.map(p => ({
          ...p,
          prices: { ...EMPTY_PRICES, ...(p.prices || {}) },
        }));
      }
      setData(d);
    } catch { setMsg('فشل تحميل البيانات'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!data) return;
    setSaving(true); setMsg('');
    try {
      await adminApi.sa.updateLanding(data);
      setMsg('تم الحفظ بنجاح');
    } catch { setMsg('فشل الحفظ'); }
    finally { setSaving(false); }
  };

  const set = (field: keyof LandingContent, value: any) =>
    setData(d => d ? { ...d, [field]: value } : d);

  const updateStat = (i: number, field: string, value: string) =>
    setData(d => { if (!d) return d; const s = [...d.stats]; s[i] = { ...s[i], [field]: value }; return { ...d, stats: s }; });

  const updateFeature = (i: number, field: string, value: string) =>
    setData(d => { if (!d) return d; const f = [...d.features]; f[i] = { ...f[i], [field]: value }; return { ...d, features: f }; });

  const updatePlan = (i: number, field: string, value: any) =>
    setData(d => { if (!d) return d; const p = [...d.pricing_plans]; p[i] = { ...p[i], [field]: value }; return { ...d, pricing_plans: p }; });

  const updatePlanPrice = (planIdx: number, countryCode: string, amount: number) =>
    setData(d => {
      if (!d) return d;
      const plans = [...d.pricing_plans];
      const plan  = { ...plans[planIdx] };
      plan.prices = { ...plan.prices, [countryCode]: { ...((plan.prices || {})[countryCode] || EMPTY_PRICES[countryCode]), amount } };
      // Keep price_sar in sync with SA
      if (countryCode === 'SA') plan.price_sar = amount;
      plans[planIdx] = plan;
      return { ...d, pricing_plans: plans };
    });

  if (!data) return (
    <div style={S.page}>
      <div style={S.topbar}><span style={S.logo}>LIVENTRA OS — CMS</span></div>
      <div style={{ textAlign: 'center', marginTop: 80, color: '#6b7280' }}>جاري التحميل...</div>
    </div>
  );

  const tabs = [
    { key: 'hero',     label: 'القسم الرئيسي' },
    { key: 'stats',    label: 'الإحصائيات' },
    { key: 'features', label: 'المميزات' },
    { key: 'pricing',  label: 'الأسعار والخطط' },
    { key: 'contact',  label: 'التواصل' },
  ];

  return (
    <div style={S.page}>
      {/* Topbar */}
      <div style={S.topbar}>
        <span style={S.logo}>إدارة الصفحة الرئيسية — www.liv-entra.com</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={S.badge(data.is_published)}>{data.is_published ? 'منشور' : 'مسودة'}</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            آخر تحديث: {data.updated_at ? new Date(data.updated_at).toLocaleString('en-US') : '—'} بواسطة: {data.updated_by || '—'}
          </span>
        </div>
      </div>

      <div style={S.body}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(0,0,0,.08)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} style={{
              padding: '12px 18px', border: 'none', cursor: 'pointer', fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              background: 'transparent',
              color: tab === t.key ? '#1E293B' : '#9ca3af',
              borderBottom: tab === t.key ? '2px solid #2563EB' : '2px solid transparent',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── HERO ── */}
        {tab === 'hero' && (
          <div style={S.card}>
            <p style={S.sectionTitle}>القسم الرئيسي (Hero)</p>
            <div style={{ ...S.row2, marginBottom: 12 }}>
              <div>
                <label style={S.label}>العنوان (عربي)</label>
                <input style={S.input} value={data.hero_title_ar} onChange={e => set('hero_title_ar', e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Title (English)</label>
                <input style={{ ...S.input, direction: 'ltr' }} value={data.hero_title_en} onChange={e => set('hero_title_en', e.target.value)} />
              </div>
            </div>
            <div style={{ ...S.row2, marginBottom: 12 }}>
              <div>
                <label style={S.label}>الوصف (عربي)</label>
                <input style={S.input} value={data.hero_subtitle_ar} onChange={e => set('hero_subtitle_ar', e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Subtitle (English)</label>
                <input style={{ ...S.input, direction: 'ltr' }} value={data.hero_subtitle_en} onChange={e => set('hero_subtitle_en', e.target.value)} />
              </div>
            </div>
            <div style={{ ...S.row2, marginBottom: 12 }}>
              <div>
                <label style={S.label}>زر الدعوة (عربي)</label>
                <input style={S.input} value={data.hero_cta_ar} onChange={e => set('hero_cta_ar', e.target.value)} />
              </div>
              <div>
                <label style={S.label}>CTA Button (English)</label>
                <input style={{ ...S.input, direction: 'ltr' }} value={data.hero_cta_en} onChange={e => set('hero_cta_en', e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>رابط الزر (CTA URL)</label>
              <input style={{ ...S.input, direction: 'ltr' }} value={data.hero_cta_url} onChange={e => set('hero_cta_url', e.target.value)} />
            </div>
            <div style={{ ...S.row2, marginBottom: 12 }}>
              <div>
                <label style={S.label}>عنوان الصفحة (SEO Meta Title)</label>
                <input style={S.input} value={data.meta_title} onChange={e => set('meta_title', e.target.value)} />
              </div>
              <div>
                <label style={S.label}>وصف الصفحة (Meta Description)</label>
                <input style={S.input} value={data.meta_description} onChange={e => set('meta_description', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <input type="checkbox" id="pub" checked={data.is_published} onChange={e => set('is_published', e.target.checked)} style={{ width: 16, height: 16 }} />
              <label htmlFor="pub" style={{ color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>نشر الصفحة (مرئية على الموقع)</label>
            </div>
          </div>
        )}

        {/* ── STATS ── */}
        {tab === 'stats' && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ ...S.sectionTitle, marginBottom: 0 }}>الإحصائيات</p>
              <button style={S.addBtn} onClick={() =>
                setData(d => d ? { ...d, stats: [...d.stats, { label_ar: '', label_en: '', value: '', icon: 'chart' }] } : d)
              }>+ إضافة</button>
            </div>
            {data.stats.map((s, i) => (
              <div key={i} style={S.itemCard}>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                  <div>
                    <label style={S.label}>أيقونة</label>
                    <input style={{ ...S.input, textAlign: 'center' }} value={s.icon} onChange={e => updateStat(i, 'icon', e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>التسمية (عربي)</label>
                    <input style={S.input} value={s.label_ar} onChange={e => updateStat(i, 'label_ar', e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>Label (EN)</label>
                    <input style={{ ...S.input, direction: 'ltr' }} value={s.label_en} onChange={e => updateStat(i, 'label_en', e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>القيمة</label>
                    <input style={{ ...S.input, direction: 'ltr' }} value={s.value} onChange={e => updateStat(i, 'value', e.target.value)} />
                  </div>
                  <button style={S.removeBtn} onClick={() =>
                    setData(d => d ? { ...d, stats: d.stats.filter((_, j) => j !== i) } : d)
                  }>×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── FEATURES ── */}
        {tab === 'features' && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ ...S.sectionTitle, marginBottom: 0 }}>مميزات المنتج ({data.features.length})</p>
              <button style={S.addBtn} onClick={() =>
                setData(d => d ? { ...d, features: [...d.features, { title_ar: '', title_en: '', desc_ar: '', desc_en: '', icon: 'star' }] } : d)
              }>+ إضافة ميزة</button>
            </div>
            {data.features.map((f, i) => (
              <div key={i} style={S.itemCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: '#6b7280', fontSize: 11, fontWeight: 500 }}>ميزة #{i + 1}</span>
                  <button style={S.removeBtn} onClick={() =>
                    setData(d => d ? { ...d, features: d.features.filter((_, j) => j !== i) } : d)
                  }>حذف</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={S.label}>أيقونة</label>
                    <input style={{ ...S.input, textAlign: 'center' }} value={f.icon} onChange={e => updateFeature(i, 'icon', e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>العنوان (عربي)</label>
                    <input style={S.input} value={f.title_ar} onChange={e => updateFeature(i, 'title_ar', e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>Title (EN)</label>
                    <input style={{ ...S.input, direction: 'ltr' }} value={f.title_en} onChange={e => updateFeature(i, 'title_en', e.target.value)} />
                  </div>
                </div>
                <div style={S.row2}>
                  <div>
                    <label style={S.label}>الوصف (عربي)</label>
                    <textarea style={{ ...S.input, height: 64, resize: 'vertical' as const }} value={f.desc_ar} onChange={e => updateFeature(i, 'desc_ar', e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>Description (EN)</label>
                    <textarea style={{ ...S.input, height: 64, direction: 'ltr', resize: 'vertical' as const }} value={f.desc_en} onChange={e => updateFeature(i, 'desc_en', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PRICING ── */}
        {tab === 'pricing' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ ...S.sectionTitle, margin: 0 }}>خطط الأسعار ({data.pricing_plans.length} خطط)</p>
              <button style={S.addBtn} onClick={() =>
                setData(d => d ? {
                  ...d, pricing_plans: [...d.pricing_plans, {
                    name_ar: '', name_en: '', price_sar: 0, units: 0,
                    prices: { ...EMPTY_PRICES }, features_ar: [], features_en: [],
                  }]
                } : d)
              }>+ خطة جديدة</button>
            </div>

            {data.pricing_plans.map((p, i) => {
              const tierColor = p.slug ? TIER_COLORS[p.slug] || '#2563EB' : '#2563EB';
              return (
                <div key={i} style={S.planCard(!!p.highlighted)}>
                  {/* Plan header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: tierColor, display: 'inline-block' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>
                        {p.name_ar || p.name_en || `خطة #${i + 1}`}
                      </span>
                      {p.highlighted && (
                        <span style={{ background: 'rgba(37,99,235,.1)', color: '#2563EB', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>مميزة</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <label style={{ fontSize: 12, color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="checkbox" checked={!!p.highlighted} onChange={e => updatePlan(i, 'highlighted', e.target.checked)} />
                        تمييز
                      </label>
                      <button style={S.removeBtn} onClick={() =>
                        setData(d => d ? { ...d, pricing_plans: d.pricing_plans.filter((_, j) => j !== i) } : d)
                      }>× حذف</button>
                    </div>
                  </div>

                  {/* Plan names & units */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 140px', gap: 10, marginBottom: 16 }}>
                    <div>
                      <label style={S.label}>الاسم (عربي)</label>
                      <input style={S.input} value={p.name_ar} onChange={e => updatePlan(i, 'name_ar', e.target.value)} />
                    </div>
                    <div>
                      <label style={S.label}>Name (EN)</label>
                      <input style={{ ...S.input, direction: 'ltr' }} value={p.name_en} onChange={e => updatePlan(i, 'name_en', e.target.value)} />
                    </div>
                    <div>
                      <label style={S.label}>Slug (للكود)</label>
                      <input style={{ ...S.input, direction: 'ltr' }} value={p.slug || ''} onChange={e => updatePlan(i, 'slug', e.target.value)} placeholder="basic" />
                    </div>
                    <div>
                      <label style={S.label}>عدد الوحدات</label>
                      <input style={{ ...S.input, direction: 'ltr' }} type="number" value={p.units} onChange={e => updatePlan(i, 'units', Number(e.target.value))} />
                    </div>
                  </div>

                  {/* Per-country prices */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ ...S.label, marginBottom: 10, fontSize: 12, color: '#1E293B', fontWeight: 600 }}>
                      الأسعار حسب الدولة
                    </label>
                    <div style={S.countryGrid}>
                      {COUNTRIES.map(c => {
                        const cp = (p.prices || {})[c.code] || { amount: 0, cur_ar: c.cur_ar, cur_en: c.cur_en };
                        return (
                          <div key={c.code} style={S.countryCell}>
                            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--lv-chip)', padding: '1px 4px', borderRadius: 3, color: 'var(--lv-muted)', fontFamily: 'var(--lv-font-mono)' }}>{c.code}</span>
                              <span>{c.label}</span>
                              <span style={{ marginRight: 'auto', color: '#9ca3af', fontSize: 10 }}>{c.cur_en}</span>
                            </div>
                            <input
                              style={{ ...S.input, padding: '7px 10px', direction: 'ltr', fontSize: 13 }}
                              type="number"
                              value={cp.amount}
                              onChange={e => updatePlanPrice(i, c.code, Number(e.target.value))}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Features list */}
                  <div style={S.row2}>
                    <div>
                      <label style={S.label}>المميزات (عربي) — سطر لكل ميزة</label>
                      <textarea
                        style={{ ...S.input, height: 140, resize: 'vertical' as const, fontSize: 12, lineHeight: '1.6' }}
                        value={p.features_ar.join('\n')}
                        onChange={e => updatePlan(i, 'features_ar', e.target.value.split('\n'))}
                        placeholder={'إدارة العقود\nتتبع المدفوعات\n...'}
                      />
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{p.features_ar.filter(Boolean).length} ميزة</div>
                    </div>
                    <div>
                      <label style={S.label}>Features (EN) — one per line</label>
                      <textarea
                        style={{ ...S.input, height: 140, direction: 'ltr', resize: 'vertical' as const, fontSize: 12, lineHeight: '1.6' }}
                        value={p.features_en.join('\n')}
                        onChange={e => updatePlan(i, 'features_en', e.target.value.split('\n'))}
                        placeholder={'Contract Management\nPayments Tracking\n...'}
                      />
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{p.features_en.filter(Boolean).length} features</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── CONTACT ── */}
        {tab === 'contact' && (
          <div style={S.card}>
            <p style={S.sectionTitle}>معلومات التواصل وزر واتساب</p>
            <div style={{ ...S.row2, marginBottom: 12 }}>
              <div>
                <label style={S.label}>رقم واتساب (بدون + — مثال: 966501234567)</label>
                <input style={{ ...S.input, direction: 'ltr' }} value={data.contact_whatsapp} onChange={e => set('contact_whatsapp', e.target.value)} placeholder="966501234567" />
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>هذا الرقم يُستخدم في زر واتساب الطائر على الموقع</div>
              </div>
              <div>
                <label style={S.label}>البريد الإلكتروني</label>
                <input style={{ ...S.input, direction: 'ltr' }} value={data.contact_email} onChange={e => set('contact_email', e.target.value)} />
              </div>
            </div>
            <div style={{ background: '#F1F5F9', borderRadius: 8, padding: 16, border: '1px solid rgba(0,0,0,.06)' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, fontWeight: 500 }}>معاينة زر واتساب:</div>
              <a
                href={`https://wa.me/${data.contact_whatsapp}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#22c55e', color: '#fff', borderRadius: 50, padding: '10px 20px', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}
              >
                تواصل معنا واتساب
              </a>
            </div>
          </div>
        )}

        {/* Save row */}
        <div style={S.saveRow}>
          <button style={S.saveBtn} onClick={save} disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
          {msg && (
            <span style={{ fontSize: 13, color: msg.includes('نجاح') || msg.includes('تم') ? '#16a34a' : '#dc2626' }}>
              {msg}
            </span>
          )}
          <a href="https://www.liv-entra.com" target="_blank" rel="noreferrer"
            style={{ fontSize: 13, color: '#2563EB', textDecoration: 'underline', marginRight: 'auto' }}>
            عرض الموقع ↗
          </a>
        </div>
      </div>
    </div>
  );
}
