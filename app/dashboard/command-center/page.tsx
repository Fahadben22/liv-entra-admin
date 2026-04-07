'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, request, BASE } from '@/lib/api';

// --- Types ---
interface TimeBucket { hour: string; label: string; warning: number; error: number; critical: number }

// --- Design tokens ---
const LVL: Record<string,{label:string;c:string;bg:string;dot:string}> = {
  critical:{ label:'حرج',    c:'#ef4444', bg:'rgba(239,68,68,0.08)',  dot:'#ef4444' },
  error:   { label:'خطأ',    c:'#f97316', bg:'rgba(249,115,22,0.08)', dot:'#f97316' },
  warning: { label:'تحذير',  c:'#f59e0b', bg:'rgba(245,158,11,0.08)', dot:'#f59e0b' },
  info:    { label:'معلومة', c:'#3b82f6', bg:'rgba(59,130,246,0.08)', dot:'#3b82f6' },
  debug:   { label:'تصحيح',  c:'#71717a', bg:'rgba(113,113,122,0.06)', dot:'#71717a' },
};
const TS: Record<string,{label:string;c:string;bg:string;bar:string}> = {
  healthy:  { label:'سليم',  c:'#16a34a', bg:'rgba(22,163,74,0.08)', bar:'#16a34a' },
  degraded: { label:'متدهور', c:'#3b82f6', bg:'rgba(59,130,246,0.08)', bar:'#3b82f6' },
  warning:  { label:'تحذير', c:'#f59e0b', bg:'rgba(245,158,11,0.08)', bar:'#f59e0b' },
  critical: { label:'حرج',  c:'#ef4444', bg:'rgba(239,68,68,0.08)',  bar:'#ef4444' },
};
const PLAN: Record<string,string> = { enterprise:'مؤسسي', professional:'احترافي', basic:'أساسي', trial:'تجريبي' };
const SEV_COLORS: Record<string,{c:string;bg:string}> = {
  critical:{c:'#dc2626',bg:'rgba(220,38,38,.08)'}, high:{c:'#c2410c',bg:'rgba(194,65,12,.08)'}, warning:{c:'#f59e0b',bg:'rgba(245,158,11,.08)'},
  medium:{c:'#854d0e',bg:'rgba(133,77,14,.08)'}, low:{c:'#3b82f6',bg:'rgba(59,130,246,.08)'}, info:{c:'#71717a',bg:'rgba(113,113,122,.06)'},
};
const TABS = [
  { id:'overview', label:'نظرة عامة',  icon:'⬡' },
  { id:'logs',     label:'السجلات',     icon:'≡' },
  { id:'incidents',label:'الحوادث',     icon:'⚡' },
  { id:'tenants',  label:'المستأجرون', icon:'⬢' },
  { id:'security', label:'الأمان',      icon:'🔐' },
  { id:'alerts',   label:'التنبيهات',   icon:'📱' },
  { id:'simulation',label:'المحاكاة',  icon:'🧪' },
];

// --- Simulation scenarios ---
const SIM_DOMAINS = ['المصادقة','التحكم في الوصول','التحقق من المدخلات','أمان API','سلامة البيانات','الأمان المالي','إساءة الاستخدام'];
const SCENARIOS = [
  {domain:0,desc:'OTP brute-force (5+ محاولات)',code:'otp.failed',risk:'critical',alert:'فوري',fixed:true,detected:true},
  {domain:0,desc:'Token منتهي الصلاحية',code:'auth.token_expired',risk:'medium',alert:'سجل',fixed:true,detected:true},
  {domain:0,desc:'Token غير صالح (تلاعب)',code:'auth.token_invalid',risk:'high',alert:'فوري',fixed:true,detected:true},
  {domain:1,desc:'محاولة وصول لدور غير مصرّح',code:'auth.role_violation',risk:'high',alert:'فوري',fixed:true,detected:true},
  {domain:1,desc:'وصول مستأجر لبيانات شركة أخرى',code:'rls.cross_tenant',risk:'critical',alert:'فوري',fixed:true,detected:true},
  {domain:1,desc:'Admin route بدون token',code:'auth.missing_token',risk:'high',alert:'لوحة',fixed:true,detected:true},
  {domain:2,desc:'SQL injection في حقل بحث',code:'input.sql_injection',risk:'critical',alert:'فوري',fixed:true,detected:true},
  {domain:2,desc:'XSS في حقل ملاحظات',code:'input.xss_attempt',risk:'high',alert:'فوري',fixed:true,detected:true},
  {domain:2,desc:'أرقام عربية-هندية في الهاتف',code:'input.arabic_digits',risk:'low',alert:'سجل',fixed:true,detected:true},
  {domain:3,desc:'Rate limit exceeded (global)',code:'rate_limit.exceeded',risk:'medium',alert:'لوحة',fixed:true,detected:true},
  {domain:3,desc:'Rate limit exceeded (AI)',code:'rate_limit.ai',risk:'high',alert:'فوري',fixed:true,detected:true},
  {domain:3,desc:'Webhook بدون توقيع صحيح',code:'webhook.invalid_sig',risk:'high',alert:'فوري',fixed:false,detected:false},
  {domain:4,desc:'حذف وحدة لها عقد نشط',code:'data.delete_with_contract',risk:'high',alert:'منع',fixed:true,detected:true},
  {domain:4,desc:'تعديل عقد مفعّل',code:'data.modify_active_contract',risk:'medium',alert:'سجل',fixed:true,detected:true},
  {domain:4,desc:'تكرار رقم وحدة بنفس العقار',code:'data.duplicate_unit',risk:'medium',alert:'منع',fixed:true,detected:true},
  {domain:5,desc:'دفعة بمبلغ سالب',code:'fin.negative_payment',risk:'critical',alert:'منع',fixed:true,detected:true},
  {domain:5,desc:'تجاوز حد 500 ر.س بدون موافقة',code:'fin.threshold_bypass',risk:'high',alert:'فوري',fixed:true,detected:true},
  {domain:5,desc:'رصيد سلبي للمالك',code:'fin.negative_owner_balance',risk:'medium',alert:'سجل',fixed:false,detected:false},
  {domain:6,desc:'إنشاء 100+ عميل/ساعة',code:'abuse.mass_create',risk:'high',alert:'فوري',fixed:false,detected:false},
  {domain:6,desc:'10+ طلبات OTP من نفس IP',code:'abuse.otp_spam',risk:'high',alert:'فوري',fixed:true,detected:true},
  {domain:6,desc:'Demo session hijack',code:'abuse.demo_hijack',risk:'critical',alert:'فوري',fixed:true,detected:true},
];

// --- Mini components ---
function AnimCounter({ value, color, size=28 }: { value:number; color:string; size?:number }) {
  const [d, setD] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const diff = value - prev.current, steps = 20; let i = 0;
    const id = setInterval(() => { i++; setD(Math.round(prev.current+(diff*i)/steps)); if (i>=steps){clearInterval(id);prev.current=value;} }, 30);
    return () => clearInterval(id);
  }, [value]);
  return <span style={{ fontSize:size,fontWeight:600,color,fontVariantNumeric:'tabular-nums' }}>{d}</span>;
}

