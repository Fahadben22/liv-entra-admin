'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface HealthScore  { score: number; grade: string; status: string; api_status: string; active_companies: number; criticals_1h: number; errors_1h: number; errors_24h: number; computed_at: string }
interface TimelineBucket { label: string; warning: number; error: number; critical: number }
interface TenantHealth { id: string; name: string; slug: string; plan: string; is_active: boolean; score: number; status: string; errors_24h: number; warnings_24h: number; errors_7d: number }
interface TopError     { source: string; message: string; level: string; count: number; companies: number; last_seen: string }
interface SystemLog    { id: string; company_id: string|null; level: string; source: string; message: string; details: any; stack_trace?: string; status: string; created_at: string; ai_analyses?: AiAnalysis[] }
interface AiAnalysis   { root_cause: string; suggested_fix: string; severity_note: string; priority: string; confidence: number; created_at: string }
interface SecurityEvent { id: string; event_type: string; description: string; ip_address: string; created_at: string }

const LEVEL = { critical:{label:'حرج',c:'#dc2626',bg:'#fef2f2'}, error:{label:'خطأ',c:'#ea580c',bg:'#fff7ed'}, warning:{label:'تحذير',c:'#d97706',bg:'#fffbeb'}, info:{label:'معلومة',c:'#2563eb',bg:'#eff6ff'}, debug:{label:'تصحيح',c:'#64748b',bg:'#f8fafc'} } as const;
const TENANT_STATUS = { healthy:{label:'سليم',c:'#16a34a',bg:'#f0fdf4',bar:'#22c55e'}, degraded:{label:'متدهور قليلاً',c:'#2563eb',bg:'#eff6ff',bar:'#3b82f6'}, warning:{label:'تحذير',c:'#d97706',bg:'#fffbeb',bar:'#f59e0b'}, critical:{label:'حرج',c:'#dc2626',bg:'#fef2f2',bar:'#ef4444'} } as const;
const PLAN_LABELS: Record<string,string> = { enterprise:'مؤسسي', professional:'احترافي', basic:'أساسي', trial:'تجريبي' };

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────
function TimelineChart({ data }: { data: TimelineBucket[] }) {
  const W = 760, H = 80, PAD = 4;
  if (!data.length) return null;
  const maxVal = Math.max(...data.map(d => d.critical + d.error + d.warning), 1);
  const bw = (W - PAD * 2) / data.length - 2;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const x    = PAD + i * ((W - PAD * 2) / data.length) + 1;
        const wH   = ((d.warning)  / maxVal) * (H - 10);
        const eH   = ((d.error)    / maxVal) * (H - 10);
        const cH   = ((d.critical) / maxVal) * (H - 10);
        const total = wH + eH + cH;
        const isHour = i % 4 === 0;
        return (
          <g key={i}>
            {/* Warning layer */}
            {wH > 0 && <rect x={x} y={H - total}     width={bw} height={wH} fill="#f59e0b" rx={1} />}
            {/* Error layer */}
            {eH > 0 && <rect x={x} y={H - total + wH} width={bw} height={eH} fill="#ef4444" rx={1} />}
            {/* Critical layer */}
            {cH > 0 && <rect x={x} y={H - cH}          width={bw} height={cH} fill="#7f1212" rx={1} />}
            {/* Empty bar placeholder */}
            {total === 0 && <rect x={x} y={H - 3} width={bw} height={3} fill="#e2e8f0" rx={1} />}
            {/* Hour label */}
            {isHour && <text x={x + bw / 2} y={H + 2} fontSize={7} fill="#94a3b8" textAnchor="middle" dominantBaseline="hanging">{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Health Score Ring ────────────────────────────────────────────────────────
function HealthRing({ score, grade, status }: { score: number; grade: string; status: string }) {
  const r = 52, cx = 64, cy = 64;
  const circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;
  const color = score >= 90 ? '#16a34a' : score >= 75 ? '#2563eb' : score >= 50 ? '#d97706' : score >= 25 ? '#ea580c' : '#dc2626';
  return (
    <svg width={128} height={128}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={10} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={circ} strokeDashoffset={fill}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset .8s ease' }} />
      <text x={cx} y={cy - 8}  textAnchor="middle" fontSize={22} fontWeight={700} fill={color}>{score}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={11} fill="#374151">درجة {grade}</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fontSize={9}  fill="#94a3b8">{status}</text>
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IntelligencePage() {
  const router = useRouter();

  const [health,   setHealth]   = useState<HealthScore | null>(null);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [tenants,  setTenants]  = useState<TenantHealth[]>([]);
  const [topErr,   setTopErr]   = useState<TopError[]>([]);
  const [logs,     setLogs]     = useState<SystemLog[]>([]);
  const [logCount, setLogCount] = useState(0);
  const [secFeed,  setSecFeed]  = useState<SecurityEvent[]>([]);
  const [summary,  setSummary]  = useState<any>(null);

  const [tab,         setTab]         = useState<'overview'|'logs'|'tenants'|'top-errors'|'security'|'alerts'>('overview');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterStatus,setFilterStatus]= useState('open');
  const [logPage,     setLogPage]     = useState(0);
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [analyzing,   setAnalyzing]   = useState<string | null>(null);
  const [resolveModal,setResolveModal]= useState(false);
  const [resNote,     setResNote]     = useState('');
  const [alerts,      setAlerts]      = useState<any[]>([]);
  const [loadError,   setLoadError]   = useState('');
  const [loading,     setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const LIMIT = 25;

  const loadOverview = useCallback(async () => {
    try {
      const [h, t, ten, te, sum] = await Promise.all([
        adminApi.getHealthScore(),
        adminApi.getTimeline(),
        adminApi.getTenantHealth(),
        adminApi.getTopErrors(),
        adminApi.intelligenceSummary(),
      ]);
      setHealth((h as any).data);
      setTimeline((t as any).data || []);
      setTenants((ten as any).data || []);
      setTopErr((te as any).data || []);
      setSummary((sum as any).data);
      setLastRefresh(new Date());
      setLoadError('');
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) router.push('/login');
      else setLoadError(msg);
    }
  }, [router]);

  const loadLogs = useCallback(async () => {
    try {
      const params: Record<string,string> = { limit: String(LIMIT), offset: String(logPage * LIMIT) };
      if (filterLevel)  params.level  = filterLevel;
      if (filterStatus) params.status = filterStatus;
      const r = await adminApi.listLogs(params);
      setLogs((r as any).data || []);
      setLogCount((r as any).count || 0);
    } catch {}
  }, [filterLevel, filterStatus, logPage]);

  const loadSecurity = useCallback(async () => {
    try {
      const r = await adminApi.getSecurityFeed();
      setSecFeed((r as any).data || []);
    } catch {}
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const r = await adminApi.listAlerts();
      setAlerts((r as any).data || []);
    } catch {}
  }, []);

  // Initial load
  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    loadOverview().finally(() => setLoading(false));
  }, [loadOverview, router]);

  useEffect(() => { if (tab === 'logs')     loadLogs();     }, [tab, loadLogs]);
  useEffect(() => { if (tab === 'security') loadSecurity(); }, [tab, loadSecurity]);
  useEffect(() => { if (tab === 'alerts')   loadAlerts();   }, [tab, loadAlerts]);

  // Auto-refresh overview every 30s
  useEffect(() => {
    timerRef.current = setInterval(() => loadOverview(), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loadOverview]);

  async function handleAnalyze(log: SystemLog) {
    setAnalyzing(log.id);
    try {
      const res = await adminApi.analyzeLog(log.id);
      const updated = { ...log, ai_analyses: [(res as any).data] };
      setLogs(prev => prev.map(l => l.id === log.id ? updated : l));
      if (selectedLog?.id === log.id) setSelectedLog(updated);
    } catch (e: any) { alert(e.message); }
    finally { setAnalyzing(null); }
  }

  async function handleResolve() {
    if (!selectedLog) return;
    try {
      await adminApi.resolveLog(selectedLog.id, resNote);
      setLogs(prev => prev.map(l => l.id === selectedLog.id ? { ...l, status: 'resolved' } : l));
      setSelectedLog(p => p ? { ...p, status: 'resolved' } : p);
      setResolveModal(false); setResNote('');
    } catch (e: any) { alert(e.message); }
  }

  async function handleIgnore(log: SystemLog) {
    try {
      await adminApi.ignoreLog(log.id);
      setLogs(prev => prev.map(l => l.id === log.id ? { ...l, status: 'ignored' } : l));
      if (selectedLog?.id === log.id) setSelectedLog(null);
    } catch {}
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:12 }}>
      <div style={{ width:40, height:40, border:'3px solid #e2e8f0', borderTopColor:'#1d4070', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
      <p style={{ color:'#94a3b8', fontSize:13 }}>جاري تحميل مركز التحكم...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const tabs = [
    { id:'overview',   label:'نظرة عامة',     icon:'📊' },
    { id:'logs',       label:`السجلات (${logCount||'—'})`, icon:'📋' },
    { id:'tenants',    label:'صحة المستأجرين', icon:'🏢' },
    { id:'top-errors', label:'أكثر الأخطاء',  icon:'🔥' },
    { id:'security',   label:'الأمان',         icon:'🔐' },
    { id:'alerts',     label:'التنبيهات',      icon:'📱' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#f0f4f8' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .row-hover:hover { background: #f8fafc !important; }
        .btn-ghost:hover { background: rgba(255,255,255,.15) !important; }
      `}</style>

      {/* ── Top Nav ── */}
      <div style={{ background:'linear-gradient(135deg,#0f2040,#1d4070)', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:52, boxShadow:'0 2px 12px rgba(0,0,0,.25)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <Link href="/dashboard" style={{ color:'#93c5fd', textDecoration:'none', fontSize:12 }}>← الرئيسية</Link>
          <div style={{ width:1, height:20, background:'rgba(255,255,255,.2)' }} />
          <span style={{ fontSize:16 }}>🧠</span>
          <span style={{ fontSize:14, fontWeight:700, color:'white', letterSpacing:'.3px' }}>مركز ذكاء النظام</span>
          {/* Live dot */}
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', animation:'pulse 2s infinite' }} />
            <span style={{ fontSize:10, color:'#86efac' }}>مباشر</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:14, alignItems:'center' }}>
          <span style={{ fontSize:10, color:'#93c5fd' }}>آخر تحديث: {lastRefresh.toLocaleTimeString('ar-SA')}</span>
          <button onClick={() => loadOverview()}
            style={{ fontSize:11, padding:'4px 12px', borderRadius:6, background:'rgba(255,255,255,.15)', color:'white', border:'1px solid rgba(255,255,255,.2)', cursor:'pointer' }}
            className="btn-ghost">
            ↻ تحديث
          </button>
          <Link href="/dashboard/companies"  style={{ fontSize:12, color:'#93c5fd', textDecoration:'none' }}>الشركات</Link>
          <Link href="/dashboard/monitoring" style={{ fontSize:12, color:'#93c5fd', textDecoration:'none' }}>المراقبة</Link>
          <button onClick={() => { localStorage.clear(); router.push('/login'); }}
            style={{ fontSize:11, padding:'4px 12px', borderRadius:6, background:'rgba(220,38,38,.3)', color:'white', border:'1px solid rgba(220,38,38,.4)', cursor:'pointer' }}>
            خروج
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ background:'white', borderBottom:'1px solid #e2e8f0', padding:'0 24px', display:'flex', gap:4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding:'10px 14px', fontSize:12, fontWeight: tab===t.id?700:400,
              color: tab===t.id?'#1d4070':'#64748b', background:'none', border:'none', cursor:'pointer',
              borderBottom: tab===t.id?'2px solid #1d4070':'2px solid transparent', marginBottom:-1, display:'flex', alignItems:'center', gap:5 }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:20 }}>
        {loadError && (
          <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <p style={{ fontSize:12, color:'#dc2626', margin:0 }}>⚠️ {loadError}</p>
            <button onClick={() => loadOverview()} style={{ fontSize:11, padding:'4px 12px', borderRadius:6, background:'#dc2626', color:'white', border:'none', cursor:'pointer' }}>إعادة المحاولة</button>
          </div>
        )}

        {/* ══════════════════════ OVERVIEW TAB ══════════════════════ */}
        {tab === 'overview' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'fadeIn .3s ease' }}>

            {/* Row 1: Health Ring + KPIs + API Status */}
            <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:16 }}>

              {/* Health Score Ring */}
              <div style={{ background:'white', borderRadius:14, padding:20, border:'1px solid #e2e8f0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minWidth:160 }}>
                <p style={{ fontSize:11, fontWeight:600, color:'#64748b', margin:'0 0 8px', textTransform:'uppercase', letterSpacing:'.5px' }}>صحة النظام</p>
                {health ? <HealthRing score={health.score} grade={health.grade} status={health.status} /> : <div style={{ width:128, height:128, background:'#f8fafc', borderRadius:'50%' }} />}
                <p style={{ fontSize:10, color:'#94a3b8', margin:'8px 0 0' }}>يُحدَّث كل 30 ثانية</p>
              </div>

              {/* KPI Grid */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
                {health && [
                  { l:'حرج (ساعة)',    v:health.criticals_1h, c:'#dc2626', bg:'#fef2f2', icon:'🚨' },
                  { l:'أخطاء (ساعة)',  v:health.errors_1h,    c:'#ea580c', bg:'#fff7ed', icon:'❌' },
                  { l:'أخطاء (24 ساعة)', v:health.errors_24h, c:'#d97706', bg:'#fffbeb', icon:'⚠️' },
                  { l:'شركات نشطة',    v:health.active_companies, c:'#16a34a', bg:'#f0fdf4', icon:'🏢' },
                  { l:'تنبيهات مرسلة', v:summary?.alerts_24h||0,  c:'#7c3aed', bg:'#faf5ff', icon:'📱' },
                  { l:'إجمالي 7 أيام', v:summary?.total_7d||0,    c:'#2563eb', bg:'#eff6ff', icon:'📊' },
                ].map(k => (
                  <div key={k.l} style={{ background:k.bg, borderRadius:10, padding:'10px 14px', border:`1px solid ${k.c}20`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <p style={{ fontSize:10, color:'#64748b', margin:'0 0 2px' }}>{k.l}</p>
                      <p style={{ fontSize:22, fontWeight:700, color:k.c, margin:0 }}>{k.v}</p>
                    </div>
                    <span style={{ fontSize:20 }}>{k.icon}</span>
                  </div>
                ))}
              </div>

              {/* Infrastructure Status */}
              <div style={{ background:'white', borderRadius:14, padding:16, border:'1px solid #e2e8f0', minWidth:180 }}>
                <p style={{ fontSize:11, fontWeight:700, color:'#374151', margin:'0 0 12px', textTransform:'uppercase', letterSpacing:'.5px' }}>البنية التحتية</p>
                {[
                  { l:'Backend API',      s: health?.api_status==='online', icon:'⚙️' },
                  { l:'Supabase DB',      s: true,                           icon:'🗄️' },
                  { l:'Vercel Frontend',  s: true,                           icon:'🌐' },
                  { l:'Railway Backend',  s: health?.api_status==='online',  icon:'🚂' },
                ].map(item => (
                  <div key={item.l} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:13 }}>{item.icon}</span>
                      <span style={{ fontSize:12, color:'#374151' }}>{item.l}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background: item.s ? '#22c55e' : '#ef4444', animation: item.s ? 'pulse 2s infinite' : 'none' }} />
                      <span style={{ fontSize:10, color: item.s ? '#16a34a' : '#dc2626', fontWeight:600 }}>{item.s ? 'يعمل' : 'متوقف'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 2: Timeline Chart */}
            <div style={{ background:'white', borderRadius:14, padding:20, border:'1px solid #e2e8f0' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:'#374151', margin:0 }}>توزيع الأحداث — آخر 24 ساعة</p>
                  <p style={{ fontSize:11, color:'#94a3b8', margin:'2px 0 0' }}>كل عمود = ساعة واحدة</p>
                </div>
                <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                  {[['#f59e0b','تحذير'],['#ef4444','خطأ'],['#7f1212','حرج']].map(([c,l]) => (
                    <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:c as string }} />
                      <span style={{ fontSize:10, color:'#64748b' }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              <TimelineChart data={timeline} />
            </div>

            {/* Row 3: Open Criticals + Top 5 Degraded Tenants */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

              {/* Open Criticals */}
              <div style={{ background:'white', borderRadius:14, border:'1px solid #e2e8f0', overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fef2f2' }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'#dc2626' }}>🚨 أحداث حرجة مفتوحة</span>
                  <button onClick={() => setTab('logs')} style={{ fontSize:11, color:'#dc2626', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>عرض الكل</button>
                </div>
                {(summary?.open_criticals || []).length === 0
                  ? <p style={{ padding:'24px 16px', textAlign:'center', color:'#94a3b8', fontSize:12 }}>✅ لا توجد أحداث حرجة</p>
                  : (summary?.open_criticals || []).map((c: any) => (
                    <div key={c.id} style={{ padding:'10px 16px', borderBottom:'1px solid #f9fafb' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                        <span style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace' }}>{c.source}</span>
                        <span style={{ fontSize:10, color:'#94a3b8' }}>{new Date(c.created_at).toLocaleTimeString('ar-SA')}</span>
                      </div>
                      <p style={{ fontSize:12, color:'#374151', margin:0 }}>{c.message.slice(0, 90)}</p>
                    </div>
                  ))
                }
              </div>

              {/* Worst tenants */}
              <div style={{ background:'white', borderRadius:14, border:'1px solid #e2e8f0', overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>🏢 أكثر المستأجرين مشاكل</span>
                  <button onClick={() => setTab('tenants')} style={{ fontSize:11, color:'#1d4070', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>عرض الكل</button>
                </div>
                {tenants.slice(0, 5).map(t => {
                  const sc = TENANT_STATUS[t.status as keyof typeof TENANT_STATUS] || TENANT_STATUS.healthy;
                  return (
                    <div key={t.id} style={{ padding:'10px 16px', borderBottom:'1px solid #f9fafb', display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                          <span style={{ fontSize:12, fontWeight:500, color:'#374151' }}>{t.name}</span>
                          <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:sc.bg, color:sc.c, fontWeight:600 }}>{sc.label}</span>
                        </div>
                        {/* Score bar */}
                        <div style={{ height:4, background:'#f1f5f9', borderRadius:2, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${t.score}%`, background:sc.bar, borderRadius:2, transition:'width .5s ease' }} />
                        </div>
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, color:sc.c, minWidth:32, textAlign:'right' }}>{t.score}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Row 4: Top 5 Errors */}
            <div style={{ background:'white', borderRadius:14, border:'1px solid #e2e8f0', overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>🔥 أكثر الأخطاء تكراراً (7 أيام)</span>
                <button onClick={() => setTab('top-errors')} style={{ fontSize:11, color:'#1d4070', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>عرض الكل</button>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    {['المصدر','الخطأ','التكرار','الشركات','آخر ظهور'].map(h => (
                      <th key={h} style={{ padding:'8px 14px', textAlign:'right', fontSize:10, fontWeight:600, color:'#64748b', borderBottom:'1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topErr.slice(0, 5).map((e, i) => {
                    const lc = LEVEL[e.level as keyof typeof LEVEL] || LEVEL.error;
                    return (
                      <tr key={i} className="row-hover" style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'9px 14px' }}><span style={{ fontSize:11, fontFamily:'monospace', color:'#374151' }}>{e.source}</span></td>
                        <td style={{ padding:'9px 14px', maxWidth:280 }}><p style={{ fontSize:11, color:'#374151', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.message}</p></td>
                        <td style={{ padding:'9px 14px' }}>
                          <span style={{ fontSize:12, fontWeight:700, padding:'2px 8px', borderRadius:5, background:lc.bg, color:lc.c }}>{e.count}</span>
                        </td>
                        <td style={{ padding:'9px 14px', fontSize:11, color:'#64748b' }}>{e.companies}</td>
                        <td style={{ padding:'9px 14px', fontSize:10, color:'#94a3b8' }}>{new Date(e.last_seen).toLocaleDateString('ar-SA')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* ══════════════════════ LOGS TAB ══════════════════════ */}
        {tab === 'logs' && (
          <div style={{ display:'grid', gridTemplateColumns: selectedLog ? '1fr 380px' : '1fr', gap:16, animation:'fadeIn .3s ease' }}>
            <div>
              {/* Filters */}
              <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
                <select value={filterLevel} onChange={e => { setFilterLevel(e.target.value); setLogPage(0); }}
                  style={{ fontSize:12, padding:'6px 10px', borderRadius:6, border:'1px solid #e2e8f0', background:'white', cursor:'pointer' }}>
                  <option value="">كل المستويات</option>
                  {Object.entries(LEVEL).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setLogPage(0); }}
                  style={{ fontSize:12, padding:'6px 10px', borderRadius:6, border:'1px solid #e2e8f0', background:'white', cursor:'pointer' }}>
                  <option value="">كل الحالات</option>
                  {[['open','مفتوح'],['analyzing','يحلّل'],['resolved','محلول'],['ignored','مهمل']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <span style={{ fontSize:11, color:'#94a3b8' }}>{logCount} نتيجة</span>
                <button onClick={loadLogs} style={{ fontSize:11, padding:'6px 12px', borderRadius:6, background:'#1d4070', color:'white', border:'none', cursor:'pointer', marginRight:'auto' }}>↻ تحديث</button>
              </div>

              <div style={{ background:'white', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
                {logs.length === 0
                  ? <p style={{ padding:32, textAlign:'center', color:'#94a3b8', fontSize:13 }}>لا توجد سجلات تطابق الفلتر</p>
                  : logs.map((log, i) => {
                    const lc = LEVEL[log.level as keyof typeof LEVEL] || LEVEL.info;
                    const hasAI = (log.ai_analyses?.length || 0) > 0;
                    const isSel = selectedLog?.id === log.id;
                    return (
                      <div key={log.id} onClick={() => setSelectedLog(isSel ? null : log)} className="row-hover"
                        style={{ padding:'11px 16px', borderBottom: i<logs.length-1?'1px solid #f1f5f9':'none', cursor:'pointer', background: isSel?'#eff6ff':'white', opacity: log.status==='ignored'?.5:1 }}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                          <div style={{ width:7, height:7, borderRadius:'50%', background:lc.c, marginTop:5, flexShrink:0 }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', gap:5, marginBottom:2, flexWrap:'wrap', alignItems:'center' }}>
                              <span style={{ fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:3, background:lc.bg, color:lc.c }}>{lc.label}</span>
                              <span style={{ fontSize:10, color:'#94a3b8', fontFamily:'monospace' }}>{log.source}</span>
                              {log.status !== 'open' && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'#f8fafc', color:'#94a3b8' }}>{log.status==='resolved'?'✓ محلول':log.status==='analyzing'?'⏳ يحلّل':'مهمل'}</span>}
                              {hasAI && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'#faf5ff', color:'#7c3aed' }}>🧠</span>}
                              {analyzing===log.id && <span style={{ fontSize:9, color:'#7c3aed', animation:'pulse 1s infinite' }}>يحلّل...</span>}
                            </div>
                            <p style={{ fontSize:11, color:'#374151', margin:'0 0 3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.message}</p>
                            <span style={{ fontSize:10, color:'#94a3b8' }}>{new Date(log.created_at).toLocaleString('ar-SA')}</span>
                          </div>
                          <div style={{ display:'flex', gap:4, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                            {log.status==='open' && !hasAI && (
                              <button onClick={() => handleAnalyze(log)} disabled={!!analyzing}
                                style={{ fontSize:10, padding:'3px 7px', borderRadius:4, background:'#faf5ff', color:'#7c3aed', border:'1px solid #e9d5ff', cursor:'pointer' }}>
                                {analyzing===log.id?'...':'🧠 حلّل'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
              {logCount > LIMIT && (
                <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:10 }}>
                  <button onClick={() => setLogPage(p => Math.max(0,p-1))} disabled={logPage===0}
                    style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid #e2e8f0', background:'white', cursor:logPage===0?'not-allowed':'pointer', color:logPage===0?'#cbd5e1':'#374151' }}>السابق</button>
                  <span style={{ fontSize:11, color:'#64748b', padding:'5px 8px' }}>{logPage+1} / {Math.ceil(logCount/LIMIT)}</span>
                  <button onClick={() => setLogPage(p=>p+1)} disabled={(logPage+1)*LIMIT>=logCount}
                    style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid #e2e8f0', background:'white', cursor:(logPage+1)*LIMIT>=logCount?'not-allowed':'pointer', color:(logPage+1)*LIMIT>=logCount?'#cbd5e1':'#374151' }}>التالي</button>
                </div>
              )}
            </div>

            {/* Detail Panel */}
            {selectedLog && (() => {
              const lc = LEVEL[selectedLog.level as keyof typeof LEVEL] || LEVEL.info;
              const ai = selectedLog.ai_analyses?.[0];
              return (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={{ background:'white', borderRadius:12, border:'1px solid #e2e8f0', padding:16 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                      <span style={{ fontSize:12, fontWeight:700, padding:'2px 8px', borderRadius:5, background:lc.bg, color:lc.c }}>{lc.label}</span>
                      <button onClick={() => setSelectedLog(null)} style={{ fontSize:16, background:'none', border:'none', cursor:'pointer', color:'#94a3b8', lineHeight:1 }}>✕</button>
                    </div>
                    <p style={{ fontSize:11, fontWeight:600, color:'#374151', marginBottom:4, fontFamily:'monospace' }}>{selectedLog.source}</p>
                    <p style={{ fontSize:12, color:'#374151', lineHeight:1.6, marginBottom:8 }}>{selectedLog.message}</p>
                    {selectedLog.stack_trace && (
                      <details style={{ marginBottom:8 }}>
                        <summary style={{ fontSize:11, color:'#94a3b8', cursor:'pointer' }}>Stack Trace</summary>
                        <pre style={{ fontSize:9, color:'#374151', background:'#f8fafc', padding:8, borderRadius:6, overflow:'auto', marginTop:6, maxHeight:140 }}>{selectedLog.stack_trace}</pre>
                      </details>
                    )}
                    <p style={{ fontSize:10, color:'#94a3b8', margin:'8px 0 0' }}>{new Date(selectedLog.created_at).toLocaleString('ar-SA')}</p>
                    {selectedLog.status === 'open' && (
                      <div style={{ display:'flex', gap:6, marginTop:12 }}>
                        <button onClick={() => handleAnalyze(selectedLog)} disabled={!!analyzing}
                          style={{ flex:1, fontSize:11, padding:'7px 0', borderRadius:7, background:'linear-gradient(135deg,#7c3aed,#a855f7)', color:'white', border:'none', cursor:'pointer', fontWeight:600 }}>
                          {analyzing===selectedLog.id?'⏳ يحلّل...':'🧠 تحليل AI'}
                        </button>
                        <button onClick={() => setResolveModal(true)}
                          style={{ fontSize:11, padding:'7px 10px', borderRadius:7, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', cursor:'pointer' }}>✓</button>
                        <button onClick={() => handleIgnore(selectedLog)}
                          style={{ fontSize:11, padding:'7px 10px', borderRadius:7, background:'#f8fafc', color:'#94a3b8', border:'1px solid #e2e8f0', cursor:'pointer' }}>–</button>
                      </div>
                    )}
                  </div>
                  {ai ? (
                    <div style={{ background:'linear-gradient(135deg,#faf5ff,#f5f3ff)', borderRadius:12, border:'1px solid #e9d5ff', padding:16 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                        <span style={{ fontSize:15 }}>🧠</span>
                        <span style={{ fontSize:12, fontWeight:700, color:'#7c3aed' }}>تحليل الذكاء الاصطناعي</span>
                        <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'#ede9fe', color:'#7c3aed' }}>{ai.confidence}% ثقة</span>
                      </div>
                      <p style={{ fontSize:10, fontWeight:700, color:'#6d28d9', margin:'0 0 3px' }}>السبب الجذري</p>
                      <p style={{ fontSize:11, color:'#374151', margin:'0 0 10px', lineHeight:1.5 }}>{ai.root_cause}</p>
                      <p style={{ fontSize:10, fontWeight:700, color:'#6d28d9', margin:'0 0 3px' }}>الإصلاح المقترح</p>
                      <p style={{ fontSize:11, color:'#374151', margin:0, lineHeight:1.5 }}>{ai.suggested_fix}</p>
                      {ai.severity_note && <p style={{ fontSize:10, color:'#7c3aed', margin:'8px 0 0', background:'rgba(124,58,237,.07)', padding:'6px 8px', borderRadius:5 }}>{ai.severity_note}</p>}
                    </div>
                  ) : (
                    <div style={{ background:'white', borderRadius:12, border:'1px dashed #e9d5ff', padding:20, textAlign:'center' }}>
                      <p style={{ fontSize:20, margin:'0 0 4px' }}>🧠</p>
                      <p style={{ fontSize:11, color:'#94a3b8', margin:0 }}>لا يوجد تحليل بعد</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ══════════════════════ TENANTS TAB ══════════════════════ */}
        {tab === 'tenants' && (
          <div style={{ animation:'fadeIn .3s ease' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
              {tenants.map(t => {
                const sc = TENANT_STATUS[t.status as keyof typeof TENANT_STATUS] || TENANT_STATUS.healthy;
                return (
                  <div key={t.id} style={{ background:'white', borderRadius:14, border:`1px solid ${sc.c}30`, padding:16, boxShadow: t.status==='critical'?`0 0 0 1px ${sc.c}40`:'none' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:10 }}>
                      <div>
                        <p style={{ fontSize:13, fontWeight:700, color:'#374151', margin:'0 0 3px' }}>{t.name}</p>
                        <p style={{ fontSize:10, color:'#94a3b8', margin:0 }}>{t.slug}.app.liv-entra.com</p>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <p style={{ fontSize:22, fontWeight:700, color:sc.c, margin:0 }}>{t.score}</p>
                        <span style={{ fontSize:9, padding:'1px 6px', borderRadius:3, background:sc.bg, color:sc.c, fontWeight:600 }}>{sc.label}</span>
                      </div>
                    </div>
                    {/* Score bar */}
                    <div style={{ height:5, background:'#f1f5f9', borderRadius:3, marginBottom:10, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${t.score}%`, background:sc.bar, borderRadius:3, transition:'width .5s' }} />
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                      {[
                        { l:'أخطاء 24h', v:t.errors_24h,   c:t.errors_24h>0?'#ea580c':'#64748b' },
                        { l:'تحذير 24h', v:t.warnings_24h, c:t.warnings_24h>0?'#d97706':'#64748b' },
                        { l:'أخطاء 7d',  v:t.errors_7d,    c:t.errors_7d>5?'#dc2626':'#64748b' },
                      ].map(k => (
                        <div key={k.l} style={{ background:'#f8fafc', borderRadius:6, padding:'6px 8px', textAlign:'center' }}>
                          <p style={{ fontSize:14, fontWeight:700, color:k.c, margin:0 }}>{k.v}</p>
                          <p style={{ fontSize:9, color:'#94a3b8', margin:0 }}>{k.l}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'flex', gap:5, marginTop:8 }}>
                      <span style={{ fontSize:9, padding:'1px 6px', borderRadius:3, background:'#f8fafc', color:'#64748b' }}>{PLAN_LABELS[t.plan]||t.plan}</span>
                      <span style={{ fontSize:9, padding:'1px 6px', borderRadius:3, background:t.is_active?'#f0fdf4':'#fef2f2', color:t.is_active?'#16a34a':'#dc2626' }}>{t.is_active?'نشط':'موقوف'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════ TOP ERRORS TAB ══════════════════════ */}
        {tab === 'top-errors' && (
          <div style={{ background:'white', borderRadius:14, border:'1px solid #e2e8f0', overflow:'hidden', animation:'fadeIn .3s ease' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #e2e8f0', background:'#fffbeb' }}>
              <p style={{ fontSize:13, fontWeight:700, color:'#374151', margin:0 }}>🔥 أكثر الأخطاء تكراراً — آخر 7 أيام</p>
              <p style={{ fontSize:11, color:'#94a3b8', margin:'2px 0 0' }}>مجمّعة حسب المصدر وبداية الرسالة</p>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {['#','المصدر','رسالة الخطأ','التكرار','الشركات المتأثرة','المستوى','آخر ظهور'].map(h => (
                    <th key={h} style={{ padding:'9px 14px', textAlign:'right', fontSize:10, fontWeight:600, color:'#64748b', borderBottom:'1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topErr.map((e, i) => {
                  const lc = LEVEL[e.level as keyof typeof LEVEL] || LEVEL.error;
                  return (
                    <tr key={i} className="row-hover" style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'10px 14px', fontSize:11, color:'#94a3b8', width:32 }}>#{i+1}</td>
                      <td style={{ padding:'10px 14px' }}><span style={{ fontSize:11, fontFamily:'monospace', color:'#1d4070' }}>{e.source}</span></td>
                      <td style={{ padding:'10px 14px', maxWidth:320 }}><p style={{ fontSize:11, color:'#374151', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.message}</p></td>
                      <td style={{ padding:'10px 14px' }}><span style={{ fontSize:13, fontWeight:700, padding:'3px 10px', borderRadius:6, background:lc.bg, color:lc.c }}>{e.count}</span></td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:'#374151' }}>{e.companies}</td>
                      <td style={{ padding:'10px 14px' }}><span style={{ fontSize:10, padding:'1px 6px', borderRadius:3, background:lc.bg, color:lc.c }}>{lc.label}</span></td>
                      <td style={{ padding:'10px 14px', fontSize:10, color:'#94a3b8' }}>{new Date(e.last_seen).toLocaleString('ar-SA')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ══════════════════════ SECURITY TAB ══════════════════════ */}
        {tab === 'security' && (
          <div style={{ background:'white', borderRadius:14, border:'1px solid #e2e8f0', overflow:'hidden', animation:'fadeIn .3s ease' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #e2e8f0', background:'#f0f9ff' }}>
              <p style={{ fontSize:13, fontWeight:700, color:'#374151', margin:0 }}>🔐 أحداث الأمان الأخيرة</p>
              <p style={{ fontSize:11, color:'#94a3b8', margin:'2px 0 0' }}>محاولات تسجيل الدخول، الأنشطة المشبوهة، الأحداث الحساسة</p>
            </div>
            {secFeed.length === 0
              ? <p style={{ padding:32, textAlign:'center', color:'#94a3b8', fontSize:13 }}>✅ لا توجد أحداث أمنية مسجلة</p>
              : secFeed.map((ev, i) => (
                <div key={ev.id} className="row-hover" style={{ padding:'12px 16px', borderBottom:i<secFeed.length-1?'1px solid #f1f5f9':'none', display:'flex', gap:12, alignItems:'flex-start' }}>
                  <span style={{ fontSize:18 }}>{ev.event_type?.includes('fail')||ev.event_type?.includes('block')?'🚫':ev.event_type?.includes('login')?'🔑':'🔐'}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:8, marginBottom:3, alignItems:'center' }}>
                      <span style={{ fontSize:11, fontWeight:600, color:'#374151' }}>{ev.event_type}</span>
                      {ev.ip_address && <span style={{ fontSize:10, fontFamily:'monospace', color:'#64748b', background:'#f8fafc', padding:'1px 5px', borderRadius:3 }}>{ev.ip_address}</span>}
                    </div>
                    <p style={{ fontSize:11, color:'#64748b', margin:0 }}>{ev.description}</p>
                  </div>
                  <span style={{ fontSize:10, color:'#94a3b8', flexShrink:0 }}>{new Date(ev.created_at).toLocaleString('ar-SA')}</span>
                </div>
              ))
            }
          </div>
        )}

        {/* ══════════════════════ ALERTS TAB ══════════════════════ */}
        {tab === 'alerts' && (
          <div style={{ background:'white', borderRadius:14, border:'1px solid #e2e8f0', overflow:'hidden', animation:'fadeIn .3s ease' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #e2e8f0', background:'#faf5ff' }}>
              <p style={{ fontSize:13, fontWeight:700, color:'#374151', margin:0 }}>📱 تنبيهات واتساب المُرسلة</p>
            </div>
            {alerts.length === 0
              ? <p style={{ padding:32, textAlign:'center', color:'#94a3b8', fontSize:13 }}>لم يُرسل أي تنبيه حتى الآن</p>
              : alerts.map((a, i) => (
                <div key={a.id} className="row-hover" style={{ padding:'12px 16px', borderBottom:i<alerts.length-1?'1px solid #f1f5f9':'none' }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontSize:14 }}>📱</span>
                    <span style={{ fontSize:12, fontWeight:600, color:'#374151' }}>{a.recipient}</span>
                    <span style={{ fontSize:10, padding:'1px 6px', borderRadius:3, background:a.status==='sent'?'#f0fdf4':'#fef2f2', color:a.status==='sent'?'#16a34a':'#dc2626' }}>{a.status==='sent'?'أُرسل':'فشل'}</span>
                    <span style={{ fontSize:10, color:'#94a3b8', marginRight:'auto' }}>{new Date(a.sent_at).toLocaleString('ar-SA')}</span>
                  </div>
                  <p style={{ fontSize:11, color:'#64748b', margin:0, whiteSpace:'pre-line', lineHeight:1.5, paddingRight:22 }}>{a.message_body.slice(0,300)}</p>
                </div>
              ))
            }
          </div>
        )}

      </div>

      {/* Resolve Modal */}
      {resolveModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'white', borderRadius:14, padding:24, width:380, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ fontSize:15, fontWeight:700, margin:'0 0 10px' }}>تأكيد إغلاق السجل</h3>
            <textarea value={resNote} onChange={e => setResNote(e.target.value)}
              placeholder="ملاحظة الحل (اختياري)..."
              style={{ width:'100%', minHeight:80, padding:10, fontSize:12, borderRadius:8, border:'1px solid #e2e8f0', resize:'vertical', boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'flex-end' }}>
              <button onClick={() => setResolveModal(false)} style={{ fontSize:12, padding:'7px 14px', borderRadius:7, border:'1px solid #e2e8f0', background:'white', cursor:'pointer' }}>إلغاء</button>
              <button onClick={handleResolve} style={{ fontSize:12, padding:'7px 14px', borderRadius:7, background:'#16a34a', color:'white', border:'none', cursor:'pointer', fontWeight:600 }}>تأكيد الإغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
