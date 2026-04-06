'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

// Derive lifecycle from existing fields — works even without migration
function lcOf(c: any): string {
  if (c.lifecycle_status) return c.lifecycle_status;
  if (!c.is_active) return 'suspended';
  if (c.plan === 'trial') return 'trial';
  return 'active';
}

const LC: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  trial:     { bg: '#fefce8', color: '#854d0e', dot: '#f59e0b', label: 'تجريبي'   },
  active:    { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e', label: 'نشط'       },
  overdue:   { bg: '#fff7ed', color: '#c2410c', dot: '#f97316', label: 'متأخر'     },
  suspended: { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444', label: 'موقوف'     },
  deleted:   { bg: '#f1f5f9', color: '#94a3b8', dot: '#94a3b8', label: 'محذوف'     },
};

const PLAN_AR: Record<string, string> = {
  trial: 'تجريبي', basic: 'أساسي', professional: 'احترافي', enterprise: 'مؤسسي',
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// Onboarding checklist score 0-5 based on available fields
function onboardingScore(c: any) {
  let steps = 0;
  if (c.name)                                    steps++;  // 1. Created
  if (c.contact_email || c.admin_email)          steps++;  // 2. Contact set
  if (c.plan && c.plan !== 'trial')              steps++;  // 3. Plan chosen
  if (c.max_units && c.max_units > 5)            steps++;  // 4. Limits set
  if (c.is_active && daysSince(c.created_at) > 3) steps++; // 5. Active + setup time
  return steps;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats,     setStats]     = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      adminApi.getStats(),                                           // always works
      adminApi.listCompanies(),                                      // always works
      adminApi.sa.listAnomalies({ status: 'open', limit: '8' }),    // needs migration, graceful
    ]);
    if (results[0].status === 'fulfilled') setStats((results[0].value as any)?.data);
    if (results[1].status === 'fulfilled') setCompanies((results[1].value as any)?.data || []);
    if (results[2].status === 'fulfilled') setAnomalies((results[2].value as any)?.data || []);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>⚡</div>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>جاري تحميل لوحة التحكم...</p>
      </div>
    </div>
  );

  // Compute lifecycle buckets from real company data
  const byStage = {
    trial:     companies.filter(c => lcOf(c) === 'trial'),
    active:    companies.filter(c => lcOf(c) === 'active'),
    overdue:   companies.filter(c => lcOf(c) === 'overdue'),
    suspended: companies.filter(c => lcOf(c) === 'suspended'),
  };

  // Attention items
  const trialsExpiringSoon = byStage.trial.filter(c => c.trial_ends_at && daysUntil(c.trial_ends_at) <= 7 && daysUntil(c.trial_ends_at) >= 0);
  const newThisWeek        = companies.filter(c => daysSince(c.created_at) <= 7);
  const needsAttention     = [
    ...byStage.suspended.map(c => ({ type: 'suspended', company: c, msg: `موقوفة منذ ${c.suspended_reason || 'غير محدد'}` })),
    ...byStage.overdue.map(c => ({ type: 'overdue',   company: c, msg: 'دفعة متأخرة' })),
    ...trialsExpiringSoon.map(c => ({ type: 'trial_expiring', company: c, msg: `تجربة تنتهي خلال ${daysUntil(c.trial_ends_at!)} يوم` })),
  ].slice(0, 6);

  const s = stats || {};
  const totalRevenue = s.total_revenue || 0;

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', direction: 'rtl' }}>
      {/* Top nav */}
      <div style={{ background: '#0f172a', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 8px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Liventra OS — Control Plane</span>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {[
            { href: '/dashboard/companies',       label: 'الشركات' },
            { href: '/dashboard/billing',         label: 'الفواتير' },
            { href: '/dashboard/audit',           label: 'التدقيق' },
            { href: '/dashboard/features',        label: 'الميزات' },
            { href: '/dashboard/command-center',   label: '🎯 مركز القيادة' },
            { href: '/dashboard/agents',          label: '🤖 الوكلاء' },
            { href: '/dashboard/template-center', label: '📨 القوالب' },
            { href: '/dashboard/landing-page',    label: '🌐 الموقع' },
            { href: '/dashboard/leads',           label: '📋 طلبات العرض' },
            { href: '/dashboard/demo-leads',      label: '⚡ قيادات الديمو' },
          ].map(n => (
            <Link key={n.href} href={n.href} style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none' }}>{n.label}</Link>
          ))}
          <button onClick={() => { localStorage.clear(); router.push('/login'); }}
            style={{ fontSize: 11, padding: '4px 14px', borderRadius: 8, background: 'rgba(255,255,255,.1)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,.15)', cursor: 'pointer' }}>
            خروج
          </button>
        </div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>لوحة التحكم</h1>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Link href="/dashboard/companies/new"
            style={{ fontSize: 13, padding: '9px 20px', borderRadius: 10, background: '#0f172a', color: 'white', textDecoration: 'none', fontWeight: 600 }}>
            + إضافة شركة
          </Link>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'إجمالي الشركات',   value: companies.length,           color: '#0f172a', icon: '🏢' },
            { label: 'شركات نشطة',        value: byStage.active.length,      color: '#15803d', icon: '✅' },
            { label: 'في التجربة',         value: byStage.trial.length,       color: '#854d0e', icon: '⏳' },
            { label: 'موقوفة / متأخرة',   value: byStage.suspended.length + byStage.overdue.length, color: '#dc2626', icon: '⚠️' },
            { label: 'إجمالي الوحدات',    value: s.total_units || 0,         color: '#7c3aed', icon: '🏠' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{k.label}</p>
                <span style={{ fontSize: 16 }}>{k.icon}</span>
              </div>
              <p style={{ fontSize: 30, fontWeight: 700, color: k.color, margin: 0 }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Lifecycle pipeline */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 18px', color: '#0f172a' }}>مسار دورة حياة الشركات</h2>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
            {[
              { stage: 'trial',     label: 'تجريبي',    count: byStage.trial.length,     color: '#f59e0b', bg: '#fefce8', pct: companies.length ? Math.round(byStage.trial.length/companies.length*100) : 0 },
              { stage: 'active',    label: 'نشط',        count: byStage.active.length,    color: '#22c55e', bg: '#f0fdf4', pct: companies.length ? Math.round(byStage.active.length/companies.length*100) : 0 },
              { stage: 'overdue',   label: 'متأخر',      count: byStage.overdue.length,   color: '#f97316', bg: '#fff7ed', pct: companies.length ? Math.round(byStage.overdue.length/companies.length*100) : 0 },
              { stage: 'suspended', label: 'موقوف',      count: byStage.suspended.length, color: '#ef4444', bg: '#fef2f2', pct: companies.length ? Math.round(byStage.suspended.length/companies.length*100) : 0 },
            ].map((st, i, arr) => (
              <div key={st.stage} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <Link href={`/dashboard/companies?status=${st.stage}`} style={{ flex: 1, padding: '16px 20px', borderRadius: i === 0 ? '10px 0 0 10px' : i === arr.length-1 ? '0 10px 10px 0' : 0, background: st.bg, border: `1px solid ${st.color}33`, textDecoration: 'none', display: 'block', transition: 'filter .15s' }}>
                  <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 4px', fontWeight: 500 }}>{st.label}</p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: st.color, margin: '0 0 4px' }}>{st.count}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#e2e8f0' }}>
                      <div style={{ height: '100%', width: `${st.pct}%`, background: st.color, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>{st.pct}%</span>
                  </div>
                </Link>
                {i < arr.length - 1 && (
                  <div style={{ width: 24, textAlign: 'center', color: '#cbd5e1', fontSize: 16, flexShrink: 0 }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
          {/* Recent companies */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                جميع الشركات
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginRight: 8 }}>({companies.length})</span>
              </h2>
              <Link href="/dashboard/companies" style={{ fontSize: 12, color: '#1d4070', textDecoration: 'none' }}>عرض الكل ←</Link>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 420 }}>
              {companies.slice(0, 15).map((c, i) => {
                const lc = LC[lcOf(c)] || LC.active;
                const score = onboardingScore(c);
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderBottom: i < 14 ? '1px solid #f8fafc' : 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#1d4070', flexShrink: 0 }}>
                      {c.name?.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: lc.bg, color: lc.color, fontWeight: 600, flexShrink: 0 }}>{lc.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{PLAN_AR[c.plan] || c.plan}</p>
                        <span style={{ color: '#e2e8f0' }}>·</span>
                        {/* Onboarding progress dots */}
                        <div style={{ display: 'flex', gap: 3 }}>
                          {[1,2,3,4,5].map(n => (
                            <div key={n} style={{ width: 6, height: 6, borderRadius: '50%', background: n <= score ? '#22c55e' : '#e2e8f0' }} />
                          ))}
                        </div>
                        <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>إعداد {score}/5</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'left', flexShrink: 0 }}>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{c.max_units} وحدة</p>
                      {c.trial_ends_at && lcOf(c) === 'trial' && (
                        <p style={{ fontSize: 10, color: daysUntil(c.trial_ends_at) <= 3 ? '#dc2626' : '#f59e0b', margin: '2px 0 0', fontWeight: 600 }}>
                          {daysUntil(c.trial_ends_at) >= 0 ? `${daysUntil(c.trial_ends_at)}ي` : 'منتهية'}
                        </p>
                      )}
                    </div>
                    <Link href={`/dashboard/companies/${c.id}`}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', color: '#1d4070', textDecoration: 'none', flexShrink: 0 }}>
                      ↗
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Revenue card */}
            <div style={{ background: 'linear-gradient(135deg,#0f172a,#1d4070)', borderRadius: 14, padding: '20px 22px', color: 'white' }}>
              <p style={{ fontSize: 12, color: '#93c5fd', margin: '0 0 6px' }}>إجمالي الإيرادات المُحصَّلة</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: '0 0 12px' }}>
                {totalRevenue.toLocaleString('ar-SA')} ر.س
              </p>
              <div style={{ display: 'flex', gap: 20 }}>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{s.active_contracts || 0}</p>
                  <p style={{ fontSize: 11, color: '#93c5fd', margin: '2px 0 0' }}>عقد نشط</p>
                </div>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{s.active_companies || 0}</p>
                  <p style={{ fontSize: 11, color: '#93c5fd', margin: '2px 0 0' }}>شركة نشطة</p>
                </div>
              </div>
            </div>

            {/* Needs attention */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', flex: 1 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>يحتاج انتباهاً</h3>
                {needsAttention.length > 0 && (
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>
                    {needsAttention.length}
                  </span>
                )}
              </div>
              {needsAttention.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                  لا توجد تنبيهات
                </div>
              ) : (
                needsAttention.map((item, i) => {
                  const color = item.type === 'suspended' ? '#dc2626' : item.type === 'overdue' ? '#f97316' : '#f59e0b';
                  const icon  = item.type === 'suspended' ? '🔴' : item.type === 'overdue' ? '🟠' : '🟡';
                  return (
                    <Link key={i} href={`/dashboard/companies/${item.company.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderBottom: i < needsAttention.length-1 ? '1px solid #f8fafc' : 'none', textDecoration: 'none' }}>
                      <span style={{ fontSize: 14 }}>{icon}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: 0 }}>{item.company.name}</p>
                        <p style={{ fontSize: 11, color, margin: '2px 0 0' }}>{item.msg}</p>
                      </div>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>←</span>
                    </Link>
                  );
                })
              )}

              {/* New this week */}
              {newThisWeek.length > 0 && (
                <div style={{ padding: '10px 18px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                  <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 6px', fontWeight: 600 }}>انضمت هذا الأسبوع 🆕</p>
                  {newThisWeek.slice(0, 3).map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                      <Link href={`/dashboard/companies/${c.id}`} style={{ fontSize: 12, color: '#1d4070', textDecoration: 'none' }}>{c.name}</Link>
                      <span style={{ fontSize: 10, color: '#94a3b8', marginRight: 'auto' }}>منذ {daysSince(c.created_at)} يوم</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Anomalies (if migration ran) */}
            {anomalies.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #fecaca', overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', margin: 0 }}>🚨 تنبيهات ذكية ({anomalies.length})</p>
                </div>
                {anomalies.slice(0, 3).map((a, i) => (
                  <div key={a.id} style={{ padding: '10px 18px', borderBottom: i < 2 ? '1px solid #fef2f2' : 'none' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: '0 0 2px' }}>{a.anomaly_type?.replace(/_/g,' ')}</p>
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{a.description}</p>
                  </div>
                ))}
                <Link href="/dashboard/audit" style={{ display: 'block', textAlign: 'center', padding: '10px', fontSize: 12, color: '#dc2626', textDecoration: 'none', borderTop: '1px solid #fef2f2' }}>
                  عرض الكل ←
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
