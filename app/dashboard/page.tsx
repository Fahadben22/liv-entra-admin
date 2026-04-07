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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #ede9fe', borderTopColor: '#7c5cfc', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
    <div>
      {/* Header */}
      <div className="fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0, letterSpacing: '-0.03em' }}>لوحة التحكم</h1>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
            {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/dashboard/companies/new"
          style={{ fontSize: 12, padding: '9px 20px', borderRadius: 10, background: '#7c5cfc', color: '#fff', textDecoration: 'none', fontWeight: 500, boxShadow: '0 2px 8px rgba(124,92,252,.2)' }}>
          + إضافة شركة
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'إجمالي الشركات', value: companies.length, trend: '+12%', up: true, color: '#7c5cfc' },
          { label: 'شركات نشطة', value: byStage.active.length, trend: '+8%', up: true, color: '#10b981' },
          { label: 'في التجربة', value: byStage.trial.length, trend: `${byStage.trial.length}`, up: true, color: '#f59e0b' },
          { label: 'موقوفة / متأخرة', value: byStage.suspended.length + byStage.overdue.length, trend: byStage.suspended.length + byStage.overdue.length > 0 ? 'تنبيه' : '0', up: false, color: '#ef4444' },
        ].map((k, i) => (
          <div key={k.label} className="card fade-in" style={{ padding: '22px 24px', animationDelay: `${i * 0.06}s` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, fontWeight: 500 }}>{k.label}</p>
              {/* Mini sparkline SVG */}
              <svg width="60" height="24" viewBox="0 0 60 24" fill="none">
                <path d={`M0 ${20 - i * 3} C15 ${12 + i * 2},30 ${8 - i},45 ${14 + i * 2},60 ${6 + i}`} stroke={k.color} strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <p style={{ fontSize: 32, fontWeight: 700, color: '#1a1a2e', margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}>{k.value}</p>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                background: k.up ? '#ecfdf5' : '#fef2f2',
                color: k.up ? '#10b981' : '#ef4444',
                marginBottom: 4,
              }}>
                {k.up ? '↑' : '↓'} {k.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Lifecycle pipeline */}
      <div className="card" style={{ padding: '22px 26px', marginBottom: 28 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px', color: '#1a1a2e' }}>دورة حياة الشركات</h2>
        <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { stage: 'trial',     label: 'تجريبي', count: byStage.trial.length,     color: '#f59e0b', bg: '#fffbeb', pct: companies.length ? Math.round(byStage.trial.length/companies.length*100) : 0 },
            { stage: 'active',    label: 'نشط',     count: byStage.active.length,    color: '#10b981', bg: '#ecfdf5', pct: companies.length ? Math.round(byStage.active.length/companies.length*100) : 0 },
            { stage: 'overdue',   label: 'متأخر',   count: byStage.overdue.length,   color: '#f97316', bg: '#fff7ed', pct: companies.length ? Math.round(byStage.overdue.length/companies.length*100) : 0 },
            { stage: 'suspended', label: 'موقوف',   count: byStage.suspended.length, color: '#ef4444', bg: '#fef2f2', pct: companies.length ? Math.round(byStage.suspended.length/companies.length*100) : 0 },
          ].map((st) => (
            <Link key={st.stage} href={`/dashboard/companies?status=${st.stage}`}
              style={{ padding: '16px 20px', borderRadius: 12, background: st.bg, textDecoration: 'none', display: 'block', transition: 'all .15s', border: '1px solid transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.color }} />
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0, fontWeight: 500 }}>{st.label}</p>
              </div>
              <p style={{ fontSize: 26, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px', letterSpacing: '-0.03em' }}>{st.count}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(0,0,0,.06)' }}>
                  <div style={{ height: '100%', width: `${st.pct}%`, background: st.color, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap' }}>{st.pct}%</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
        {/* Recent companies */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(0,0,0,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#1a1a2e' }}>
              جميع الشركات
              <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400, marginRight: 6 }}>({companies.length})</span>
            </h2>
            <Link href="/dashboard/companies" style={{ fontSize: 12, color: '#7c5cfc', textDecoration: 'none', fontWeight: 500 }}>عرض الكل →</Link>
          </div>
            <div style={{ overflowY: 'auto', maxHeight: 420 }}>
              {companies.slice(0, 15).map((c, i) => {
                const lc = LC[lcOf(c)] || LC.active;
                const score = onboardingScore(c);
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 22px', borderBottom: i < 14 ? '1px solid rgba(0,0,0,.04)' : 'none', transition: 'background .15s' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#7c5cfc', flexShrink: 0 }}>
                      {c.name?.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: lc.bg, color: lc.color, fontWeight: 600, flexShrink: 0 }}>{lc.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{PLAN_AR[c.plan] || c.plan}</p>
                        <span style={{ color: '#d1d5db' }}>·</span>
                        {/* Onboarding progress dots */}
                        <div style={{ display: 'flex', gap: 3 }}>
                          {[1,2,3,4,5].map(n => (
                            <div key={n} style={{ width: 5, height: 5, borderRadius: '50%', background: n <= score ? '#10b981' : '#e5e7eb' }} />
                          ))}
                        </div>
                        <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>إعداد {score}/5</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'left', flexShrink: 0 }}>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{c.max_units} وحدة</p>
                      {c.trial_ends_at && lcOf(c) === 'trial' && (
                        <p style={{ fontSize: 10, color: daysUntil(c.trial_ends_at) <= 3 ? '#dc2626' : '#f59e0b', margin: '2px 0 0', fontWeight: 600 }}>
                          {daysUntil(c.trial_ends_at) >= 0 ? `${daysUntil(c.trial_ends_at)}ي` : 'منتهية'}
                        </p>
                      )}
                    </div>
                    <Link href={`/dashboard/companies/${c.id}`}
                      style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,.06)', color: '#7c5cfc', textDecoration: 'none', flexShrink: 0, transition: 'all .15s' }}>
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
            <div className="card" style={{ background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', padding: '22px 24px', color: '#fff' }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', margin: '0 0 8px', fontWeight: 500 }}>إجمالي الإيرادات المُحصَّلة</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: '0 0 18px', letterSpacing: '-0.03em' }}>
                {totalRevenue.toLocaleString('ar-SA')} ر.س
              </p>
              <div style={{ display: 'flex', gap: 28 }}>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{s.active_contracts || 0}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', margin: '3px 0 0' }}>عقد نشط</p>
                </div>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{s.active_companies || 0}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', margin: '3px 0 0' }}>شركة نشطة</p>
                </div>
              </div>
            </div>

            {/* Needs attention */}
            <div className="card" style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#1a1a2e' }}>يحتاج انتباهاً</h3>
                {needsAttention.length > 0 && (
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: '#fef2f2', color: '#ef4444', fontWeight: 600 }}>
                    {needsAttention.length}
                  </span>
                )}
              </div>
              {needsAttention.length === 0 ? (
                <div style={{ padding: '28px 0', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                  لا توجد تنبيهات
                </div>
              ) : (
                needsAttention.map((item, i) => {
                  const color = item.type === 'suspended' ? '#ef4444' : item.type === 'overdue' ? '#f97316' : '#f59e0b';
                  return (
                    <Link key={i} href={`/dashboard/companies/${item.company.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px', borderBottom: i < needsAttention.length-1 ? '1px solid rgba(0,0,0,.04)' : 'none', textDecoration: 'none', transition: 'background .15s' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>{item.company.name}</p>
                        <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{item.msg}</p>
                      </div>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>←</span>
                    </Link>
                  );
                })
              )}

              {/* New this week */}
              {newThisWeek.length > 0 && (
                <div style={{ padding: '12px 20px', background: '#f8f7fc', borderTop: '1px solid rgba(0,0,0,.04)' }}>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px', fontWeight: 600 }}>انضمت هذا الأسبوع</p>
                  {newThisWeek.slice(0, 3).map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                      <Link href={`/dashboard/companies/${c.id}`} style={{ fontSize: 12, color: '#7c5cfc', textDecoration: 'none' }}>{c.name}</Link>
                      <span style={{ fontSize: 10, color: '#9ca3af', marginRight: 'auto' }}>منذ {daysSince(c.created_at)} يوم</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Anomalies */}
            {anomalies.length > 0 && (
              <div className="card" style={{ background: '#fef2f2', overflow: 'hidden', border: '1px solid #fecaca' }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #fecaca' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', margin: 0 }}>تنبيهات ذكية ({anomalies.length})</p>
                </div>
                {anomalies.slice(0, 3).map((a, i) => (
                  <div key={a.id} style={{ padding: '10px 20px', borderBottom: i < 2 ? '1px solid #fecaca' : 'none', background: '#fff' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', margin: '0 0 2px' }}>{a.anomaly_type?.replace(/_/g,' ')}</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{a.description}</p>
                  </div>
                ))}
                <Link href="/dashboard/audit" style={{ display: 'block', textAlign: 'center', padding: '10px', fontSize: 12, color: '#ef4444', textDecoration: 'none', borderTop: '1px solid #fecaca', background: '#fff' }}>
                  عرض الكل ←
                </Link>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
