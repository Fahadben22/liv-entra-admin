'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

const LC_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  trial:     { bg: '#fefce8', color: '#854d0e', label: 'تجريبي'   },
  active:    { bg: '#f0fdf4', color: '#15803d', label: 'نشط'       },
  overdue:   { bg: '#fff7ed', color: '#c2410c', label: 'متأخر'     },
  suspended: { bg: '#fef2f2', color: '#dc2626', label: 'موقوف'     },
  deleted:   { bg: '#f1f5f9', color: '#64748b', label: 'محذوف'     },
};

function StatCard({ label, value, sub, color }: { label: string; value: any; sub?: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 22px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 30, fontWeight: 700, color, margin: 0 }}>{value ?? '—'}</p>
      {sub && <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

function MrrBar({ current, prev }: { current: number; prev: number }) {
  const pct = prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
        {current.toLocaleString('ar-SA')} ر.س
      </span>
      {pct !== 0 && (
        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: pct > 0 ? '#f0fdf4' : '#fef2f2', color: pct > 0 ? '#15803d' : '#dc2626', fontWeight: 600 }}>
          {pct > 0 ? '+' : ''}{pct}%
        </span>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats,     setStats]     = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [mrr,       setMrr]       = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    setLoading(true);
    const results = await Promise.allSettled([
      adminApi.sa.platformStats(),
      adminApi.sa.listCompanies({ limit: '10', order: 'created_at.desc' }),
      adminApi.sa.mrrStats(),
      adminApi.sa.listAnomalies({ status: 'open', limit: '5' }),
    ]);
    if (results[0].status === 'fulfilled') setStats((results[0].value as any)?.data);
    if (results[1].status === 'fulfilled') setCompanies((results[1].value as any)?.data || []);
    if (results[2].status === 'fulfilled') setMrr((results[2].value as any)?.data);
    if (results[3].status === 'fulfilled') setAnomalies((results[3].value as any)?.data || []);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
      <p style={{ color: '#94a3b8', fontSize: 14 }}>جاري تحميل لوحة التحكم...</p>
    </div>
  );

  const s = stats || {};

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', direction: 'rtl' }}>
      {/* Top nav */}
      <div style={{ background: '#0f172a', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 8px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white', letterSpacing: 0.3 }}>Liventra OS — Control Plane</span>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {[
            { href: '/dashboard/companies', label: 'الشركات' },
            { href: '/dashboard/billing',   label: 'الفواتير' },
            { href: '/dashboard/audit',     label: 'التدقيق' },
            { href: '/dashboard/features',  label: 'الميزات' },
            { href: '/dashboard/intelligence', label: '🧠 الذكاء' },
          ].map(n => (
            <Link key={n.href} href={n.href} style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none' }}>{n.label}</Link>
          ))}
          <button
            onClick={() => { localStorage.clear(); router.push('/login'); }}
            style={{ fontSize: 11, padding: '4px 14px', borderRadius: 8, background: 'rgba(255,255,255,.1)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,.15)', cursor: 'pointer' }}>
            خروج
          </button>
        </div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>لوحة التحكم الرئيسية</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* MRR Banner */}
        {mrr && (
          <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#1d4070)', borderRadius: 16, padding: '22px 28px', marginBottom: 28, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 12, color: '#93c5fd', margin: '0 0 6px' }}>الإيراد الشهري المتكرر (MRR)</p>
              <MrrBar current={mrr.current_mrr || 0} prev={mrr.prev_mrr || 0} />
            </div>
            <div style={{ display: 'flex', gap: 32, textAlign: 'center' }}>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{(mrr.arr || 0).toLocaleString('ar-SA')}</p>
                <p style={{ fontSize: 11, color: '#93c5fd', margin: '4px 0 0' }}>ARR (ر.س)</p>
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{mrr.active_subscriptions || 0}</p>
                <p style={{ fontSize: 11, color: '#93c5fd', margin: '4px 0 0' }}>اشتراك نشط</p>
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{mrr.overdue_subscriptions || 0}</p>
                <p style={{ fontSize: 11, color: '#fca5a5', margin: '4px 0 0' }}>متأخرات</p>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 28 }}>
          <StatCard label="إجمالي الشركات"   value={s.total_companies}  color="#0f172a" />
          <StatCard label="شركات نشطة"        value={s.active_companies}  color="#15803d" sub={`${s.total_companies ? Math.round((s.active_companies/s.total_companies)*100) : 0}% من الإجمالي`} />
          <StatCard label="في التجربة"         value={s.trial_companies}   color="#854d0e" />
          <StatCard label="موقوفة / متأخرة"    value={(s.suspended_companies||0)+(s.overdue_companies||0)} color="#dc2626" />
          <StatCard label="إجمالي الوحدات"     value={s.total_units}       color="#7c3aed" sub={`عبر ${s.total_properties||0} مبنى`} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
          {/* Recent Companies */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>أحدث الشركات</h2>
              <Link href="/dashboard/companies" style={{ fontSize: 12, color: '#1d4070', textDecoration: 'none' }}>عرض الكل ←</Link>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['الشركة', 'الحالة', 'الخطة', 'الوحدات', ''].map(h => (
                    <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map((c, i) => {
                  const lc = LC_COLORS[c.lifecycle_status] || LC_COLORS[c.is_active ? 'active' : 'suspended'];
                  return (
                    <tr key={c.id} style={{ borderBottom: i < companies.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1d4070' }}>
                            {c.name?.charAt(0)}
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{c.name}</p>
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, direction: 'ltr', textAlign: 'right' }}>{c.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: lc.bg, color: lc.color, fontWeight: 500 }}>
                          {lc.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>
                        {c.subscription?.plan?.name || c.plan || '—'}
                      </td>
                      <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>
                        {c.max_units ?? '—'}
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <Link href={`/dashboard/companies/${c.id}`} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', color: '#1d4070', textDecoration: 'none' }}>
                          تفاصيل
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Anomalies Panel */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', height: 'fit-content' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>تنبيهات نشطة</h2>
              {anomalies.length > 0 && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 600 }}>
                  {anomalies.length}
                </span>
              )}
            </div>
            <div style={{ padding: 16 }}>
              {anomalies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                  لا توجد تنبيهات نشطة
                </div>
              ) : (
                anomalies.map(a => {
                  const sevColors = { critical: { bg: '#fef2f2', color: '#dc2626', dot: '#dc2626' }, warning: { bg: '#fff7ed', color: '#c2410c', dot: '#f97316' }, info: { bg: '#eff6ff', color: '#1d4070', dot: '#3b82f6' } } as any;
                  const sc = sevColors[a.severity] || sevColors.info;
                  return (
                    <div key={a.id} style={{ padding: '12px 14px', borderRadius: 10, background: sc.bg, marginBottom: 10, border: `1px solid ${sc.dot}22` }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.dot, marginTop: 4, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: sc.color, margin: '0 0 2px' }}>{a.anomaly_type?.replace(/_/g, ' ')}</p>
                          <p style={{ fontSize: 11, color: '#475569', margin: 0, lineHeight: 1.4 }}>{a.description}</p>
                          {a.ai_suggestion && (
                            <p style={{ fontSize: 10, color: '#64748b', margin: '4px 0 0', fontStyle: 'italic' }}>💡 {a.ai_suggestion}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {anomalies.length > 0 && (
                <Link href="/dashboard/audit" style={{ display: 'block', textAlign: 'center', fontSize: 12, color: '#1d4070', textDecoration: 'none', marginTop: 8 }}>
                  عرض كل التنبيهات ←
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <Link href="/dashboard/companies/new"
            style={{ fontSize: 13, padding: '10px 20px', borderRadius: 10, background: '#1d4070', color: 'white', textDecoration: 'none', fontWeight: 600 }}>
            + إضافة شركة جديدة
          </Link>
          <Link href="/dashboard/billing"
            style={{ fontSize: 13, padding: '10px 20px', borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a', textDecoration: 'none', fontWeight: 500 }}>
            إدارة الفواتير
          </Link>
          <Link href="/dashboard/intelligence"
            style={{ fontSize: 13, padding: '10px 20px', borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a', textDecoration: 'none', fontWeight: 500 }}>
            🧠 مركز الذكاء
          </Link>
        </div>
      </div>
    </div>
  );
}
