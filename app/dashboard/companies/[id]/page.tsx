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
  deleted:   { bg: '#f1f5f9', color: '#94a3b8', label: 'محذوف'     },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 18px', color: '#0f172a' }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{value ?? '—'}</span>
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
      showToast('تم بنجاح ✓');
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
      showToast(`تم تمديد التجربة ${days} يوماً ✓`);
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const handleAssignPlan = async (planId: string, cycle: string) => {
    setSaving(true);
    try {
      await adminApi.sa.assignPlan(id, { plan_id: planId, billing_cycle: cycle });
      showToast('تم تغيير الخطة ✓');
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const handleToggleFlag = async (featureKey: string, current: boolean) => {
    setSaving(true);
    try {
      await adminApi.sa.setFlag(id, featureKey, !current);
      showToast(`${featureKey} ${!current ? 'مُفعَّل' : 'مُعطَّل'} ✓`);
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
      <p style={{ color: '#94a3b8' }}>جاري التحميل...</p>
    </div>
  );

  if (!company) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#dc2626' }}>لم يتم العثور على الشركة</p>
    </div>
  );

  const lcStatus = company.lifecycle_status || (company.is_active ? 'active' : 'suspended');
  const lc = LC[lcStatus] || LC.active;
  const sub = company.subscription;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', direction: 'rtl' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: 'white', padding: '10px 24px', borderRadius: 10, fontSize: 13, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
          {toast}
        </div>
      )}

      {/* Nav */}
      <div style={{ background: '#0f172a', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/dashboard/companies" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>← الشركات</Link>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{company.name}</span>
          <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: lc.bg, color: lc.color, fontWeight: 600 }}>{lc.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {lcStatus !== 'active' && lcStatus !== 'deleted' && (
            <button onClick={() => handleLifecycle('activate')} disabled={saving}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, background: '#15803d', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              {saving ? '...' : 'تفعيل'}
            </button>
          )}
          {lcStatus === 'active' && (
            <button onClick={() => handleLifecycle('suspend')} disabled={saving}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              {saving ? '...' : 'إيقاف'}
            </button>
          )}
          {lcStatus === 'trial' && (
            <button onClick={handleExtendTrial} disabled={saving}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, background: '#854d0e', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              تمديد التجربة
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 32px', display: 'flex', gap: 4 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ fontSize: 13, padding: '14px 18px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t ? 700 : 400, color: tab === t ? '#0f172a' : '#64748b', borderBottom: tab === t ? '2px solid #1d4070' : '2px solid transparent', transition: 'all .15s' }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
        {/* ── نظرة عامة ── */}
        {tab === 'نظرة عامة' && (
          <>
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
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>تعديل الحدود</p>
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
              <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>لا يوجد اشتراك نشط</p>
            )}
            <div style={{ marginTop: 20, borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>تغيير الخطة</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {plans.filter(p => p.is_active).map(p => (
                  <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', background: '#fafafa', minWidth: 160 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>{p.name}</p>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 10px' }}>{p.price_monthly} ر.س/شهر</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleAssignPlan(p.id, 'monthly')} disabled={saving}
                        style={{ flex: 1, fontSize: 11, padding: '5px 8px', borderRadius: 7, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4070', cursor: 'pointer' }}>
                        شهري
                      </button>
                      <button onClick={() => handleAssignPlan(p.id, 'yearly')} disabled={saving}
                        style={{ flex: 1, fontSize: 11, padding: '5px 8px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', cursor: 'pointer' }}>
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
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, border: '1px solid', borderColor: enabled ? '#bbf7d0' : '#e2e8f0', background: enabled ? '#f0fdf4' : '#fafafa', transition: 'all .15s' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px', color: '#0f172a' }}>{meta.name_ar}</p>
                      <p style={{ fontSize: 10, color: '#94a3b8', margin: 0, direction: 'ltr' }}>{key}</p>
                      <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>الحد الأدنى: {meta.tier_min}</p>
                    </div>
                    <button onClick={() => handleToggleFlag(key, enabled)} disabled={saving}
                      style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: enabled ? '#15803d' : '#cbd5e1', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: 2, left: enabled ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
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
                    <div key={m.l} style={{ padding: '16px 18px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fafafa' }}>
                      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 6px' }}>{m.l}</p>
                      <p style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>{m.v ?? '—'}</p>
                      {pct !== null && (
                        <>
                          <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 6px' }}>من {m.max} ({pct}%)</p>
                          <div style={{ height: 5, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct > 90 ? '#dc2626' : pct > 70 ? '#f97316' : '#15803d', borderRadius: 3, transition: 'width .4s' }} />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: 13 }}>لا توجد بيانات استخدام</p>
            )}
          </Section>
        )}

        {/* ── التدقيق ── */}
        {tab === 'التدقيق' && (
          <Section title="سجل تدقيق الشركة">
            {audit.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 13 }}>لا توجد أحداث مسجلة</p>
            ) : (
              <div>
                {audit.map((a, i) => (
                  <div key={a.id} style={{ padding: '12px 0', borderBottom: i < audit.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                      👤
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{a.action?.replace(/_/g, ' ')}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 8 }}>بواسطة {a.actor_email}</span>
                        </div>
                        <span style={{ fontSize: 11, color: '#94a3b8', direction: 'ltr' }}>
                          {new Date(a.created_at).toLocaleString('ar-SA')}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>
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
      showToast('تم تحديث الحدود ✓');
      onSave();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const inp = { padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, width: 80, textAlign: 'center' as const };

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      {[
        { l: 'مستخدمون', v: maxUsers, set: setMaxUsers },
        { l: 'عقارات',   v: maxProperties, set: setMaxProperties },
        { l: 'وحدات',    v: maxUnits, set: setMaxUnits },
        { l: 'عقود',     v: maxContracts, set: setMaxContracts },
      ].map(f => (
        <div key={f.l}>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 4px' }}>{f.l}</p>
          <input value={f.v} onChange={e => f.set(e.target.value)} type="number" style={inp} />
        </div>
      ))}
      <button onClick={save} disabled={saving}
        style={{ padding: '6px 16px', borderRadius: 8, background: '#1d4070', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
        {saving ? '...' : 'حفظ'}
      </button>
    </div>
  );
}
