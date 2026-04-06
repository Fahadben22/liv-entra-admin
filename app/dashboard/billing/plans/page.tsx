'use client';
import { useEffect, useState } from 'react';
import { request } from '@/lib/api';


const TIER_ORDER = ['trial', 'basic', 'professional', 'enterprise'];
const TIER_AR: Record<string, string> = { trial: 'تجريبي', basic: 'أساسي', professional: 'احترافي', enterprise: 'مؤسسي' };
const TIER_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  trial:        { bg: '#f8fafc', border: '#e2e8f0', color: '#64748b' },
  basic:        { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
  professional: { bg: '#f0fdf4', border: '#86efac', color: '#16a34a' },
  enterprise:   { bg: '#faf5ff', border: '#c084fc', color: '#7c3aed' },
};

const EMPTY_PLAN = { name: '', name_ar: '', price_monthly: 0, price_yearly: 0, max_users: 5, max_properties: 5, max_units: 50, max_contracts: 100, features: [], is_active: true, sort_order: 0 };

export default function PlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [registry, setRegistry] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ ...EMPTY_PLAN });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      request<any>('GET', '/superadmin/plans'),
      request<any>('GET', '/superadmin/features/registry'),
    ]).then(([plansRes, regRes]) => {
      setPlans(plansRes?.data || []);
      setRegistry(regRes?.data || {});
    }).finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_PLAN });
    setModal(true);
  }

  function openEdit(plan: any) {
    setEditing(plan);
    setForm({
      name: plan.name || '',
      name_ar: plan.name_ar || '',
      price_monthly: plan.price_monthly || 0,
      price_yearly: plan.price_yearly || 0,
      max_users: plan.max_users || 5,
      max_properties: plan.max_properties || 5,
      max_units: plan.max_units || 50,
      max_contracts: plan.max_contracts || 100,
      features: plan.features || [],
      is_active: plan.is_active !== false,
      sort_order: plan.sort_order || 0,
    });
    setModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        await request<any>('PATCH', `/superadmin/plans/${editing.id}`, form);
      } else {
        await request<any>('POST', '/superadmin/plans', form);
      }
      const res = await request<any>('GET', '/superadmin/plans');
      setPlans(res?.data || []);
      setModal(false);
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  function toggleFeature(key: string) {
    setForm((p: any) => ({
      ...p,
      features: p.features.includes(key)
        ? p.features.filter((f: string) => f !== key)
        : [...p.features, key],
    }));
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8' }}>جاري التحميل...</div>;

  const allFeatureKeys = Object.keys(registry);

  return (
    <div style={{ direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>إدارة الخطط</h2>
        <button onClick={openCreate} style={{ padding: '8px 18px', background: '#1d4070', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + خطة جديدة
        </button>
      </div>

      {/* Plans Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {plans.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(plan => {
          const tc = TIER_COLORS[plan.name] || TIER_COLORS.basic;
          return (
            <div key={plan.id} style={{ background: 'white', border: `1.5px solid ${tc.border}`, borderRadius: 16, padding: 20, position: 'relative' }}>
              {!plan.is_active && (
                <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 9, padding: '2px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>غير نشط</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: tc.color }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: tc.color }}>{plan.name_ar || TIER_AR[plan.name] || plan.name}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>({plan.name})</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>شهري</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{Number(plan.price_monthly || 0).toLocaleString()} ر.س</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>سنوي</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{Number(plan.price_yearly || 0).toLocaleString()} ر.س</div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: '#475569', marginBottom: 12 }}>
                <div>الوحدات: {plan.max_units || '∞'} · العقارات: {plan.max_properties || '∞'}</div>
                <div>الموظفين: {plan.max_users || '∞'} · العقود: {plan.max_contracts || '∞'}</div>
              </div>

              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>الميزات ({(plan.features || []).length}):</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(plan.features || []).map((f: string) => (
                  <span key={f} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                    {registry[f]?.name_ar || f}
                  </span>
                ))}
              </div>

              <button onClick={() => openEdit(plan)} style={{ marginTop: 14, width: '100%', padding: '7px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
                تعديل
              </button>
            </div>
          );
        })}
      </div>

      {/* Create/Edit Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'auto', direction: 'rtl' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{editing ? 'تعديل الخطة' : 'خطة جديدة'}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>الاسم (EN)</label>
                <input value={form.name} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} placeholder="basic" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>الاسم (AR)</label>
                <input value={form.name_ar} onChange={e => setForm((p: any) => ({ ...p, name_ar: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} placeholder="أساسي" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>السعر الشهري (ر.س)</label>
                <input type="number" value={form.price_monthly} onChange={e => setForm((p: any) => ({ ...p, price_monthly: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>السعر السنوي (ر.س)</label>
                <input type="number" value={form.price_yearly} onChange={e => setForm((p: any) => ({ ...p, price_yearly: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { key: 'max_units', label: 'الوحدات' },
                { key: 'max_properties', label: 'العقارات' },
                { key: 'max_users', label: 'الموظفين' },
                { key: 'max_contracts', label: 'العقود' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input type="number" value={form[f.key]} onChange={e => setForm((p: any) => ({ ...p, [f.key]: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 8 }}>الميزات المضمنة</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {allFeatureKeys.map(key => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8, background: form.features.includes(key) ? '#f0fdf4' : '#f8fafc', border: `1px solid ${form.features.includes(key) ? '#86efac' : '#e2e8f0'}`, cursor: 'pointer', fontSize: 11 }}>
                    <input type="checkbox" checked={form.features.includes(key)} onChange={() => toggleFeature(key)} style={{ accentColor: '#16a34a' }} />
                    <span>{registry[key]?.name_ar || key}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm((p: any) => ({ ...p, is_active: e.target.checked }))} style={{ accentColor: '#16a34a' }} />
                نشطة
              </label>
              <div>
                <label style={{ fontSize: 10, color: '#64748b' }}>ترتيب:</label>
                <input type="number" value={form.sort_order} onChange={e => setForm((p: any) => ({ ...p, sort_order: Number(e.target.value) }))}
                  style={{ width: 50, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, marginRight: 4 }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer', color: '#475569' }}>إلغاء</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px', background: '#1d4070', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديل' : 'إنشاء الخطة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