function HealthRing({ score, grade, status }: { score:number; grade:string; status:string }) {
  const r=38, C=2*Math.PI*r, pct=Math.min(score,100)/100;
  const color = score>=80?'#16a34a':score>=60?'#3b82f6':score>=40?'#f59e0b':'#ef4444';
  return (
    <div style={{ position:'relative',width:96,height:96 }}>
      <svg width={96} height={96} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={48} cy={48} r={r} fill="none" stroke="rgba(0,0,0,.06)" strokeWidth={6}/>
        <circle cx={48} cy={48} r={r} fill="none" stroke={color} strokeWidth={6} strokeDasharray={`${C*pct} ${C*(1-pct)}`} strokeLinecap="round" style={{ transition:'stroke-dasharray .8s ease' }}/>
      </svg>
      <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
        <span style={{ fontSize:22,fontWeight:600,color }}>{score}</span>
        <span style={{ fontSize:9,color:'#9ca3af',marginTop:-2 }}>{grade}</span>
      </div>
    </div>
  );
}

function Spark({ vals, color }: { vals:number[]; color:string }) {
  if (!vals.length) return null;
  const max = Math.max(...vals,1), W=80, H=24;
  const pts = vals.map((v,i) => `${(i/(vals.length-1||1))*W},${H-((v/max)*H*.8+1)}`).join(' ');
  return <svg width={W} height={H} style={{ display:'block' }}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round"/></svg>;
}

function AreaTimeline({ data, onSelect, selectedHour }: { data:TimeBucket[]; onSelect:(h:string|null)=>void; selectedHour:string|null }) {
  const W=900, H=80;
  if (!data.length) return <div style={{ height:H,background:'#f8f7fc',borderRadius:8 }}/>;
  const maxV = Math.max(...data.map(d=>d.critical+d.error+d.warning),1);
  const n = data.length;
  const makePts = (offset:(d:TimeBucket)=>number) => data.map((d,i) => `${8+(i/(n-1||1))*(W-16)},${H-((offset(d)/maxV)*(H-10))}`);
  const wP=makePts(d=>d.warning), eP=makePts(d=>d.warning+d.error), cP=makePts(d=>d.warning+d.error+d.critical);
  const mkArea = (pts:string[]) => `M8,${H} L${pts.join(' L')} L${W-8},${H} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H+14}`} style={{ display:'block',cursor:'crosshair' }}>
      <path d={mkArea(wP)} fill="rgba(245,158,11,.12)"/><path d={mkArea(eP)} fill="rgba(249,115,22,.15)"/><path d={mkArea(cP)} fill="rgba(239,68,68,.18)"/>
      <polyline points={cP.join(' ')} fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round"/>
      {data.map((d,i) => { const x=8+(i/(n-1||1))*(W-16); const isSel=selectedHour===d.hour; return (
        <g key={i} onClick={()=>onSelect(isSel?null:d.hour)} style={{ cursor:'pointer' }}>
          <rect x={x-((W-16)/(n-1||1))/2} y={0} width={(W-16)/(n-1||1)} height={H} fill={isSel?'rgba(124,92,252,.1)':'transparent'}/>
          {i%4===0 && <text x={x} y={H+12} fontSize={8} fill={isSel?'#7c5cfc':'#9ca3af'} textAnchor="middle">{d.label}</text>}
        </g>
      );})}
    </svg>
  );
}

