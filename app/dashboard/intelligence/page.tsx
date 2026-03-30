'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type LogLevel    = 'debug'|'info'|'warning'|'error'|'critical';
type TenantStatus= 'healthy'|'degraded'|'warning'|'critical';

interface HealthData  { score:number; grade:string; status:string; api_status:string; active_companies:number; criticals_1h:number; errors_1h:number; errors_24h:number }
interface TimeBucket  { label:string; hour:string; warning:number; error:number; critical:number }
interface TenantH     { id:string; name:string; slug:string; plan:string; is_active:boolean; score:number; status:TenantStatus; errors_24h:number; warnings_24h:number; errors_7d:number }
interface TopError    { source:string; message:string; level:string; count:number; companies:number; last_seen:string }
interface SystemLog   { id:string; company_id:string|null; level:LogLevel; source:string; message:string; details:any; stack_trace?:string; status:string; created_at:string; ai_analyses?:AiAnalysis[]; _new?:boolean }
interface AiAnalysis  { root_cause:string; suggested_fix:string; severity_note:string; priority:string; confidence:number; created_at:string }
interface SecEvent    { id:string; event_type:string; description:string; ip_address:string; created_at:string }
interface ChatMsg     { role:'user'|'assistant'; content:string; ts:Date }

// ─── Config ───────────────────────────────────────────────────────────────────
const LVL = {
  critical:{ label:'حرج',    c:'#dc2626', bg:'#fef2f2', dot:'#dc2626' },
  error:   { label:'خطأ',    c:'#ea580c', bg:'#fff7ed', dot:'#ea580c' },
  warning: { label:'تحذير',  c:'#d97706', bg:'#fffbeb', dot:'#f59e0b' },
  info:    { label:'معلومة', c:'#2563eb', bg:'#eff6ff', dot:'#3b82f6' },
  debug:   { label:'تصحيح',  c:'#64748b', bg:'#f8fafc', dot:'#94a3b8' },
} as const;

const TS = {
  healthy:  { label:'سليم',          c:'#16a34a', bg:'#f0fdf4', bar:'#22c55e' },
  degraded: { label:'متدهور قليلاً', c:'#2563eb', bg:'#eff6ff', bar:'#3b82f6' },
  warning:  { label:'تحذير',         c:'#d97706', bg:'#fffbeb', bar:'#f59e0b' },
  critical: { label:'حرج',           c:'#dc2626', bg:'#fef2f2', bar:'#ef4444' },
} as const;

const PLAN: Record<string,string> = { enterprise:'مؤسسي', professional:'احترافي', basic:'أساسي', trial:'تجريبي' };

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimCounter({ value, color }: { value: number; color: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const diff = value - prev.current;
    const steps = 20;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplay(Math.round(prev.current + (diff * i) / steps));
      if (i >= steps) { clearInterval(id); prev.current = value; }
    }, 30);
    return () => clearInterval(id);
  }, [value]);
  return <span style={{ fontSize: 26, fontWeight: 700, color }}>{display}</span>;
}

