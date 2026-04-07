'use client';
import { useState } from 'react';
import { request } from '@/lib/api';
import { useBilling } from '../layout';
import { fmt, fmtDate, PLAN_AR, PLAN_C, lcOf, daysUntil } from '@/lib/billing-helpers';
import Link from 'next/link';

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'نشط',    color: '#16a34a', bg: '#f0fdf4' },
  trial:     { label: 'تجريبي', color: '#3b82f6', bg: '#eff6ff' },
  overdue:   { label: 'متأخر',  color: '#c2410c', bg: '#fff7ed' },
  suspended: { label: 'موقوف',  color: '#dc2626', bg: '#fef2f2' },
};

export default function SubscriptionsPage() {
  const { companies, loading, reload, showToast } = useBilling();
  const [filter, setFilter] = useState<string>('all');
  const [acting, setActing] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: '#6b7280' }}>جاري التحميل...</div>;

  const safeCompanies = Array.isArray(companies) ? companies : [];

  // Counts
  const active    = safeCompanies.filter(c => lcOf(c) === 'active').length;
  const trial     = safeCompanies.filter(c => lcOf(c) === 'trial').length;
  const overdue   = safeCompanies.filter(c => lcOf(c) === 'overdue').length;
  const suspended = safeCompanies.filter(c => lcOf(c) === 'suspended').length;

  // Filter + search
  let filtered = safeCompanies;
  if (filter !== 'all') filtered = filtered.filter(c => lcOf(c) === filter);
  if (search.trim()) filtered = filtered.filter(c => c.name?.includes(search) || c.name_ar?.includes(search) || c.email?.includes(search));

  // Actions
  const handleAction = async (companyId: string, action: string, extra?: any) => {
    setActing(companyId);
    try {
      if (action === 'activate') {
        await request('POST', `/admin/companies/${companyId}/activate`);
        showToast('تم التفعيل');
      } else if (action === 'suspend') {
        await request('POST', `/admin/companies/${companyId}/suspend`);
        showToast('تم الإيقاف');
      } else if (action === 'extend') {
        const days = parseInt(prompt('عدد أيام التمديد:') || '0');
        if (!days) { setActing(null); return; }
        await request('POST', `/superadmin/companies/${companyId}/extend-trial`, { days });
        showToast(`تم تمديد التجربة ${days} يوماً`);
      }
      await reload();
    } catch (e: any) {
      showToast(`خطأ: ${e.message}`);
    }
    setActing(null);
  };

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 20px', color: '#1a1a2e' }}>الاشتراكات</h2>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'all',       label: 'الكل',     count: safeCompanies.length, color: '#1a1a2e' },
          { key: 'active',    label: 'نشطة',     count: active,    color: '#16a34a' },
          { key: 'trial',     label: 'تجريبية',  count: trial,     color: '#3b82f6' },
          { key: 'overdue',   label: 'متأخرة',   count: overdue,   color: '#c2410c' },
          { key: 'suspended', label: 'موقوفة',   count: suspended, color: '#dc2626' },
        ].map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className="card" style={{
              background: filter === s.key ? s.color : '#fff', borderRadius: 12, padding: '12px 20px',
              minWidth: 100, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.06)',
              border: filter === s.key ? 'none' : '1px solid rgba(0,0,0,.06)', cursor: 'pointer',
            }}>
            <p style={{ fontSize: 22, fontWeight: 600, color: filter === s.key ? '#fff' : s.color, margin: 0 }}>{s.count}</p>
            <p style={{ fontSize: 11, color: filter === s.key ? 'rgba(255,255,255,.8)' : '#6b7280', margin: '4px 0 0', fontWeight: 500 }}>{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو البريد..."
          style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,.08)', fontSize: 13, width: 280, background: '#f8f7fc', color: '#1a1a2e' }}
        />
      </div>

      {/* Company list */}
      <div className="card" style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>لا توجد شركات</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f7fc' }}>
                {['الشركة', 'الخطة', 'الحالة', 'الفترة', 'الدورة', 'إجراءات'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#6b7280', borderBottom: '1px solid rgba(0,0,0,.06)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const status = lcOf(c);
                const ss = STATUS_STYLES[status] || STATUS_STYLES.active;
                const pc = PLAN_C[c.plan] || PLAN_C.basic;
                const isActing = acting === c.id;
                const trialEnd = c.trial_ends_at && status === 'trial' ? daysUntil(c.trial_ends_at) : null;
                return (
                  <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,.04)' : 'none', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/dashboard/companies/${c.id}`} style={{ textDecoration: 'none' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>{c.name}</p>
                      </Link>
                      {c.email && <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0', direction: 'ltr' }}>{c.email}</p>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 7, background: pc.bg, color: pc.color, fontWeight: 600, border: `1px solid ${pc.border}` }}>
                        {PLAN_AR[c.plan] || c.plan}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, color: ss.color, fontWeight: 500 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.color, display: 'inline-block' }} />
                        {ss.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#9ca3af' }}>
                      {trialEnd !== null ? (
                        <span style={{ color: trialEnd <= 3 ? '#dc2626' : '#6b7280', fontWeight: trialEnd <= 3 ? 600 : 400 }}>
                          {trialEnd <= 0 ? 'منتهية' : `${trialEnd} يوم`}
                        </span>
                      ) : c.subscription?.current_period_end ? (
                        fmtDate(c.subscription.current_period_end)
                      ) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#9ca3af' }}>
                      {c.subscription?.billing_cycle === 'yearly' ? 'سنوي' : 'شهري'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {status === 'trial' && (
                          <button onClick={() => handleAction(c.id, 'extend')} disabled={isActing}
                            style={{ fontSize: 10, padding: '4px 10px', borderRadius: 7, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4070', cursor: 'pointer', fontWeight: 500 }}>
                            {isActing ? '...' : 'تمديد'}
                          </button>
                        )}
                        {(status === 'suspended' || status === 'overdue') && (
                          <button onClick={() => handleAction(c.id, 'activate')} disabled={isActing}
                            style={{ fontSize: 10, padding: '4px 10px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', cursor: 'pointer', fontWeight: 500 }}>
                            {isActing ? '...' : 'تفعيل'}
                          </button>
                        )}
                        {status === 'active' && (
                          <button onClick={() => handleAction(c.id, 'suspend')} disabled={isActing}
                            style={{ fontSize: 10, padding: '4px 10px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', fontWeight: 500 }}>
                            {isActing ? '...' : 'إيقاف'}
                          </button>
                        )}
                        <Link href={`/dashboard/companies/${c.id}`}
                          style={{ fontSize: 10, padding: '4px 10px', borderRadius: 7, background: '#f8f7fc', border: '1px solid rgba(0,0,0,.08)', color: '#6b7280', textDecoration: 'none', fontWeight: 500 }}>
                          تفاصيل
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ fontSize: 11, color: '#9ca3af', margin: '12px 0 0', textAlign: 'center' }}>
        عرض {filtered.length} من {safeCompanies.length} شركة
      </p>
    </div>
  );
}
