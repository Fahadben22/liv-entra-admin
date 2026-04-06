'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

const TABS = ['نظرة عامة', 'الاشتراك', 'الميزات', 'الاستخدام', 'التدقيق'] as const;
type Tab = typeof TABS[number];

const LC: Record<string, { bg: string; color: string; label: string }> = {
  trial:     { bg: '#fefce8', color: '#854d0e', label: 'تجريبي'   },
  active:    { bg: '#f0fdf4', color: '#15803d', label: 'نشط'       },
  overdue:   { bg: '#fff7ed', color: '#c2410c', label: 'متأخر'     },
  suspended: { bg: '#fef2f2', color: '#dc2626', label: 'موقوف'     },
  deleted:   { bg: '#fafafa', color: '#a1a1aa', label: 'محذوف'     },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', padding: '20px 24px', marginBottom: 20 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 18px', color: '#18181b' }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
      <span style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#18181b' }}>{value ?? '—'}</span>
    </div>
  );
}

export default function CompanyDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [tab,      setTab]      = useState<Tab>('نظرة عامة');
  const [company,  setCompany]  = useState<any>(null);
  const [usage,    setUsage]    = useState<any>(null);
  const [flags,    setFlags]    = useState<any[]>([]);
  const [registry, setRegistry] = useState<any>({});
  const [plans,    setPlans]    = useState<any[]>([]);
  const [audit,    setAudit]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    setLoading(true);
    const results = await Promise.allSettled([
      // Primary: old endpoint always works
      adminApi.getCompany(id),
      // Enhanced: new sa endpoints (graceful if migration not run)
      adminApi.sa.getCompanyUsage(id),
      adminApi.sa.companyFlags(id),
      adminApi.sa.featureRegistry(),
      adminApi.sa.listPlans(),
      adminApi.sa.listAudit({ target_id: id, limit: '20' }),
    ]);
    if (results[0].status === 'fulfilled') {
      const d = (results[0].value as any)?.data;
      setCompany(d);
      // Old endpoint embeds usage
      if (d?.usage && !usage) setUsage({
        unit_count:      d.usage.total_units      || 0,
        contract_count:  d.usage.active_contracts || 0,
        staff_count:     d.usage.total_staff      || 0,
        property_count:  0,
        payment_count:   0,
        maintenance_count: 0,
      });
    }
    if (results[1].status === 'fulfilled') setUsage((results[1].value as any)?.data);
    if (results[2].status === 'fulfilled') setFlags((results[2].value as any)?.data || []);
    if (results[3].status === 'fulfilled') setRegistry((results[3].value as any)?.data || {});
    if (results[4].status === 'fulfilled') setPlans((results[4].value as any)?.data || []);
    if (results[5].status === 'fulfilled') setAudit((results[5].value as any)?.data || []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  const handleLifecycle = async (action: 'activate' | 'suspend') => {
    const reason = action === 'suspend' ? (prompt('سبب الإيقاف:') || 'manual') : undefined;
    if (action === 'suspend' && !reason) return;
    setSaving(true);
    try {
      if (action === 'activate') {
        // Try new SA endpoint first, fallback to old
        await adminApi.sa.activateCompany(id).catch(() => adminApi.activateCompany(id));
      } else {
        await adminApi.sa.suspendCompany(id, reason!).catch(() => adminApi.suspendCompany(id));
      }
      showToast('تم بنجاح');
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const handleExtendTrial = async () => {
    const days = parseInt(prompt('عدد أيام التمديد:') || '0');
    if (!days || days < 1) return;
    setSaving(true);
    try {
      await adminApi.sa.extendTrial(id, days);
      showToast(`تم تمديد التجربة ${days} يوماً`);
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const handleAssignPlan = async (planId: string, cycle: string) => {
    setSaving(true);
    try {
      await adminApi.sa.assignPlan(id, { plan_id: planId, billing_cycle: cycle });
      showToast('تم تغيير الخطة');
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const handleToggleFlag = async (featureKey: string, current: boolean) => {
    setSaving(true);
    try {
      await adminApi.sa.setFlag(id, featureKey, !current);
      showToast(`${featureKey} ${!current ? 'مُفعَّل' : 'مُعطَّل'}`);
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fafafa' }}>
      <p style={{ color: '#a1a1aa', fontSize: 13 }}>جاري التحميل...</p>
    </div>
  );

  if (!company) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fafafa' }}>
      <p style={{ color: '#dc2626', fontSize: 13 }}>لم يتم العثور على الشركة</p>
    </div>
  );

  const lcStatus = company.lifecycle_status || (company.is_active ? 'active' : 'suspended');
  const lc = LC[lcStatus] || LC.active;
  const sub = company.subscription;

  return (
    <div style={{ background: '#fafafa' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#18181b', color: '#fff', padding: '7px 20px', borderRadius: 7, fontSize: 12, zIndex: 9999, boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e5e5', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#18181b', letterSpacing: '-0.02em' }}>{company.name}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: lc.color, display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: lc.color, fontWeight: 500 }}>{lc.label}</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {lcStatus !== 'active' && lcStatus !== 'deleted' && (
            <button onClick={() => handleLifecycle('activate')} disabled={saving}
              style={{ fontSize: 12, padding: '7px 16px', borderRadius: 7, background: '#18181b', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
              {saving ? '...' : 'تفعيل'}
            </button>
          )}
          {lcStatus === 'active' && (
            <button onClick={() => handleLifecycle('suspend')} disabled={saving}
              style={{ fontSize: 12, padding: '7px 16px', borderRadius: 7, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', cursor: 'pointer', fontWeight: 500 }}>
              {saving ? '...' : 'إيقاف'}
            </button>
          )}
          {lcStatus === 'trial' && (
            <button onClick={handleExtendTrial} disabled={saving}
              style={{ fontSize: 12, padding: '7px 16px', borderRadius: 7, background: '#fff', color: '#71717a', border: '1px solid #e5e5e5', cursor: 'pointer', fontWeight: 500 }}>
              تمديد التجربة
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e5e5', padding: '0 32px', display: 'flex', gap: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ fontSize: 13, padding: '12px 18px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t ? 600 : 400, color: tab === t ? '#18181b' : '#a1a1aa', borderBottom: tab === t ? '2px solid #18181b' : '2px solid transparent', transition: 'all .15s' }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
        {/* ── نظرة عامة ── */}
        {tab === 'نظرة عامة' && (
          <>
            {/* Health Score Card */}
            {company.health && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'صحة الشركة', value: `${company.health.score}%`, sub: `تقييم ${company.health.grade}`, color: company.health.grade === 'A' ? '#059669' : company.health.grade === 'B' ? '#2563eb' : company.health.grade === 'C' ? '#d97706' : '#dc2626' },
                  { label: 'نسبة الإشغال', value: `${company.health.occupancy}%`, sub: 'الوحدات المشغولة', color: '#0ea5e9' },
                  { label: 'معدل التحصيل', value: `${company.health.collection}%`, sub: 'آخر 90 يوم', color: '#059669' },
                  { label: 'استجابة الصيانة', value: `${company.health.maintenance}%`, sub: 'تذاكر محلولة', color: '#8b5cf6' },
                  { label: 'تبني الميزات', value: `${company.health.adoption}%`, sub: 'ميزات مفعلة', color: '#f59e0b' },
                ].map(k => (
                  <div key={k.label} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: '14px', textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: '#a1a1aa', margin: '0 0 6px', fontWeight: 500 }}>{k.label}</p>
                    <p style={{ fontSize: 22, fontWeight: 600, color: k.color, margin: 0 }}>{k.value}</p>
                    <p style={{ fontSize: 11, color: '#a1a1aa', margin: '4px 0 0', fontWeight: 500 }}>{k.sub}</p>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Section title="معلومات الشركة">
                <Row label="الاسم"        value={company.name} />
                <Row label="المعرّف"      value={<span style={{ direction: 'ltr' }}>{company.slug}</span>} />
                <Row label="البريد"       value={company.email} />
                <Row label="الهاتف"       value={company.phone} />
                <Row label="الدولة"       value={company.country || 'SA'} />
                <Row label="تاريخ التسجيل" value={new Date(company.created_at).toLocaleDateString('ar-SA')} />
                <Row label="سبب الإيقاف" value={company.suspended_reason} />
                <Row label="ملاحظات"      value={company.notes} />
              </Section>

              <Section title="الحدود والصلاحيات">
                <Row label="الحد الأقصى للمستخدمين"   value={company.max_users ?? '∞'} />
                <Row label="الحد الأقصى للعقارات"     value={company.max_properties ?? '∞'} />
                <Row label="الحد الأقصى للوحدات"      value={company.max_units ?? '∞'} />
                <Row label="الحد الأقصى للعقود"       value={company.max_contracts ?? '∞'} />
                <Row label="نهاية التجربة"            value={company.trial_ends_at ? new Date(company.trial_ends_at).toLocaleDateString('ar-SA') : '—'} />
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8, fontWeight: 500 }}>تعديل الحدود</p>
                  <LimitsForm companyId={id} current={company} onSave={load} showToast={showToast} />
                </div>
              </Section>
            </div>
          </>
        )}

        {/* ── الاشتراك ── */}
        {tab === 'الاشتراك' && (
          <Section title="إدارة الاشتراك">
            {sub ? (
              <>
                <Row label="الخطة الحالية"    value={sub.plan?.name || '—'} />
                <Row label="حالة الاشتراك"    value={sub.status} />
                <Row label="دورة الفوترة"     value={sub.billing_cycle === 'yearly' ? 'سنوي' : 'شهري'} />
                <Row label="بداية الفترة"     value={sub.current_period_start ? new Date(sub.current_period_start).toLocaleDateString('ar-SA') : '—'} />
                <Row label="نهاية الفترة"     value={sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('ar-SA') : '—'} />
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 16 }}>لا يوجد اشتراك نشط</p>
            )}
            <div style={{ marginTop: 20, borderTop: '1px solid #f0f0f0', paddingTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#18181b' }}>تغيير الخطة</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {plans.filter(p => p.is_active).map(p => (
                  <div key={p.id} style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: '12px 16px', background: '#fff', minWidth: 160 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: '#18181b' }}>{p.name}</p>
                    <p style={{ fontSize: 11, color: '#a1a1aa', margin: '0 0 10px', fontWeight: 500 }}>{p.price_monthly} ر.س/شهر</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleAssignPlan(p.id, 'monthly')} disabled={saving}
                        style={{ flex: 1, fontSize: 12, padding: '7px 16px', borderRadius: 7, background: '#fff', border: '1px solid #e5e5e5', color: '#71717a', cursor: 'pointer', fontWeight: 500 }}>
                        شهري
                      </button>
                      <button onClick={() => handleAssignPlan(p.id, 'yearly')} disabled={saving}
                        style={{ flex: 1, fontSize: 12, padding: '7px 16px', borderRadius: 7, background: '#18181b', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
                        سنوي
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* ── الميزات ── */}
        {tab === 'الميزات' && (
          <Section title="إدارة ميزات الشركة">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {Object.entries(registry).map(([key, meta]: [string, any]) => {
                const flag = flags.find(f => f.feature_key === key);
                const enabled = flag?.is_enabled ?? false;
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 8, border: '1px solid', borderColor: enabled ? '#bbf7d0' : '#e5e5e5', background: enabled ? '#f0fdf4' : '#fff', transition: 'all .15s' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px', color: '#18181b' }}>{meta.name_ar}</p>
                      <p style={{ fontSize: 11, color: '#a1a1aa', margin: 0, direction: 'ltr', fontWeight: 500 }}>{key}</p>
                      <p style={{ fontSize: 11, color: '#a1a1aa', margin: '2px 0 0', fontWeight: 500 }}>الحد الأدنى: {meta.tier_min}</p>
                    </div>
                    <button onClick={() => handleToggleFlag(key, enabled)} disabled={saving}
                      style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: enabled ? '#15803d' : '#cbd5e1', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: 2, left: enabled ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }} />
                    </button>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── الاستخدام ── */}
        {tab === 'الاستخدام' && (
          <Section title="استخدام الموارد">
            {usage ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {[
                  { l: 'المستخدمون',  v: usage.staff_count,    max: company.max_users },
                  { l: 'الوحدات',    v: usage.unit_count,     max: company.max_units },
                  { l: 'العقود',     v: usage.contract_count, max: company.max_contracts },
                  { l: 'العقارات',   v: usage.property_count, max: company.max_properties },
                  { l: 'المدفوعات',  v: usage.payment_count },
                  { l: 'طلبات الصيانة', v: usage.maintenance_count },
                ].map(m => {
                  const pct = m.max ? Math.min(Math.round((m.v / m.max) * 100), 100) : null;
                  return (
                    <div key={m.l} style={{ padding: '14px 16px', borderRadius: 8, border: '1px solid #e5e5e5', background: '#fff' }}>
                      <p style={{ fontSize: 11, color: '#a1a1aa', margin: '0 0 6px', fontWeight: 500 }}>{m.l}</p>
                      <p style={{ fontSize: 22, fontWeight: 600, color: '#18181b', margin: 0 }}>{m.v ?? '—'}</p>
                      {pct !== null && (
                        <>
                          <p style={{ fontSize: 11, color: '#a1a1aa', margin: '4px 0 6px', fontWeight: 500 }}>من {m.max} ({pct}%)</p>
                          <div style={{ height: 4, borderRadius: 3, background: '#e5e5e5', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct > 90 ? '#dc2626' : pct > 70 ? '#f97316' : '#15803d', borderRadius: 3, transition: 'width .4s' }} />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: '#a1a1aa', fontSize: 13 }}>لا توجد بيانات استخدام</p>
            )}
          </Section>
        )}

        {/* ── التدقيق ── */}
        {tab === 'التدقيق' && (
          <Section title="سجل تدقيق الشركة">
            {audit.length === 0 ? (
              <p style={{ color: '#a1a1aa', fontSize: 13 }}>لا توجد أحداث مسجلة</p>
            ) : (
              <div>
                {audit.map((a, i) => (
                  <div key={a.id} style={{ padding: '12px 0', borderBottom: i < audit.length - 1 ? '1px solid #f0f0f0' : 'none', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fafafa', border: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, color: '#a1a1aa', fontWeight: 500 }}>
                      A
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#18181b' }}>{a.action?.replace(/_/g, ' ')}</span>
                          <span style={{ fontSize: 11, color: '#a1a1aa', marginRight: 8, fontWeight: 500 }}>بواسطة {a.actor_email}</span>
                        </div>
                        <span style={{ fontSize: 11, color: '#a1a1aa', direction: 'ltr', fontWeight: 500 }}>
                          {new Date(a.created_at).toLocaleString('ar-SA')}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: '#71717a', margin: '4px 0 0', fontWeight: 500 }}>
                        {a.actor_role} · {a.ip_address}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

// ── Limits inline form ──────────────────────────────────────────────────────
function LimitsForm({ companyId, current, onSave, showToast }: { companyId: string; current: any; onSave: () => void; showToast: (m: string) => void }) {
  const [maxUsers,      setMaxUsers]      = useState(String(current.max_users      ?? ''));
  const [maxProperties, setMaxProperties] = useState(String(current.max_properties ?? ''));
  const [maxUnits,      setMaxUnits]      = useState(String(current.max_units      ?? ''));
  const [maxContracts,  setMaxContracts]  = useState(String(current.max_contracts  ?? ''));
  const [saving,        setSaving]        = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.sa.updateLimits(companyId, {
        max_users:       maxUsers      ? parseInt(maxUsers)      : undefined,
        max_properties:  maxProperties ? parseInt(maxProperties) : undefined,
        max_units:       maxUnits      ? parseInt(maxUnits)      : undefined,
        max_contracts:   maxContracts  ? parseInt(maxContracts)  : undefined,
      });
      showToast('تم تحديث الحدود');
      onSave();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const inp = { padding: '7px 12px', borderRadius: 7, border: '1px solid #e5e5e5', fontSize: 13, width: 80, textAlign: 'center' as const, background: '#fff' };

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      {[
        { l: 'مستخدمون', v: maxUsers, set: setMaxUsers },
        { l: 'عقارات',   v: maxProperties, set: setMaxProperties },
        { l: 'وحدات',    v: maxUnits, set: setMaxUnits },
        { l: 'عقود',     v: maxContracts, set: setMaxContracts },
      ].map(f => (
        <div key={f.l}>
          <p style={{ fontSize: 11, color: '#a1a1aa', margin: '0 0 4px', fontWeight: 500 }}>{f.l}</p>
          <input value={f.v} onChange={e => f.set(e.target.value)} type="number" style={inp} />
        </div>
      ))}
      <button onClick={save} disabled={saving}
        style={{ padding: '7px 16px', borderRadius: 7, background: '#18181b', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
        {saving ? '...' : 'حفظ'}
      </button>
    </div>
  );
}
