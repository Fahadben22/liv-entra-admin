'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

const TABS = ['نظرة عامة', 'الاشتراك', 'الميزات', 'الاستخدام', 'الكاميرات', 'التدقيق'] as const;
type Tab = typeof TABS[number];

const LC: Record<string, { color: string; label: string }> = {
  trial:     { color: '#f59e0b', label: 'تجريبي'   },
  active:    { color: '#22c55e', label: 'نشط'       },
  overdue:   { color: '#f59e0b', label: 'متأخر'     },
  suspended: { color: '#ef4444', label: 'موقوف'     },
  deleted:   { color: '#6b7280', label: 'محذوف'     },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ background: 'var(--lv-panel)', borderRadius: 14, border: '1px solid var(--lv-line)', padding: '20px 24px', marginBottom: 20, boxShadow: 'var(--lv-shadow-sm)' }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 18px', color: 'var(--lv-fg)' }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--lv-line)' }}>
      <span style={{ fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--lv-fg)' }}>{value ?? '—'}</span>
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
  const [audit,      setAudit]      = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState('');

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
      adminApi.sa.listCompanyProperties(id),
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
    if (results[6].status === 'fulfilled') setProperties((results[6].value as any)?.data || []);
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: 'var(--lv-muted)', fontSize: 13 }}>جاري التحميل...</p>
    </div>
  );

  if (!company) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#ef4444', fontSize: 13 }}>لم يتم العثور على الشركة</p>
    </div>
  );

  const lcStatus = company.lifecycle_status || (company.is_active ? 'active' : 'suspended');
  const lc = LC[lcStatus] || LC.active;
  const sub = company.subscription;

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--lv-accent)', color: '#fff', padding: '7px 20px', borderRadius: 7, fontSize: 12, zIndex: 9999, boxShadow: '0 2px 8px rgba(124,92,252,.2)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--lv-line)', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--lv-fg)', letterSpacing: '-0.02em' }}>{company.name}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: lc.color, display: 'inline-block', boxShadow: `0 0 6px ${lc.color}66` }} />
            <span style={{ fontSize: 11, color: lc.color, fontWeight: 500 }}>{lc.label}</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {lcStatus !== 'active' && lcStatus !== 'deleted' && (
            <button onClick={() => handleLifecycle('activate')} disabled={saving}
              style={{ fontSize: 12, padding: '7px 16px', borderRadius: 10, background: 'var(--lv-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500, boxShadow: '0 2px 8px rgba(124,92,252,.2)' }}>
              {saving ? '...' : 'تفعيل'}
            </button>
          )}
          {lcStatus === 'active' && (
            <button onClick={() => handleLifecycle('suspend')} disabled={saving}
              style={{ fontSize: 12, padding: '7px 16px', borderRadius: 10, background: '#fef2f2', color: '#ef4444', border: '1px solid rgba(239,68,68,.25)', cursor: 'pointer', fontWeight: 500 }}>
              {saving ? '...' : 'إيقاف'}
            </button>
          )}
          {lcStatus === 'trial' && (
            <button onClick={handleExtendTrial} disabled={saving}
              style={{ fontSize: 12, padding: '7px 16px', borderRadius: 10, background: 'transparent', color: 'var(--lv-muted)', border: '1px solid var(--lv-line)', cursor: 'pointer', fontWeight: 500 }}>
              تمديد التجربة
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid var(--lv-line)', padding: '0 32px', display: 'flex', gap: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ fontSize: 13, padding: '12px 18px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t ? 600 : 400, color: tab === t ? 'var(--lv-fg)' : 'var(--lv-muted)', borderBottom: tab === t ? '2px solid var(--lv-accent)' : '2px solid transparent', transition: 'all .15s' }}>
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
              <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'صحة الشركة', value: `${company.health.score}%`, sub: `تقييم ${company.health.grade}`, color: company.health.grade === 'A' ? '#22c55e' : company.health.grade === 'B' ? '#3b82f6' : company.health.grade === 'C' ? '#f59e0b' : '#ef4444' },
                  { label: 'نسبة الإشغال', value: `${company.health.occupancy}%`, sub: 'الوحدات المشغولة', color: '#3b82f6' },
                  { label: 'معدل التحصيل', value: `${company.health.collection}%`, sub: 'آخر 90 يوم', color: '#22c55e' },
                  { label: 'استجابة الصيانة', value: `${company.health.maintenance}%`, sub: 'تذاكر محلولة', color: '#60A5FA' },
                  { label: 'تبني الميزات', value: `${company.health.adoption}%`, sub: 'ميزات مفعلة', color: '#f59e0b' },
                ].map(k => (
                  <div key={k.label} className="card" style={{ background: 'var(--lv-panel)', border: '1px solid var(--lv-line)', borderRadius: 14, padding: '14px', textAlign: 'center', boxShadow: 'var(--lv-shadow-sm)' }}>
                    <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 6px', fontWeight: 500 }}>{k.label}</p>
                    <p style={{ fontSize: 22, fontWeight: 600, color: k.color, margin: 0 }}>{k.value}</p>
                    <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '4px 0 0', fontWeight: 500 }}>{k.sub}</p>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Section title="معلومات الشركة">
                <Row label="المعرّف"         value={<span style={{ direction: 'ltr' }}>{company.slug}</span>} />
                <Row label="تاريخ التسجيل"   value={new Date(company.created_at).toLocaleDateString('ar-SA')} />
                {company.suspended_reason && <Row label="سبب الإيقاف" value={company.suspended_reason} />}
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', marginBottom: 8, fontWeight: 500 }}>تعديل البيانات الأساسية</p>
                  <CompanyInfoForm companyId={id} current={company} onSave={load} showToast={showToast} />
                </div>
              </Section>

              <Section title="الحدود والصلاحيات">
                <Row label="الحد الأقصى للمستخدمين"   value={company.max_users ?? '∞'} />
                <Row label="الحد الأقصى للعقارات"     value={company.max_properties ?? '∞'} />
                <Row label="الحد الأقصى للوحدات"      value={company.max_units ?? '∞'} />
                <Row label="الحد الأقصى للعقود"       value={company.max_contracts ?? '∞'} />
                <Row label="نهاية التجربة"            value={company.trial_ends_at ? new Date(company.trial_ends_at).toLocaleDateString('ar-SA') : '—'} />
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', marginBottom: 8, fontWeight: 500 }}>تعديل الحدود</p>
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
              <p style={{ fontSize: 13, color: 'var(--lv-muted)', marginBottom: 16 }}>لا يوجد اشتراك نشط</p>
            )}
            <div style={{ marginTop: 20, borderTop: '1px solid var(--lv-line)', paddingTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--lv-fg)' }}>تغيير الخطة</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {plans.filter(p => p.is_active).map(p => (
                  <div key={p.id} style={{ border: '1px solid var(--lv-line)', borderRadius: 14, padding: '12px 16px', background: 'var(--lv-panel)', minWidth: 160, boxShadow: 'var(--lv-shadow-sm)' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: 'var(--lv-fg)' }}>{p.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 10px', fontWeight: 500 }}>{p.price_monthly} ر.س/شهر</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleAssignPlan(p.id, 'monthly')} disabled={saving}
                        style={{ flex: 1, fontSize: 12, padding: '7px 16px', borderRadius: 10, background: 'transparent', border: '1px solid var(--lv-line)', color: 'var(--lv-muted)', cursor: 'pointer', fontWeight: 500 }}>
                        شهري
                      </button>
                      <button onClick={() => handleAssignPlan(p.id, 'yearly')} disabled={saving}
                        style={{ flex: 1, fontSize: 12, padding: '7px 16px', borderRadius: 10, background: 'var(--lv-accent)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 500, boxShadow: '0 2px 8px rgba(124,92,252,.2)' }}>
                        سنوي
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Hatif.io Integration Config ── */}
            <div style={{ marginTop: 20, borderTop: '1px solid var(--lv-line)', paddingTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lv-accent)' }}>هاتف</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--lv-fg)' }}>تكامل هاتف — رعاية العملاء</p>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '2px 0 0', fontWeight: 500 }}>Hatif.io Customer Care Integration</p>
                </div>
              </div>
              <HatifConfigForm companyId={id} current={company} onSave={load} showToast={showToast} />
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
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 14, border: '1px solid', borderColor: enabled ? 'rgba(34,197,94,.25)' : 'var(--lv-line)', background: enabled ? '#ecfdf5' : 'var(--lv-panel)', transition: 'all .15s' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px', color: 'var(--lv-fg)' }}>{meta.name_ar}</p>
                      <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: 0, direction: 'ltr', fontWeight: 500 }}>{key}</p>
                      <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '2px 0 0', fontWeight: 500 }}>الحد الأدنى: {meta.tier_min}</p>
                    </div>
                    <button onClick={() => handleToggleFlag(key, enabled)} disabled={saving}
                      style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: enabled ? '#22c55e' : '#d1d5db', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: 2, left: enabled ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
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
                    <div key={m.l} className="card" style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid var(--lv-line)', background: 'var(--lv-panel)', boxShadow: 'var(--lv-shadow-sm)' }}>
                      <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 6px', fontWeight: 500 }}>{m.l}</p>
                      <p style={{ fontSize: 22, fontWeight: 600, color: 'var(--lv-fg)', margin: 0 }}>{m.v ?? '—'}</p>
                      {pct !== null && (
                        <>
                          <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '4px 0 6px', fontWeight: 500 }}>من {m.max} ({pct}%)</p>
                          <div style={{ height: 4, borderRadius: 3, background: 'var(--lv-line)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e', borderRadius: 3, transition: 'width .4s' }} />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--lv-muted)', fontSize: 13 }}>لا توجد بيانات استخدام</p>
            )}
          </Section>
        )}

        {/* ── الكاميرات ── */}
        {tab === 'الكاميرات' && (
          <CamerasTab companyId={id} properties={properties} showToast={showToast} />
        )}

        {/* ── التدقيق ── */}
        {tab === 'التدقيق' && (
          <Section title="سجل تدقيق الشركة">
            {audit.length === 0 ? (
              <p style={{ color: 'var(--lv-muted)', fontSize: 13 }}>لا توجد أحداث مسجلة</p>
            ) : (
              <div>
                {audit.map((a, i) => (
                  <div key={a.id} style={{ padding: '12px 0', borderBottom: i < audit.length - 1 ? '1px solid var(--lv-line)' : 'none', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--lv-bg)', border: '1px solid var(--lv-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, color: 'var(--lv-muted)', fontWeight: 500 }}>
                      A
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--lv-fg)' }}>{a.action?.replace(/_/g, ' ')}</span>
                          <span style={{ fontSize: 11, color: 'var(--lv-muted)', marginRight: 8, fontWeight: 500 }}>بواسطة {a.actor_email}</span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--lv-muted)', direction: 'ltr', fontWeight: 500 }}>
                          {new Date(a.created_at).toLocaleString('en-US')}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '4px 0 0', fontWeight: 500 }}>
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

// ── Company info edit form ──────────────────────────────────────────────────
function CompanyInfoForm({ companyId, current, onSave, showToast }: { companyId: string; current: any; onSave: () => void; showToast: (m: string) => void }) {
  const [form, setForm] = useState({
    name:          current.name          || '',
    name_ar:       current.name_ar       || '',
    contact_email: current.contact_email || current.email || '',
    contact_phone: current.contact_phone || current.phone || '',
    city:          current.city          || '',
    cr_number:     current.cr_number     || '',
    notes:         current.notes         || '',
  });
  const [saving, setSaving] = useState(false);

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateCompany(companyId, form);
      showToast('تم تحديث بيانات الشركة');
      onSave();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const inp = { padding: '7px 12px', borderRadius: 10, border: '1px solid var(--lv-line)', fontSize: 12, width: '100%', background: 'var(--lv-bg)', color: 'var(--lv-fg)', boxSizing: 'border-box' as const };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>الاسم</p>
          <input value={form.name} onChange={f('name')} style={inp} placeholder="اسم الشركة" />
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>الاسم بالعربي</p>
          <input value={form.name_ar} onChange={f('name_ar')} style={inp} placeholder="الاسم بالعربية" />
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>البريد</p>
          <input value={form.contact_email} onChange={f('contact_email')} type="email" dir="ltr" style={inp} placeholder="email@company.com" />
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>الهاتف</p>
          <input value={form.contact_phone} onChange={f('contact_phone')} type="tel" dir="ltr" style={inp} placeholder="+966XXXXXXXXX" />
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>المدينة</p>
          <input value={form.city} onChange={f('city')} style={inp} placeholder="الرياض" />
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>السجل التجاري</p>
          <input value={form.cr_number} onChange={f('cr_number')} dir="ltr" style={inp} placeholder="10XXXXXXXXX" />
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>ملاحظات</p>
        <textarea value={form.notes} onChange={f('notes')} rows={2}
          style={{ ...inp, resize: 'vertical' as const, fontFamily: 'inherit' }} placeholder="ملاحظات اختيارية" />
      </div>
      <button onClick={save} disabled={saving}
        style={{ padding: '8px 20px', borderRadius: 10, background: 'var(--lv-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, boxShadow: '0 2px 8px rgba(124,92,252,.2)' }}>
        {saving ? '...' : 'حفظ البيانات'}
      </button>
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

  const inp = { padding: '7px 12px', borderRadius: 10, border: '1px solid var(--lv-line)', fontSize: 13, width: 80, textAlign: 'center' as const, background: 'var(--lv-bg)', color: 'var(--lv-fg)' };

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      {[
        { l: 'مستخدمون', v: maxUsers, set: setMaxUsers },
        { l: 'عقارات',   v: maxProperties, set: setMaxProperties },
        { l: 'وحدات',    v: maxUnits, set: setMaxUnits },
        { l: 'عقود',     v: maxContracts, set: setMaxContracts },
      ].map(f => (
        <div key={f.l}>
          <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>{f.l}</p>
          <input value={f.v} onChange={e => f.set(e.target.value)} type="number" style={inp} />
        </div>
      ))}
      <button onClick={save} disabled={saving}
        style={{ padding: '7px 16px', borderRadius: 10, background: 'var(--lv-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, boxShadow: '0 2px 8px rgba(124,92,252,.2)' }}>
        {saving ? '...' : 'حفظ'}
      </button>
    </div>
  );
}

// ── Hatif.io integration config form ────────────────────────────────────────
function HatifConfigForm({ companyId, current, onSave, showToast }: { companyId: string; current: any; onSave: () => void; showToast: (m: string) => void }) {
  const [enabled,   setEnabled]   = useState<boolean>(current.hatif_enabled ?? false);
  const [portalUrl, setPortalUrl] = useState<string>(current.hatif_portal_url ?? '');
  const [saving,    setSaving]    = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateCompany(companyId, { hatif_enabled: enabled, hatif_portal_url: portalUrl || null });
      showToast('تم حفظ إعدادات هاتف');
      onSave();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const inp = { padding: '7px 12px', borderRadius: 10, border: '1px solid var(--lv-line)', fontSize: 12, width: '100%', background: 'var(--lv-bg)', color: 'var(--lv-fg)', boxSizing: 'border-box' as const };

  return (
    <div style={{ background: 'rgba(5,150,105,.04)', border: '1px solid rgba(5,150,105,.15)', borderRadius: 12, padding: '16px 18px' }}>
      {/* Enable toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: 'var(--lv-fg)' }}>تفعيل تكامل هاتف لهذه الشركة</p>
          <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '2px 0 0', fontWeight: 400 }}>يُظهر صفحة رعاية العملاء في لوحة تحكم الموظفين</p>
        </div>
        <button onClick={() => setEnabled(v => !v)}
          style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: enabled ? '#22c55e' : '#d1d5db', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
          <span style={{ position: 'absolute', top: 3, left: enabled ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
        </button>
      </div>

      {/* Portal URL */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 5px', fontWeight: 500 }}>رابط بوابة هاتف (اختياري)</p>
        <input
          value={portalUrl}
          onChange={e => setPortalUrl(e.target.value)}
          dir="ltr"
          placeholder="https://app.hatif.io/org/XXXXX"
          style={inp}
        />
        <p style={{ fontSize: 10, color: 'var(--lv-muted)', margin: '3px 0 0' }}>إذا تُرك فارغاً تظهر صفحة التعريف بهاتف مع زر الانتقال لموقعهم</p>
      </div>

      {/* Hatif info pill */}
      <div style={{ background: 'rgba(0,0,0,.04)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, display: 'flex', gap: 16, fontSize: 11, color: 'var(--lv-muted)', flexWrap: 'wrap' }}>
        <span>299 ر.س/شهر (3 مستخدمين)</span>
        <span>واتساب مشترك للفريق</span>
        <span>تلخيص المكالمات بالذكاء الاصطناعي</span>
        <a href="https://www.hatif.io" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--lv-accent)', textDecoration: 'none', fontWeight: 500 }}>موقع هاتف ←</a>
      </div>

      <button onClick={save} disabled={saving}
        style={{ padding: '8px 20px', borderRadius: 10, background: '#059669', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, boxShadow: '0 2px 8px rgba(5,150,105,.3)' }}>
        {saving ? '...' : 'حفظ إعدادات هاتف'}
      </button>
    </div>
  );
}

// ── Cameras Tab ──────────────────────────────────────────────────────────────
function CamerasTab({ companyId, properties, showToast }: { companyId: string; properties: any[]; showToast: (m: string) => void }) {
  const [cameras,        setCameras]        = useState<any[]>([]);
  const [selectedPropId, setSelectedPropId] = useState('');
  const [loading,        setLoading]        = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [provider,       setProvider]       = useState<'ezviz' | 'rtsp'>('ezviz');
  const [form, setForm] = useState({
    name: '', location_tag: 'entrance',
    device_serial: '', ezviz_email: '', ezviz_password: '', ezviz_region: 'apiisgp.ezvizlife.com',
    rtsp_url: '', rtsp_username: '', rtsp_password: '',
  });
  const [snapshots, setSnapshots] = useState<Record<string, string>>({});

  const loadCameras = async (propId: string) => {
    if (!propId) return;
    setLoading(true);
    try {
      const r = await adminApi.cameras.listByProperty(propId);
      setCameras(r.data || []);
    } catch { setCameras([]); }
    setLoading(false);
  };

  const handleSelectProp = (propId: string) => {
    setSelectedPropId(propId);
    loadCameras(propId);
  };

  const handleAdd = async () => {
    if (!selectedPropId) return showToast('اختر عقاراً أولاً');
    setSaving(true);
    try {
      await adminApi.cameras.add(selectedPropId, {
        ...form,
        provider,
        company_id: companyId,
      });
      showToast('تمت إضافة الكاميرا');
      setForm({ name: '', location_tag: 'entrance', device_serial: '', ezviz_email: '', ezviz_password: '', ezviz_region: 'apiisgp.ezvizlife.com', rtsp_url: '', rtsp_username: '', rtsp_password: '' });
      loadCameras(selectedPropId);
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const handleRemove = async (cameraId: string) => {
    if (!confirm('حذف هذه الكاميرا؟')) return;
    try {
      await adminApi.cameras.remove(cameraId);
      showToast('تم حذف الكاميرا');
      loadCameras(selectedPropId);
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
  };

  const handleSnapshot = async (cameraId: string) => {
    try {
      const r = await adminApi.cameras.snapshot(cameraId);
      if (r.data?.url) setSnapshots(p => ({ ...p, [cameraId]: r.data.url }));
      showToast('تم التقاط الصورة');
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
  };

  const inp = { padding: '7px 12px', borderRadius: 10, border: '1px solid var(--lv-line)', fontSize: 12, background: 'var(--lv-bg)', color: 'var(--lv-fg)', width: '100%', boxSizing: 'border-box' as const };
  const LOCATIONS: Record<string, string> = { entrance: 'المدخل', living: 'المعيشة', bedroom: 'النوم', exterior: 'الخارج', parking: 'المواقف', other: 'أخرى' };

  return (
    <div>
      {/* Property selector */}
      <div style={{ background: 'var(--lv-panel)', borderRadius: 14, border: '1px solid var(--lv-line)', padding: '16px 20px', marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: 'var(--lv-muted)', margin: '0 0 8px', fontWeight: 500 }}>اختر العقار</p>
        {properties.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--lv-muted)' }}>لا توجد عقارات مسجلة لهذه الشركة</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {properties.map(p => (
              <button key={p.id} onClick={() => handleSelectProp(p.id)}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--lv-line)', background: selectedPropId === p.id ? 'var(--lv-accent)' : 'var(--lv-bg)', color: selectedPropId === p.id ? '#fff' : 'var(--lv-fg)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                {p.name || p.name_ar}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Camera list */}
      {selectedPropId && (
        <>
          <div style={{ background: 'var(--lv-panel)', borderRadius: 14, border: '1px solid var(--lv-line)', padding: '16px 20px', marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 14px', color: 'var(--lv-fg)' }}>
              الكاميرات المثبتة ({cameras.length})
            </h3>
            {loading ? (
              <p style={{ fontSize: 12, color: 'var(--lv-muted)' }}>جاري التحميل...</p>
            ) : cameras.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--lv-muted)' }}>لا توجد كاميرات لهذا العقار</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {cameras.map(cam => (
                  <div key={cam.id} style={{ background: 'var(--lv-bg)', borderRadius: 12, border: '1px solid var(--lv-line)', overflow: 'hidden' }}>
                    {snapshots[cam.id] && (
                      <img src={snapshots[cam.id]} alt="snapshot" style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
                    )}
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)' }}>{cam.name}</span>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: cam.provider === 'rtsp' ? 'rgba(59,130,246,.1)' : 'rgba(124,92,252,.1)', color: cam.provider === 'rtsp' ? '#3b82f6' : 'var(--lv-accent)', fontWeight: 600 }}>
                          {cam.provider?.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 8px' }}>{LOCATIONS[cam.location_tag] || cam.location_tag}</p>
                      {cam.device_serial && <p style={{ fontSize: 10, color: 'var(--lv-muted)', direction: 'ltr', margin: '0 0 8px' }}>{cam.device_serial}</p>}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleSnapshot(cam.id)}
                          style={{ flex: 1, padding: '5px 0', borderRadius: 7, background: 'var(--lv-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                          التقاط
                        </button>
                        <button onClick={() => handleRemove(cam.id)}
                          style={{ padding: '5px 10px', borderRadius: 7, background: '#fef2f2', color: '#ef4444', border: '1px solid rgba(239,68,68,.2)', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                          حذف
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add camera form */}
          <div style={{ background: 'var(--lv-panel)', borderRadius: 14, border: '1px solid var(--lv-line)', padding: '16px 20px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 14px', color: 'var(--lv-fg)' }}>إضافة كاميرا جديدة</h3>

            {/* Provider toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['ezviz', 'rtsp'] as const).map(p => (
                <button key={p} onClick={() => setProvider(p)}
                  style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid var(--lv-line)', background: provider === p ? 'var(--lv-accent)' : 'var(--lv-bg)', color: provider === p ? '#fff' : 'var(--lv-fg)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                  {p === 'ezviz' ? 'EZVIZ' : 'RTSP (أي كاميرا)'}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>اسم الكاميرا</p>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inp} placeholder="كاميرا المدخل" />
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>الموقع</p>
                <select value={form.location_tag} onChange={e => setForm(p => ({ ...p, location_tag: e.target.value }))} style={{ ...inp }}>
                  {Object.entries(LOCATIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            {provider === 'ezviz' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>رقم الجهاز (Serial)</p>
                  <input value={form.device_serial} onChange={e => setForm(p => ({ ...p, device_serial: e.target.value }))} dir="ltr" style={inp} placeholder="BG8598562" />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>إيميل EZVIZ</p>
                  <input value={form.ezviz_email} onChange={e => setForm(p => ({ ...p, ezviz_email: e.target.value }))} type="email" dir="ltr" style={inp} placeholder="owner@email.com" />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>كلمة مرور EZVIZ</p>
                  <input value={form.ezviz_password} onChange={e => setForm(p => ({ ...p, ezviz_password: e.target.value }))} type="password" dir="ltr" style={inp} placeholder="••••••" />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>السيرفر (Region)</p>
                  <input value={form.ezviz_region} onChange={e => setForm(p => ({ ...p, ezviz_region: e.target.value }))} dir="ltr" style={inp} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>RTSP URL</p>
                  <input value={form.rtsp_url} onChange={e => setForm(p => ({ ...p, rtsp_url: e.target.value }))} dir="ltr" style={inp} placeholder="rtsp://192.168.1.100:554/stream" />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>اسم المستخدم (اختياري)</p>
                  <input value={form.rtsp_username} onChange={e => setForm(p => ({ ...p, rtsp_username: e.target.value }))} dir="ltr" style={inp} placeholder="admin" />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>كلمة المرور (اختياري)</p>
                  <input value={form.rtsp_password} onChange={e => setForm(p => ({ ...p, rtsp_password: e.target.value }))} type="password" dir="ltr" style={inp} placeholder="••••••" />
                </div>
              </div>
            )}

            <button onClick={handleAdd} disabled={saving}
              style={{ padding: '8px 22px', borderRadius: 10, background: 'var(--lv-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, boxShadow: '0 2px 8px rgba(124,92,252,.2)' }}>
              {saving ? '...' : 'إضافة الكاميرا'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
