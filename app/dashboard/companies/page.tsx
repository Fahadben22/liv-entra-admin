'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

const LC: Record<string, { bg: string; color: string; label: string }> = {
  trial:     { bg: '#fefce8', color: '#854d0e', label: 'تجريبي'   },
  active:    { bg: '#f0fdf4', color: '#15803d', label: 'نشط'       },
  overdue:   { bg: '#fff7ed', color: '#c2410c', label: 'متأخر'     },
  suspended: { bg: '#fef2f2', color: '#dc2626', label: 'موقوف'     },
  deleted:   { bg: '#f1f5f9', color: '#94a3b8', label: 'محذوف'     },
};

const PLAN_COLORS: Record<string, { bg: string; color: string }> = {
  trial:        { bg: '#f0fdf4', color: '#15803d' },
  basic:        { bg: '#f8fafc', color: '#475569' },
  professional: { bg: '#eff6ff', color: '#1d4070' },
  enterprise:   { bg: '#fef3c7', color: '#92400e' },
};

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actioning, setActioning] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    setLoading(true);
    try {
      const r = await adminApi.sa.listCompanies();
      setCompanies((r as any)?.data || []);
    } catch { router.push('/login'); }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: 'activate' | 'suspend' | 'delete', name: string) => {
    const confirmMsg = action === 'activate' ? `تفعيل "${name}"؟` :
                       action === 'suspend'  ? `إيقاف "${name}"؟ سيمنع الوصول فوراً.` :
                                               `حذف "${name}"؟ لا يمكن التراجع.`;
    if (!confirm(confirmMsg)) return;
    setActioning(id);
    try {
      if (action === 'activate') await adminApi.sa.activateCompany(id);
      else if (action === 'suspend') {
        const reason = prompt('سبب الإيقاف:') || 'manual_suspension';
        await adminApi.sa.suspendCompany(id, reason);
      } else {
        const reason = prompt('سبب الحذف:') || 'manual_deletion';
        await adminApi.sa.deleteCompany(id, reason);
      }
      showToast('تم بنجاح ✓');
      await load();
    } catch (e: any) {
      showToast(`خطأ: ${e.message}`);
    }
    setActioning(null);
  };

  const filtered = companies.filter(c => {
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.slug?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || (c.lifecycle_status || (c.is_active ? 'active' : 'suspended')) === statusFilter;
    return matchSearch && matchStatus;
  });

  // Counts per status
  const counts = companies.reduce((acc, c) => {
    const s = c.lifecycle_status || (c.is_active ? 'active' : 'suspended');
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
          <Link href="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>إدارة الشركات والمستأجرين</span>
        </div>
        <Link href="/dashboard/companies/new"
          style={{ fontSize: 12, padding: '7px 16px', borderRadius: 8, background: '#1d4070', color: 'white', textDecoration: 'none', fontWeight: 600 }}>
          + إضافة شركة
        </Link>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Status filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: `الكل (${companies.length})` },
            { key: 'active',    label: `نشط (${counts.active || 0})` },
            { key: 'trial',     label: `تجريبي (${counts.trial || 0})` },
            { key: 'overdue',   label: `متأخر (${counts.overdue || 0})` },
            { key: 'suspended', label: `موقوف (${counts.suspended || 0})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer', transition: 'all .15s',
                background: statusFilter === tab.key ? '#0f172a' : 'white',
                color:      statusFilter === tab.key ? 'white'    : '#475569',
                borderColor: statusFilter === tab.key ? '#0f172a' : '#e2e8f0',
                fontWeight: statusFilter === tab.key ? 600 : 400 }}>
              {tab.label}
            </button>
          ))}

          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الرابط..."
            style={{ marginRight: 'auto', padding: '6px 14px', borderRadius: 20, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', width: 220, background: 'white' }} />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>جاري التحميل...</div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
            <div style={{ padding: '14px 22px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>{filtered.length} شركة</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['الشركة', 'الحالة', 'الخطة', 'المستخدمون', 'الوحدات', 'تاريخ التسجيل', 'إجراءات'].map(h => (
                    <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const lcStatus = c.lifecycle_status || (c.is_active ? 'active' : 'suspended');
                  const lc = LC[lcStatus] || LC.active;
                  const planName = c.subscription?.plan?.name || c.plan || 'basic';
                  const pc = PLAN_COLORS[planName] || PLAN_COLORS.basic;
                  const planAr: Record<string, string> = { trial: 'تجريبي', basic: 'أساسي', professional: 'احترافي', enterprise: 'مؤسسي' };
                  const isActing = actioning === c.id;

                  return (
                    <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background .1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafbfc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#1d4070', flexShrink: 0 }}>
                            {c.name?.charAt(0)}
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#0f172a' }}>{c.name}</p>
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, direction: 'ltr', textAlign: 'right' }}>{c.slug}</p>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: lc.bg, color: lc.color, fontWeight: 600 }}>
                          {lc.label}
                        </span>
                        {c.trial_ends_at && lcStatus === 'trial' && (
                          <p style={{ fontSize: 10, color: '#94a3b8', margin: '3px 0 0' }}>
                            ينتهي {new Date(c.trial_ends_at).toLocaleDateString('ar-SA')}
                          </p>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: pc.bg, color: pc.color, fontWeight: 500 }}>
                          {planAr[planName] || planName}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px', fontSize: 12, color: '#475569' }}>
                        {c.usage?.staff_count ?? '—'} / {c.max_users ?? '∞'}
                      </td>

                      <td style={{ padding: '14px 18px', fontSize: 12, color: '#475569' }}>
                        {c.usage?.unit_count ?? c.max_units ?? '—'}
                      </td>

                      <td style={{ padding: '14px 18px', fontSize: 11, color: '#94a3b8', direction: 'ltr', textAlign: 'right' }}>
                        {new Date(c.created_at).toLocaleDateString('ar-SA')}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Link href={`/dashboard/companies/${c.id}`}
                            style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, border: '1px solid #e2e8f0', color: '#1d4070', textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            تحكم ↗
                          </Link>
                          {lcStatus !== 'active' && lcStatus !== 'deleted' && (
                            <button onClick={() => handleAction(c.id, 'activate', c.name)} disabled={isActing}
                              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              {isActing ? '...' : 'تفعيل'}
                            </button>
                          )}
                          {lcStatus === 'active' && (
                            <button onClick={() => handleAction(c.id, 'suspend', c.name)} disabled={isActing}
                              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              {isActing ? '...' : 'إيقاف'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 13 }}>
                      لا توجد شركات تطابق البحث
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
