'use client';
import { useState } from 'react';
import { request } from '@/lib/api';
import { useBilling } from '../layout';
import { fmt, fmtDate, PLAN_AR, PLAN_C, PLAN_PRICE, lcOf, daysUntil } from '@/lib/billing-helpers';
import Link from 'next/link';

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active:    { label: 'نشط',    color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  trial:     { label: 'تجريبي', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  overdue:   { label: 'متأخر',  color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  suspended: { label: 'موقوف',  color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
};

// ─── Change Plan Modal ──────────────────────────────────────────────────────
function ChangePlanModal({ company, onClose, onDone }: { company: any; onClose: () => void; onDone: () => void }) {
  const { showToast } = useBilling();
  const [planId, setPlanId] = useState('');
  const [cycle, setCycle]   = useState('monthly');
  const [plans, setPlans]   = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Fetch plans on mount
  useState(() => {
    request<any>('GET', '/superadmin/plans')
      .then(r => setPlans((r as any)?.data || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  });

  const submit = async () => {
    if (!planId) { showToast('اختر خطة'); return; }
    setLoading(true);
    try {
      await request('POST', `/superadmin/companies/${company.id}/assign-plan`, { plan_id: planId, billing_cycle: cycle });
      showToast('تم تغيير الخطة');
      onDone();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 18, padding: '32px', width: 420, maxWidth: '92vw', boxShadow: '0 24px 60px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: '#1a1a2e' }}>تغيير الخطة</h3>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 24px' }}>{company.name} — {PLAN_AR[company.plan] || company.plan}</p>

        {fetching ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>جاري التحميل...</p> : (
          <>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 10 }}>اختر الخطة الجديدة</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {plans.filter(p => p.name !== 'trial' && p.is_active !== false).map(p => {
                const selected = planId === p.id;
                return (
                  <button key={p.id} onClick={() => setPlanId(p.id)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                      background: selected ? '#ede9fe' : '#fafafa',
                      border: selected ? '2px solid #7c5cfc' : '1.5px solid rgba(0,0,0,.06)',
                      transition: 'all .15s',
                    }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>{p.name_ar || PLAN_AR[p.name] || p.name}</p>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{p.max_units} وحدة · {p.max_users || p.max_staff} موظف</p>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: '#7c5cfc', margin: 0 }}>{fmt(p.price_monthly)} <span style={{ fontSize: 10, fontWeight: 400, color: '#9ca3af' }}>ر.س/شهر</span></p>
                    </div>
                  </button>
                );
              })}
            </div>

            <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>دورة الفوترة</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {[{ key: 'monthly', label: 'شهري' }, { key: 'yearly', label: 'سنوي (خصم 20%)' }].map(c => (
                <button key={c.key} onClick={() => setCycle(c.key)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                    background: cycle === c.key ? '#7c5cfc' : '#fafafa',
                    color: cycle === c.key ? '#fff' : '#6b7280',
                    border: cycle === c.key ? 'none' : '1.5px solid rgba(0,0,0,.06)',
                    fontSize: 13, fontWeight: 600,
                  }}>
                  {c.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid rgba(0,0,0,.08)', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280', fontWeight: 500 }}>إلغاء</button>
              <button onClick={submit} disabled={loading || !planId}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#7c5cfc', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: loading || !planId ? .5 : 1 }}>
                {loading ? 'جاري التغيير...' : 'تأكيد التغيير'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Extend Trial Modal ─────────────────────────────────────────────────────
function ExtendModal({ company, onClose, onDone }: { company: any; onClose: () => void; onDone: () => void }) {
  const { showToast } = useBilling();
  const [days, setDays] = useState('7');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await request('POST', `/superadmin/companies/${company.id}/extend-trial`, { days: Number(days) });
      showToast(`تم تمديد التجربة ${days} يوماً`);
      onDone();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 18, padding: '32px', width: 360, maxWidth: '92vw', boxShadow: '0 24px 60px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: '#1a1a2e' }}>تمديد التجربة</h3>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px' }}>{company.name}</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>عدد أيام التمديد</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {['7', '14', '30'].map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{
                flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                background: days === d ? '#3b82f6' : '#fafafa',
                color: days === d ? '#fff' : '#6b7280',
                border: days === d ? 'none' : '1.5px solid rgba(0,0,0,.06)',
                fontSize: 14, fontWeight: 700,
              }}>
              {d} يوم
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid rgba(0,0,0,.08)', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>إلغاء</button>
          <button onClick={submit} disabled={loading}
            style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            {loading ? '...' : 'تمديد'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionsPage() {
  const { companies, metrics, loading, reload, showToast } = useBilling();
  const [filter, setFilter]         = useState<string>('all');
  const [acting, setActing]         = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [changePlanCo, setChangePlanCo] = useState<any>(null);
  const [extendCo, setExtendCo]     = useState<any>(null);

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: '#6b7280' }}>جاري التحميل...</div>;

  const safeCompanies = Array.isArray(companies) ? companies : [];
  const active = safeCompanies.filter(c => lcOf(c) === 'active').length;
  const trial = safeCompanies.filter(c => lcOf(c) === 'trial').length;
  const overdue = safeCompanies.filter(c => lcOf(c) === 'overdue').length;
  const suspended = safeCompanies.filter(c => lcOf(c) === 'suspended').length;

  let filtered = safeCompanies;
  if (filter !== 'all') filtered = filtered.filter(c => lcOf(c) === filter);
  if (search.trim()) filtered = filtered.filter(c => c.name?.includes(search) || c.name_ar?.includes(search) || c.contact_email?.includes(search));

  const handleAction = async (companyId: string, action: string) => {
    setActing(companyId);
    try {
      if (action === 'activate') {
        await request('POST', `/admin/companies/${companyId}/activate`);
        showToast('تم التفعيل');
      } else if (action === 'suspend') {
        await request('POST', `/admin/companies/${companyId}/suspend`);
        showToast('تم الإيقاف');
      }
      await reload();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setActing(null);
  };

  return (
    <>
      {changePlanCo && <ChangePlanModal company={changePlanCo} onClose={() => setChangePlanCo(null)} onDone={async () => { setChangePlanCo(null); await reload(); }} />}
      {extendCo && <ExtendModal company={extendCo} onClose={() => setExtendCo(null)} onDone={async () => { setExtendCo(null); await reload(); }} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1a1a2e' }}>الاشتراكات</h2>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'الكل', count: safeCompanies.length, color: '#7c5cfc' },
          { key: 'active', label: 'نشطة', count: active, color: '#16a34a' },
          { key: 'trial', label: 'تجريبية', count: trial, color: '#3b82f6' },
          { key: 'overdue', label: 'متأخرة', count: overdue, color: '#c2410c' },
          { key: 'suspended', label: 'موقوفة', count: suspended, color: '#dc2626' },
        ].map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10, cursor: 'pointer',
              background: filter === s.key ? s.color : '#fff',
              color: filter === s.key ? '#fff' : '#6b7280',
              border: filter === s.key ? 'none' : '1.5px solid rgba(0,0,0,.06)',
              fontSize: 13, fontWeight: 600, transition: 'all .15s',
              minHeight: 44,
            }}>
            {s.label}
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              background: filter === s.key ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.04)',
            }}>
              {s.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="بحث بالاسم أو البريد..."
        style={{ padding: '11px 18px', borderRadius: 12, border: '1.5px solid rgba(0,0,0,.08)', fontSize: 14, width: '100%', maxWidth: 360, background: '#fafafa', color: '#1a1a2e', marginBottom: 20, minHeight: 44 }}
      />

      {/* Subscription cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <div className="card" style={{ padding: '60px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>لا توجد اشتراكات</div>
        ) : filtered.map(c => {
          const status = lcOf(c);
          const ss = STATUS_STYLES[status] || STATUS_STYLES.active;
          const pc = PLAN_C[c.plan] || PLAN_C.basic;
          const isActing = acting === c.id;
          const trialEnd = c.trial_ends_at && status === 'trial' ? daysUntil(c.trial_ends_at) : null;
          const monthlyPrice = PLAN_PRICE[c.plan] || 0;

          return (
            <div key={c.id} className="card" style={{ padding: '18px 22px', borderRight: `3px solid ${ss.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                {/* Company info */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Link href={`/dashboard/companies/${c.id}`} style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', textDecoration: 'none' }}>{c.name}</Link>
                    <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 8, background: ss.bg, color: ss.color, fontWeight: 600, border: `1px solid ${ss.border}` }}>{ss.label}</span>
                    <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 8, background: pc.bg, color: pc.color, fontWeight: 600, border: `1px solid ${pc.border}` }}>{PLAN_AR[c.plan] || c.plan}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#9ca3af', flexWrap: 'wrap' }}>
                    {c.contact_email && <span style={{ direction: 'ltr' }}>{c.contact_email}</span>}
                    <span>{c.subscription?.billing_cycle === 'yearly' ? 'سنوي' : 'شهري'}</span>
                    {trialEnd !== null && (
                      <span style={{ color: trialEnd <= 3 ? '#dc2626' : '#f59e0b', fontWeight: 600 }}>
                        {trialEnd <= 0 ? 'منتهية' : `ينتهي خلال ${trialEnd} يوم`}
                      </span>
                    )}
                    {c.subscription?.current_period_end && status !== 'trial' && (
                      <span>التجديد: {fmtDate(c.subscription.current_period_end)}</span>
                    )}
                    {monthlyPrice > 0 && <span style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(monthlyPrice)} ر.س/شهر</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={() => setChangePlanCo(c)}
                    style={{ padding: '8px 16px', borderRadius: 10, background: '#ede9fe', border: '1px solid #c4b5fd', color: '#7c5cfc', cursor: 'pointer', fontSize: 12, fontWeight: 600, minHeight: 40 }}>
                    تغيير الخطة
                  </button>
                  {status === 'trial' && (
                    <button onClick={() => setExtendCo(c)} disabled={isActing}
                      style={{ padding: '8px 16px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4070', cursor: 'pointer', fontSize: 12, fontWeight: 600, minHeight: 40 }}>
                      تمديد التجربة
                    </button>
                  )}
                  {(status === 'suspended' || status === 'overdue') && (
                    <button onClick={() => handleAction(c.id, 'activate')} disabled={isActing}
                      style={{ padding: '8px 16px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', cursor: 'pointer', fontSize: 12, fontWeight: 600, minHeight: 40 }}>
                      {isActing ? '...' : 'تفعيل'}
                    </button>
                  )}
                  {status === 'active' && (
                    <button onClick={() => handleAction(c.id, 'suspend')} disabled={isActing}
                      style={{ padding: '8px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600, minHeight: 40 }}>
                      {isActing ? '...' : 'إيقاف'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: '#9ca3af', margin: '16px 0 0', textAlign: 'center' }}>
        عرض {filtered.length} من {safeCompanies.length} اشتراك
      </p>
    </>
  );
}
