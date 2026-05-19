'use client';
import { useEffect, useState } from 'react';
import { adminApi, BASE } from '@/lib/api';

function StatusDot({ ok }: { ok: boolean }) {
  const c = ok ? '#16a34a' : '#dc2626';
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}66`, display: 'inline-block' }} />;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: 'var(--lv-panel)', borderRadius: 14, padding: '16px 20px', border: '1px solid var(--lv-line)' }}>
      <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 6px', fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--lv-fg)', margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

export default function MonitoringPage() {
  const [stats,    setStats]    = useState<any>(null);
  const [health,   setHealth]   = useState<any>(null);
  const [summary,  setSummary]  = useState<any>(null);
  const [platform, setPlatform] = useState<any>(null);
  const [score,    setScore]    = useState<any>(null);
  const [anomalies,setAnomalies]= useState<any[]>([]);
  const [rag,      setRag]      = useState<any>(null);
  const [loading,  setLoading]  = useState(true);

  async function load() {
    setLoading(true);
    const results = await Promise.allSettled([
      adminApi.getStats(),
      fetch(`${BASE}/health`).then(r => r.json()),
      adminApi.intelligenceSummary(),
      adminApi.sa.platformStats(),
      adminApi.getHealthScore(),
      adminApi.sa.listAnomalies({ limit: '5', status: 'open' }),
      adminApi.getRagPipelineStatus(),
    ]);
    if (results[0].status === 'fulfilled') setStats((results[0].value as any)?.data);
    if (results[1].status === 'fulfilled') setHealth(results[1].value as any);
    if (results[2].status === 'fulfilled') setSummary((results[2].value as any)?.data);
    if (results[3].status === 'fulfilled') setPlatform((results[3].value as any)?.data);
    if (results[4].status === 'fulfilled') setScore((results[4].value as any)?.data);
    if (results[5].status === 'fulfilled') setAnomalies((results[5].value as any)?.data || []);
    if (results[6].status === 'fulfilled') setRag((results[6].value as any)?.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Build last-run map per source from rag schedules
  const ragSchedules: any[] = rag?.schedules || [];
  const ragRuns: any[] = rag?.runs || [];
  // Latest run per source_id
  const latestRunMap: Record<string, any> = {};
  ragRuns.forEach((r: any) => {
    if (!latestRunMap[r.source_id] || r.run_timestamp > latestRunMap[r.source_id].run_timestamp) {
      latestRunMap[r.source_id] = r;
    }
  });

  const healthOk = health?.status === 'ok';
  const platformScore = score?.score ?? null;

  return (
    <div dir="rtl" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--lv-fg)', margin: 0 }}>مراقبة النظام</h1>
          <p style={{ fontSize: 12, color: 'var(--lv-muted)', margin: '3px 0 0' }}>حالة المنصة والخدمات في الوقت الفعلي</p>
        </div>
        <button onClick={load} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--lv-line)', background: 'var(--lv-panel)', fontSize: 12, cursor: 'pointer', color: 'var(--lv-fg)' }}>
          تحديث
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--lv-muted)' }}>جاري التحميل...</div>
      ) : (
        <>
          {/* ── Service health ── */}
          <div style={{ background: 'var(--lv-panel)', borderRadius: 14, padding: 20, border: '1px solid var(--lv-line)', marginBottom: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)', margin: '0 0 16px' }}>حالة الخدمات</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'API Backend',     ok: healthOk },
                { label: 'Supabase DB',     ok: !!stats },
                { label: 'Vercel Frontend', ok: true },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--lv-bg)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--lv-line)' }}>
                  <span style={{ fontSize: 13, color: 'var(--lv-muted)' }}>{s.label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StatusDot ok={s.ok} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: s.ok ? '#16a34a' : '#dc2626' }}>{s.ok ? 'يعمل' : 'توقف'}</span>
                  </span>
                </div>
              ))}
            </div>
            {health?.ts && (
              <p style={{ fontSize: 11, color: 'var(--lv-muted)', marginTop: 12, direction: 'ltr', textAlign: 'left' }}>
                Last checked: {new Date(health.ts).toLocaleString('en-US')}
              </p>
            )}
          </div>

          {/* ── Platform health score ── */}
          {platformScore !== null && (
            <div style={{ background: 'var(--lv-panel)', borderRadius: 14, padding: 20, border: '1px solid var(--lv-line)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: platformScore >= 80 ? '#dcfce7' : platformScore >= 60 ? '#fef9c3' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: platformScore >= 80 ? '#16a34a' : platformScore >= 60 ? '#ca8a04' : '#dc2626' }}>{platformScore}</span>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--lv-fg)', margin: 0 }}>نقاط صحة المنصة</p>
                <p style={{ fontSize: 12, color: 'var(--lv-muted)', margin: '3px 0 0' }}>
                  {platformScore >= 80 ? 'المنصة في حالة ممتازة' : platformScore >= 60 ? 'تحتاج مراقبة' : 'تحتاج تدخل فوري'}
                </p>
                {summary?.error_rate !== undefined && (
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '3px 0 0' }}>معدل الأخطاء: {summary.error_rate}%</p>
                )}
              </div>
            </div>
          )}

          {/* ── Key stats ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            <StatCard label="إجمالي الشركات"    value={platform?.total_companies ?? stats?.total_companies ?? 0} />
            <StatCard label="وحدات عقارية"       value={platform?.total_units     ?? stats?.total_units     ?? 0} />
            <StatCard label="عقود نشطة"          value={platform?.active_contracts ?? stats?.active_contracts ?? 0} />
            <StatCard label="تنبيهات غير محلولة" value={platform?.anomaly_count ?? 0}
              sub={platform?.anomaly_count > 0 ? 'تحتاج مراجعة' : 'لا توجد تنبيهات'} />
          </div>

          {/* ── Recent anomalies ── */}
          {anomalies.length > 0 && (
            <div style={{ background: 'var(--lv-panel)', borderRadius: 14, padding: 20, border: '1px solid #fde68a', marginBottom: 20 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                تنبيهات حديثة
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {anomalies.map((a: any) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--lv-bg)', borderRadius: 8, border: '1px solid var(--lv-line)', fontSize: 12 }}>
                    <span style={{ color: 'var(--lv-fg)', fontWeight: 500 }}>{a.description || a.anomaly_type}</span>
                    <span style={{ color: 'var(--lv-muted)', flexShrink: 0, marginInlineStart: 12 }}>{a.company_name || ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RAG Pipeline ── */}
          <div style={{ background: 'var(--lv-panel)', borderRadius: 14, padding: 20, border: '1px solid var(--lv-line)' }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)', margin: '0 0 14px' }}>
              حالة خطوط معالجة AI
            </h2>
            {ragSchedules.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--lv-muted)', margin: 0 }}>لا توجد بيانات متاحة</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {ragSchedules.map((s: any) => {
                  const lastRun = latestRunMap[s.source_id];
                  const ok = s.last_status === 'success' || lastRun?.status === 'success';
                  const failed = s.last_status === 'failed' || lastRun?.status === 'failed';
                  const dotColor = !s.is_active ? '#9ca3af' : ok ? '#16a34a' : failed ? '#dc2626' : '#f59e0b';
                  const hoursAgo = s.last_run_at
                    ? Math.round((Date.now() - new Date(s.last_run_at).getTime()) / 3600000)
                    : null;
                  return (
                    <div key={s.source_id} style={{ background: 'var(--lv-bg)', borderRadius: 10, padding: '10px 14px', border: `1px solid ${ok ? '#bbf7d0' : failed ? '#fecaca' : 'var(--lv-line)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--lv-fg)' }}>{s.source_name || s.source_id}</span>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--lv-muted)' }}>
                        {hoursAgo !== null ? `آخر تشغيل منذ ${hoursAgo} س` : 'لم يشتغل بعد'}
                        {lastRun?.records_written ? ` · ${lastRun.records_written} سجل` : ''}
                        {s.consecutive_failures > 0 ? ` · ${s.consecutive_failures} فشل متتالي` : ''}
                      </div>
                      {s.gap_status && s.gap_status !== 'ok' && (
                        <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>{s.gap_status}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
