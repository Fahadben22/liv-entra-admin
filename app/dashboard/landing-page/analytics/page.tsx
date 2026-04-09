'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import Link from 'next/link';

const FLAGS: Record<string, string> = { SA: 'SA', AE: 'AE', KW: 'KW', BH: 'BH', QA: 'QA', OM: 'OM', EG: 'EG', JO: 'JO', US: 'US', GB: 'GB' };
const DEVICES: Record<string, string> = { desktop: 'PC', mobile: 'Mobile', tablet: 'Tablet' };

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

export default function LandingAnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [live, setLive] = useState<any>(null);
  const [clicks, setClicks] = useState<any[]>([]);
  const [scroll, setScroll] = useState<any>(null);
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      adminApi.sa.landingStats(period),
      adminApi.sa.landingLive(),
      adminApi.sa.landingTopClicks(),
      adminApi.sa.landingScrollDepth(),
    ]);
    if (results[0].status === 'fulfilled') setStats((results[0].value as any)?.data);
    if (results[1].status === 'fulfilled') setLive((results[1].value as any)?.data);
    if (results[2].status === 'fulfilled') setClicks((results[2].value as any)?.data || []);
    if (results[3].status === 'fulfilled') setScroll((results[3].value as any)?.data);
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  // SSE for real-time updates
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      if (token) {
        es = new EventSource(adminApi.sa.landingStreamUrl() + `?token=${token}`);
        es.onmessage = () => {
          // Refresh live data on any event
          adminApi.sa.landingLive().then((r: any) => { if (r?.data) setLive(r.data); }).catch(() => {});
        };
        es.onerror = () => { es?.close(); };
      }
    } catch {}
    return () => es?.close();
  }, []);

  if (loading && !stats) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #ede9fe', borderTopColor: '#7c5cfc', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const s = stats || {};
  const activeCount = live?.active_count || 0;
  const sessions = live?.sessions || [];

  // Daily trend chart data
  const trendDays = Object.entries(s.daily_trend || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const maxVisitors = Math.max(...trendDays.map(([, v]: any) => v.visitors), 1);

  return (
    <div>
      {/* Header */}
      <div className="fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Link href="/dashboard/landing-page" style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none' }}>الموقع</Link>
            <span style={{ color: '#d1d5db' }}>/</span>
            <span style={{ fontSize: 12, color: '#7c5cfc', fontWeight: 600 }}>التحليلات</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>تحليلات الموقع</h1>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['7d', '30d', '90d'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: period === p ? 600 : 400, border: `1px solid ${period === p ? '#7c5cfc' : 'rgba(0,0,0,.08)'}`, background: period === p ? 'rgba(124,92,252,.06)' : '#fff', color: period === p ? '#7c5cfc' : '#6b7280', cursor: 'pointer' }}>
              {p === '7d' ? '7 ايام' : p === '30d' ? '30 يوم' : '90 يوم'}
            </button>
          ))}
        </div>
      </div>

      {/* Live indicator + KPIs */}
      <div className="grid-responsive stagger-enter" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        {/* Live now — special card */}
        <div className="card fade-in" style={{ padding: '20px 22px', background: activeCount > 0 ? 'rgba(16,185,129,.04)' : undefined, border: activeCount > 0 ? '1px solid rgba(16,185,129,.2)' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeCount > 0 ? '#10b981' : '#d1d5db', animation: activeCount > 0 ? 'pulse 2s ease-in-out infinite' : 'none' }} />
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>الآن على الموقع</p>
          </div>
          <p style={{ fontSize: 32, fontWeight: 700, color: activeCount > 0 ? '#059669' : '#1a1a2e', margin: 0 }}>{activeCount}</p>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        </div>

        {[
          { label: 'زوار اليوم', value: s.today?.visitors || 0, color: '#7c5cfc' },
          { label: 'طلبات اليوم', value: s.today?.conversions || 0, color: '#f59e0b' },
          { label: 'معدل التحويل', value: `${s.conversion_rate || 0}%`, color: '#10b981' },
          { label: 'معدل الارتداد', value: `${s.bounce_rate || 0}%`, color: '#ef4444' },
        ].map((k, i) => (
          <div key={k.label} className="card fade-in" style={{ padding: '20px 22px', animationDelay: `${(i + 1) * 0.06}s` }}>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 10px' }}>{k.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 24 }}>
        {/* Daily trend chart */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px', color: '#1a1a2e' }}>الزوار والتحويلات — {period === '7d' ? '7 ايام' : period === '30d' ? '30 يوم' : '90 يوم'}</h2>
          {trendDays.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 40 }}>لا توجد بيانات بعد — ارفع ملف app.js للموقع لبدء التتبع</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
              {trendDays.map(([day, v]: any) => (
                <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: '#6b7280' }}>{v.visitors}</span>
                  <div style={{ width: '100%', maxWidth: 40, borderRadius: '4px 4px 0 0', background: 'linear-gradient(180deg, #7c5cfc, #a78bfa)', height: Math.max(4, (v.visitors / maxVisitors) * 130), transition: 'height .3s' }} />
                  {v.conversions > 0 && (
                    <div style={{ width: '100%', maxWidth: 40, borderRadius: '4px 4px 0 0', background: '#10b981', height: Math.max(2, (v.conversions / maxVisitors) * 130), marginTop: -2 }} />
                  )}
                  <span style={{ fontSize: 9, color: '#9ca3af', transform: 'rotate(-45deg)', transformOrigin: 'center' }}>{day.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Country + Device breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Countries */}
          <div className="card" style={{ padding: '16px 20px', flex: 1 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px', color: '#1a1a2e' }}>الدول</h2>
            {Object.keys(s.countries || {}).length === 0 ? (
              <p style={{ fontSize: 12, color: '#9ca3af' }}>لا توجد بيانات</p>
            ) : (
              Object.entries(s.countries || {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 6).map(([cc, count]: any) => (
                <div key={cc} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{FLAGS[cc] || cc} {cc}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{count}</span>
                </div>
              ))
            )}
          </div>

          {/* Devices */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px', color: '#1a1a2e' }}>الأجهزة</h2>
            {Object.entries(s.devices || {}).map(([dev, count]: any) => (
              <div key={dev} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{DEVICES[dev] || dev}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active sessions */}
      <div className="card" style={{ marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(0,0,0,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#1a1a2e' }}>
            الجلسات النشطة
            {activeCount > 0 && <span style={{ marginRight: 8, fontSize: 11, color: '#10b981', background: 'rgba(16,185,129,.1)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>{activeCount} نشط</span>}
          </h2>
          <button onClick={load} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,.08)', background: '#f8f7fc', color: '#6b7280', cursor: 'pointer' }}>تحديث</button>
        </div>
        {sessions.length === 0 ? (
          <p style={{ padding: '30px 22px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>لا يوجد زوار نشطون حالياً</p>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {sessions.map((s: any, i: number) => (
              <div key={s.session_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 22px', borderBottom: i < sessions.length - 1 ? '1px solid rgba(0,0,0,.04)' : 'none' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1a1a2e' }}>
                    <span style={{ fontWeight: 600 }}>{FLAGS[s.country_code] || ''} {s.country_code || '??'}</span>
                    <span style={{ color: '#d1d5db' }}>|</span>
                    <span style={{ color: '#6b7280' }}>{DEVICES[s.device_type] || s.device_type}</span>
                    <span style={{ color: '#d1d5db' }}>|</span>
                    <span style={{ color: '#6b7280', direction: 'ltr' }}>{s.current_page}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {s.referrer && <span>{s.referrer.slice(0, 40)} · </span>}
                    {s.page_count} صفحات · {s.minutes_on_site} دقيقة
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{timeAgo(s.last_seen)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Top clicked elements */}
        <div className="card" style={{ padding: '16px 22px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px', color: '#1a1a2e' }}>أكثر العناصر نقراً</h2>
          {clicks.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9ca3af' }}>لا توجد بيانات نقر بعد</p>
          ) : (
            clicks.slice(0, 10).map(([el, count]: any, i: number) => (
              <div key={el} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 9 ? '1px solid rgba(0,0,0,.04)' : 'none' }}>
                <span style={{ fontSize: 12, color: '#6b7280', direction: 'ltr' }}>{el}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#7c5cfc' }}>{count}</span>
              </div>
            ))
          )}
        </div>

        {/* Scroll depth */}
        <div className="card" style={{ padding: '16px 22px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px', color: '#1a1a2e' }}>عمق التمرير</h2>
          {!scroll ? (
            <p style={{ fontSize: 12, color: '#9ca3af' }}>لا توجد بيانات تمرير بعد</p>
          ) : (
            [25, 50, 75, 100].map(depth => {
              const count = (scroll as any)?.[depth] || 0;
              const max = Math.max(...Object.values(scroll as Record<string, number>), 1);
              return (
                <div key={depth} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: '#6b7280', width: 40, textAlign: 'left', direction: 'ltr' }}>{depth}%</span>
                  <div style={{ flex: 1, height: 20, background: 'rgba(0,0,0,.04)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: depth === 100 ? '#10b981' : depth >= 75 ? '#059669' : depth >= 50 ? '#7c5cfc' : '#a78bfa', borderRadius: 6, transition: 'width .3s' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', width: 30, textAlign: 'left' }}>{count}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Top referrers */}
      <div className="card" style={{ padding: '16px 22px', marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px', color: '#1a1a2e' }}>مصادر الزيارات</h2>
        {(s.referrers || []).length === 0 ? (
          <p style={{ fontSize: 12, color: '#9ca3af' }}>لا توجد بيانات مصادر بعد — معظم الزيارات مباشرة</p>
        ) : (
          (s.referrers || []).map(([ref, count]: any, i: number) => (
            <div key={ref} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < (s.referrers?.length || 0) - 1 ? '1px solid rgba(0,0,0,.04)' : 'none' }}>
              <span style={{ fontSize: 12, color: '#6b7280', direction: 'ltr' }}>{ref}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
