'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../lib/api';

interface LandingContent {
  id: string;
  hero_title_ar: string;
  hero_title_en: string;
  hero_subtitle_ar: string;
  hero_subtitle_en: string;
  hero_cta_ar: string;
  hero_cta_en: string;
  hero_cta_url: string;
  stats: { label_ar: string; label_en: string; value: string; icon: string }[];
  features: { title_ar: string; title_en: string; desc_ar: string; desc_en: string; icon: string }[];
  pricing_plans: { name_ar: string; name_en: string; price_sar: number; units: number; features_ar: string[]; features_en: string[]; highlighted?: boolean }[];
  contact_whatsapp: string;
  contact_email: string;
  meta_title: string;
  meta_description: string;
  is_published: boolean;
  updated_at: string;
  updated_by: string;
}

const S = {
  page: { color: '#fafafa', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
  topbar: { borderBottom: '1px solid rgba(255,255,255,.06)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  logo: { color: '#fafafa', fontWeight: 600, fontSize: 18, letterSpacing: '-0.02em' as const },
  body: { maxWidth: 960, margin: '0 auto', padding: '32px 16px' },
  card: { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: 24, marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 600 as const, color: '#fafafa', letterSpacing: '-0.02em' as const, marginBottom: 16, marginTop: 0 },
  label: { fontSize: 11, color: '#a1a1aa', fontWeight: 500 as const, marginBottom: 4, display: 'block' },
  input: { width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, padding: '10px 12px', color: '#fafafa', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  saveBtn: { background: '#6366f1', color: '#fff', border: 'none', borderRadius: 7, padding: '12px 32px', fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  saveRow: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 24 },
  badge: (ok: boolean) => ({ background: ok ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.1)', color: ok ? '#16a34a' : '#dc2626', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, border: ok ? '1px solid rgba(22,163,74,.2)' : '1px solid rgba(220,38,38,.2)' }),
  addBtn: { background: 'rgba(255,255,255,.04)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 12 },
  removeBtn: { background: 'rgba(220,38,38,.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,.2)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 12 },
  itemCard: { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: 16, marginBottom: 10 },
};

export default function LandingPageCMS() {
  const [data, setData] = useState<LandingContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<'hero' | 'stats' | 'features' | 'pricing' | 'contact'>('hero');

  const load = useCallback(async () => {
    try {
      const res: any = await adminApi.sa.getLanding();
      setData(res.data);
    } catch {
      setMsg('فشل تحميل البيانات');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setMsg('');
    try {
      await adminApi.sa.updateLanding(data);
      setMsg('تم الحفظ بنجاح');
    } catch {
      setMsg('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof LandingContent, value: any) =>
    setData(d => d ? { ...d, [field]: value } : d);

  const updateStat = (i: number, field: string, value: string) =>
    setData(d => { if (!d) return d; const s = [...d.stats]; s[i] = { ...s[i], [field]: value }; return { ...d, stats: s }; });

  const updateFeature = (i: number, field: string, value: string) =>
    setData(d => { if (!d) return d; const f = [...d.features]; f[i] = { ...f[i], [field]: value }; return { ...d, features: f }; });

  const updatePlan = (i: number, field: string, value: any) =>
    setData(d => { if (!d) return d; const p = [...d.pricing_plans]; p[i] = { ...p[i], [field]: value }; return { ...d, pricing_plans: p }; });

  if (!data) return (
    <div style={S.page}>
      <div style={S.topbar}><span style={S.logo}>LIVENTRA OS — CMS</span></div>
      <div style={{ textAlign: 'center', marginTop: 80, color: '#a1a1aa' }}>جاري التحميل...</div>
    </div>
  );

  const tabs = [
    { key: 'hero', label: 'القسم الرئيسي' },
    { key: 'stats', label: 'الإحصائيات' },
    { key: 'features', label: 'المميزات' },
    { key: 'pricing', label: 'الأسعار' },
    { key: 'contact', label: 'التواصل' },
  ];

  return (
    <div style={S.page}>
      {/* Topbar */}
      <div style={S.topbar}>
        <span style={S.logo}>إدارة الصفحة الرئيسية — www.liv-entra.com</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={S.badge(data.is_published)}>{data.is_published ? 'منشور' : 'مسودة'}</span>
          <span style={{ fontSize: 11, color: '#52525b' }}>آخر تحديث: {data.updated_at ? new Date(data.updated_at).toLocaleString('ar-SA') : '—'} بواسطة: {data.updated_by || '—'}</span>
        </div>
      </div>

      <div style={S.body}>
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} style={{
              padding: '12px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              background: 'transparent',
              color: tab === t.key ? '#fafafa' : '#52525b',
              borderBottom: tab === t.key ? '2px solid #6366f1' : '2px solid transparent',
            }}>{t.label}</button>
          ))}
        </div>

        {/* -- HERO -- */}
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
              <label htmlFor="pub" style={{ color: '#a1a1aa', fontSize: 13, cursor: 'pointer' }}>نشر الصفحة (مرئية على الموقع)</label>
            </div>
          </div>
        )}

        {/* -- STATS -- */}
        {tab === 'stats' && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ ...S.sectionTitle, marginBottom: 0 }}>الإحصائيات</p>
              <button style={S.addBtn} onClick={() =>
                setData(d => d ? { ...d, stats: [...d.stats, { label_ar: '', label_en: '', value: '', icon: '📊' }] } : d)
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
                  }>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* -- FEATURES -- */}
        {tab === 'features' && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ ...S.sectionTitle, marginBottom: 0 }}>المميزات</p>
              <button style={S.addBtn} onClick={() =>
                setData(d => d ? { ...d, features: [...d.features, { title_ar: '', title_en: '', desc_ar: '', desc_en: '', icon: '' }] } : d)
              }>+ إضافة</button>
            </div>
            {data.features.map((f, i) => (
              <div key={i} style={S.itemCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#a1a1aa', fontSize: 11, fontWeight: 500 }}>ميزة #{i + 1}</span>
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
                    <input style={S.input} value={f.desc_ar} onChange={e => updateFeature(i, 'desc_ar', e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>Description (EN)</label>
                    <input style={{ ...S.input, direction: 'ltr' }} value={f.desc_en} onChange={e => updateFeature(i, 'desc_en', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* -- PRICING -- */}
        {tab === 'pricing' && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ ...S.sectionTitle, marginBottom: 0 }}>خطط الأسعار</p>
              <button style={S.addBtn} onClick={() =>
                setData(d => d ? { ...d, pricing_plans: [...d.pricing_plans, { name_ar: '', name_en: '', price_sar: 0, units: 0, features_ar: [], features_en: [] }] } : d)
              }>+ خطة جديدة</button>
            </div>
            {data.pricing_plans.map((p, i) => (
              <div key={i} style={{ ...S.itemCard, borderColor: p.highlighted ? '#6366f1' : 'rgba(255,255,255,.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: '#a1a1aa', fontSize: 11, fontWeight: 500 }}>خطة #{i + 1} {p.highlighted ? 'مميزة' : ''}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{ fontSize: 12, color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="checkbox" checked={!!p.highlighted} onChange={e => updatePlan(i, 'highlighted', e.target.checked)} />
                      تمييز
                    </label>
                    <button style={S.removeBtn} onClick={() =>
                      setData(d => d ? { ...d, pricing_plans: d.pricing_plans.filter((_, j) => j !== i) } : d)
                    }>✕</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={S.label}>الاسم (عربي)</label>
                    <input style={S.input} value={p.name_ar} onChange={e => updatePlan(i, 'name_ar', e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>Name (EN)</label>
                    <input style={{ ...S.input, direction: 'ltr' }} value={p.name_en} onChange={e => updatePlan(i, 'name_en', e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>السعر (ريال)</label>
                    <input style={{ ...S.input, direction: 'ltr' }} type="number" value={p.price_sar} onChange={e => updatePlan(i, 'price_sar', Number(e.target.value))} />
                  </div>
                  <div>
                    <label style={S.label}>عدد الوحدات</label>
                    <input style={{ ...S.input, direction: 'ltr' }} type="number" value={p.units} onChange={e => updatePlan(i, 'units', Number(e.target.value))} />
                  </div>
                </div>
                <div style={S.row2}>
                  <div>
                    <label style={S.label}>المميزات (عربي) — سطر لكل ميزة</label>
                    <textarea
                      style={{ ...S.input, height: 100, resize: 'vertical' as const }}
                      value={p.features_ar.join('\n')}
                      onChange={e => updatePlan(i, 'features_ar', e.target.value.split('\n').filter(Boolean))}
                    />
                  </div>
                  <div>
                    <label style={S.label}>Features (EN) — one per line</label>
                    <textarea
                      style={{ ...S.input, height: 100, direction: 'ltr', resize: 'vertical' as const }}
                      value={p.features_en.join('\n')}
                      onChange={e => updatePlan(i, 'features_en', e.target.value.split('\n').filter(Boolean))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* -- CONTACT -- */}
        {tab === 'contact' && (
          <div style={S.card}>
            <p style={S.sectionTitle}>معلومات التواصل وزر واتساب</p>
            <div style={{ ...S.row2, marginBottom: 12 }}>
              <div>
                <label style={S.label}>رقم واتساب (بدون + — مثال: 966501234567)</label>
                <input style={{ ...S.input, direction: 'ltr' }} value={data.contact_whatsapp} onChange={e => set('contact_whatsapp', e.target.value)} placeholder="966501234567" />
                <div style={{ fontSize: 11, color: '#52525b', marginTop: 4 }}>هذا الرقم يُستخدم في زر واتساب الطائر على الموقع</div>
              </div>
              <div>
                <label style={S.label}>البريد الإلكتروني</label>
                <input style={{ ...S.input, direction: 'ltr' }} value={data.contact_email} onChange={e => set('contact_email', e.target.value)} />
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: 16, border: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8, fontWeight: 500 }}>معاينة زر واتساب:</div>
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
            style={{ fontSize: 13, color: '#6366f1', textDecoration: 'underline', marginRight: 'auto' }}>
            عرض الموقع
          </a>
        </div>
      </div>
    </div>
  );
}
