'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useEvents, DashboardEvent } from '@/lib/useEvents';

const MODULE_ICONS: Record<string, string> = {
  properties: '🏢', units: '🏠', tenants: '👤', contracts: '📋', payments: '💰',
  maintenance: '🔧', reports: '📊', dashboard: '📈', whatsapp: '💬', settings: '⚙️',
  expenses: '💸', documents: '📄', leads: '🎯', vendors: '🏪', auth: '🔐', other: '📋',
};

const MODULE_AR: Record<string, string> = {
  properties: 'العقارات', units: 'الوحدات', tenants: 'المستأجرين', contracts: 'العقود',
  payments: 'المدفوعات', maintenance: 'الصيانة', reports: 'التقارير', dashboard: 'لوحة التحكم',
  whatsapp: 'واتساب', settings: 'الإعدادات', expenses: 'المصاريف', documents: 'المستندات',
  leads: 'العملاء المحتملين', vendors: 'الموردين', auth: 'الدخول', other: 'أخرى',
};

const PLAN_AR: Record<string, string> = { trial: 'تجريبي', basic: 'أساسي', professional: 'احترافي', enterprise: 'مؤسسي' };

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'الآن';
  if (s < 3600) return `منذ ${Math.floor(s / 60)} د`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} س`;
  return `منذ ${Math.floor(s / 86400)} ي`;
}

export default function ActivityPage() {
  const [overview, setOverview] = useState<any>(null);
  const [live, setLive]         = useState<any>(null);
  const [health, setHealth]     = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const { events, isConnected } = useEvents(50);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      adminApi.sa.activityOverview(),
      adminApi.sa.activityLive(),
      adminApi.sa.companyHealth(),
    ]);
    if (results[0].status === 'fulfilled') setOverview((results[0].value as any)?.data);
    if (results[1].status === 'fulfilled') setLive((results[1].value as any)?.data);
    if (results[2].status === 'fulfilled') setHealth((results[2].value as any)?.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh live data every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await adminApi.sa.activityLive().catch(() => null);
      if (res?.data) setLive(res.data);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #DBEAFE', borderTopColor: '#2563EB', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const o = overview || {};
  const h = health || {};
  const clientEvents = events.filter((e: DashboardEvent) => e.type === 'client_activity');

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1E293B', margin: 0 }}>نشاط العملاء</h1>
            {isConnected && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#16A34A', background: '#F0FDF4', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', animation: 'pulse-dot 2s infinite' }} />
                مباشر
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>متابعة ما يقوم به عملاؤك داخل النظام</p>
        </div>
        <button onClick={load} style={{ fontSize: 12, padding: '8px 16px', borderRadius: 10, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#64748B', cursor: 'pointer' }}>
          ↻ تحديث
        </button>
      </div>

      {/* ── Section A: KPI Strip ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'نشط اليوم (DAU)', value: o.dau || 0, color: '#2563EB', sub: 'شركة' },
          { label: 'نشط هذا الأسبوع (WAU)', value: o.wau || 0, color: '#16A34A', sub: 'شركة' },
          { label: 'نشط هذا الشهر (MAU)', value: o.mau || 0, color: '#0891B2', sub: 'شركة' },
          { label: 'متصل الآن', value: live?.active_now || 0, color: '#16A34A', sub: '', live: true },
        ].map((k, i) => (
          <div key={k.label} className="card" style={{ padding: '18px 16px', borderRight: `3px solid ${k.color}` }}>
            <p style={{ fontSize: 10, color: '#94A3B8', margin: '0 0 8px', fontWeight: 600, letterSpacing: '.04em' }}>{k.label}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#1E293B', margin: 0, lineHeight: 1 }}>{k.value}</p>
              {k.live && k.value > 0 && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', animation: 'pulse-dot 2s infinite' }} />
              )}
            </div>
            {k.sub && <p style={{ fontSize: 10, color: '#94A3B8', margin: '4px 0 0' }}>{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Section B+C: Live Feed + Active Companies ──────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, marginBottom: 24 }}>

        {/* Live Activity Feed */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#1E293B' }}>🟢 النشاط المباشر</h2>
            <span style={{ fontSize: 10, color: '#94A3B8' }}>{clientEvents.length} حدث</span>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {clientEvents.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
                في انتظار نشاط العملاء...
                <p style={{ fontSize: 11, marginTop: 8 }}>ستظهر هنا الأحداث فور حدوثها</p>
              </div>
            ) : (
              clientEvents.map((ev: DashboardEvent, i: number) => (
                <div key={`${ev.at}-${i}`} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                  borderBottom: '1px solid #F1F5F9',
                  animation: i === 0 ? 'fadeIn .4s ease' : undefined,
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{MODULE_ICONS[ev.module] || '📋'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.company || 'شركة'}
                    </p>
                    <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>
                      {ev.detail || MODULE_AR[ev.module] || ev.module}
                    </p>
                  </div>
                  <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>{ev.at ? timeAgo(ev.at) : ''}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Companies Right Now */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0' }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#1E293B' }}>شركات نشطة الآن ({live?.active_now || 0})</h2>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {(live?.companies || []).length === 0 ? (
              <div style={{ padding: '40px 18px', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>لا توجد شركات نشطة حالياً</div>
            ) : (
              (live?.companies || []).map((c: any) => (
                <Link key={c.company_id} href={`/dashboard/companies/${c.company_id}`}
                  style={{ display: 'block', padding: '14px 18px', borderBottom: '1px solid #F1F5F9', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0 }}>{c.name}</p>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#DBEAFE', color: '#2563EB', fontWeight: 600 }}>
                      {PLAN_AR[c.plan] || c.plan}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#64748B' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} />
                      {c.actions} عملية
                    </span>
                    <span>·</span>
                    <span>{c.last_action}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Section D: Module Usage ────────────────────────── */}
      <div className="card" style={{ padding: '22px', marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 18px', color: '#1E293B' }}>استخدام الوحدات (آخر 7 أيام)</h2>
        {(o.modules || []).length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>لا توجد بيانات بعد — ستظهر بعد تفاعل العملاء</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(o.modules || []).slice(0, 8).map((m: any) => {
              const max = (o.modules || [])[0]?.count || 1;
              const pct = Math.round((m.count / max) * 100);
              return (
                <div key={m.module}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#1E293B', fontWeight: 500 }}>
                      {MODULE_ICONS[m.module] || '📋'} {MODULE_AR[m.module] || m.module}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2563EB' }}>{m.count.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: '#F1F5F9' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#2563EB', borderRadius: 4, transition: 'width .5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section E: Engagement Tiers ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: '🟢 نشط جداً', count: o.engagement?.high || 0, desc: '>10 عملية/يوم', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', companies: o.engagement?.high_companies || [] },
          { label: '🟡 نشط معتدل', count: o.engagement?.medium || 0, desc: '3-10 عملية/يوم', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', companies: [] },
          { label: '🔴 خامل', count: o.engagement?.low || 0, desc: '<3 عملية/يوم', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', companies: o.engagement?.low_companies || [] },
        ].map(tier => (
          <div key={tier.label} className="card" style={{ padding: '20px', borderTop: `3px solid ${tier.color}` }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', margin: '0 0 4px' }}>{tier.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: tier.color, margin: '0 0 4px', lineHeight: 1 }}>{tier.count}</p>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 14px' }}>{tier.desc}</p>
            {tier.companies.length > 0 && (
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>
                {tier.companies.slice(0, 5).map((c: any) => (
                  <Link key={c.id} href={`/dashboard/companies/${c.id}`}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, color: '#64748B', textDecoration: 'none' }}>
                    <span>{c.name}</span>
                    <span style={{ fontWeight: 600, color: tier.color }}>{c.avg_actions}/يوم</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Section F: Health Distribution ──────────────────── */}
      {h.distribution && (
        <div className="card" style={{ padding: '22px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 18px', color: '#1E293B' }}>صحة العملاء</h2>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            {[
              { grade: 'A', color: '#16A34A', bg: '#F0FDF4' },
              { grade: 'B', color: '#2563EB', bg: '#EFF6FF' },
              { grade: 'C', color: '#D97706', bg: '#FFFBEB' },
              { grade: 'D', color: '#EA580C', bg: '#FFF7ED' },
              { grade: 'F', color: '#DC2626', bg: '#FEF2F2' },
            ].map(g => (
              <div key={g.grade} style={{ flex: 1, textAlign: 'center', padding: '14px 8px', borderRadius: 10, background: g.bg }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: g.color, margin: 0 }}>{g.grade}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', margin: '4px 0 0' }}>{h.distribution?.[g.grade] || 0}</p>
              </div>
            ))}
          </div>
          {/* At-risk companies (D/F) */}
          {(h.companies || []).filter((c: any) => c.grade === 'D' || c.grade === 'F').length > 0 && (
            <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '14px 16px', border: '1px solid #FECACA' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', margin: '0 0 8px' }}>⚠️ شركات معرّضة للخطر</p>
              {(h.companies || []).filter((c: any) => c.grade === 'D' || c.grade === 'F').slice(0, 5).map((c: any) => (
                <Link key={c.company_id} href={`/dashboard/companies/${c.company_id}`}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(220,38,38,.1)', fontSize: 12, textDecoration: 'none', color: '#1E293B' }}>
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ color: '#DC2626', fontWeight: 700 }}>{c.grade} ({c.score})</span>
                    <span style={{ color: '#94A3B8' }}>{c.days_since_active <= 1 ? 'نشط اليوم' : `آخر نشاط: ${c.days_since_active} يوم`}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Section G: 30-Day Trend ────────────────────────── */}
      {(o.trend || []).length > 0 && (
        <div className="card" style={{ padding: '22px' }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 18px', color: '#1E293B' }}>اتجاه النشاط (آخر 30 يوم)</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140 }}>
            {(() => {
              const maxCount = Math.max(...(o.trend || []).map((t: any) => t.count), 1);
              return (o.trend || []).map((t: any, i: number) => {
                const h = Math.round((t.count / maxCount) * 120);
                return (
                  <div key={t.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{ width: '100%', height: h, background: '#2563EB', borderRadius: '4px 4px 0 0', minHeight: t.count > 0 ? 3 : 0, opacity: 0.7, transition: 'height .3s' }}
                      title={`${t.date}: ${t.count} عملية`}
                    />
                    {i % 5 === 0 && (
                      <span style={{ fontSize: 8, color: '#94A3B8', marginTop: 4 }}>{new Date(t.date).getDate()}</span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          div[style*="repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
          div[style*="1fr 380px"] { grid-template-columns: 1fr !important; }
          div[style*="repeat(3"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