// =============================================
// MAIN PAGE
// =============================================
export default function CommandCenterPage() {
  const router = useRouter();

  // --- Data state ---
  const [health, setHealth]     = useState<any>(null);
  const [timeline, setTimeline] = useState<TimeBucket[]>([]);
  const [tenants, setTenants]   = useState<any[]>([]);
  const [topErrors, setTopErrors] = useState<any[]>([]);
  const [summary, setSummary]   = useState<any>({});
  const [secSummary, setSecSummary] = useState<any>({});
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [logs, setLogs]         = useState<any[]>([]);
  const [logCount, setLogCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [secEvents, setSecEvents] = useState<any[]>([]);
  const [secFeed, setSecFeed]   = useState<any[]>([]);
  const [alerts, setAlerts]     = useState<any[]>([]);
  const [ticker, setTicker]     = useState<any[]>([]);

  // --- UI state ---
  const [tab, setTab]           = useState('overview');
  const [loading, setLoading]   = useState(true);
  const [sseOk, setSseOk]       = useState(false);
  const [logLevel, setLogLevel] = useState('');
  const [logStatus, setLogStatus] = useState('');
  const [logPage, setLogPage]   = useState(0);
  const [companyFilter, setCompanyFilter] = useState('');
  const [hourFilter, setHourFilter] = useState<string|null>(null);
  const [analyzing, setAnalyzing] = useState('');
  const [resModal, setResModal] = useState<any>(null);
  const [resNote, setResNote]   = useState('');
  const [evtSev, setEvtSev]     = useState('');
  const [evtHours, setEvtHours] = useState('24');
  const [evtPage, setEvtPage]   = useState(0);
  const [anomFilter, setAnomFilter] = useState('');
  const [simFilter, setSimFilter] = useState('');
  const [simDomain, setSimDomain] = useState(-1);
  const [toast, setToast]       = useState('');

  // --- IT Agent state ---
  const [agentMsgs, setAgentMsgs] = useState<{role:string;content:string}[]>([]);
  const [agentInput, setAgentInput] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentTokens, setAgentTokens] = useState(0);
  const agentScrollRef = useRef<HTMLDivElement>(null);

  const LIMIT = 25;
  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3000); };

  // --- Data loaders ---
  const loadOverview = useCallback(async () => {
    const results = await Promise.allSettled([
      adminApi.getHealthScore(), adminApi.getTimeline(), adminApi.getTenantHealth(),
      adminApi.getTopErrors(), adminApi.intelligenceSummary(),
      adminApi.platformSecuritySummary(), adminApi.sa.listAnomalies({ limit:'50' }),
      adminApi.sa.listAudit({ limit:'20' }),
    ]);
    const g = (i:number) => results[i].status==='fulfilled' ? (results[i] as any).value?.data : null;
    if (g(0)) setHealth(g(0));
    if (g(1)) setTimeline(Array.isArray(g(1)) ? g(1) : g(1)?.buckets || []);
    if (g(2)) setTenants(Array.isArray(g(2)) ? g(2) : []);
    if (g(3)) setTopErrors(Array.isArray(g(3)) ? g(3) : g(3)?.patterns || []);
    if (g(4)) setSummary(g(4) || {});
    if (g(5)) setSecSummary(g(5) || {});
    if (g(6)) setAnomalies(Array.isArray(g(6)) ? g(6) : g(6)?.items || []);
    if (g(7)) setAuditLog(Array.isArray(g(7)) ? g(7) : g(7)?.items || []);
  }, []);

  const loadLogs = useCallback(async () => {
    const params: Record<string,string> = { limit: String(LIMIT), offset: String(logPage*LIMIT) };
    if (logLevel) params.level = logLevel;
    if (logStatus) params.status = logStatus;
    if (companyFilter) params.company_id = companyFilter;
    const res = await adminApi.listLogs(params).catch(()=>null);
    if (res?.data) { setLogs(Array.isArray(res.data) ? res.data : res.data.items || []); setLogCount(res.data.total || res.data.length || 0); }
  }, [logPage, logLevel, logStatus, companyFilter]);

  const loadSecEvents = useCallback(async () => {
    const params: Record<string,string> = { hours: evtHours, limit:'50' };
    if (evtSev) params.severity = evtSev;
    const res = await adminApi.securityEvents(params).catch(()=>null);
    if (res?.data) setSecEvents(Array.isArray(res.data) ? res.data : res.data.events || []);
  }, [evtHours, evtSev]);

  const loadAlerts = useCallback(async () => {
    const [feedRes, alertRes] = await Promise.allSettled([adminApi.getSecurityFeed(), adminApi.listAlerts()]);
    if (feedRes.status==='fulfilled') setSecFeed(Array.isArray(feedRes.value?.data) ? feedRes.value.data : []);
    if (alertRes.status==='fulfilled') setAlerts(Array.isArray(alertRes.value?.data) ? alertRes.value.data : []);
  }, []);

  // --- Initial load ---
  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    loadOverview().finally(() => setLoading(false));
  }, [loadOverview, router]);

  // --- Auto-refresh ---
  useEffect(() => {
    const id = setInterval(() => { loadOverview(); }, 30000);
    return () => clearInterval(id);
  }, [loadOverview]);

  useEffect(() => {
    if (tab === 'logs' || tab === 'incidents') loadLogs();
  }, [tab, loadLogs]);

  useEffect(() => {
    if (tab === 'security') loadSecEvents();
  }, [tab, loadSecEvents]);

  useEffect(() => {
    if (tab === 'alerts') loadAlerts();
  }, [tab, loadAlerts]);

  // --- SSE real-time stream ---
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;
    const es = new EventSource(`${BASE}/admin/intelligence/stream?token=${token}`);
    es.onopen = () => setSseOk(true);
    es.onerror = () => setSseOk(false);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'new_log' || msg.type === 'security_event') {
          setTicker(prev => [msg, ...prev].slice(0, 30));
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  // --- Ticker scroll animation ---
  const [tickerX, setTickerX] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTickerX(prev => prev <= -2000 ? 0 : prev - 1), 30);
    return () => clearInterval(id);
  }, []);

  // --- Handlers ---
  async function handleAnalyze(logId:string) {
    setAnalyzing(logId);
    try {
      const res = await adminApi.analyzeLog(logId);
      if (res?.data && selectedLog?.id === logId) setSelectedLog((p:any) => ({ ...p, ai_analyses: [res.data] }));
      showToast('تم التحليل');
    } catch (e:any) { showToast(`خطأ: ${e.message}`); }
    setAnalyzing('');
  }
  async function handleResolve() {
    if (!resModal) return;
    try {
      await adminApi.resolveLog(resModal.id, resNote);
      showToast('تم الحل'); setResModal(null); setResNote(''); setSelectedLog(null); loadLogs();
    } catch (e:any) { showToast(`خطأ: ${e.message}`); }
  }
  async function handleIgnore(id:string) {
    try { await adminApi.ignoreLog(id); showToast('تم التجاهل'); setSelectedLog(null); loadLogs(); } catch {}
  }
  async function handleAnomAction(id:string, status:string) {
    let note = '';
    if (status === 'resolved') note = prompt('ملاحظة الحل (اختياري):') || '';
    try {
      await adminApi.sa.updateAnomaly(id, status, note);
      showToast('تم التحديث');
      setAnomalies(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch (e:any) { showToast(`خطأ: ${e.message}`); }
  }

  // --- IT Agent ---
  async function agentSend(text?:string) {
    const msg = (text || agentInput).trim();
    if (!msg || agentLoading) return;
    setAgentInput('');
    setAgentMsgs(prev => [...prev, { role:'user', content:msg }]);
    setAgentLoading(true);
    try {
      const res = await request<any>('POST', '/admin/agents/it/chat', { message: msg });
      const reply = res?.data?.reply || 'خطأ';
      setAgentTokens(prev => prev + (res?.data?.tokens_used || 0));
      setAgentMsgs(prev => [...prev, { role:'assistant', content: reply }]);
    } catch (e:any) { setAgentMsgs(prev => [...prev, { role:'assistant', content:`خطأ: ${e.message}` }]); }
    setAgentLoading(false);
  }
  async function agentClear() {
    try { await request('DELETE', '/admin/agents/it/clear'); setAgentMsgs([]); setAgentTokens(0); } catch {}
  }
  useEffect(() => { if (agentScrollRef.current) agentScrollRef.current.scrollTop = agentScrollRef.current.scrollHeight; }, [agentMsgs]);

  // --- Derived ---
  const score = health?.score ?? 100;
  const grade = health?.grade ?? 'A';
  const statusLabel = score >= 80 ? 'مستقر' : score >= 60 ? 'تحذير' : 'حرج';
  const statusColor = score >= 80 ? '#16a34a' : score >= 60 ? '#f59e0b' : '#ef4444';
  const incidents = (() => {
    const map: Record<string,any> = {};
    for (const l of logs.filter(l => ['error','critical'].includes(l.level))) {
      const k = `${l.source}::${l.level}`;
      if (!map[k]) map[k] = { source:l.source, level:l.level, count:0, first:l.created_at, last:l.created_at, samples:[] };
      map[k].count++; map[k].last = l.created_at;
      if (map[k].samples.length < 3) map[k].samples.push(l.message);
    }
    return Object.values(map).sort((a:any,b:any) => b.count - a.count);
  })();
  const filteredAnoms = anomFilter ? anomalies.filter(a => a.status === anomFilter) : anomalies;
  const filteredSims = SCENARIOS.filter(s => {
    if (simFilter === 'pass' && !s.detected) return false;
    if (simFilter === 'fail' && s.detected) return false;
    if (simDomain >= 0 && s.domain !== simDomain) return false;
    return true;
  });
  const secEvtsPaged = secEvents.slice(evtPage*50, (evtPage+1)*50);
  // Top IPs
  const ipMap: Record<string,number> = {};
  for (const e of (secSummary?.events_24h || secEvents)) { if (e.ip_address) ipMap[e.ip_address] = (ipMap[e.ip_address]||0)+1; }
  const topIPs = Object.entries(ipMap).sort((a,b) => b[1]-a[1]).slice(0,8);

  // --- Light theme tokens ---
  const C = { card:'#fff', border:'rgba(0,0,0,.08)', lightBorder:'rgba(0,0,0,.06)', text1:'#1a1a2e', text2:'#6b7280', muted:'#9ca3af', accent:'#7c5cfc', body:'#6b7280' };

  // --- Loading ---
  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,height:'100vh' }}>
      <div style={{ width:40,height:40,border:'3px solid rgba(0,0,0,.08)',borderTopColor:'#7c5cfc',borderRadius:'50%',animation:'spin 1s linear infinite' }}/>
      <p style={{ color:'#9ca3af',fontSize:13 }}>جاري تحميل مركز القيادة...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse-dot{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}`}</style>
    </div>
  );

  return (
    <div style={{ color:C.text1 }}>
      {toast && <div style={{ position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',background:'#fff',color:C.text1,padding:'8px 20px',borderRadius:10,fontSize:12,zIndex:9999,border:`1px solid ${C.border}`,boxShadow:'0 4px 12px rgba(0,0,0,.08)' }}>{toast}</div>}

      {/* === ZONE 1 -- LIVE PULSE === */}
      <div style={{ borderBottom:`1px solid ${C.border}`,padding:'20px 28px 14px',position:'sticky',top:0,zIndex:50,background:'rgba(255,255,255,.92)',backdropFilter:'blur(12px)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:24,maxWidth:1600,margin:'0 auto' }}>
          {/* Health ring */}
          <HealthRing score={score} grade={grade} status={statusLabel} />

          {/* KPIs */}
          <div style={{ display:'flex',gap:12,flex:1,justifyContent:'center' }}>
            {[
              { label:'حرج', value:summary.open_criticals||health?.criticals_1h||0, color:'#ef4444' },
              { label:'أخطاء', value:health?.errors_1h||0, color:'#f97316' },
              { label:'أحداث أمنية', value:secSummary?.total_24h||0, color:'#3b82f6' },
              { label:'شركات نشطة', value:tenants.length, color:'#16a34a' },
            ].map(k => (
              <div key={k.label} className="card" style={{ background:C.card,border:'none',borderTop:`3px solid ${k.color}`,borderRadius:14,padding:'12px 20px',minWidth:110,textAlign:'center',boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
                <AnimCounter value={k.value} color={k.color} size={28} />
                <div style={{ fontSize:11,color:C.muted,marginTop:4,fontWeight:500 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Status badge */}
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ fontSize:13,fontWeight:600,color:statusColor,padding:'8px 18px',background:score>=80?'rgba(22,163,74,.06)':score>=60?'rgba(245,158,11,.06)':'rgba(239,68,68,.06)',borderRadius:24,border:`1.5px solid ${statusColor}33` }}>
              {statusLabel}
            </div>
          </div>
        </div>
        {/* Ticker */}
        <div style={{ overflow:'hidden',marginTop:10,height:20,position:'relative',display:'flex',alignItems:'center',gap:8 }}>
          <div style={{ display:'flex',alignItems:'center',gap:6,flexShrink:0 }}>
            <div style={{ width:7,height:7,borderRadius:'50%',background:'#16a34a',boxShadow:'0 0 6px rgba(22,163,74,.4)',animation:'pulse-dot 1.5s ease-in-out infinite' }}/>
            <span style={{ fontSize:9,color:'#16a34a',fontWeight:600,letterSpacing:'.5px' }}>LIVE</span>
          </div>
          <div style={{ overflow:'hidden',flex:1,position:'relative',height:20 }}>
            <div style={{ display:'flex',gap:40,position:'absolute',whiteSpace:'nowrap',transform:`translateX(${tickerX}px)`,transition:'none',alignItems:'center',height:20 }}>
              {ticker.length === 0 ? <span style={{ fontSize:10,color:C.muted }}>بانتظار أحداث مباشرة...</span> :
                ticker.map((t,i) => {
                  const lv = LVL[t.level || t.severity] || LVL.info;
                  return <span key={i} style={{ fontSize:10,color:lv.c }}>[{lv.label}] {t.source||t.event_type}: {(t.message||'').slice(0,60)}</span>;
                })
              }
            </div>
          </div>
        </div>
      </div>

      {/* === ZONE 2 + 3 GRID === */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 340px',maxWidth:1600,margin:'0 auto',minHeight:'calc(100vh - 130px)' }}>

        {/* === ZONE 2 -- INTELLIGENCE CENTER === */}
        <div style={{ borderLeft:`1px solid ${C.border}`,overflow:'auto' }}>
          {/* Tab bar */}
          <div style={{ display:'flex',gap:0,borderBottom:`1px solid ${C.border}`,padding:'0 16px',overflow:'auto' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{ padding:'12px 16px',fontSize:12,fontWeight:tab===t.id?600:400,color:tab===t.id?C.text1:C.muted,background:'transparent',border:'none',borderBottom:tab===t.id?`2px solid ${C.accent}`:'2px solid transparent',cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s' }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding:'16px 20px' }}>

            {/* --- TAB: OVERVIEW --- */}
            {tab === 'overview' && <>
              {/* Timeline */}
              <div className="card" style={{ background:C.card,border:'none',boxShadow:'0 1px 3px rgba(0,0,0,.06)',borderRadius:14,padding:'14px 16px',marginBottom:14 }}>
                <p style={{ fontSize:13,fontWeight:600,color:C.text1,marginBottom:8 }}>الجدول الزمني — 24 ساعة</p>
                <AreaTimeline data={timeline} onSelect={(h) => { setHourFilter(h); if (h) setTab('logs'); }} selectedHour={hourFilter} />
              </div>
              {/* Metrics row */}
              <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14 }}>
                {(topErrors.slice(0,3)).map((e:any,i:number) => (
                  <div key={i} className="card" style={{ background:C.card,border:'none',boxShadow:'0 1px 3px rgba(0,0,0,.06)',borderRadius:14,padding:'12px 14px' }}>
                    <div style={{ fontSize:11,color:C.muted,marginBottom:4,fontWeight:500 }}>{e.source}</div>
                    <div style={{ fontSize:13,fontWeight:600,color:C.text1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{e.message}</div>
                    <div style={{ fontSize:18,fontWeight:600,color:(LVL[e.level]||LVL.error).c,marginTop:4 }}>{e.count}x</div>
                  </div>
                ))}
              </div>
              {/* Open criticals + Tenant health */}
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
                <div className="card" style={{ background:C.card,border:'none',boxShadow:'0 1px 3px rgba(0,0,0,.06)',borderRadius:14,padding:'14px 16px' }}>
                  <p style={{ fontSize:13,fontWeight:600,color:'#ef4444',marginBottom:10 }}>أخطاء حرجة مفتوحة</p>
                  {(summary.open_criticals_list || []).slice(0,4).map((l:any,i:number) => (
                    <div key={i} style={{ fontSize:11,padding:'6px 0',borderBottom:`1px solid ${C.lightBorder}`,color:C.text2 }}>
                      <span style={{ color:'#ef4444',fontFamily:'monospace' }}>{l.source}</span>: {(l.message||'').slice(0,60)}
                    </div>
                  ))}
                  {(!summary.open_criticals_list?.length) && <p style={{ fontSize:11,color:C.text2 }}>لا توجد أخطاء حرجة</p>}
                </div>
                <div className="card" style={{ background:C.card,border:'none',boxShadow:'0 1px 3px rgba(0,0,0,.06)',borderRadius:14,padding:'14px 16px' }}>
                  <p style={{ fontSize:13,fontWeight:600,color:C.text1,marginBottom:10 }}>صحة المستأجرين</p>
                  {tenants.slice(0,5).map((t:any) => {
                    const ts = t.score>=80?TS.healthy:t.score>=60?TS.degraded:t.score>=40?TS.warning:TS.critical;
                    return (
                      <div key={t.id||t.slug} style={{ display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:`1px solid ${C.lightBorder}` }}>
                        <span style={{ fontSize:11,flex:1,color:C.text1 }}>{t.name||t.slug}</span>
                        <span style={{ fontSize:10,color:ts.c,fontWeight:600 }}>{t.score??'—'}</span>
                        <div style={{ width:40,height:4,borderRadius:2,background:'rgba(0,0,0,.06)' }}>
                          <div style={{ height:'100%',width:`${Math.min(t.score||0,100)}%`,background:ts.bar,borderRadius:2 }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>}

            {/* --- TAB: LOGS --- */}
            {tab === 'logs' && <>
              <div style={{ display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center' }}>
                <select value={logLevel} onChange={e=>{setLogLevel(e.target.value);setLogPage(0)}} style={{ background:'#f8f7fc',border:`1px solid ${C.border}`,borderRadius:10,padding:'6px 10px',color:C.text1,fontSize:11 }}>
                  <option value="">كل المستويات</option>
                  {Object.keys(LVL).map(l => <option key={l} value={l}>{LVL[l].label}</option>)}
                </select>
                <select value={logStatus} onChange={e=>{setLogStatus(e.target.value);setLogPage(0)}} style={{ background:'#f8f7fc',border:`1px solid ${C.border}`,borderRadius:10,padding:'6px 10px',color:C.text1,fontSize:11 }}>
                  <option value="">كل الحالات</option>
                  <option value="open">مفتوح</option><option value="resolved">محلول</option><option value="ignored">متجاهل</option>
                </select>
                <span style={{ fontSize:10,color:C.muted }}>{logCount} سجل</span>
                <button onClick={loadLogs} style={{ background:'transparent',border:`1px solid ${C.border}`,borderRadius:10,padding:'6px 12px',color:C.text2,fontSize:11,cursor:'pointer' }}>↻</button>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:selectedLog?'1fr 320px':'1fr',gap:12 }}>
                <div>
                  {logs.map((l:any) => {
                    const lv = LVL[l.level] || LVL.info;
                    return (
                      <div key={l.id} onClick={()=>setSelectedLog(selectedLog?.id===l.id?null:l)}
                        style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderBottom:`1px solid ${C.lightBorder}`,cursor:'pointer',background:selectedLog?.id===l.id?'#f0edff':'transparent' }}>
                        <div style={{ width:6,height:6,borderRadius:'50%',background:lv.dot,boxShadow:`0 0 6px ${lv.dot}66`,flexShrink:0 }}/>
                        <span style={{ fontSize:10,color:lv.c,fontWeight:600,minWidth:36 }}>{lv.label}</span>
                        <span style={{ fontSize:10,color:C.accent,fontFamily:'monospace',minWidth:80 }}>{l.source}</span>
                        <span style={{ fontSize:11,color:C.text2,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{l.message}</span>
                        {l.ai_analyses?.length > 0 && <span style={{ fontSize:8,background:'rgba(139,92,246,.08)',color:'#8b5cf6',padding:'1px 6px',borderRadius:10 }}>AI</span>}
                        <span style={{ fontSize:9,color:C.muted,flexShrink:0 }}>{new Date(l.created_at).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})}</span>
                      </div>
                    );
                  })}
                  <div style={{ display:'flex',justifyContent:'center',gap:12,padding:'12px 0' }}>
                    <button disabled={logPage===0} onClick={()=>setLogPage(p=>p-1)} style={{ fontSize:11,padding:'4px 12px',borderRadius:10,border:`1px solid ${C.border}`,background:'transparent',color:C.text2,cursor:'pointer' }}>السابق</button>
                    <span style={{ fontSize:11,color:C.text2 }}>{logPage+1}/{Math.ceil(logCount/LIMIT)||1}</span>
                    <button disabled={logs.length<LIMIT} onClick={()=>setLogPage(p=>p+1)} style={{ fontSize:11,padding:'4px 12px',borderRadius:10,border:`1px solid ${C.border}`,background:'transparent',color:C.text2,cursor:'pointer' }}>التالي</button>
                  </div>
                </div>
                {selectedLog && (
                  <div className="card" style={{ background:C.card,border:'none',boxShadow:'0 1px 3px rgba(0,0,0,.06)',borderRadius:14,padding:'14px',fontSize:12 }}>
                    <div style={{ fontSize:10,color:(LVL[selectedLog.level]||LVL.info).c,fontWeight:600,marginBottom:4 }}>{(LVL[selectedLog.level]||LVL.info).label} — {selectedLog.source}</div>
                    <p style={{ color:C.body,lineHeight:1.6,marginBottom:10,fontSize:11 }}>{selectedLog.message}</p>
                    {selectedLog.stack_trace && <details style={{ marginBottom:10 }}><summary style={{ fontSize:10,color:C.text2,cursor:'pointer' }}>Stack trace</summary><pre style={{ fontSize:9,color:C.text2,whiteSpace:'pre-wrap',marginTop:4 }}>{selectedLog.stack_trace}</pre></details>}
                    <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                      <button onClick={()=>handleAnalyze(selectedLog.id)} disabled={analyzing===selectedLog.id} style={{ fontSize:10,padding:'6px 12px',borderRadius:10,background:C.accent,color:'#fff',border:'none',cursor:'pointer',flex:1 }}>{analyzing===selectedLog.id?'...':'تحليل AI'}</button>
                      <button onClick={()=>{setResModal(selectedLog);setResNote('')}} style={{ fontSize:10,padding:'6px 12px',borderRadius:10,background:'rgba(22,163,74,.06)',color:'#16a34a',border:'1px solid rgba(22,163,74,.2)',cursor:'pointer' }}>حل</button>
                      <button onClick={()=>handleIgnore(selectedLog.id)} style={{ fontSize:10,padding:'6px 12px',borderRadius:10,background:'transparent',color:C.text2,border:`1px solid ${C.border}`,cursor:'pointer' }}>تجاهل</button>
                    </div>
                    {selectedLog.ai_analyses?.[0] && (
                      <div style={{ marginTop:10,background:'rgba(139,92,246,.04)',border:'1px solid rgba(139,92,246,.12)',borderRadius:8,padding:10 }}>
                        <p style={{ fontSize:10,fontWeight:600,color:'#8b5cf6',marginBottom:4 }}>تحليل AI ({selectedLog.ai_analyses[0].confidence}%)</p>
                        <p style={{ fontSize:10,color:C.body,marginBottom:4 }}><strong>السبب:</strong> {selectedLog.ai_analyses[0].root_cause}</p>
                        <p style={{ fontSize:10,color:C.body }}><strong>الحل:</strong> {selectedLog.ai_analyses[0].suggested_fix}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>}

            {/* --- TAB: INCIDENTS --- */}
            {tab === 'incidents' && <>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
                <p style={{ fontSize:13,fontWeight:600 }}>الحوادث النشطة</p>
                <button onClick={loadLogs} style={{ fontSize:10,padding:'4px 10px',borderRadius:10,background:'transparent',border:`1px solid ${C.border}`,color:C.text2,cursor:'pointer' }}>↻</button>
              </div>
              {incidents.length === 0 ? <p style={{ textAlign:'center',color:C.text2,padding:40 }}>لا توجد حوادث</p> :
                incidents.map((inc:any,i:number) => (
                  <div key={i} className="card" style={{ background:C.card,border:'none',boxShadow:'0 1px 3px rgba(0,0,0,.06)',borderRadius:14,padding:'12px 16px',marginBottom:10 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
                      <div style={{ width:36,height:36,borderRadius:8,background:(LVL[inc.level]||LVL.error).bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:600,color:(LVL[inc.level]||LVL.error).c }}>{inc.count}</div>
                      <div style={{ flex:1 }}>
                        <span style={{ fontSize:12,fontFamily:'monospace',color:C.accent }}>{inc.source}</span>
                        <span style={{ fontSize:10,color:(LVL[inc.level]||LVL.error).c,marginRight:8,padding:'1px 6px',borderRadius:10,background:(LVL[inc.level]||LVL.error).bg }}>{(LVL[inc.level]||LVL.error).label}</span>
                      </div>
                    </div>
                    {inc.samples.map((s:string,j:number) => <p key={j} style={{ fontSize:10,color:C.text2,fontFamily:'monospace',marginBottom:2 }}>{s.slice(0,80)}</p>)}
                  </div>
                ))
              }
            </>}

            {/* --- TAB: TENANTS --- */}
            {tab === 'tenants' && <>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12 }}>
                {tenants.map((t:any) => {
                  const ts = t.score>=80?TS.healthy:t.score>=60?TS.degraded:t.score>=40?TS.warning:TS.critical;
                  const isFiltered = companyFilter===t.id;
                  return (
                    <div key={t.id||t.slug} onClick={()=>{setCompanyFilter(isFiltered?'':t.id);if(!isFiltered)setTab('logs');}}
                      className="card" style={{ background:C.card,border:isFiltered?`1px solid ${C.accent}`:'none',boxShadow:'0 1px 3px rgba(0,0,0,.06)',borderRadius:14,padding:'16px',cursor:'pointer',transition:'border .15s' }}>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
                        <div><div style={{ fontSize:13,fontWeight:600 }}>{t.name}</div><div style={{ fontSize:10,color:C.muted,fontFamily:'monospace' }}>{t.slug}</div></div>
                        <div style={{ textAlign:'center' }}><div style={{ fontSize:22,fontWeight:600,color:ts.c }}>{t.score??'—'}</div><div style={{ fontSize:9,color:ts.c }}>{ts.label}</div></div>
                      </div>
                      <div style={{ height:4,borderRadius:2,background:'rgba(0,0,0,.06)',marginBottom:8 }}><div style={{ height:'100%',width:`${Math.min(t.score||0,100)}%`,background:ts.bar,borderRadius:2,transition:'width .5s' }}/></div>
                      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4,fontSize:10,color:C.text2 }}>
                        <div>أخطاء 24س: <span style={{ color:C.text1,fontWeight:600 }}>{t.errors_24h||0}</span></div>
                        <div>تحذيرات: <span style={{ color:C.text1,fontWeight:600 }}>{t.warnings_24h||0}</span></div>
                        <div>7 أيام: <span style={{ color:C.text1,fontWeight:600 }}>{t.errors_7d||0}</span></div>
                      </div>
                      <span style={{ fontSize:9,padding:'2px 8px',borderRadius:10,marginTop:6,display:'inline-block',background:t.plan==='enterprise'?'rgba(245,158,11,.08)':'rgba(59,130,246,.06)',color:t.plan==='enterprise'?'#f59e0b':'#3b82f6' }}>{PLAN[t.plan]||t.plan}</span>
                    </div>
                  );
                })}
              </div>
            </>}

            {/* --- TAB: SECURITY --- */}
            {tab === 'security' && <>
              {/* Filters */}
              <div style={{ display:'flex',gap:8,marginBottom:12,flexWrap:'wrap' }}>
                {['','critical','high','medium','info'].map(s => (
                  <button key={s} onClick={()=>{setEvtSev(s);setEvtPage(0);}} style={{ fontSize:10,padding:'4px 10px',borderRadius:20,border:`1px solid ${evtSev===s?C.accent:C.border}`,background:evtSev===s?'rgba(124,92,252,.1)':'transparent',color:evtSev===s?C.text1:C.text2,cursor:'pointer' }}>
                    {s?((SEV_COLORS[s]||SEV_COLORS.info) && (s==='critical'?'حرج':s==='high'?'عالي':s==='medium'?'متوسط':'معلومة')):'الكل'}
                  </button>
                ))}
                <select value={evtHours} onChange={e=>{setEvtHours(e.target.value);setEvtPage(0);loadSecEvents()}} style={{ background:'#f8f7fc',border:`1px solid ${C.border}`,borderRadius:10,padding:'4px 8px',color:C.text1,fontSize:10 }}>
                  <option value="6">6 ساعات</option><option value="24">24 ساعة</option><option value="72">3 أيام</option><option value="168">7 أيام</option>
                </select>
              </div>
              {/* Events table */}
              {secEvtsPaged.map((e:any,i:number) => (
                <div key={i} style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:`1px solid ${C.lightBorder}`,fontSize:11 }}>
                  <span style={{ fontSize:9,padding:'2px 6px',borderRadius:10,background:(SEV_COLORS[e.severity]||SEV_COLORS.info).bg,color:(SEV_COLORS[e.severity]||SEV_COLORS.info).c,fontWeight:600 }}>{e.severity}</span>
                  <span style={{ fontWeight:600,color:C.text1,minWidth:100 }}>{e.event_type}</span>
                  {e.ip_address && <span style={{ fontSize:9,color:C.muted,fontFamily:'monospace',background:'#f8f7fc',padding:'1px 6px',borderRadius:4 }}>{e.ip_address}</span>}
                  <span style={{ flex:1,color:C.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{e.description||''}</span>
                  <span style={{ fontSize:9,color:C.muted }}>{new Date(e.created_at).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              ))}
              {/* Top IPs */}
              {topIPs.length > 0 && (
                <div className="card" style={{ background:C.card,border:'none',boxShadow:'0 1px 3px rgba(0,0,0,.06)',borderRadius:14,padding:'14px 16px',marginTop:14 }}>
                  <p style={{ fontSize:13,fontWeight:600,color:C.text1,marginBottom:8 }}>أكثر العناوين نشاطاً</p>
                  {topIPs.map(([ip,count]) => (
                    <div key={ip} style={{ display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${C.lightBorder}`,fontSize:11 }}>
                      <span style={{ fontFamily:'monospace',color:C.accent }}>{ip}</span>
                      <span style={{ fontWeight:600,color:Number(count)>100?'#ef4444':Number(count)>30?'#f59e0b':C.text1 }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Anomalies */}
              <div style={{ marginTop:14 }}>
                <div style={{ display:'flex',gap:6,marginBottom:10 }}>
                  {['','open','acknowledged','resolved'].map(s => (
                    <button key={s} onClick={()=>setAnomFilter(s)} style={{ fontSize:10,padding:'3px 10px',borderRadius:20,border:`1px solid ${anomFilter===s?C.accent:C.border}`,background:anomFilter===s?'rgba(124,92,252,.1)':'transparent',color:anomFilter===s?C.text1:C.text2,cursor:'pointer' }}>
                      {s===''?'الكل':s==='open'?'مفتوح':s==='acknowledged'?'معترف به':'محلول'}
                    </button>
                  ))}
                </div>
                {filteredAnoms.map((a:any) => {
                  const sc = SEV_COLORS[a.severity] || SEV_COLORS.info;
                  return (
                    <div key={a.id} className="card" style={{ background:C.card,border:'none',boxShadow:'0 1px 3px rgba(0,0,0,.06)',borderRadius:14,padding:'10px 14px',marginBottom:8 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:4 }}>
                        <span style={{ fontSize:9,padding:'2px 6px',borderRadius:10,background:sc.bg,color:sc.c,fontWeight:600 }}>{a.severity}</span>
                        <span style={{ fontSize:11,fontWeight:600,color:C.text1 }}>{a.anomaly_type}</span>
                        <span style={{ fontSize:9,color:C.muted,marginRight:'auto' }}>{a.status}</span>
                      </div>
                      <p style={{ fontSize:10,color:C.text2,marginBottom:6 }}>{(a.description||'').slice(0,120)}</p>
                      {a.status === 'open' && (
                        <div style={{ display:'flex',gap:6 }}>
                          <button onClick={()=>handleAnomAction(a.id,'acknowledged')} style={{ fontSize:9,padding:'3px 8px',borderRadius:10,background:'rgba(124,92,252,.06)',color:C.accent,border:'1px solid rgba(124,92,252,.15)',cursor:'pointer' }}>اعتراف</button>
                          <button onClick={()=>handleAnomAction(a.id,'resolved')} style={{ fontSize:9,padding:'3px 8px',borderRadius:10,background:'rgba(22,163,74,.06)',color:'#16a34a',border:'1px solid rgba(22,163,74,.15)',cursor:'pointer' }}>حل</button>
                          <button onClick={()=>handleAnomAction(a.id,'false_positive')} style={{ fontSize:9,padding:'3px 8px',borderRadius:10,background:'transparent',color:C.text2,border:`1px solid ${C.border}`,cursor:'pointer' }}>إيجابي خاطئ</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>}

            {/* --- TAB: ALERTS --- */}
            {tab === 'alerts' && <>
              {alerts.length === 0 ? <p style={{ textAlign:'center',color:C.text2,padding:40 }}>لا توجد تنبيهات</p> :
                alerts.map((a:any,i:number) => (
                  <div key={i} style={{ padding:'10px 0',borderBottom:`1px solid ${C.lightBorder}` }}>
                    <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:4 }}>
                      <span style={{ fontSize:11,color:C.text1 }}>{a.recipient_phone||a.to}</span>
                      <span style={{ fontSize:9,padding:'1px 6px',borderRadius:10,background:a.status==='sent'?'rgba(22,163,74,.08)':'rgba(239,68,68,.08)',color:a.status==='sent'?'#16a34a':'#ef4444' }}>{a.status}</span>
                      <span style={{ fontSize:9,color:C.muted,marginRight:'auto' }}>{new Date(a.sent_at||a.created_at).toLocaleString('ar-SA')}</span>
                    </div>
                    {a.message_body && <p style={{ fontSize:10,color:C.text2,whiteSpace:'pre-wrap' }}>{(a.message_body||a.body||'').slice(0,200)}</p>}
                  </div>
                ))
              }
            </>}

            {/* --- TAB: SIMULATION --- */}
            {tab === 'simulation' && <>
              <div style={{ display:'flex',gap:10,marginBottom:12 }}>
                <div style={{ background:'rgba(22,163,74,.04)',border:'1px solid rgba(22,163,74,.12)',borderRadius:14,padding:'10px 16px',textAlign:'center',flex:1 }}>
                  <div style={{ fontSize:22,fontWeight:600,color:'#16a34a' }}>{SCENARIOS.filter(s=>s.detected).length}</div>
                  <div style={{ fontSize:10,color:C.text2 }}>مكتشف</div>
                </div>
                <div style={{ background:'rgba(239,68,68,.04)',border:'1px solid rgba(239,68,68,.12)',borderRadius:14,padding:'10px 16px',textAlign:'center',flex:1 }}>
                  <div style={{ fontSize:22,fontWeight:600,color:'#ef4444' }}>{SCENARIOS.filter(s=>!s.detected).length}</div>
                  <div style={{ fontSize:10,color:C.text2 }}>ثغرات</div>
                </div>
                <div style={{ background:'rgba(124,92,252,.04)',border:'1px solid rgba(124,92,252,.12)',borderRadius:14,padding:'10px 16px',textAlign:'center',flex:1 }}>
                  <div style={{ fontSize:22,fontWeight:600,color:C.accent }}>{Math.round(SCENARIOS.filter(s=>s.detected).length/SCENARIOS.length*100)}%</div>
                  <div style={{ fontSize:10,color:C.text2 }}>النتيجة</div>
                </div>
              </div>
              <div style={{ display:'flex',gap:4,marginBottom:10,flexWrap:'wrap' }}>
                {['','pass','fail'].map(f => (
                  <button key={f} onClick={()=>setSimFilter(f)} style={{ fontSize:10,padding:'3px 10px',borderRadius:20,border:`1px solid ${simFilter===f?C.accent:C.border}`,background:simFilter===f?'rgba(124,92,252,.1)':'transparent',color:simFilter===f?C.text1:C.text2,cursor:'pointer' }}>
                    {f===''?'الكل':f==='pass'?'ناجح':'ثغرة'}
                  </button>
                ))}
                {SIM_DOMAINS.map((d,i) => (
                  <button key={i} onClick={()=>setSimDomain(simDomain===i?-1:i)} style={{ fontSize:9,padding:'3px 8px',borderRadius:20,border:`1px solid ${simDomain===i?C.accent:C.border}`,background:simDomain===i?'rgba(124,92,252,.1)':'transparent',color:simDomain===i?C.text1:C.text2,cursor:'pointer' }}>
                    {d}
                  </button>
                ))}
              </div>
              {filteredSims.map((s,i) => (
                <div key={i} style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 10px',marginBottom:2,borderRadius:8,fontSize:11,background:s.detected?'rgba(22,163,74,.03)':'rgba(239,68,68,.03)',border:`1px solid ${s.detected?'rgba(22,163,74,.1)':'rgba(239,68,68,.1)'}` }}>
                  <span style={{ width:20,textAlign:'center',color:C.muted,fontWeight:600 }}>{i+1}</span>
                  <span style={{ fontSize:10,padding:'2px 8px',borderRadius:10,background:s.detected?'rgba(22,163,74,.08)':'rgba(239,68,68,.08)',color:s.detected?'#16a34a':'#ef4444',fontWeight:600 }}>{s.detected?'ناجح':'ثغرة'}</span>
                  <span style={{ flex:1,color:C.text1 }}>{s.desc}</span>
                  <span style={{ fontSize:9,color:C.muted,fontFamily:'monospace' }}>{s.code}</span>
                  <span style={{ fontSize:9,padding:'1px 6px',borderRadius:10,background:(SEV_COLORS[s.risk]||SEV_COLORS.info).bg,color:(SEV_COLORS[s.risk]||SEV_COLORS.info).c,fontWeight:600 }}>{s.risk}</span>
                </div>
              ))}
            </>}
          </div>
        </div>

        {/* === ZONE 3 -- IT AGENT SIDEBAR === */}
        <div style={{ display:'flex',flexDirection:'column',borderRight:`1px solid ${C.border}` }}>
          {/* Header */}
          <div style={{ padding:'12px 14px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:8 }}>
            <span style={{ fontSize:18 }}>🛡️</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13,fontWeight:600,color:C.text1 }}>وكيل IT</div>
              <div style={{ fontSize:11,color:C.muted,fontWeight:500 }}>{agentTokens>0?`${agentTokens.toLocaleString()} رمز`:'جاهز'}</div>
            </div>
            <button onClick={agentClear} style={{ fontSize:9,padding:'3px 8px',borderRadius:10,border:`1px solid ${C.border}`,background:'transparent',color:C.text2,cursor:'pointer' }}>مسح</button>
          </div>
          {/* Quick actions */}
          <div style={{ padding:'8px 10px',display:'flex',flexWrap:'wrap',gap:4,borderBottom:`1px solid ${C.border}` }}>
            {['ما حالة النظام؟','حلل آخر خطأ حرج','من أكثر المستأجرين تأثراً؟','هل يوجد تهديد أمني؟'].map(q => (
              <button key={q} onClick={()=>agentSend(q)} style={{ fontSize:9,padding:'4px 8px',borderRadius:14,border:`1px solid ${C.border}`,background:'transparent',color:C.text2,cursor:'pointer' }}>{q}</button>
            ))}
          </div>
          {/* Messages */}
          <div ref={agentScrollRef} style={{ flex:1,overflowY:'auto',padding:'10px 12px',display:'flex',flexDirection:'column',gap:8 }}>
            {agentMsgs.length === 0 && <p style={{ textAlign:'center',color:C.muted,fontSize:11,paddingTop:40 }}>اسأل وكيل IT أي سؤال</p>}
            {agentMsgs.map((m,i) => (
              <div key={i} style={{ alignSelf:m.role==='user'?'flex-start':'flex-end',maxWidth:'90%',padding:'10px 14px',borderRadius:12,background:m.role==='user'?'#ede9fe':'#f8f7fc',border:`1px solid ${m.role==='user'?'rgba(124,92,252,.15)':'rgba(0,0,0,.06)'}`,fontSize:12,color:C.text1,lineHeight:1.7,whiteSpace:'pre-wrap',wordBreak:'break-word' }}>
                {m.content}
              </div>
            ))}
            {agentLoading && <div style={{ alignSelf:'flex-end',padding:'8px 12px',borderRadius:12,background:'#f8f7fc',border:`1px solid rgba(0,0,0,.06)` }}><span style={{ color:C.muted,fontSize:11 }}>...</span></div>}
          </div>
          {/* Input */}
          <div style={{ padding:'10px 12px',borderTop:`1px solid ${C.border}`,display:'flex',gap:6 }}>
            <input value={agentInput} onChange={e=>setAgentInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();agentSend();}}}
              placeholder="اسأل وكيل IT..." disabled={agentLoading}
              style={{ flex:1,padding:'8px 10px',borderRadius:10,border:`1px solid ${C.border}`,background:'#f8f7fc',color:C.text1,fontSize:11,outline:'none' }} />
            <button onClick={()=>agentSend()} disabled={agentLoading||!agentInput.trim()}
              style={{ padding:'8px 14px',borderRadius:10,border:'none',background:agentLoading||!agentInput.trim()?'#d1d5db':C.accent,color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600 }}>↑</button>
          </div>
        </div>
      </div>

      {/* Resolve modal */}
      {resModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.3)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center' }} onClick={()=>setResModal(null)}>
          <div style={{ background:'#fff',borderRadius:16,padding:24,width:380,border:'none',boxShadow:'0 20px 60px rgba(0,0,0,.12)' }} onClick={e=>e.stopPropagation()}>
            <p style={{ fontSize:13,fontWeight:600,color:C.text1,marginBottom:12 }}>حل المشكلة</p>
            <textarea value={resNote} onChange={e=>setResNote(e.target.value)} rows={3} placeholder="ملاحظة الحل (اختياري)..."
              style={{ width:'100%',padding:'8px 10px',borderRadius:10,border:`1px solid rgba(0,0,0,.08)`,background:'#f8f7fc',color:C.text1,fontSize:12,resize:'vertical',boxSizing:'border-box' }} />
            <div style={{ display:'flex',gap:8,marginTop:12 }}>
              <button onClick={()=>setResModal(null)} style={{ flex:1,padding:'8px',borderRadius:10,border:`1px solid ${C.border}`,background:'transparent',color:C.text2,cursor:'pointer',fontSize:12 }}>إلغاء</button>
              <button onClick={handleResolve} style={{ flex:2,padding:'8px',borderRadius:10,border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600 }}>تأكيد الحل</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