// ─── SVG Timeline ─────────────────────────────────────────────────────────────
function TimelineChart({ data, selectedHour, onSelect }: { data: TimeBucket[]; selectedHour: string|null; onSelect: (h:string|null)=>void }) {
  const W = 740, H = 90;
  if (!data.length) return <div style={{ height:90, background:'#f8fafc', borderRadius:8 }} />;
  const maxVal = Math.max(...data.map(d => d.critical + d.error + d.warning), 1);
  const bw = (W - 8) / data.length - 2;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H+16}`} style={{ display:'block', cursor:'pointer' }}>
      {data.map((d, i) => {
        const x    = 4 + i * ((W-8)/data.length) + 1;
        const wH   = (d.warning  / maxVal) * H;
        const eH   = (d.error    / maxVal) * H;
        const cH   = (d.critical / maxVal) * H;
        const tot  = wH + eH + cH;
        const isSel = selectedHour === d.hour;
        const tot2 = d.warning + d.error + d.critical;
        return (
          <g key={i} onClick={() => onSelect(isSel ? null : d.hour)}>
            {isSel && <rect x={x-1} y={0} width={bw+2} height={H+2} fill="#1d407018" rx={2}/>}
            {tot === 0
              ? <rect x={x} y={H-3} width={bw} height={3} fill={isSel?'#94a3b8':'#e2e8f0'} rx={1}/>
              : <>
                  {wH>0 && <rect x={x} y={H-tot}        width={bw} height={wH} fill="#f59e0b" rx={1}/>}
                  {eH>0 && <rect x={x} y={H-tot+wH}     width={bw} height={eH} fill="#ef4444" rx={1}/>}
                  {cH>0 && <rect x={x} y={H-cH}          width={bw} height={cH} fill="#7f1212" rx={1}/>}
                </>
            }
            {tot2>0 && <title>{`${d.label} — ${tot2} حدث`}</title>}
            {i%3===0 && <text x={x+bw/2} y={H+14} fontSize={8} fill={isSel?'#1d4070':'#94a3b8'} textAnchor="middle" fontWeight={isSel?700:400}>{d.label}</text>}
            {isSel && tot2>0 && <text x={Math.min(x+bw/2, W-40)} y={9} fontSize={9} fill="#1d4070" textAnchor="middle" fontWeight={700}>{d.label} • {tot2}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Health Ring ──────────────────────────────────────────────────────────────
function HealthRing({ score, grade, status }: { score:number; grade:string; status:string }) {
  const r = 50, cx = 62, cy = 62, circ = 2*Math.PI*r;
  const fill  = circ - (score/100)*circ;
  const color = score>=90?'#16a34a':score>=75?'#2563eb':score>=50?'#d97706':'#dc2626';
  return (
    <svg width={124} height={124}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={9}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={9}
        strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} style={{ transition:'stroke-dashoffset 1s ease' }}/>
      <text x={cx} y={cy-6}  textAnchor="middle" fontSize={24} fontWeight={800} fill={color}>{score}</text>
      <text x={cx} y={cy+12} textAnchor="middle" fontSize={11} fill="#374151" fontWeight={600}>{grade}</text>
      <text x={cx} y={cy+26} textAnchor="middle" fontSize={9}  fill="#94a3b8">{status}</text>
    </svg>
  );
}

// ─── AI Chat Panel ────────────────────────────────────────────────────────────
function AiChatPanel({ onClose }: { onClose: ()=>void }) {
  const [msgs,    setMsgs]    = useState<ChatMsg[]>([{ role:'assistant', content:'مرحباً! أنا مساعدك الذكي لتشخيص النظام.\n\nلدي اطلاع كامل على سجلات النظام وحالة كل شركة الآن. اسألني مثلاً:\n• ما سبب الأخطاء المتكررة في المدفوعات؟\n• أي شركة تعاني أكثر اليوم؟\n• كيف أصلح خطأ foreign key في العقود؟\n• ما خطوات رفع درجة الصحة؟', ts:new Date() }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const quickQ = ['ما أخطر المشاكل الحالية؟','لماذا تفشل العقود؟','أي شركة تعاني أكثر؟','كيف أرفع درجة الصحة؟'];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [msgs]);

  async function send(text?: string) {
    const q = (text||input).trim();
    if (!q||loading) return;
    setInput('');
    setMsgs(prev => [...prev, { role:'user', content:q, ts:new Date() }]);
    setLoading(true);
    try {
      const history = msgs.slice(-6).map(m => ({ role:m.role, content:m.content }));
      const res: any = await adminApi.aiChat(q, history);
      setMsgs(prev => [...prev, { role:'assistant', content:res.data.reply, ts:new Date() }]);
    } catch (e: any) {
      setMsgs(prev => [...prev, { role:'assistant', content:`⚠️ خطأ: ${e.message}`, ts:new Date() }]);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ position:'fixed', left:20, bottom:20, width:400, height:560, background:'white', borderRadius:16, boxShadow:'0 8px 40px rgba(0,0,0,.2)', display:'flex', flexDirection:'column', zIndex:200, border:'1px solid #e2e8f0', overflow:'hidden' }}>
      <div style={{ background:'linear-gradient(135deg,#7c3aed,#6d28d9)', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>🧠</span>
          <div>
            <p style={{ fontSize:13, fontWeight:700, color:'white', margin:0 }}>مساعد التشخيص الذكي</p>
            <p style={{ fontSize:9, color:'#ddd6fe', margin:0 }}>Claude claude-sonnet-4-6 + بيانات النظام المباشرة</p>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'white', borderRadius:6, width:26, height:26, cursor:'pointer', fontSize:14 }}>✕</button>
      </div>
      <div style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', display:'flex', gap:4, flexWrap:'wrap' }}>
        {quickQ.map(q => (
          <button key={q} onClick={() => send(q)} style={{ fontSize:10, padding:'3px 8px', borderRadius:20, border:'1px solid #e9d5ff', background:'#faf5ff', color:'#7c3aed', cursor:'pointer', whiteSpace:'nowrap' }}>{q}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
        {msgs.map((m,i) => (
          <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            <div style={{ maxWidth:'85%', padding:'9px 12px', borderRadius:m.role==='user'?'12px 12px 2px 12px':'12px 12px 12px 2px', background:m.role==='user'?'linear-gradient(135deg,#1d4070,#2563eb)':'#f8fafc', color:m.role==='user'?'white':'#374151', fontSize:12, lineHeight:1.6, whiteSpace:'pre-wrap', border:m.role==='assistant'?'1px solid #e2e8f0':'none' }}>
              {m.content}
              <div style={{ fontSize:9, color:m.role==='user'?'rgba(255,255,255,.6)':'#94a3b8', marginTop:4 }}>{m.ts.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', gap:4, padding:'8px 12px' }}>
            {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'#7c3aed', animation:`bounce 1s ${i*.2}s infinite` }}/>)}
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div style={{ padding:'10px 12px', borderTop:'1px solid #e2e8f0', display:'flex', gap:8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter'&&!e.shiftKey&&send()}
          placeholder="اسأل عن أي مشكلة في النظام..."
          style={{ flex:1, padding:'8px 12px', fontSize:12, borderRadius:8, border:'1px solid #e2e8f0', outline:'none' }} disabled={loading}/>
        <button onClick={() => send()} disabled={loading||!input.trim()}
          style={{ padding:'8px 14px', borderRadius:8, background:input.trim()?'linear-gradient(135deg,#7c3aed,#6d28d9)':'#e2e8f0', color:input.trim()?'white':'#94a3b8', border:'none', cursor:input.trim()?'pointer':'not-allowed', fontSize:14 }}>↑</button>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function IntelligencePage() {
  const router = useRouter();
  const [health,    setHealth]    = useState<HealthData|null>(null);
  const [timeline,  setTimeline]  = useState<TimeBucket[]>([]);
  const [tenants,   setTenants]   = useState<TenantH[]>([]);
  const [topErr,    setTopErr]    = useState<TopError[]>([]);
  const [logs,      setLogs]      = useState<SystemLog[]>([]);
  const [logCount,  setLogCount]  = useState(0);
  const [secFeed,   setSecFeed]   = useState<SecEvent[]>([]);
  const [summary,   setSummary]   = useState<any>(null);
  const [alerts,    setAlerts]    = useState<any[]>([]);
  const [tab,          setTab]         = useState<'overview'|'logs'|'tenants'|'top-errors'|'security'|'alerts'>('overview');
  const [filterLevel,  setFilterLevel] = useState('');
  const [filterStatus, setFilterStatus]= useState('open');
  const [filterTenant, setFilterTenant]= useState<string|null>(null);
  const [selectedHour, setSelectedHour]= useState<string|null>(null);
  const [selectedLog,  setSelectedLog] = useState<SystemLog|null>(null);
  const [logPage,      setLogPage]     = useState(0);
  const [analyzing,    setAnalyzing]   = useState<string|null>(null);
  const [resolveModal, setResolveModal]= useState(false);
  const [resNote,      setResNote]     = useState('');
  const [showChat,     setShowChat]    = useState(false);
  const [sseStatus,    setSseStatus]   = useState<'connecting'|'live'|'disconnected'>('connecting');
  const [newLogCount,  setNewLogCount] = useState(0);
  const [loadError,    setLoadError]   = useState('');
  const [loading,      setLoading]     = useState(true);
  const [lastRefresh,  setLastRefresh] = useState(new Date());
  const LIMIT = 25;

  const loadOverview = useCallback(async (silent=false) => {
    try {
      if (!silent) setLoadError('');
      const [h,t,ten,te,sum] = await Promise.all([
        adminApi.getHealthScore(), adminApi.getTimeline(), adminApi.getTenantHealth(),
        adminApi.getTopErrors(), adminApi.intelligenceSummary(),
      ]);
      setHealth((h as any).data); setTimeline((t as any).data||[]); setTenants((ten as any).data||[]);
      setTopErr((te as any).data||[]); setSummary((sum as any).data); setLastRefresh(new Date());
    } catch (e: any) {
      const msg = e?.message||'';
      if (msg.includes('401')||msg.toLowerCase().includes('unauthorized')) router.push('/login');
      else if (!silent) setLoadError(msg);
    }
  }, [router]);

  const loadLogs = useCallback(async () => {
    try {
      const p: Record<string,string> = { limit:String(LIMIT), offset:String(logPage*LIMIT) };
      if (filterLevel)  p.level      = filterLevel;
      if (filterStatus) p.status     = filterStatus;
      if (filterTenant) p.company_id = filterTenant;
      const r = await adminApi.listLogs(p);
      setLogs((r as any).data||[]); setLogCount((r as any).count||0); setNewLogCount(0);
    } catch {}
  }, [filterLevel, filterStatus, filterTenant, logPage]);

  // SSE real-time connection
  useEffect(() => {
    const BASE = process.env.NEXT_PUBLIC_API_URL||'https://liv-entra-api-production.up.railway.app/api/v1';
    const url = `${BASE}/admin/intelligence/stream`;
    let es: EventSource, retryT: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource(url);
      es.onopen = () => setSseStatus('live');
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          if (ev.type === 'new_log') {
            const log: SystemLog = { ...ev.data, _new:true };
            setLogs(prev => [log, ...prev.slice(0, LIMIT-1)]);
            setLogCount(p => p+1);
            setNewLogCount(p => p+1);
            if (log.level==='critical'||log.level==='error') {
              setHealth(prev => prev ? { ...prev,
                errors_1h:    prev.errors_1h    + (log.level==='error'?1:0),
                criticals_1h: prev.criticals_1h + (log.level==='critical'?1:0),
                errors_24h:   prev.errors_24h   + 1,
                score: Math.max(0, prev.score - (log.level==='critical'?15:5)),
              } : prev);
              setTimeline(prev => {
                const now = new Date(); now.setMinutes(0,0,0);
                return prev.map(b => b.hour===now.toISOString() ? { ...b, [log.level]:(b[log.level as 'error'|'warning'|'critical']||0)+1 } : b);
              });
            }
          }
          if (ev.type==='analysis_complete') {
            setLogs(prev => prev.map(l => l.id===ev.log_id ? { ...l, ai_analyses:[ev.analysis] } : l));
            setSelectedLog(prev => (prev && prev.id===ev.log_id) ? { ...prev, ai_analyses:[ev.analysis] } : prev);
          }
        } catch {}
      };
      es.onerror = () => { setSseStatus('disconnected'); es.close(); retryT = setTimeout(connect, 5000); };
    }
    connect();
    return () => { es?.close(); clearTimeout(retryT); };
  }, []); // eslint-disable-line

  useEffect(() => { if (!localStorage.getItem('admin_token')) { router.push('/login'); return; } loadOverview().finally(() => setLoading(false)); }, [loadOverview, router]);
  useEffect(() => { if (tab==='logs')     loadLogs(); }, [tab, filterLevel, filterStatus, filterTenant, logPage, loadLogs]);
  useEffect(() => { if (tab==='security') adminApi.getSecurityFeed().then(r => setSecFeed((r as any).data||[])).catch(()=>{}); }, [tab]);
  useEffect(() => { if (tab==='alerts')   adminApi.listAlerts().then(r => setAlerts((r as any).data||[])).catch(()=>{}); }, [tab]);
  useEffect(() => { const id = setInterval(()=>loadOverview(true), 60_000); return ()=>clearInterval(id); }, [loadOverview]);

  function handleHourSelect(hour: string|null) { setSelectedHour(hour); if (hour) { setTab('logs'); setLogPage(0); } }
  function handleTenantClick(id: string)       { setFilterTenant(prev => prev===id?null:id); setTab('logs'); setLogPage(0); }

  async function handleAnalyze(log: SystemLog) {
    setAnalyzing(log.id);
    try {
      const res: any = await adminApi.analyzeLog(log.id);
      const upd = { ...log, ai_analyses:[res.data] };
      setLogs(prev => prev.map(l => l.id===log.id ? upd : l));
      if (selectedLog?.id===log.id) setSelectedLog(upd);
    } catch (e: any) { alert(e.message); }
    finally { setAnalyzing(null); }
  }
  async function handleResolve() {
    if (!selectedLog) return;
    try { await adminApi.resolveLog(selectedLog.id, resNote); setLogs(prev=>prev.map(l=>l.id===selectedLog.id?{...l,status:'resolved'}:l)); setSelectedLog(p=>p?{...p,status:'resolved'}:p); setResolveModal(false); setResNote(''); } catch (e:any){alert(e.message);}
  }
  async function handleIgnore(log: SystemLog) {
    try { await adminApi.ignoreLog(log.id); setLogs(prev=>prev.map(l=>l.id===log.id?{...l,status:'ignored'}:l)); if(selectedLog?.id===log.id)setSelectedLog(null); } catch{}
  }

  const activeTenantName = filterTenant ? tenants.find(t=>t.id===filterTenant)?.name : null;

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12 }}>
      <div style={{ width:44,height:44,border:'3px solid #e2e8f0',borderTopColor:'#1d4070',borderRadius:'50%',animation:'spin 1s linear infinite' }}/>
      <p style={{ color:'#94a3b8',fontSize:13 }}>جاري تحميل مركز التحكم...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes flash{0%{background:#fef9c3}100%{background:white}}`}</style>
    </div>
  );

  const tabs = [
    { id:'overview',   label:'نظرة عامة',     icon:'📊' },
    { id:'logs',       label:'السجلات',        icon:'📋', badge:newLogCount>0?newLogCount:null },
    { id:'tenants',    label:'صحة المستأجرين', icon:'🏢' },
    { id:'top-errors', label:'أكثر الأخطاء',  icon:'🔥' },
    { id:'security',   label:'الأمان',         icon:'🔐' },
    { id:'alerts',     label:'التنبيهات',      icon:'📱' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#f0f4f8' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes flash{0%{background:#fef9c3}100%{background:white}}@keyframes slideIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}.rh:hover{background:#f8fafc!important}.ch:hover{transform:translateY(-2px);box-shadow:0 4px 20px rgba(0,0,0,.1)!important}.lnew{animation:flash 4s ease forwards}`}</style>

      {/* Nav */}
      <div style={{ background:'linear-gradient(135deg,#0f2040,#1d4070)',padding:'0 20px',display:'flex',alignItems:'center',justifyContent:'space-between',height:50,boxShadow:'0 2px 12px rgba(0,0,0,.3)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:14 }}>
          <Link href="/dashboard" style={{ color:'#93c5fd',textDecoration:'none',fontSize:12 }}>← الرئيسية</Link>
          <div style={{ width:1,height:18,background:'rgba(255,255,255,.2)' }}/>
          <span style={{ fontSize:14 }}>🧠</span>
          <span style={{ fontSize:13,fontWeight:700,color:'white' }}>مركز ذكاء النظام</span>
          <div style={{ display:'flex',alignItems:'center',gap:5,padding:'3px 9px',borderRadius:20,background:'rgba(255,255,255,.08)' }}>
            <div style={{ width:6,height:6,borderRadius:'50%',background:sseStatus==='live'?'#22c55e':sseStatus==='connecting'?'#f59e0b':'#ef4444',animation:sseStatus==='live'?'bounce 2s infinite':'none' }}/>
            <span style={{ fontSize:10,color:sseStatus==='live'?'#86efac':sseStatus==='connecting'?'#fde68a':'#fca5a5' }}>{sseStatus==='live'?'مباشر':sseStatus==='connecting'?'يتصل...':'منقطع'}</span>
          </div>
        </div>
        <div style={{ display:'flex',gap:10,alignItems:'center' }}>
          <span style={{ fontSize:10,color:'#64748b' }}>{lastRefresh.toLocaleTimeString('ar-SA')}</span>
          <button onClick={()=>setShowChat(p=>!p)} style={{ fontSize:12,padding:'5px 14px',borderRadius:8,background:showChat?'#7c3aed':'rgba(124,58,237,.3)',color:'white',border:'1px solid rgba(124,58,237,.5)',cursor:'pointer',fontWeight:600 }}>🧠 مساعد AI</button>
          <button onClick={()=>loadOverview()} style={{ fontSize:11,padding:'4px 10px',borderRadius:6,background:'rgba(255,255,255,.1)',color:'white',border:'1px solid rgba(255,255,255,.2)',cursor:'pointer' }}>↻</button>
          <button onClick={()=>{localStorage.clear();router.push('/login');}} style={{ fontSize:11,padding:'4px 10px',borderRadius:6,background:'rgba(220,38,38,.25)',color:'#fca5a5',border:'1px solid rgba(220,38,38,.3)',cursor:'pointer' }}>خروج</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background:'white',borderBottom:'2px solid #e2e8f0',padding:'0 20px',display:'flex',gap:2 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id as any)}
            style={{ padding:'10px 14px',fontSize:12,fontWeight:tab===t.id?700:400,color:tab===t.id?'#1d4070':'#64748b',background:'none',border:'none',cursor:'pointer',borderBottom:tab===t.id?'2px solid #1d4070':'2px solid transparent',marginBottom:-2,display:'flex',alignItems:'center',gap:5,position:'relative' }}>
            {t.icon} {t.label}
            {(t as any).badge && <span style={{ position:'absolute',top:6,right:2,fontSize:9,fontWeight:700,padding:'1px 4px',borderRadius:10,background:'#dc2626',color:'white',minWidth:14,textAlign:'center',animation:'slideIn .3s ease' }}>{(t as any).badge}</span>}
          </button>
        ))}
        {(activeTenantName||selectedHour) && (
          <div style={{ display:'flex',alignItems:'center',gap:6,marginRight:'auto',paddingRight:8 }}>
            {activeTenantName && <span style={{ fontSize:11,padding:'3px 10px',borderRadius:20,background:'#eff6ff',color:'#1d4070',display:'flex',alignItems:'center',gap:4 }}>🏢 {activeTenantName}<button onClick={()=>setFilterTenant(null)} style={{ background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:12,padding:0 }}>✕</button></span>}
            {selectedHour && <span style={{ fontSize:11,padding:'3px 10px',borderRadius:20,background:'#fef9c3',color:'#92400e',display:'flex',alignItems:'center',gap:4 }}>🕐 {new Date(selectedHour).getHours()}:00<button onClick={()=>setSelectedHour(null)} style={{ background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:12,padding:0 }}>✕</button></span>}
          </div>
        )}
      </div>

      <div style={{ padding:16 }}>
        {loadError && (
          <div style={{ background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'10px 16px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <p style={{ fontSize:12,color:'#dc2626',margin:0 }}>⚠️ {loadError}</p>
            <button onClick={()=>loadOverview()} style={{ fontSize:11,padding:'4px 10px',borderRadius:6,background:'#dc2626',color:'white',border:'none',cursor:'pointer' }}>إعادة المحاولة</button>
          </div>
        )}

        {/* OVERVIEW */}
        {tab==='overview' && (
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
            <div style={{ display:'grid',gridTemplateColumns:'140px 1fr 200px',gap:14 }}>
              <div style={{ background:'white',borderRadius:14,padding:16,border:'1px solid #e2e8f0',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
                <p style={{ fontSize:10,fontWeight:700,color:'#64748b',margin:'0 0 6px',textTransform:'uppercase',letterSpacing:'.5px' }}>صحة النظام</p>
                {health ? <HealthRing score={health.score} grade={health.grade} status={health.status}/> : <div style={{ width:124,height:124,borderRadius:'50%',background:'#f8fafc' }}/>}
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10 }}>
                {health && ([
                  { l:'حرج (ساعة)',      v:health.criticals_1h,    c:'#dc2626', bg:'#fef2f2', icon:'🚨' },
                  { l:'أخطاء (ساعة)',    v:health.errors_1h,       c:'#ea580c', bg:'#fff7ed', icon:'❌' },
                  { l:'أخطاء (24 ساعة)',v:health.errors_24h,      c:'#d97706', bg:'#fffbeb', icon:'⚠️' },
                  { l:'شركات نشطة',      v:health.active_companies,c:'#16a34a', bg:'#f0fdf4', icon:'🏢' },
                  { l:'تنبيهات مُرسلة', v:summary?.alerts_24h||0, c:'#7c3aed', bg:'#faf5ff', icon:'📱' },
                  { l:'إجمالي 7 أيام',  v:summary?.total_7d||0,   c:'#2563eb', bg:'#eff6ff', icon:'📊' },
                ] as any[]).map((k:any) => (
                  <div key={k.l} style={{ background:k.bg,borderRadius:10,padding:'10px 14px',border:`1px solid ${k.c}25`,display:'flex',justifyContent:'space-between',alignItems:'center',transition:'transform .2s',cursor:'default' }} className="ch">
                    <div><p style={{ fontSize:10,color:'#64748b',margin:'0 0 2px' }}>{k.l}</p><AnimCounter value={k.v} color={k.c}/></div>
                    <span style={{ fontSize:22 }}>{k.icon}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:'white',borderRadius:14,padding:14,border:'1px solid #e2e8f0' }}>
                <p style={{ fontSize:10,fontWeight:700,color:'#374151',margin:'0 0 12px',textTransform:'uppercase',letterSpacing:'.4px' }}>البنية التحتية</p>
                {[
                  { l:'Backend API',s:health?.api_status==='online',icon:'⚙️' },
                  { l:'Supabase DB',s:true,                          icon:'🗄️' },
                  { l:'Vercel',     s:true,                          icon:'🌐' },
                  { l:'Railway',    s:health?.api_status==='online', icon:'🚂' },
                  { l:'SSE Stream', s:sseStatus==='live',            icon:'📡' },
                ].map(item => (
                  <div key={item.l} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:9 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:6 }}><span style={{ fontSize:12 }}>{item.icon}</span><span style={{ fontSize:11,color:'#374151' }}>{item.l}</span></div>
                    <div style={{ display:'flex',alignItems:'center',gap:4 }}>
                      <div style={{ width:6,height:6,borderRadius:'50%',background:item.s?'#22c55e':'#ef4444',animation:item.s?'bounce 2s infinite':'none' }}/>
                      <span style={{ fontSize:10,color:item.s?'#16a34a':'#dc2626',fontWeight:600 }}>{item.s?'يعمل':'متوقف'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background:'white',borderRadius:14,padding:16,border:'1px solid #e2e8f0' }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
                <div>
                  <p style={{ fontSize:13,fontWeight:700,color:'#374151',margin:0 }}>توزيع الأحداث — آخر 24 ساعة</p>
                  <p style={{ fontSize:10,color:'#94a3b8',margin:'2px 0 0' }}>اضغط على أي عمود لتصفية السجلات حسب الساعة</p>
                </div>
                <div style={{ display:'flex',gap:10,alignItems:'center' }}>
                  {([['#f59e0b','تحذير'],['#ef4444','خطأ'],['#7f1212','حرج']] as [string,string][]).map(([c,l])=>(
                    <div key={l} style={{ display:'flex',alignItems:'center',gap:4 }}><div style={{ width:10,height:10,borderRadius:2,background:c }}/><span style={{ fontSize:10,color:'#64748b' }}>{l}</span></div>
                  ))}
                  {selectedHour && <button onClick={()=>setSelectedHour(null)} style={{ fontSize:10,padding:'2px 8px',borderRadius:20,background:'#fef9c3',color:'#92400e',border:'none',cursor:'pointer' }}>إلغاء ✕</button>}
                </div>
              </div>
              <TimelineChart data={timeline} selectedHour={selectedHour} onSelect={handleHourSelect}/>
            </div>

            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
              <div style={{ background:'white',borderRadius:14,border:'1px solid #e2e8f0',overflow:'hidden' }}>
                <div style={{ padding:'11px 16px',borderBottom:'1px solid #f1f5f9',background:'#fef2f2',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <span style={{ fontSize:12,fontWeight:700,color:'#dc2626' }}>🚨 أحداث حرجة مفتوحة</span>
                  <button onClick={()=>setTab('logs')} style={{ fontSize:10,color:'#dc2626',background:'none',border:'none',cursor:'pointer',textDecoration:'underline' }}>عرض الكل</button>
                </div>
                {!(summary?.open_criticals?.length) ? <p style={{ padding:'20px 16px',textAlign:'center',color:'#94a3b8',fontSize:12 }}>✅ لا توجد أحداث حرجة</p>
                  : (summary.open_criticals as any[]).map((c:any)=>(
                    <div key={c.id} className="rh" style={{ padding:'9px 16px',borderBottom:'1px solid #f9fafb',cursor:'pointer' }} onClick={()=>setTab('logs')}>
                      <div style={{ display:'flex',justifyContent:'space-between' }}><span style={{ fontSize:10,color:'#94a3b8',fontFamily:'monospace' }}>{c.source}</span><span style={{ fontSize:9,color:'#94a3b8' }}>{new Date(c.created_at).toLocaleTimeString('ar-SA')}</span></div>
                      <p style={{ fontSize:11,color:'#374151',margin:'2px 0 0' }}>{c.message.slice(0,90)}</p>
                    </div>
                  ))
                }
              </div>
              <div style={{ background:'white',borderRadius:14,border:'1px solid #e2e8f0',overflow:'hidden' }}>
                <div style={{ padding:'11px 16px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <span style={{ fontSize:12,fontWeight:700,color:'#374151' }}>🏢 أكثر الشركات مشاكل</span>
                  <button onClick={()=>setTab('tenants')} style={{ fontSize:10,color:'#1d4070',background:'none',border:'none',cursor:'pointer',textDecoration:'underline' }}>عرض الكل</button>
                </div>
                {tenants.slice(0,5).map(t=>{
                  const sc=TS[t.status]||TS.healthy;
                  return (
                    <div key={t.id} className="rh" style={{ padding:'9px 16px',borderBottom:'1px solid #f9fafb',cursor:'pointer',display:'flex',alignItems:'center',gap:10 }} onClick={()=>handleTenantClick(t.id)}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:3 }}><span style={{ fontSize:11,fontWeight:500,color:'#374151' }}>{t.name}</span><span style={{ fontSize:9,padding:'1px 5px',borderRadius:3,background:sc.bg,color:sc.c,fontWeight:600 }}>{sc.label}</span></div>
                        <div style={{ height:4,background:'#f1f5f9',borderRadius:2,overflow:'hidden' }}><div style={{ height:'100%',width:`${t.score}%`,background:sc.bar,borderRadius:2,transition:'width .6s ease' }}/></div>
                      </div>
                      <span style={{ fontSize:14,fontWeight:800,color:sc.c }}>{t.score}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background:'white',borderRadius:14,border:'1px solid #e2e8f0',overflow:'hidden' }}>
              <div style={{ padding:'11px 16px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                <span style={{ fontSize:12,fontWeight:700,color:'#374151' }}>🔥 أكثر الأخطاء تكراراً (7 أيام)</span>
                <button onClick={()=>setTab('top-errors')} style={{ fontSize:10,color:'#1d4070',background:'none',border:'none',cursor:'pointer',textDecoration:'underline' }}>عرض الكل</button>
              </div>
              <table style={{ width:'100%',borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#f8fafc' }}>{['المصدر','الخطأ','التكرار','الشركات','آخر ظهور'].map(h=><th key={h} style={{ padding:'7px 14px',textAlign:'right',fontSize:10,fontWeight:600,color:'#64748b',borderBottom:'1px solid #e2e8f0' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {topErr.slice(0,5).map((e,i)=>{
                    const lc=LVL[e.level as LogLevel]||LVL.error;
                    return <tr key={i} className="rh" style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'9px 14px' }}><span style={{ fontSize:10,fontFamily:'monospace',color:'#1d4070' }}>{e.source}</span></td>
                      <td style={{ padding:'9px 14px',maxWidth:260 }}><p style={{ fontSize:11,color:'#374151',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{e.message}</p></td>
                      <td style={{ padding:'9px 14px' }}><span style={{ fontSize:12,fontWeight:700,padding:'2px 8px',borderRadius:5,background:lc.bg,color:lc.c }}>{e.count}</span></td>
                      <td style={{ padding:'9px 14px',fontSize:11,color:'#64748b' }}>{e.companies}</td>
                      <td style={{ padding:'9px 14px',fontSize:10,color:'#94a3b8' }}>{new Date(e.last_seen).toLocaleDateString('ar-SA')}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOGS */}
        {tab==='logs' && (
          <div style={{ display:'grid',gridTemplateColumns:selectedLog?'1fr 400px':'1fr',gap:14 }}>
            <div>
              <div style={{ display:'flex',gap:8,marginBottom:10,flexWrap:'wrap',alignItems:'center' }}>
                <select value={filterLevel} onChange={e=>{setFilterLevel(e.target.value);setLogPage(0);}} style={{ fontSize:12,padding:'6px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'white',cursor:'pointer' }}>
                  <option value="">كل المستويات</option>
                  {Object.entries(LVL).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);setLogPage(0);}} style={{ fontSize:12,padding:'6px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'white',cursor:'pointer' }}>
                  <option value="">كل الحالات</option>
                  {[['open','مفتوح'],['resolved','محلول'],['ignored','مهمل']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
                <span style={{ fontSize:11,color:'#94a3b8' }}>{logCount} سجل</span>
                <button onClick={loadLogs} style={{ fontSize:11,padding:'5px 10px',borderRadius:6,background:'#1d4070',color:'white',border:'none',cursor:'pointer',marginRight:'auto' }}>↻ تحديث</button>
              </div>
              <div style={{ background:'white',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden' }}>
                {logs.length===0 ? <p style={{ padding:28,textAlign:'center',color:'#94a3b8',fontSize:12 }}>لا توجد سجلات</p>
                  : logs.map((log,i)=>{
                    const lc=LVL[log.level]||LVL.info;
                    const isSel=selectedLog?.id===log.id;
                    return (
                      <div key={log.id} onClick={()=>setSelectedLog(isSel?null:log)} className={`rh${log._new?' lnew':''}`}
                        style={{ padding:'10px 16px',borderBottom:i<logs.length-1?'1px solid #f1f5f9':'none',cursor:'pointer',background:isSel?'#eff6ff':'white',opacity:log.status==='ignored'?.45:1,transition:'background .15s' }}>
                        <div style={{ display:'flex',alignItems:'flex-start',gap:10 }}>
                          <div style={{ width:7,height:7,borderRadius:'50%',background:lc.dot,marginTop:5,flexShrink:0 }}/>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ display:'flex',gap:5,marginBottom:2,flexWrap:'wrap',alignItems:'center' }}>
                              <span style={{ fontSize:10,fontWeight:700,padding:'1px 5px',borderRadius:3,background:lc.bg,color:lc.c }}>{lc.label}</span>
                              <span style={{ fontSize:10,color:'#94a3b8',fontFamily:'monospace' }}>{log.source}</span>
                              {log.status==='resolved'&&<span style={{ fontSize:9,padding:'1px 5px',borderRadius:3,background:'#f0fdf4',color:'#16a34a' }}>✓ محلول</span>}
                              {(log.ai_analyses?.length||0)>0&&<span style={{ fontSize:9,padding:'1px 5px',borderRadius:3,background:'#faf5ff',color:'#7c3aed' }}>🧠</span>}
                              {log._new&&<span style={{ fontSize:9,padding:'1px 5px',borderRadius:3,background:'#fef9c3',color:'#92400e',fontWeight:700 }}>جديد</span>}
                              {analyzing===log.id&&<span style={{ fontSize:9,color:'#7c3aed' }}>يحلّل...</span>}
                            </div>
                            <p style={{ fontSize:11,color:'#374151',margin:'0 0 3px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{log.message}</p>
                            <span style={{ fontSize:10,color:'#94a3b8' }}>{new Date(log.created_at).toLocaleString('ar-SA')}</span>
                          </div>
                          <div style={{ display:'flex',gap:3,flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                            {log.status==='open'&&!(log.ai_analyses?.length)&&(
                              <button onClick={()=>handleAnalyze(log)} disabled={!!analyzing} style={{ fontSize:10,padding:'3px 7px',borderRadius:4,background:'#faf5ff',color:'#7c3aed',border:'1px solid #e9d5ff',cursor:'pointer' }}>
                                {analyzing===log.id?'...':'🧠'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
              {logCount>LIMIT && (
                <div style={{ display:'flex',gap:8,justifyContent:'center',marginTop:10 }}>
                  <button onClick={()=>setLogPage(p=>Math.max(0,p-1))} disabled={logPage===0} style={{ fontSize:11,padding:'5px 12px',borderRadius:6,border:'1px solid #e2e8f0',background:'white',cursor:logPage===0?'not-allowed':'pointer',color:logPage===0?'#cbd5e1':'#374151' }}>السابق</button>
                  <span style={{ fontSize:11,color:'#64748b',padding:'5px 6px' }}>{logPage+1}/{Math.ceil(logCount/LIMIT)}</span>
                  <button onClick={()=>setLogPage(p=>p+1)} disabled={(logPage+1)*LIMIT>=logCount} style={{ fontSize:11,padding:'5px 12px',borderRadius:6,border:'1px solid #e2e8f0',background:'white',cursor:(logPage+1)*LIMIT>=logCount?'not-allowed':'pointer',color:(logPage+1)*LIMIT>=logCount?'#cbd5e1':'#374151' }}>التالي</button>
                </div>
              )}
            </div>

            {selectedLog&&(()=>{
              const lc=LVL[selectedLog.level]||LVL.info;
              const ai=selectedLog.ai_analyses?.[0];
              return (
                <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                  <div style={{ background:'white',borderRadius:12,border:'1px solid #e2e8f0',padding:16 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:10 }}>
                      <span style={{ fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:5,background:lc.bg,color:lc.c }}>{lc.label}</span>
                      <button onClick={()=>setSelectedLog(null)} style={{ fontSize:15,background:'none',border:'none',cursor:'pointer',color:'#94a3b8' }}>✕</button>
                    </div>
                    <p style={{ fontSize:11,fontWeight:600,color:'#374151',marginBottom:4,fontFamily:'monospace' }}>{selectedLog.source}</p>
                    <p style={{ fontSize:12,color:'#374151',lineHeight:1.6,marginBottom:6 }}>{selectedLog.message}</p>
                    {selectedLog.stack_trace&&<details style={{ marginBottom:6 }}><summary style={{ fontSize:11,color:'#94a3b8',cursor:'pointer' }}>Stack Trace</summary><pre style={{ fontSize:9,color:'#374151',background:'#f8fafc',padding:8,borderRadius:6,overflow:'auto',marginTop:4,maxHeight:130 }}>{selectedLog.stack_trace}</pre></details>}
                    <p style={{ fontSize:10,color:'#94a3b8',margin:'6px 0 0' }}>{new Date(selectedLog.created_at).toLocaleString('ar-SA')}</p>
                    {selectedLog.status==='open'&&(
                      <div style={{ display:'flex',gap:6,marginTop:10 }}>
                        <button onClick={()=>handleAnalyze(selectedLog)} disabled={!!analyzing} style={{ flex:1,fontSize:11,padding:'7px 0',borderRadius:7,background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'white',border:'none',cursor:'pointer',fontWeight:600 }}>{analyzing===selectedLog.id?'⏳ يحلّل...':'🧠 تحليل AI'}</button>
                        <button onClick={()=>setResolveModal(true)} style={{ fontSize:11,padding:'7px 10px',borderRadius:7,background:'#f0fdf4',color:'#16a34a',border:'1px solid #bbf7d0',cursor:'pointer' }}>✓</button>
                        <button onClick={()=>handleIgnore(selectedLog)} style={{ fontSize:11,padding:'7px 10px',borderRadius:7,background:'#f8fafc',color:'#94a3b8',border:'1px solid #e2e8f0',cursor:'pointer' }}>–</button>
                      </div>
                    )}
                  </div>
                  {ai ? (
                    <div style={{ background:'linear-gradient(135deg,#faf5ff,#f5f3ff)',borderRadius:12,border:'1px solid #ddd6fe',padding:16 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:10 }}>
                        <span style={{ fontSize:14 }}>🧠</span>
                        <span style={{ fontSize:12,fontWeight:700,color:'#7c3aed' }}>تحليل الذكاء الاصطناعي</span>
                        <span style={{ fontSize:9,padding:'1px 5px',borderRadius:3,background:'#ede9fe',color:'#7c3aed' }}>{ai.confidence}%</span>
                        <span style={{ fontSize:9,padding:'1px 5px',borderRadius:3,background:ai.priority==='critical'?'#fef2f2':ai.priority==='high'?'#fff7ed':'#fffbeb',color:ai.priority==='critical'?'#dc2626':ai.priority==='high'?'#ea580c':'#d97706',fontWeight:700 }}>{ai.priority}</span>
                      </div>
                      <p style={{ fontSize:10,fontWeight:700,color:'#6d28d9',margin:'0 0 3px' }}>السبب الجذري</p>
                      <p style={{ fontSize:11,color:'#374151',margin:'0 0 10px',lineHeight:1.5 }}>{ai.root_cause}</p>
                      <p style={{ fontSize:10,fontWeight:700,color:'#6d28d9',margin:'0 0 3px' }}>الإصلاح المقترح</p>
                      <p style={{ fontSize:11,color:'#374151',margin:0,lineHeight:1.5 }}>{ai.suggested_fix}</p>
                      {ai.severity_note&&<p style={{ fontSize:10,color:'#6d28d9',margin:'8px 0 0',background:'rgba(124,58,237,.07)',padding:'6px 8px',borderRadius:5 }}>{ai.severity_note}</p>}
                    </div>
                  ) : (
                    <div style={{ background:'white',borderRadius:12,border:'1px dashed #e9d5ff',padding:20,textAlign:'center' }}>
                      <p style={{ fontSize:18,margin:'0 0 4px' }}>🧠</p>
                      <p style={{ fontSize:11,color:'#94a3b8',margin:0 }}>اضغط "تحليل AI" لتشغيل Claude</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* TENANTS */}
        {tab==='tenants' && (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12 }}>
            {tenants.map(t=>{
              const sc=TS[t.status]||TS.healthy;
              const isActive=filterTenant===t.id;
              return (
                <div key={t.id} onClick={()=>handleTenantClick(t.id)} className="ch"
                  style={{ background:'white',borderRadius:14,border:`2px solid ${isActive?sc.c:sc.c+'30'}`,padding:16,cursor:'pointer',transition:'transform .2s,box-shadow .2s',boxShadow:isActive?`0 0 0 3px ${sc.c}30`:'0 1px 4px rgba(0,0,0,.06)' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:10 }}>
                    <div><p style={{ fontSize:13,fontWeight:700,color:'#374151',margin:'0 0 3px' }}>{t.name}</p><p style={{ fontSize:10,color:'#94a3b8',margin:0 }}>{t.slug}</p></div>
                    <div style={{ textAlign:'center' }}><p style={{ fontSize:24,fontWeight:800,color:sc.c,margin:0,lineHeight:1 }}>{t.score}</p><span style={{ fontSize:9,padding:'1px 6px',borderRadius:3,background:sc.bg,color:sc.c,fontWeight:700 }}>{sc.label}</span></div>
                  </div>
                  <div style={{ height:5,background:'#f1f5f9',borderRadius:3,marginBottom:10,overflow:'hidden' }}><div style={{ height:'100%',width:`${t.score}%`,background:sc.bar,borderRadius:3,transition:'width .7s ease' }}/></div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6 }}>
                    {[{l:'أخطاء 24h',v:t.errors_24h,c:t.errors_24h>0?'#ea580c':'#64748b'},{l:'تحذير 24h',v:t.warnings_24h,c:t.warnings_24h>0?'#d97706':'#64748b'},{l:'أخطاء 7d',v:t.errors_7d,c:t.errors_7d>5?'#dc2626':'#64748b'}].map(k=>(
                      <div key={k.l} style={{ background:'#f8fafc',borderRadius:6,padding:6,textAlign:'center' }}><p style={{ fontSize:15,fontWeight:700,color:k.c,margin:0 }}>{k.v}</p><p style={{ fontSize:9,color:'#94a3b8',margin:0 }}>{k.l}</p></div>
                    ))}
                  </div>
                  <div style={{ display:'flex',gap:5,marginTop:8 }}>
                    <span style={{ fontSize:9,padding:'1px 6px',borderRadius:3,background:'#f8fafc',color:'#64748b' }}>{PLAN[t.plan]||t.plan}</span>
                    <span style={{ fontSize:9,padding:'1px 6px',borderRadius:3,background:t.is_active?'#f0fdf4':'#fef2f2',color:t.is_active?'#16a34a':'#dc2626' }}>{t.is_active?'نشط':'موقوف'}</span>
                    {isActive&&<span style={{ fontSize:9,padding:'1px 6px',borderRadius:3,background:'#eff6ff',color:'#1d4070',fontWeight:700 }}>فلتر مفعّل ✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TOP ERRORS */}
        {tab==='top-errors' && (
          <div style={{ background:'white',borderRadius:14,border:'1px solid #e2e8f0',overflow:'hidden' }}>
            <div style={{ padding:'12px 16px',borderBottom:'1px solid #e2e8f0',background:'#fffbeb' }}>
              <p style={{ fontSize:13,fontWeight:700,color:'#374151',margin:0 }}>🔥 أكثر الأخطاء تكراراً — آخر 7 أيام</p>
            </div>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead><tr style={{ background:'#f8fafc' }}>{['#','المصدر','رسالة الخطأ','التكرار','الشركات','المستوى','آخر ظهور'].map(h=><th key={h} style={{ padding:'8px 14px',textAlign:'right',fontSize:10,fontWeight:600,color:'#64748b',borderBottom:'1px solid #e2e8f0' }}>{h}</th>)}</tr></thead>
              <tbody>
                {topErr.map((e,i)=>{
                  const lc=LVL[e.level as LogLevel]||LVL.error;
                  return <tr key={i} className="rh" style={{ borderBottom:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'9px 14px',fontSize:11,color:'#94a3b8' }}>#{i+1}</td>
                    <td style={{ padding:'9px 14px' }}><span style={{ fontSize:11,fontFamily:'monospace',color:'#1d4070' }}>{e.source}</span></td>
                    <td style={{ padding:'9px 14px',maxWidth:300 }}><p style={{ fontSize:11,color:'#374151',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{e.message}</p></td>
                    <td style={{ padding:'9px 14px' }}><span style={{ fontSize:13,fontWeight:700,padding:'3px 10px',borderRadius:6,background:lc.bg,color:lc.c }}>{e.count}</span></td>
                    <td style={{ padding:'9px 14px',fontSize:12,color:'#374151' }}>{e.companies}</td>
                    <td style={{ padding:'9px 14px' }}><span style={{ fontSize:10,padding:'1px 6px',borderRadius:3,background:lc.bg,color:lc.c }}>{lc.label}</span></td>
                    <td style={{ padding:'9px 14px',fontSize:10,color:'#94a3b8' }}>{new Date(e.last_seen).toLocaleString('ar-SA')}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* SECURITY */}
        {tab==='security' && (
          <div style={{ background:'white',borderRadius:14,border:'1px solid #e2e8f0',overflow:'hidden' }}>
            <div style={{ padding:'12px 16px',borderBottom:'1px solid #e2e8f0',background:'#f0f9ff' }}><p style={{ fontSize:13,fontWeight:700,color:'#374151',margin:0 }}>🔐 أحداث الأمان</p></div>
            {secFeed.length===0 ? <p style={{ padding:28,textAlign:'center',color:'#94a3b8',fontSize:12 }}>✅ لا توجد أحداث أمنية</p>
              : secFeed.map((ev,i)=>(
                <div key={ev.id} className="rh" style={{ padding:'11px 16px',borderBottom:i<secFeed.length-1?'1px solid #f1f5f9':'none',display:'flex',gap:12,alignItems:'flex-start' }}>
                  <span style={{ fontSize:17 }}>{ev.event_type?.includes('fail')||ev.event_type?.includes('block')?'🚫':'🔑'}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex',gap:8,marginBottom:3 }}><span style={{ fontSize:11,fontWeight:600,color:'#374151' }}>{ev.event_type}</span>{ev.ip_address&&<span style={{ fontSize:10,fontFamily:'monospace',color:'#64748b',background:'#f8fafc',padding:'1px 5px',borderRadius:3 }}>{ev.ip_address}</span>}</div>
                    <p style={{ fontSize:11,color:'#64748b',margin:0 }}>{ev.description}</p>
                  </div>
                  <span style={{ fontSize:10,color:'#94a3b8' }}>{new Date(ev.created_at).toLocaleString('ar-SA')}</span>
                </div>
              ))
            }
          </div>
        )}

        {/* ALERTS */}
        {tab==='alerts' && (
          <div style={{ background:'white',borderRadius:14,border:'1px solid #e2e8f0',overflow:'hidden' }}>
            <div style={{ padding:'12px 16px',borderBottom:'1px solid #e2e8f0',background:'#faf5ff' }}><p style={{ fontSize:13,fontWeight:700,color:'#374151',margin:0 }}>📱 تنبيهات واتساب</p></div>
            {alerts.length===0 ? <p style={{ padding:28,textAlign:'center',color:'#94a3b8',fontSize:12 }}>لم يُرسل أي تنبيه</p>
              : alerts.map((a,i)=>(
                <div key={a.id} className="rh" style={{ padding:'11px 16px',borderBottom:i<alerts.length-1?'1px solid #f1f5f9':'none' }}>
                  <div style={{ display:'flex',gap:8,alignItems:'center',marginBottom:4 }}>
                    <span style={{ fontSize:13 }}>📱</span>
                    <span style={{ fontSize:11,fontWeight:600,color:'#374151' }}>{a.recipient}</span>
                    <span style={{ fontSize:10,padding:'1px 6px',borderRadius:3,background:a.status==='sent'?'#f0fdf4':'#fef2f2',color:a.status==='sent'?'#16a34a':'#dc2626' }}>{a.status==='sent'?'أُرسل':'فشل'}</span>
                    <span style={{ fontSize:10,color:'#94a3b8',marginRight:'auto' }}>{new Date(a.sent_at).toLocaleString('ar-SA')}</span>
                  </div>
                  <p style={{ fontSize:11,color:'#64748b',margin:0,whiteSpace:'pre-line',lineHeight:1.5,paddingRight:21 }}>{a.message_body.slice(0,250)}</p>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {showChat && <AiChatPanel onClose={()=>setShowChat(false)}/>}

      {resolveModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300 }}>
          <div style={{ background:'white',borderRadius:14,padding:24,width:380,boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ fontSize:14,fontWeight:700,margin:'0 0 10px' }}>تأكيد إغلاق السجل</h3>
            <textarea value={resNote} onChange={e=>setResNote(e.target.value)} placeholder="ملاحظة الحل (اختياري)..." style={{ width:'100%',minHeight:80,padding:10,fontSize:12,borderRadius:8,border:'1px solid #e2e8f0',resize:'vertical',boxSizing:'border-box' }}/>
            <div style={{ display:'flex',gap:8,marginTop:12,justifyContent:'flex-end' }}>
              <button onClick={()=>setResolveModal(false)} style={{ fontSize:12,padding:'7px 14px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',cursor:'pointer' }}>إلغاء</button>
              <button onClick={handleResolve} style={{ fontSize:12,padding:'7px 14px',borderRadius:7,background:'#16a34a',color:'white',border:'none',cursor:'pointer',fontWeight:600 }}>تأكيد</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
