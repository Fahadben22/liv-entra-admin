'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type LogLevel    = 'debug'|'info'|'warning'|'error'|'critical';
type TenantStatus= 'healthy'|'degraded'|'warning'|'critical';
type TabId       = 'overview'|'logs'|'tenants'|'top-errors'|'security'|'alerts'|'incidents';

interface HealthData  { score:number; grade:string; status:string; api_status:string; active_companies:number; criticals_1h:number; errors_1h:number; errors_24h:number; computed_at?:string }
interface TimeBucket  { label:string; hour:string; warning:number; error:number; critical:number }
interface TenantH     { id:string; name:string; slug:string; plan:string; is_active:boolean; score:number; status:TenantStatus; errors_24h:number; warnings_24h:number; errors_7d:number }
interface TopError    { source:string; message:string; level:string; count:number; companies:number; last_seen:string }
interface SystemLog   { id:string; company_id:string|null; level:LogLevel; source:string; message:string; details:any; stack_trace?:string; status:string; created_at:string; ai_analyses?:AiAnalysis[]; _new?:boolean }
interface AiAnalysis  { root_cause:string; suggested_fix:string; severity_note:string; priority:string; confidence:number; created_at:string }
interface SecEvent    { id:string; event_type:string; description:string; ip_address:string; created_at:string }
interface ChatMsg     { role:'user'|'assistant'; content:string; ts:Date }
interface LiveEvent   { id:string; level:LogLevel; source:string; message:string; ts:Date }
interface Incident    { id:string; source:string; firstAt:Date; lastAt:Date; count:number; level:LogLevel; messages:string[] }

// ─── Design tokens ────────────────────────────────────────────────────────────
const LVL = {
  critical:{ label:'حرج',    c:'#ef4444', bg:'rgba(239,68,68,0.15)',  dot:'#ef4444' },
  error:   { label:'خطأ',    c:'#f97316', bg:'rgba(249,115,22,0.15)', dot:'#f97316' },
  warning: { label:'تحذير',  c:'#f59e0b', bg:'rgba(245,158,11,0.15)', dot:'#f59e0b' },
  info:    { label:'معلومة', c:'#38bdf8', bg:'rgba(56,189,248,0.12)', dot:'#38bdf8' },
  debug:   { label:'تصحيح',  c:'#64748b', bg:'rgba(100,116,139,0.1)', dot:'#64748b' },
} as const;

const TS = {
  healthy:  { label:'سليم',          c:'#10b981', bg:'rgba(16,185,129,0.15)', bar:'#10b981' },
  degraded: { label:'متدهور قليلاً', c:'#38bdf8', bg:'rgba(56,189,248,0.15)', bar:'#38bdf8' },
  warning:  { label:'تحذير',         c:'#f59e0b', bg:'rgba(245,158,11,0.15)', bar:'#f59e0b' },
  critical: { label:'حرج',           c:'#ef4444', bg:'rgba(239,68,68,0.15)',  bar:'#ef4444' },
} as const;

const PLAN: Record<string,string> = { enterprise:'مؤسسي', professional:'احترافي', basic:'أساسي', trial:'تجريبي' };

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimCounter({ value, color, size=28 }: { value:number; color:string; size?:number }) {
  const [d, setD] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const diff = value - prev.current, steps = 20; let i = 0;
    const id = setInterval(() => { i++; setDisplay(Math.round(prev.current+(diff*i)/steps)); if (i>=steps){clearInterval(id);prev.current=value;} }, 30);
    return () => clearInterval(id);
    function setDisplay(v:number){setD(v);}
  }, [value]);
  return <span style={{ fontSize:size,fontWeight:800,color,fontVariantNumeric:'tabular-nums',letterSpacing:'-1px' }}>{d}</span>;
}

// ─── Spark Line ───────────────────────────────────────────────────────────────
function Spark({ vals, color }: { vals:number[]; color:string }) {
  if (!vals.length) return null;
  const max = Math.max(...vals,1), W=80, H=30;
  const pts = vals.map((v,i) => `${(i/(vals.length-1||1))*W},${H-((v/max)*H*.85+2)}`).join(' ');
  const area = `M0,${H} L${pts.split(' ').map((p,i) => (i===0?`0,${H} `:'')+'L'+p).join(' ')} L${W},${H} Z`;
  return (
    <svg width={W} height={H} style={{ display:'block' }}>
      <defs><linearGradient id={`sg${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".4"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <path d={area} fill={`url(#sg${color.replace('#','')})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Area Timeline Chart ──────────────────────────────────────────────────────
function AreaTimeline({ data, onSelect, selectedHour }: { data:TimeBucket[]; onSelect:(h:string|null)=>void; selectedHour:string|null }) {
  const W=900, H=100, pad=8;
  if (!data.length) return <div style={{ height:H,background:'rgba(255,255,255,0.02)',borderRadius:8 }}/>;
  const maxV = Math.max(...data.map(d=>d.critical+d.error+d.warning),1);
  const n = data.length;
  const pts = (key:'warning'|'error'|'critical', offset:(d:TimeBucket)=>number) =>
    data.map((d,i) => `${pad+(i/(n-1||1))*(W-pad*2)},${H-((offset(d)/maxV)*(H-12))}`).join(' ');

  const warnPts = data.map((d,i) => { const x=pad+(i/(n-1||1))*(W-pad*2); const y=H-((d.warning/maxV)*(H-12)); return `${x},${y}`; });
  const errPts  = data.map((d,i) => { const x=pad+(i/(n-1||1))*(W-pad*2); const y=H-(((d.warning+d.error)/maxV)*(H-12)); return `${x},${y}`; });
  const critPts = data.map((d,i) => { const x=pad+(i/(n-1||1))*(W-pad*2); const y=H-(((d.warning+d.error+d.critical)/maxV)*(H-12)); return `${x},${y}`; });

  const mkArea = (topPts:string[], botPts:string[], fill:string) => {
    const top = topPts.join(' ');
    const bot = [...botPts].reverse().join(' ');
    return `M${topPts[0]} L${top} L${bot} Z`;
  };

  const warnArea = `M${pad},${H} L${warnPts.join(' L')} L${W-pad},${H} Z`;
  const errArea  = `M${pad},${H} L${errPts.join(' L')} L${W-pad},${H} Z`;
  const critArea = `M${pad},${H} L${critPts.join(' L')} L${W-pad},${H} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H+18}`} style={{ display:'block',cursor:'crosshair' }}>
      <defs>
        <linearGradient id="gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity=".35"/><stop offset="100%" stopColor="#f59e0b" stopOpacity=".0"/></linearGradient>
        <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity=".45"/><stop offset="100%" stopColor="#f97316" stopOpacity=".0"/></linearGradient>
        <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity=".55"/><stop offset="100%" stopColor="#ef4444" stopOpacity=".0"/></linearGradient>
      </defs>
      {/* Grid lines */}
      {[0.25,0.5,0.75,1].map(v=><line key={v} x1={pad} y1={H-(v*(H-12))} x2={W-pad} y2={H-(v*(H-12))} stroke="rgba(255,255,255,0.05)" strokeWidth={1}/>)}
      {/* Stacked areas */}
      <path d={warnArea} fill="url(#gw)"/>
      <path d={errArea}  fill="url(#ge)"/>
      <path d={critArea} fill="url(#gc)"/>
      {/* Lines */}
      <polyline points={warnPts.join(' ')} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={.7}/>
      <polyline points={errPts.join(' ')}  fill="none" stroke="#f97316" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={.7}/>
      <polyline points={critPts.join(' ')} fill="none" stroke="#ef4444" strokeWidth={2}   strokeLinecap="round" strokeLinejoin="round"/>
      {/* Clickable columns + labels */}
      {data.map((d,i) => {
        const x = pad+(i/(n-1||1))*(W-pad*2);
        const colW = (W-pad*2)/(n-1||1);
        const isSel = selectedHour===d.hour;
        const tot = d.warning+d.error+d.critical;
        return (
          <g key={i} onClick={()=>onSelect(isSel?null:d.hour)} style={{ cursor:'pointer' }}>
            <rect x={x-colW/2} y={0} width={colW} height={H} fill={isSel?'rgba(56,189,248,0.08)':'transparent'}/>
            {isSel && <line x1={x} y1={0} x2={x} y2={H} stroke="#38bdf8" strokeWidth={1} strokeDasharray="3,2"/>}
            {tot>0 && isSel && <text x={Math.min(x,W-50)} y={11} fontSize={9} fill="#38bdf8" textAnchor="middle" fontWeight={700}>{d.label} • {tot}</text>}
            {i%4===0 && <text x={x} y={H+14} fontSize={8} fill={isSel?'#38bdf8':'rgba(255,255,255,0.3)'} textAnchor="middle" fontWeight={isSel?700:400}>{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Health Ring ──────────────────────────────────────────────────────────────
function HealthRing({ score, grade, status }: { score:number; grade:string; status:string }) {
  const r=56, cx=68, cy=68, circ=2*Math.PI*r;
  const fill = circ-(score/100)*circ;
  const color = score>=90?'#10b981':score>=75?'#38bdf8':score>=50?'#f59e0b':'#ef4444';
  const glow  = score>=90?'0 0 20px rgba(16,185,129,.4)':score>=75?'0 0 20px rgba(56,189,248,.4)':score>=50?'0 0 20px rgba(245,158,11,.4)':'0 0 20px rgba(239,68,68,.4)';
  return (
    <svg width={136} height={136} style={{ filter:glow }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} style={{ transition:'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}/>
      <text x={cx} y={cy-8}  textAnchor="middle" fontSize={30} fontWeight={900} fill={color}>{score}</text>
      <text x={cx} y={cy+14} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,.7)" fontWeight={600}>{grade}</text>
      <text x={cx} y={cy+30} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,.4)">{status}</text>
    </svg>
  );
}

// ─── Pulse Dot ────────────────────────────────────────────────────────────────
function PulseDot({ on, color='#10b981' }: { on:boolean; color?:string }) {
  return (
    <span style={{ position:'relative',display:'inline-flex',width:10,height:10 }}>
      {on && <span style={{ position:'absolute',inset:0,borderRadius:'50%',background:color,animation:'ping 1.5s cubic-bezier(0,0,.2,1) infinite',opacity:.5 }}/>}
      <span style={{ position:'relative',width:10,height:10,borderRadius:'50%',background:on?color:'#374151' }}/>
    </span>
  );
}

// ─── AI Chat Drawer ───────────────────────────────────────────────────────────
function ChatDrawer({ onClose }: { onClose:()=>void }) {
  const [msgs,    setMsgs]    = useState<ChatMsg[]>([{ role:'assistant', content:'مرحباً! أنا مساعد تشخيص النظام المدعوم بـ Claude.\n\nلدي اطلاع كامل على سجلات النظام الحية. اسألني:\n• ما أخطر المشاكل الحالية؟\n• لماذا يتكرر هذا الخطأ؟\n• أي شركة تعاني أكثر اليوم؟\n• كيف أرفع درجة صحة النظام؟', ts:new Date() }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const quickQ = ['ما أخطر المشاكل الحالية؟','أي شركة تعاني أكثر؟','ما سبب أكثر الأخطاء تكراراً؟','خطوات رفع درجة الصحة؟','هل النظام في خطر الآن؟'];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [msgs]);

  async function send(text?:string) {
    const q = (text||input).trim();
    if (!q||loading) return;
    setInput('');
    setMsgs(prev => [...prev,{role:'user',content:q,ts:new Date()}]);
    setLoading(true);
    try {
      const history = msgs.slice(-6).map(m=>({role:m.role,content:m.content}));
      const res:any = await adminApi.aiChat(q, history);
      setMsgs(prev => [...prev,{role:'assistant',content:res.data.reply,ts:new Date()}]);
    } catch (e:any) {
      setMsgs(prev => [...prev,{role:'assistant',content:`⚠️ ${e.message}`,ts:new Date()}]);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ position:'fixed',top:0,right:0,width:420,height:'100vh',background:'#0d1629',borderLeft:'1px solid rgba(139,92,246,0.3)',display:'flex',flexDirection:'column',zIndex:500,boxShadow:'-8px 0 40px rgba(0,0,0,.5)' }}>
      {/* Header */}
      <div style={{ padding:'14px 18px',borderBottom:'1px solid rgba(255,255,255,0.08)',background:'rgba(139,92,246,0.1)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#8b5cf6,#6d28d9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>🧠</div>
          <div>
            <p style={{ fontSize:13,fontWeight:700,color:'white',margin:0 }}>مساعد التشخيص الذكي</p>
            <p style={{ fontSize:10,color:'#a78bfa',margin:0 }}>Claude Sonnet • بيانات النظام المباشرة</p>
          </div>
        </div>
        <button onClick={onClose} style={{ width:30,height:30,borderRadius:8,background:'rgba(255,255,255,0.08)',border:'none',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
      </div>
      {/* Quick questions */}
      <div style={{ padding:'8px 14px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',gap:5,flexWrap:'wrap',flexShrink:0 }}>
        {quickQ.map(q=>(
          <button key={q} onClick={()=>send(q)} style={{ fontSize:10,padding:'4px 9px',borderRadius:20,border:'1px solid rgba(139,92,246,0.3)',background:'rgba(139,92,246,0.1)',color:'#c4b5fd',cursor:'pointer',whiteSpace:'nowrap' }}>{q}</button>
        ))}
      </div>
      {/* Messages */}
      <div style={{ flex:1,overflowY:'auto',padding:'14px 16px',display:'flex',flexDirection:'column',gap:12 }}>
        {msgs.map((m,i)=>(
          <div key={i} style={{ display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            {m.role==='assistant' && <div style={{ width:28,height:28,borderRadius:8,background:'rgba(139,92,246,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0,marginLeft:8 }}>🧠</div>}
            <div style={{ maxWidth:'82%',padding:'10px 13px',borderRadius:m.role==='user'?'14px 14px 2px 14px':'14px 14px 14px 2px',background:m.role==='user'?'linear-gradient(135deg,#1d4070,#2563eb)':'rgba(255,255,255,0.06)',color:m.role==='user'?'white':'rgba(255,255,255,0.9)',fontSize:12,lineHeight:1.65,whiteSpace:'pre-wrap',border:m.role==='assistant'?'1px solid rgba(255,255,255,0.08)':'none' }}>
              {m.content}
              <div style={{ fontSize:9,color:'rgba(255,255,255,0.3)',marginTop:5 }}>{m.ts.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 0' }}>
            <div style={{ width:28,height:28,borderRadius:8,background:'rgba(139,92,246,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>🧠</div>
            <div style={{ display:'flex',gap:4,padding:'8px 12px',background:'rgba(255,255,255,0.06)',borderRadius:'14px 14px 14px 2px',border:'1px solid rgba(255,255,255,0.08)' }}>
              {[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:'50%',background:'#8b5cf6',animation:`bounce .9s ${i*.15}s infinite` }}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      {/* Input */}
      <div style={{ padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,0.08)',display:'flex',gap:8,flexShrink:0 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
          placeholder="اسأل عن أي مشكلة في النظام..." disabled={loading}
          style={{ flex:1,padding:'9px 13px',fontSize:12,borderRadius:10,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.06)',color:'white',outline:'none' }}/>
        <button onClick={()=>send()} disabled={loading||!input.trim()}
          style={{ padding:'9px 16px',borderRadius:10,background:input.trim()?'linear-gradient(135deg,#8b5cf6,#6d28d9)':'rgba(255,255,255,0.06)',color:input.trim()?'white':'rgba(255,255,255,0.3)',border:'none',cursor:input.trim()?'pointer':'not-allowed',fontSize:16,fontWeight:700 }}>↑</button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function IntelligencePage() {
  const router = useRouter();

  // Data
  const [health,   setHealth]   = useState<HealthData|null>(null);
  const [timeline, setTimeline] = useState<TimeBucket[]>([]);
  const [tenants,  setTenants]  = useState<TenantH[]>([]);
  const [topErr,   setTopErr]   = useState<TopError[]>([]);
  const [logs,     setLogs]     = useState<SystemLog[]>([]);
  const [logCount, setLogCount] = useState(0);
  const [secFeed,  setSecFeed]  = useState<SecEvent[]>([]);
  const [summary,  setSummary]  = useState<any>(null);
  const [alerts,   setAlerts]   = useState<any[]>([]);
  const [liveFeed, setLiveFeed] = useState<LiveEvent[]>([]);
  const [incidents,setIncidents]= useState<Incident[]>([]);

  // UI
  const [tab,          setTab]         = useState<TabId>('overview');
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
  const tickerRef = useRef<HTMLDivElement>(null);
  const LIMIT = 25;

  // ─── Incident detection (client-side grouping) ──────────────────────────────
  function buildIncidents(logList: SystemLog[]): Incident[] {
    const errLogs = logList.filter(l=>l.level==='error'||l.level==='critical').slice(0,100);
    const groups: Record<string,Incident> = {};
    errLogs.forEach(l => {
      const key = l.source;
      const t   = new Date(l.created_at);
      if (!groups[key]) {
        groups[key] = { id:l.id, source:l.source, firstAt:t, lastAt:t, count:0, level:l.level, messages:[] };
      }
      const g = groups[key];
      if (t < g.firstAt) g.firstAt = t;
      if (t > g.lastAt)  g.lastAt  = t;
      g.count++;
      if (g.messages.length < 3) g.messages.push(l.message.slice(0,80));
      if (l.level==='critical') g.level='critical';
    });
    return Object.values(groups).sort((a,b)=>b.count-a.count).slice(0,12);
  }

  const loadOverview = useCallback(async (silent=false) => {
    if (!silent) setLoadError('');
    const [h,t,ten,te,sum] = await Promise.allSettled([
      adminApi.getHealthScore(), adminApi.getTimeline(), adminApi.getTenantHealth(),
      adminApi.getTopErrors(), adminApi.intelligenceSummary(),
    ]);
    // Apply each result independently — one failure never blocks the rest
    if (h.status==='fulfilled')   setHealth((h.value as any).data);
    else if (!silent)             setLoadError((h.reason as any)?.message||'فشل تحميل البيانات');
    if (t.status==='fulfilled')   setTimeline((t.value as any).data||[]);
    if (ten.status==='fulfilled') setTenants((ten.value as any).data||[]);
    if (te.status==='fulfilled')  setTopErr((te.value as any).data||[]);
    if (sum.status==='fulfilled') setSummary((sum.value as any).data);
    setLastRefresh(new Date());
    // Only redirect on 401
    [h,t,ten,te,sum].forEach(r => {
      if (r.status==='rejected') {
        const msg = (r.reason as any)?.message||'';
        if (msg.includes('401')||msg.toLowerCase().includes('unauthorized')) router.push('/login');
      }
    });
  }, [router]);

  const loadLogs = useCallback(async () => {
    try {
      const p: Record<string,string> = { limit:String(LIMIT), offset:String(logPage*LIMIT) };
      if (filterLevel)  p.level      = filterLevel;
      if (filterStatus) p.status     = filterStatus;
      if (filterTenant) p.company_id = filterTenant;
      const r = await adminApi.listLogs(p);
      const data = (r as any).data||[];
      setLogs(data); setLogCount((r as any).count||0); setNewLogCount(0);
      setIncidents(buildIncidents(data));
    } catch {}
  }, [filterLevel, filterStatus, filterTenant, logPage]);

  // ─── SSE real-time ─────────────────────────────────────────────────────────
  useEffect(() => {
    const BASE = process.env.NEXT_PUBLIC_API_URL||'https://liv-entra-api-production.up.railway.app/api/v1';
    let es: EventSource, retryT: ReturnType<typeof setTimeout>;
    function connect() {
      es = new EventSource(`${BASE}/admin/intelligence/stream`);
      es.onopen = () => setSseStatus('live');
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          if (ev.type === 'new_log') {
            const log: SystemLog = { ...ev.data, _new:true };
            setLogs(prev => [log,...prev.slice(0,LIMIT-1)]);
            setLogCount(p=>p+1); setNewLogCount(p=>p+1);
            setLiveFeed(prev => [{
              id:log.id, level:log.level, source:log.source, message:log.message, ts:new Date()
            },...prev.slice(0,19)]);
            if (log.level==='critical'||log.level==='error') {
              setHealth(prev=>prev?{...prev,
                errors_1h:    prev.errors_1h+(log.level==='error'?1:0),
                criticals_1h: prev.criticals_1h+(log.level==='critical'?1:0),
                errors_24h:   prev.errors_24h+1,
                score: Math.max(0,prev.score-(log.level==='critical'?15:5)),
              }:prev);
              setTimeline(prev=>{
                const now=new Date(); now.setMinutes(0,0,0);
                return prev.map(b=>b.hour===now.toISOString()?{...b,[log.level]:(b[log.level as 'error'|'warning'|'critical']||0)+1}:b);
              });
            }
          }
          if (ev.type==='analysis_complete') {
            setLogs(prev=>prev.map(l=>l.id===ev.log_id?{...l,ai_analyses:[ev.analysis]}:l));
            setSelectedLog(prev=>(prev&&prev.id===ev.log_id)?{...prev,ai_analyses:[ev.analysis]}:prev);
          }
          // Security events from logSecurityEvent() — add to live ticker
          if (ev.type==='security_event') {
            const d = ev.data;
            const lvl: LogLevel = d.severity==='critical'?'critical':d.severity==='high'||d.severity==='warning'?'warning':d.severity==='medium'?'warning':'info';
            setLiveFeed(prev => [{
              id: d.id || String(Date.now()),
              level: lvl,
              source: `security/${d.event_type}`,
              message: d.ip_address ? `${d.event_type} · ${d.ip_address}` : d.event_type,
              ts: new Date(),
            }, ...prev.slice(0, 19)]);
            setNewLogCount(p => p + 1);
          }
        } catch {}
      };
      es.onerror = ()=>{ setSseStatus('disconnected'); es.close(); retryT=setTimeout(connect,5000); };
    }
    connect();
    return () => { es?.close(); clearTimeout(retryT); };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    loadOverview().finally(()=>setLoading(false));
  }, [loadOverview, router]);

  useEffect(() => { if (tab==='logs'||tab==='incidents') loadLogs(); }, [tab,filterLevel,filterStatus,filterTenant,logPage,loadLogs]);
  // Logs + incidents auto-refresh every 15s while active
  useEffect(() => {
    if (tab !== 'logs' && tab !== 'incidents') return;
    const id = setInterval(() => loadLogs(), 15_000);
    return () => clearInterval(id);
  }, [tab, loadLogs]);
  useEffect(() => { if (tab==='security') adminApi.getSecurityFeed().then(r=>setSecFeed((r as any).data||[])).catch(()=>{}); }, [tab]);
  useEffect(() => { if (tab==='alerts')   adminApi.listAlerts().then(r=>setAlerts((r as any).data||[])).catch(()=>{}); }, [tab]);
  // Overview auto-refresh every 15 s
  useEffect(() => { const id=setInterval(()=>loadOverview(true),15_000); return ()=>clearInterval(id); }, [loadOverview]);
  // Security feed auto-refresh every 15 s while on security tab
  useEffect(() => {
    if (tab !== 'security') return;
    const id = setInterval(() => adminApi.getSecurityFeed().then(r=>setSecFeed((r as any).data||[])).catch(()=>{}), 15_000);
    return () => clearInterval(id);
  }, [tab]);

  // Ticker scroll
  useEffect(() => {
    const el = tickerRef.current; if (!el) return;
    let x = 0; const speed = 0.5;
    const id = setInterval(() => {
      x -= speed;
      if (x < -el.scrollWidth/2) x = 0;
      el.style.transform = `translateX(${x}px)`;
    }, 16);
    return () => clearInterval(id);
  }, [liveFeed]);

  function handleHourSelect(hour:string|null) { setSelectedHour(hour); if(hour){setTab('logs');setLogPage(0);} }
  function handleTenantClick(id:string) { setFilterTenant(prev=>prev===id?null:id); setTab('logs');setLogPage(0); }

  async function handleAnalyze(log:SystemLog) {
    setAnalyzing(log.id);
    try {
      const res:any = await adminApi.analyzeLog(log.id);
      const upd = {...log,ai_analyses:[res.data]};
      setLogs(prev=>prev.map(l=>l.id===log.id?upd:l));
      if (selectedLog?.id===log.id) setSelectedLog(upd);
    } catch (e:any) { alert(e.message); }
    finally { setAnalyzing(null); }
  }
  async function handleResolve() {
    if (!selectedLog) return;
    try {
      await adminApi.resolveLog(selectedLog.id,resNote);
      setLogs(prev=>prev.map(l=>l.id===selectedLog.id?{...l,status:'resolved'}:l));
      setSelectedLog(p=>p?{...p,status:'resolved'}:p);
      setResolveModal(false); setResNote('');
    } catch(e:any){alert(e.message);}
  }
  async function handleIgnore(log:SystemLog) {
    try { await adminApi.ignoreLog(log.id); setLogs(prev=>prev.map(l=>l.id===log.id?{...l,status:'ignored'}:l)); if(selectedLog?.id===log.id)setSelectedLog(null); } catch{}
  }

  const activeTenantName = filterTenant ? tenants.find(t=>t.id===filterTenant)?.name : null;
  const scoreColor = health ? (health.score>=90?'#10b981':health.score>=75?'#38bdf8':health.score>=50?'#f59e0b':'#ef4444') : '#64748b';

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#060d1f',flexDirection:'column',gap:14 }}>
      <div style={{ width:48,height:48,border:'3px solid rgba(255,255,255,0.08)',borderTopColor:'#3b82f6',borderRadius:'50%',animation:'spin 1s linear infinite' }}/>
      <p style={{ color:'rgba(255,255,255,0.4)',fontSize:13,margin:0 }}>جاري تحميل مركز التحكم...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const tabs: { id:TabId; label:string; icon:string; badge?:number|null }[] = [
    { id:'overview',   label:'نظرة عامة',     icon:'⬡'  },
    { id:'logs',       label:'السجلات المباشرة',icon:'≡',  badge:newLogCount>0?newLogCount:null },
    { id:'incidents',  label:'الحوادث',        icon:'⚡' },
    { id:'tenants',    label:'صحة المستأجرين', icon:'⬢'  },
    { id:'top-errors', label:'أكثر الأخطاء',  icon:'🔥' },
    { id:'security',   label:'الأمان',         icon:'🔐' },
    { id:'alerts',     label:'التنبيهات',      icon:'📱' },
  ];

  // Spark data from timeline
  const warnSpark = timeline.slice(-12).map(d=>d.warning);
  const errSpark  = timeline.slice(-12).map(d=>d.error);
  const critSpark = timeline.slice(-12).map(d=>d.critical);

  return (
    <div style={{ minHeight:'100vh',background:'#060d1f',fontFamily:'system-ui,sans-serif',direction:'rtl',color:'#e2e8f0' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes ping{75%,100%{transform:scale(2);opacity:0}}
        @keyframes slideIn{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:none}}
        @keyframes flash{0%{background:rgba(245,158,11,.2)}100%{background:transparent}}
        @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .rh:hover{background:rgba(255,255,255,0.04)!important}
        .ch:hover{transform:translateY(-2px)!important;box-shadow:0 6px 24px rgba(0,0,0,.3)!important}
        .lnew{animation:flash 5s ease forwards}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:rgba(255,255,255,0.03)}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:2px}
      `}</style>

      {/* ─── Live Event Ticker ────────────────────────────────────────────── */}
      <div style={{ height:28,background:'rgba(0,0,0,0.6)',borderBottom:'1px solid rgba(255,255,255,0.05)',overflow:'hidden',display:'flex',alignItems:'center' }}>
        <div style={{ background:'rgba(239,68,68,0.9)',padding:'0 12px',height:'100%',display:'flex',alignItems:'center',flexShrink:0,zIndex:1 }}>
          <span style={{ fontSize:9,fontWeight:800,color:'white',letterSpacing:'.5px' }}>● LIVE</span>
        </div>
        <div style={{ flex:1,overflow:'hidden',position:'relative' }}>
          <div ref={tickerRef} style={{ display:'flex',whiteSpace:'nowrap',gap:48,willChange:'transform' }}>
            {[...liveFeed,...liveFeed].map((ev,i)=>{
              const lc = LVL[ev.level]||LVL.info;
              return (
                <span key={i} style={{ fontSize:10,color:'rgba(255,255,255,0.6)',flexShrink:0 }}>
                  <span style={{ color:lc.c,fontWeight:700 }}>[{lc.label}]</span>{' '}
                  <span style={{ color:'rgba(255,255,255,0.4)',fontFamily:'monospace' }}>{ev.source}</span>{' '}
                  {ev.message.slice(0,60)}
                  <span style={{ color:'rgba(255,255,255,0.25)',marginRight:16 }}> • {ev.ts.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})}</span>
                </span>
              );
            })}
            {liveFeed.length===0 && <span style={{ fontSize:10,color:'rgba(255,255,255,0.3)' }}>في انتظار الأحداث المباشرة... سيتم عرض السجلات الجديدة هنا تلقائياً</span>}
          </div>
        </div>
      </div>

      {/* ─── Main Header ─────────────────────────────────────────────────── */}
      <div style={{ background:'rgba(13,22,41,0.95)',borderBottom:'1px solid rgba(255,255,255,0.07)',padding:'0 20px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between',backdropFilter:'blur(10px)',position:'sticky',top:0,zIndex:100 }}>
        <div style={{ display:'flex',alignItems:'center',gap:14 }}>
          <Link href="/dashboard" style={{ color:'rgba(255,255,255,0.4)',textDecoration:'none',fontSize:12,transition:'color .2s' }}>← الرئيسية</Link>
          <div style={{ width:1,height:20,background:'rgba(255,255,255,0.1)' }}/>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <div style={{ width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,#1d4070,#3b82f6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16 }}>⬡</div>
            <div>
              <p style={{ fontSize:13,fontWeight:800,color:'white',margin:0,letterSpacing:'-.3px' }}>مركز قيادة النظام</p>
              <p style={{ fontSize:9,color:'rgba(255,255,255,0.35)',margin:0 }}>Liventra OS Intelligence Command Center</p>
            </div>
          </div>
          {/* SSE Status */}
          <div style={{ display:'flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:20,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)' }}>
            <PulseDot on={sseStatus==='live'} color={sseStatus==='live'?'#10b981':sseStatus==='connecting'?'#f59e0b':'#ef4444'}/>
            <span style={{ fontSize:10,color:sseStatus==='live'?'#6ee7b7':sseStatus==='connecting'?'#fde68a':'#fca5a5',fontWeight:600 }}>
              {sseStatus==='live'?'مباشر':sseStatus==='connecting'?'يتصل...':'منقطع'}
            </span>
          </div>
        </div>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          <span style={{ fontSize:10,color:'rgba(255,255,255,0.3)' }}>آخر تحديث: {lastRefresh.toLocaleTimeString('ar-SA')}</span>
          <button onClick={()=>setShowChat(p=>!p)}
            style={{ fontSize:12,padding:'6px 14px',borderRadius:8,background:showChat?'rgba(139,92,246,0.3)':'rgba(139,92,246,0.15)',color:'#c4b5fd',border:'1px solid rgba(139,92,246,0.4)',cursor:'pointer',fontWeight:600,transition:'all .2s' }}>
            🧠 مساعد AI
          </button>
          <button onClick={()=>loadOverview()}
            style={{ fontSize:18,padding:'4px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.6)',border:'1px solid rgba(255,255,255,0.1)',cursor:'pointer',lineHeight:1 }}>↻</button>
          <button onClick={()=>{localStorage.clear();router.push('/login');}}
            style={{ fontSize:11,padding:'5px 12px',borderRadius:8,background:'rgba(239,68,68,0.15)',color:'#fca5a5',border:'1px solid rgba(239,68,68,0.3)',cursor:'pointer' }}>خروج</button>
        </div>
      </div>

      <div style={{ display:'flex',minHeight:'calc(100vh - 80px)' }}>
        {/* ─── Left Sidebar Tabs ────────────────────────────────────────── */}
        <div style={{ width:180,flexShrink:0,background:'rgba(0,0,0,0.3)',borderLeft:'1px solid rgba(255,255,255,0.06)',padding:'12px 8px',display:'flex',flexDirection:'column',gap:2 }}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ width:'100%',padding:'10px 12px',borderRadius:8,background:tab===t.id?'rgba(59,130,246,0.2)':'transparent',border:tab===t.id?'1px solid rgba(59,130,246,0.4)':'1px solid transparent',color:tab===t.id?'#93c5fd':'rgba(255,255,255,0.5)',fontSize:12,cursor:'pointer',textAlign:'right',display:'flex',alignItems:'center',gap:8,transition:'all .2s',position:'relative' }}>
              <span style={{ fontSize:14,flexShrink:0 }}>{t.icon}</span>
              <span style={{ fontWeight:tab===t.id?700:400 }}>{t.label}</span>
              {t.badge && <span style={{ position:'absolute',left:8,top:6,fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:10,background:'#ef4444',color:'white',minWidth:16,textAlign:'center',animation:'slideIn .3s ease' }}>{t.badge}</span>}
            </button>
          ))}

          {/* Sidebar health mini */}
          <div style={{ marginTop:'auto',padding:'12px 8px',borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize:9,color:'rgba(255,255,255,0.3)',margin:'0 0 8px',textTransform:'uppercase',letterSpacing:'.5px' }}>صحة النظام</p>
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <div style={{ width:36,height:36,borderRadius:'50%',border:`3px solid ${scoreColor}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:`0 0 10px ${scoreColor}50` }}>
                <span style={{ fontSize:11,fontWeight:800,color:scoreColor }}>{health?.score??'—'}</span>
              </div>
              <div>
                <p style={{ fontSize:11,fontWeight:700,color:scoreColor,margin:0 }}>{health?.grade??'—'}</p>
                <p style={{ fontSize:9,color:'rgba(255,255,255,0.3)',margin:0 }}>{health?.status??'تحميل...'}</p>
              </div>
            </div>
            {/* Services mini */}
            <div style={{ marginTop:10,display:'flex',flexDirection:'column',gap:4 }}>
              {[
                { l:'API',     on:sseStatus==='live'||health?.api_status==='online' },
                { l:'DB',      on:true },
                { l:'SSE',     on:sseStatus==='live' },
                { l:'Vercel',  on:true },
              ].map(s=>(
                <div key={s.l} style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <span style={{ fontSize:10,color:'rgba(255,255,255,0.4)' }}>{s.l}</span>
                  <div style={{ display:'flex',alignItems:'center',gap:4 }}>
                    <PulseDot on={s.on} color={s.on?'#10b981':'#ef4444'}/>
                    <span style={{ fontSize:9,color:s.on?'#6ee7b7':'#fca5a5' }}>{s.on?'يعمل':'متوقف'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Main Content ─────────────────────────────────────────────── */}
        <div style={{ flex:1,padding:16,overflowX:'hidden',paddingLeft:showChat?436:16,transition:'padding-left .3s ease' }}>

          {loadError && (
            <div style={{ background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:10,padding:'10px 16px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <p style={{ fontSize:12,color:'#fca5a5',margin:0 }}>⚠️ {loadError}</p>
              <button onClick={()=>loadOverview()} style={{ fontSize:11,padding:'4px 10px',borderRadius:6,background:'rgba(239,68,68,0.2)',color:'#fca5a5',border:'1px solid rgba(239,68,68,0.3)',cursor:'pointer' }}>إعادة المحاولة</button>
            </div>
          )}

          {/* Active filters */}
          {(activeTenantName||selectedHour) && (
            <div style={{ display:'flex',gap:6,marginBottom:12,alignItems:'center' }}>
              <span style={{ fontSize:10,color:'rgba(255,255,255,0.3)' }}>فلاتر نشطة:</span>
              {activeTenantName && <span style={{ fontSize:11,padding:'3px 10px',borderRadius:20,background:'rgba(59,130,246,0.2)',color:'#93c5fd',display:'flex',alignItems:'center',gap:5,border:'1px solid rgba(59,130,246,0.3)' }}>⬢ {activeTenantName}<button onClick={()=>setFilterTenant(null)} style={{ background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)',fontSize:12,padding:0,marginRight:2 }}>✕</button></span>}
              {selectedHour && <span style={{ fontSize:11,padding:'3px 10px',borderRadius:20,background:'rgba(245,158,11,0.2)',color:'#fde68a',display:'flex',alignItems:'center',gap:5,border:'1px solid rgba(245,158,11,0.3)' }}>🕐 {new Date(selectedHour).getHours()}:00<button onClick={()=>setSelectedHour(null)} style={{ background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)',fontSize:12,padding:0,marginRight:2 }}>✕</button></span>}
            </div>
          )}

          {/* ══ OVERVIEW ══════════════════════════════════════════════════ */}
          {tab==='overview' && (
            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>

              {/* Row 1: Health + Metrics */}
              <div style={{ display:'grid',gridTemplateColumns:'160px 1fr',gap:14 }}>
                {/* Health Ring */}
                <div style={{ background:'rgba(255,255,255,0.03)',borderRadius:14,border:'1px solid rgba(255,255,255,0.08)',padding:16,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6 }}>
                  <p style={{ fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',margin:0,textTransform:'uppercase',letterSpacing:'.5px' }}>درجة الصحة</p>
                  {health ? <HealthRing score={health.score} grade={health.grade} status={health.status}/> : <div style={{ width:136,height:136 }}/>}
                  <p style={{ fontSize:9,color:'rgba(255,255,255,0.3)',margin:0 }}>محدّث الآن</p>
                </div>

                {/* Metrics grid */}
                <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gridTemplateRows:'1fr 1fr',gap:10 }}>
                  {health && ([
                    { l:'أحداث حرجة / ساعة', v:health.criticals_1h, c:'#ef4444', spark:critSpark, icon:'🚨' },
                    { l:'أخطاء / ساعة',       v:health.errors_1h,    c:'#f97316', spark:errSpark,  icon:'❌' },
                    { l:'أخطاء / 24 ساعة',   v:health.errors_24h,   c:'#f59e0b', spark:[...warnSpark.map((_,i)=>warnSpark[i]+errSpark[i])], icon:'⚠️' },
                    { l:'شركات نشطة',          v:health.active_companies, c:'#10b981', spark:[], icon:'⬢' },
                    { l:'تنبيهات مُرسلة',     v:summary?.alerts_24h||0, c:'#8b5cf6', spark:[], icon:'📱' },
                    { l:'إجمالي 7 أيام',       v:summary?.total_7d||0,   c:'#38bdf8', spark:[], icon:'📊' },
                  ] as any[]).map((k:any)=>(
                    <div key={k.l} className="ch" style={{ background:'rgba(255,255,255,0.03)',borderRadius:12,padding:'12px 14px',border:`1px solid ${k.c}25`,display:'flex',flexDirection:'column',justifyContent:'space-between',transition:'transform .2s,box-shadow .2s',cursor:'default',gap:4 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                        <p style={{ fontSize:10,color:'rgba(255,255,255,0.4)',margin:0,lineHeight:1.3 }}>{k.l}</p>
                        <span style={{ fontSize:16 }}>{k.icon}</span>
                      </div>
                      <AnimCounter value={k.v} color={k.c}/>
                      {k.spark.length>1 && <Spark vals={k.spark} color={k.c}/>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 2: Timeline */}
              <div style={{ background:'rgba(255,255,255,0.03)',borderRadius:14,border:'1px solid rgba(255,255,255,0.08)',padding:16 }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
                  <div>
                    <p style={{ fontSize:13,fontWeight:700,color:'white',margin:0 }}>توزيع الأحداث — آخر 24 ساعة</p>
                    <p style={{ fontSize:10,color:'rgba(255,255,255,0.3)',margin:'2px 0 0' }}>اضغط على أي نقطة لتصفية السجلات حسب الساعة</p>
                  </div>
                  <div style={{ display:'flex',gap:12,alignItems:'center' }}>
                    {([['#f59e0b','تحذير'],['#f97316','خطأ'],['#ef4444','حرج']] as [string,string][]).map(([c,l])=>(
                      <div key={l} style={{ display:'flex',alignItems:'center',gap:5 }}>
                        <div style={{ width:24,height:3,borderRadius:2,background:c }}/>
                        <span style={{ fontSize:10,color:'rgba(255,255,255,0.4)' }}>{l}</span>
                      </div>
                    ))}
                    {selectedHour && <button onClick={()=>setSelectedHour(null)} style={{ fontSize:10,padding:'3px 8px',borderRadius:20,background:'rgba(245,158,11,0.2)',color:'#fde68a',border:'1px solid rgba(245,158,11,0.3)',cursor:'pointer' }}>إلغاء ✕</button>}
                  </div>
                </div>
                <AreaTimeline data={timeline} selectedHour={selectedHour} onSelect={handleHourSelect}/>
              </div>

              {/* Row 3: Open criticals + Live feed */}
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
                {/* Open criticals */}
                <div style={{ background:'rgba(255,255,255,0.03)',borderRadius:14,border:'1px solid rgba(239,68,68,0.2)',overflow:'hidden' }}>
                  <div style={{ padding:'11px 16px',borderBottom:'1px solid rgba(239,68,68,0.15)',background:'rgba(239,68,68,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                    <span style={{ fontSize:12,fontWeight:700,color:'#fca5a5' }}>🚨 أحداث حرجة مفتوحة</span>
                    <button onClick={()=>{setTab('logs');setFilterLevel('critical');}} style={{ fontSize:10,color:'#fca5a5',background:'none',border:'none',cursor:'pointer',opacity:.7 }}>عرض الكل ←</button>
                  </div>
                  {!(summary?.open_criticals?.length) ? (
                    <div style={{ padding:'24px 16px',textAlign:'center' }}>
                      <p style={{ fontSize:24,margin:'0 0 6px' }}>✅</p>
                      <p style={{ fontSize:12,color:'rgba(255,255,255,0.3)',margin:0 }}>لا توجد أحداث حرجة</p>
                    </div>
                  ) : (summary.open_criticals as any[]).map((c:any)=>(
                    <div key={c.id} className="rh" style={{ padding:'9px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer' }} onClick={()=>setTab('logs')}>
                      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:2 }}>
                        <span style={{ fontSize:10,color:'rgba(255,255,255,0.4)',fontFamily:'monospace' }}>{c.source}</span>
                        <span style={{ fontSize:9,color:'rgba(255,255,255,0.25)' }}>{new Date(c.created_at).toLocaleTimeString('ar-SA')}</span>
                      </div>
                      <p style={{ fontSize:11,color:'rgba(255,255,255,0.8)',margin:0,lineHeight:1.4 }}>{c.message.slice(0,90)}</p>
                    </div>
                  ))}
                </div>

                {/* Live event feed */}
                <div style={{ background:'rgba(255,255,255,0.03)',borderRadius:14,border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden' }}>
                  <div style={{ padding:'11px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:7 }}>
                      <PulseDot on={sseStatus==='live'} color="#10b981"/>
                      <span style={{ fontSize:12,fontWeight:700,color:'white' }}>التدفق المباشر</span>
                    </div>
                    <span style={{ fontSize:9,color:'rgba(255,255,255,0.3)',background:'rgba(255,255,255,0.05)',padding:'2px 7px',borderRadius:10 }}>{liveFeed.length} حدث</span>
                  </div>
                  {liveFeed.length===0 ? (
                    <div style={{ padding:'24px 16px',textAlign:'center' }}>
                      <p style={{ fontSize:12,color:'rgba(255,255,255,0.25)',margin:0 }}>في انتظار الأحداث الجديدة...</p>
                    </div>
                  ) : liveFeed.slice(0,8).map((ev,i)=>{
                    const lc=LVL[ev.level]||LVL.info;
                    return (
                      <div key={ev.id+i} style={{ padding:'7px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)',display:'flex',gap:8,alignItems:'flex-start',animation:'slideIn .3s ease' }}>
                        <div style={{ width:6,height:6,borderRadius:'50%',background:lc.dot,marginTop:5,flexShrink:0,boxShadow:`0 0 4px ${lc.dot}` }}/>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ display:'flex',justifyContent:'space-between',marginBottom:1 }}>
                            <span style={{ fontSize:9,color:lc.c,fontWeight:700 }}>{lc.label}</span>
                            <span style={{ fontSize:9,color:'rgba(255,255,255,0.25)' }}>{ev.ts.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
                          </div>
                          <p style={{ fontSize:10,color:'rgba(255,255,255,0.6)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                            <span style={{ color:'rgba(255,255,255,0.4)',fontFamily:'monospace',marginLeft:4 }}>{ev.source}</span>
                            {ev.message.slice(0,55)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Row 4: Top Tenants + Top Errors preview */}
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
                {/* Top tenants */}
                <div style={{ background:'rgba(255,255,255,0.03)',borderRadius:14,border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden' }}>
                  <div style={{ padding:'11px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',justifyContent:'space-between' }}>
                    <span style={{ fontSize:12,fontWeight:700,color:'white' }}>⬢ أكثر الشركات تضرراً</span>
                    <button onClick={()=>setTab('tenants')} style={{ fontSize:10,color:'rgba(255,255,255,0.4)',background:'none',border:'none',cursor:'pointer' }}>عرض الكل ←</button>
                  </div>
                  {tenants.slice(0,5).map(t=>{
                    const sc=TS[t.status]||TS.healthy;
                    return (
                      <div key={t.id} className="rh" style={{ padding:'9px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer',display:'flex',alignItems:'center',gap:10 }} onClick={()=>handleTenantClick(t.id)}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:4 }}>
                            <span style={{ fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.85)' }}>{t.name}</span>
                            <span style={{ fontSize:9,padding:'1px 5px',borderRadius:3,background:sc.bg,color:sc.c,fontWeight:600,border:`1px solid ${sc.c}30` }}>{sc.label}</span>
                          </div>
                          <div style={{ height:3,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden' }}>
                            <div style={{ height:'100%',width:`${t.score}%`,background:sc.bar,borderRadius:2,transition:'width .7s ease' }}/>
                          </div>
                        </div>
                        <span style={{ fontSize:18,fontWeight:800,color:sc.c,minWidth:36,textAlign:'center' }}>{t.score}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Top errors preview */}
                <div style={{ background:'rgba(255,255,255,0.03)',borderRadius:14,border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden' }}>
                  <div style={{ padding:'11px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',justifyContent:'space-between' }}>
                    <span style={{ fontSize:12,fontWeight:700,color:'white' }}>🔥 أكثر الأخطاء تكراراً</span>
                    <button onClick={()=>setTab('top-errors')} style={{ fontSize:10,color:'rgba(255,255,255,0.4)',background:'none',border:'none',cursor:'pointer' }}>عرض الكل ←</button>
                  </div>
                  {topErr.slice(0,5).map((e,i)=>{
                    const lc=LVL[e.level as LogLevel]||LVL.error;
                    return (
                      <div key={i} className="rh" style={{ padding:'9px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)',display:'flex',gap:10,alignItems:'center' }}>
                        <span style={{ fontSize:16,fontWeight:800,color:lc.c,minWidth:28,textAlign:'center' }}>{e.count}</span>
                        <div style={{ flex:1,minWidth:0 }}>
                          <p style={{ fontSize:10,color:'rgba(255,255,255,0.4)',margin:'0 0 1px',fontFamily:'monospace' }}>{e.source}</p>
                          <p style={{ fontSize:11,color:'rgba(255,255,255,0.75)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{e.message}</p>
                        </div>
                        <span style={{ fontSize:9,color:'rgba(255,255,255,0.3)',flexShrink:0 }}>{e.companies} شركة</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══ LOGS ══════════════════════════════════════════════════════ */}
          {tab==='logs' && (
            <div style={{ display:'grid',gridTemplateColumns:selectedLog?'1fr 380px':'1fr',gap:14 }}>
              <div>
                <div style={{ display:'flex',gap:8,marginBottom:10,flexWrap:'wrap',alignItems:'center' }}>
                  {[
                    <select key="lvl" value={filterLevel} onChange={e=>{setFilterLevel(e.target.value);setLogPage(0);}} style={{ fontSize:12,padding:'7px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.06)',color:'white',cursor:'pointer' }}>
                      <option value="">كل المستويات</option>
                      {Object.entries(LVL).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                    </select>,
                    <select key="st" value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);setLogPage(0);}} style={{ fontSize:12,padding:'7px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.06)',color:'white',cursor:'pointer' }}>
                      <option value="">كل الحالات</option>
                      {[['open','مفتوح'],['resolved','محلول'],['ignored','مهمل']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>,
                    <span key="cnt" style={{ fontSize:11,color:'rgba(255,255,255,0.3)' }}>{logCount} سجل</span>,
                    <button key="rf" onClick={loadLogs} style={{ fontSize:11,padding:'6px 12px',borderRadius:7,background:'rgba(59,130,246,0.2)',color:'#93c5fd',border:'1px solid rgba(59,130,246,0.3)',cursor:'pointer',marginRight:'auto' }}>↻ تحديث</button>,
                  ]}
                </div>
                <div style={{ background:'rgba(255,255,255,0.02)',borderRadius:12,border:'1px solid rgba(255,255,255,0.07)',overflow:'hidden' }}>
                  {logs.length===0 ? <p style={{ padding:28,textAlign:'center',color:'rgba(255,255,255,0.25)',fontSize:12 }}>لا توجد سجلات</p>
                    : logs.map((log,i)=>{
                      const lc=LVL[log.level]||LVL.info;
                      const isSel=selectedLog?.id===log.id;
                      return (
                        <div key={log.id} onClick={()=>setSelectedLog(isSel?null:log)} className={`rh${log._new?' lnew':''}`}
                          style={{ padding:'10px 16px',borderBottom:i<logs.length-1?'1px solid rgba(255,255,255,0.04)':'none',cursor:'pointer',background:isSel?'rgba(59,130,246,0.08)':'transparent',opacity:log.status==='ignored'?.4:1,transition:'background .15s' }}>
                          <div style={{ display:'flex',alignItems:'flex-start',gap:10 }}>
                            <div style={{ width:6,height:6,borderRadius:'50%',background:lc.dot,marginTop:5,flexShrink:0,boxShadow:`0 0 4px ${lc.dot}` }}/>
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ display:'flex',gap:5,marginBottom:3,flexWrap:'wrap',alignItems:'center' }}>
                                <span style={{ fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:4,background:lc.bg,color:lc.c }}>{lc.label}</span>
                                <span style={{ fontSize:10,color:'rgba(255,255,255,0.35)',fontFamily:'monospace' }}>{log.source}</span>
                                {log.status==='resolved'&&<span style={{ fontSize:9,padding:'1px 5px',borderRadius:3,background:'rgba(16,185,129,0.15)',color:'#6ee7b7' }}>✓ محلول</span>}
                                {(log.ai_analyses?.length||0)>0&&<span style={{ fontSize:9,padding:'1px 5px',borderRadius:3,background:'rgba(139,92,246,0.15)',color:'#c4b5fd' }}>🧠 AI</span>}
                                {log._new&&<span style={{ fontSize:9,padding:'1px 5px',borderRadius:3,background:'rgba(245,158,11,0.2)',color:'#fde68a',fontWeight:700 }}>جديد</span>}
                              </div>
                              <p style={{ fontSize:11,color:'rgba(255,255,255,0.75)',margin:'0 0 3px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{log.message}</p>
                              <span style={{ fontSize:10,color:'rgba(255,255,255,0.25)' }}>{new Date(log.created_at).toLocaleString('ar-SA')}</span>
                            </div>
                            <div style={{ display:'flex',gap:3,flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                              {log.status==='open'&&!(log.ai_analyses?.length)&&(
                                <button onClick={()=>handleAnalyze(log)} disabled={!!analyzing} style={{ fontSize:10,padding:'3px 8px',borderRadius:5,background:'rgba(139,92,246,0.2)',color:'#c4b5fd',border:'1px solid rgba(139,92,246,0.3)',cursor:'pointer' }}>
                                  {analyzing===log.id?'⏳':'🧠'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
                {logCount>LIMIT && (
                  <div style={{ display:'flex',gap:8,justifyContent:'center',marginTop:10 }}>
                    <button onClick={()=>setLogPage(p=>Math.max(0,p-1))} disabled={logPage===0} style={{ fontSize:11,padding:'5px 12px',borderRadius:6,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',cursor:logPage===0?'not-allowed':'pointer',color:logPage===0?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.7)' }}>السابق</button>
                    <span style={{ fontSize:11,color:'rgba(255,255,255,0.3)',padding:'5px 6px' }}>{logPage+1}/{Math.ceil(logCount/LIMIT)}</span>
                    <button onClick={()=>setLogPage(p=>p+1)} disabled={(logPage+1)*LIMIT>=logCount} style={{ fontSize:11,padding:'5px 12px',borderRadius:6,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',cursor:(logPage+1)*LIMIT>=logCount?'not-allowed':'pointer',color:(logPage+1)*LIMIT>=logCount?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.7)' }}>التالي</button>
                  </div>
                )}
              </div>

              {selectedLog&&(()=>{
                const lc=LVL[selectedLog.level]||LVL.info;
                const ai=selectedLog.ai_analyses?.[0];
                return (
                  <div style={{ display:'flex',flexDirection:'column',gap:12,position:'sticky',top:70,maxHeight:'calc(100vh - 90px)',overflowY:'auto' }}>
                    <div style={{ background:'rgba(255,255,255,0.03)',borderRadius:12,border:'1px solid rgba(255,255,255,0.08)',padding:16 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:10 }}>
                        <span style={{ fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:5,background:lc.bg,color:lc.c }}>{lc.label}</span>
                        <button onClick={()=>setSelectedLog(null)} style={{ fontSize:16,background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)' }}>✕</button>
                      </div>
                      <p style={{ fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.5)',marginBottom:4,fontFamily:'monospace' }}>{selectedLog.source}</p>
                      <p style={{ fontSize:12,color:'rgba(255,255,255,0.85)',lineHeight:1.6,marginBottom:6 }}>{selectedLog.message}</p>
                      {selectedLog.stack_trace&&<details style={{ marginBottom:6 }}><summary style={{ fontSize:11,color:'rgba(255,255,255,0.4)',cursor:'pointer' }}>Stack Trace</summary><pre style={{ fontSize:9,color:'rgba(255,255,255,0.7)',background:'rgba(0,0,0,0.4)',padding:8,borderRadius:6,overflow:'auto',marginTop:4,maxHeight:120,direction:'ltr' }}>{selectedLog.stack_trace}</pre></details>}
                      <p style={{ fontSize:10,color:'rgba(255,255,255,0.25)',margin:'6px 0 0' }}>{new Date(selectedLog.created_at).toLocaleString('ar-SA')}</p>
                      {selectedLog.status==='open'&&(
                        <div style={{ display:'flex',gap:6,marginTop:12 }}>
                          <button onClick={()=>handleAnalyze(selectedLog)} disabled={!!analyzing} style={{ flex:1,fontSize:11,padding:'8px 0',borderRadius:8,background:'linear-gradient(135deg,#8b5cf6,#6d28d9)',color:'white',border:'none',cursor:'pointer',fontWeight:700 }}>{analyzing===selectedLog.id?'⏳ يحلّل...':'🧠 تحليل AI'}</button>
                          <button onClick={()=>setResolveModal(true)} style={{ fontSize:11,padding:'8px 12px',borderRadius:8,background:'rgba(16,185,129,0.15)',color:'#6ee7b7',border:'1px solid rgba(16,185,129,0.3)',cursor:'pointer' }}>✓</button>
                          <button onClick={()=>handleIgnore(selectedLog)} style={{ fontSize:11,padding:'8px 12px',borderRadius:8,background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.4)',border:'1px solid rgba(255,255,255,0.1)',cursor:'pointer' }}>–</button>
                        </div>
                      )}
                    </div>
                    {ai ? (
                      <div style={{ background:'rgba(139,92,246,0.08)',borderRadius:12,border:'1px solid rgba(139,92,246,0.25)',padding:16 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:12 }}>
                          <span style={{ fontSize:16 }}>🧠</span>
                          <span style={{ fontSize:12,fontWeight:700,color:'#c4b5fd' }}>تحليل الذكاء الاصطناعي</span>
                          <span style={{ fontSize:9,padding:'1px 6px',borderRadius:3,background:'rgba(139,92,246,0.2)',color:'#c4b5fd' }}>{ai.confidence}%</span>
                          <span style={{ fontSize:9,padding:'1px 6px',borderRadius:3,background:ai.priority==='critical'?'rgba(239,68,68,0.2)':ai.priority==='high'?'rgba(249,115,22,0.2)':'rgba(245,158,11,0.2)',color:ai.priority==='critical'?'#fca5a5':ai.priority==='high'?'#fdba74':'#fde68a',fontWeight:700 }}>{ai.priority}</span>
                        </div>
                        <p style={{ fontSize:10,fontWeight:700,color:'#a78bfa',margin:'0 0 4px' }}>السبب الجذري</p>
                        <p style={{ fontSize:11,color:'rgba(255,255,255,0.8)',margin:'0 0 12px',lineHeight:1.6 }}>{ai.root_cause}</p>
                        <p style={{ fontSize:10,fontWeight:700,color:'#a78bfa',margin:'0 0 4px' }}>الإصلاح المقترح</p>
                        <p style={{ fontSize:11,color:'rgba(255,255,255,0.8)',margin:0,lineHeight:1.6 }}>{ai.suggested_fix}</p>
                        {ai.severity_note&&<p style={{ fontSize:10,color:'#c4b5fd',margin:'10px 0 0',background:'rgba(139,92,246,0.1)',padding:'7px 10px',borderRadius:6,lineHeight:1.5 }}>{ai.severity_note}</p>}
                      </div>
                    ) : (
                      <div style={{ background:'rgba(255,255,255,0.02)',borderRadius:12,border:'1px dashed rgba(139,92,246,0.3)',padding:24,textAlign:'center' }}>
                        <p style={{ fontSize:20,margin:'0 0 6px' }}>🧠</p>
                        <p style={{ fontSize:11,color:'rgba(255,255,255,0.3)',margin:0 }}>اضغط "تحليل AI" لتحليل هذا الخطأ</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══ INCIDENTS ════════════════════════════════════════════════ */}
          {tab==='incidents' && (
            <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                <div>
                  <p style={{ fontSize:14,fontWeight:800,color:'white',margin:0 }}>⚡ الحوادث النشطة</p>
                  <p style={{ fontSize:10,color:'rgba(255,255,255,0.35)',margin:'2px 0 0' }}>مجموعات الأخطاء المتكررة من نفس المصدر</p>
                </div>
                <button onClick={loadLogs} style={{ fontSize:11,padding:'6px 12px',borderRadius:7,background:'rgba(59,130,246,0.2)',color:'#93c5fd',border:'1px solid rgba(59,130,246,0.3)',cursor:'pointer' }}>↻ تحديث</button>
              </div>
              {incidents.length===0 ? (
                <div style={{ background:'rgba(255,255,255,0.02)',borderRadius:14,border:'1px solid rgba(255,255,255,0.07)',padding:'40px 20px',textAlign:'center' }}>
                  <p style={{ fontSize:28,margin:'0 0 8px' }}>✅</p>
                  <p style={{ fontSize:13,color:'rgba(255,255,255,0.3)',margin:0 }}>لا توجد حوادث نشطة حالياً</p>
                </div>
              ) : incidents.map((inc,i)=>{
                const lc=LVL[inc.level]||LVL.error;
                const dur = Math.round((inc.lastAt.getTime()-inc.firstAt.getTime())/60000);
                return (
                  <div key={inc.id} style={{ background:'rgba(255,255,255,0.03)',borderRadius:14,border:`1px solid ${lc.c}30`,padding:16,transition:'border-color .2s' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                        <div style={{ width:40,height:40,borderRadius:10,background:lc.bg,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${lc.c}40` }}>
                          <span style={{ fontSize:16,fontWeight:800,color:lc.c }}>{inc.count}</span>
                        </div>
                        <div>
                          <p style={{ fontSize:13,fontWeight:700,color:'white',margin:'0 0 2px',fontFamily:'monospace' }}>{inc.source}</p>
                          <div style={{ display:'flex',gap:5 }}>
                            <span style={{ fontSize:9,padding:'1px 6px',borderRadius:3,background:lc.bg,color:lc.c,fontWeight:700 }}>{lc.label}</span>
                            {dur>0&&<span style={{ fontSize:9,padding:'1px 6px',borderRadius:3,background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.4)' }}>مدة {dur} د</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign:'left',fontSize:10,color:'rgba(255,255,255,0.3)' }}>
                        <p style={{ margin:'0 0 2px' }}>أول ظهور: {inc.firstAt.toLocaleTimeString('ar-SA')}</p>
                        <p style={{ margin:0 }}>آخر ظهور: {inc.lastAt.toLocaleTimeString('ar-SA')}</p>
                      </div>
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',gap:4 }}>
                      {inc.messages.map((m,j)=>(
                        <div key={j} style={{ fontSize:11,color:'rgba(255,255,255,0.6)',background:'rgba(0,0,0,0.2)',padding:'6px 10px',borderRadius:6,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                          {m}
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'flex',gap:8,marginTop:12 }}>
                      <button onClick={()=>{setFilterLevel(inc.level);setTab('logs');}} style={{ fontSize:11,padding:'6px 12px',borderRadius:7,background:lc.bg,color:lc.c,border:`1px solid ${lc.c}40`,cursor:'pointer' }}>عرض السجلات</button>
                      <button onClick={()=>setShowChat(true)} style={{ fontSize:11,padding:'6px 12px',borderRadius:7,background:'rgba(139,92,246,0.15)',color:'#c4b5fd',border:'1px solid rgba(139,92,246,0.3)',cursor:'pointer' }}>🧠 تحليل AI</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ TENANTS ══════════════════════════════════════════════════ */}
          {tab==='tenants' && (
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))',gap:12 }}>
              {tenants.map(t=>{
                const sc=TS[t.status]||TS.healthy;
                const isActive=filterTenant===t.id;
                return (
                  <div key={t.id} onClick={()=>handleTenantClick(t.id)} className="ch"
                    style={{ background:'rgba(255,255,255,0.03)',borderRadius:14,border:`1px solid ${isActive?sc.c:sc.c+'30'}`,padding:16,cursor:'pointer',transition:'transform .2s,box-shadow .2s',boxShadow:isActive?`0 0 0 2px ${sc.c}40`:'none' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12 }}>
                      <div>
                        <p style={{ fontSize:13,fontWeight:700,color:'white',margin:'0 0 3px' }}>{t.name}</p>
                        <p style={{ fontSize:10,color:'rgba(255,255,255,0.35)',margin:0,fontFamily:'monospace' }}>{t.slug}</p>
                      </div>
                      <div style={{ textAlign:'center',background:sc.bg,padding:'6px 10px',borderRadius:10,border:`1px solid ${sc.c}30` }}>
                        <p style={{ fontSize:22,fontWeight:900,color:sc.c,margin:0,lineHeight:1 }}>{t.score}</p>
                        <span style={{ fontSize:8,color:sc.c,fontWeight:700 }}>{sc.label}</span>
                      </div>
                    </div>
                    <div style={{ height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,marginBottom:12,overflow:'hidden' }}>
                      <div style={{ height:'100%',width:`${t.score}%`,background:sc.bar,borderRadius:2,transition:'width .7s ease' }}/>
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6 }}>
                      {[{l:'أخطاء 24h',v:t.errors_24h,c:t.errors_24h>0?'#f97316':'rgba(255,255,255,0.4)'},{l:'تحذير 24h',v:t.warnings_24h,c:t.warnings_24h>0?'#f59e0b':'rgba(255,255,255,0.4)'},{l:'أخطاء 7d',v:t.errors_7d,c:t.errors_7d>5?'#ef4444':'rgba(255,255,255,0.4)'}].map(k=>(
                        <div key={k.l} style={{ background:'rgba(255,255,255,0.04)',borderRadius:6,padding:'7px 8px',textAlign:'center' }}>
                          <p style={{ fontSize:16,fontWeight:800,color:k.c,margin:0 }}>{k.v}</p>
                          <p style={{ fontSize:8,color:'rgba(255,255,255,0.3)',margin:0 }}>{k.l}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'flex',gap:5,marginTop:10 }}>
                      <span style={{ fontSize:9,padding:'2px 6px',borderRadius:3,background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.4)' }}>{PLAN[t.plan]||t.plan}</span>
                      <span style={{ fontSize:9,padding:'2px 6px',borderRadius:3,background:t.is_active?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)',color:t.is_active?'#6ee7b7':'#fca5a5' }}>{t.is_active?'نشط':'موقوف'}</span>
                      {isActive&&<span style={{ fontSize:9,padding:'2px 6px',borderRadius:3,background:'rgba(59,130,246,0.2)',color:'#93c5fd',fontWeight:700 }}>فلتر ✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ TOP ERRORS ═══════════════════════════════════════════════ */}
          {tab==='top-errors' && (
            <div style={{ background:'rgba(255,255,255,0.02)',borderRadius:14,border:'1px solid rgba(255,255,255,0.07)',overflow:'hidden' }}>
              <div style={{ padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'rgba(245,158,11,0.06)' }}>
                <p style={{ fontSize:13,fontWeight:700,color:'white',margin:0 }}>🔥 أكثر الأخطاء تكراراً — آخر 7 أيام</p>
              </div>
              <table style={{ width:'100%',borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'rgba(255,255,255,0.03)' }}>{['#','المصدر','رسالة الخطأ','التكرار','الشركات','المستوى','آخر ظهور'].map(h=><th key={h} style={{ padding:'9px 14px',textAlign:'right',fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.4)',borderBottom:'1px solid rgba(255,255,255,0.07)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {topErr.map((e,i)=>{
                    const lc=LVL[e.level as LogLevel]||LVL.error;
                    return <tr key={i} className="rh" style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding:'9px 14px',fontSize:11,color:'rgba(255,255,255,0.25)' }}>#{i+1}</td>
                      <td style={{ padding:'9px 14px' }}><span style={{ fontSize:11,fontFamily:'monospace',color:'#93c5fd' }}>{e.source}</span></td>
                      <td style={{ padding:'9px 14px',maxWidth:300 }}><p style={{ fontSize:11,color:'rgba(255,255,255,0.75)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{e.message}</p></td>
                      <td style={{ padding:'9px 14px' }}><span style={{ fontSize:14,fontWeight:800,padding:'3px 10px',borderRadius:6,background:lc.bg,color:lc.c }}>{e.count}</span></td>
                      <td style={{ padding:'9px 14px',fontSize:12,color:'rgba(255,255,255,0.5)' }}>{e.companies}</td>
                      <td style={{ padding:'9px 14px' }}><span style={{ fontSize:10,padding:'1px 6px',borderRadius:3,background:lc.bg,color:lc.c }}>{lc.label}</span></td>
                      <td style={{ padding:'9px 14px',fontSize:10,color:'rgba(255,255,255,0.3)' }}>{new Date(e.last_seen).toLocaleString('ar-SA')}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ══ SECURITY ════════════════════════════════════════════════ */}
          {tab==='security' && (
            <div style={{ background:'rgba(255,255,255,0.02)',borderRadius:14,border:'1px solid rgba(56,189,248,0.2)',overflow:'hidden' }}>
              <div style={{ padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'rgba(56,189,248,0.06)' }}>
                <p style={{ fontSize:13,fontWeight:700,color:'white',margin:0 }}>🔐 أحداث الأمان</p>
              </div>
              {secFeed.length===0 ? <p style={{ padding:32,textAlign:'center',color:'rgba(255,255,255,0.3)',fontSize:12 }}>✅ لا توجد أحداث أمنية</p>
                : secFeed.map((ev,i)=>(
                  <div key={ev.id} className="rh" style={{ padding:'11px 16px',borderBottom:i<secFeed.length-1?'1px solid rgba(255,255,255,0.04)':'none',display:'flex',gap:12,alignItems:'flex-start' }}>
                    <span style={{ fontSize:18,flexShrink:0 }}>{ev.event_type?.includes('fail')||ev.event_type?.includes('block')?'🚫':'🔑'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex',gap:8,marginBottom:3,alignItems:'center' }}>
                        <span style={{ fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.85)' }}>{ev.event_type}</span>
                        {ev.ip_address&&<span style={{ fontSize:10,fontFamily:'monospace',color:'rgba(255,255,255,0.4)',background:'rgba(255,255,255,0.06)',padding:'1px 6px',borderRadius:3 }}>{ev.ip_address}</span>}
                      </div>
                      <p style={{ fontSize:11,color:'rgba(255,255,255,0.5)',margin:0 }}>{ev.description}</p>
                    </div>
                    <span style={{ fontSize:10,color:'rgba(255,255,255,0.25)',flexShrink:0 }}>{new Date(ev.created_at).toLocaleString('ar-SA')}</span>
                  </div>
                ))}
            </div>
          )}

          {/* ══ ALERTS ══════════════════════════════════════════════════ */}
          {tab==='alerts' && (
            <div style={{ background:'rgba(255,255,255,0.02)',borderRadius:14,border:'1px solid rgba(139,92,246,0.2)',overflow:'hidden' }}>
              <div style={{ padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'rgba(139,92,246,0.06)' }}>
                <p style={{ fontSize:13,fontWeight:700,color:'white',margin:0 }}>📱 تنبيهات واتساب المُرسلة</p>
              </div>
              {alerts.length===0 ? <p style={{ padding:32,textAlign:'center',color:'rgba(255,255,255,0.3)',fontSize:12 }}>لم يُرسل أي تنبيه</p>
                : alerts.map((a,i)=>(
                  <div key={a.id} className="rh" style={{ padding:'11px 16px',borderBottom:i<alerts.length-1?'1px solid rgba(255,255,255,0.04)':'none' }}>
                    <div style={{ display:'flex',gap:8,alignItems:'center',marginBottom:5 }}>
                      <span style={{ fontSize:14 }}>📱</span>
                      <span style={{ fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.85)' }}>{a.recipient}</span>
                      <span style={{ fontSize:10,padding:'1px 7px',borderRadius:4,background:a.status==='sent'?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)',color:a.status==='sent'?'#6ee7b7':'#fca5a5',fontWeight:600 }}>{a.status==='sent'?'أُرسل':'فشل'}</span>
                      <span style={{ fontSize:10,color:'rgba(255,255,255,0.25)',marginRight:'auto' }}>{new Date(a.sent_at).toLocaleString('ar-SA')}</span>
                    </div>
                    <p style={{ fontSize:11,color:'rgba(255,255,255,0.5)',margin:0,whiteSpace:'pre-line',lineHeight:1.6,paddingRight:22 }}>{a.message_body.slice(0,250)}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── AI Chat Drawer ───────────────────────────────────────────── */}
      {showChat && <ChatDrawer onClose={()=>setShowChat(false)}/>}

      {/* ─── Resolve Modal ────────────────────────────────────────────── */}
      {resolveModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:600,backdropFilter:'blur(4px)' }}>
          <div style={{ background:'#0d1629',borderRadius:16,padding:24,width:380,boxShadow:'0 24px 80px rgba(0,0,0,.6)',border:'1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ fontSize:14,fontWeight:700,margin:'0 0 12px',color:'white' }}>✓ تأكيد إغلاق السجل</h3>
            <textarea value={resNote} onChange={e=>setResNote(e.target.value)} placeholder="ملاحظة الحل (اختياري)..."
              style={{ width:'100%',minHeight:80,padding:10,fontSize:12,borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.06)',color:'white',resize:'vertical',boxSizing:'border-box',outline:'none' }}/>
            <div style={{ display:'flex',gap:8,marginTop:14,justifyContent:'flex-end' }}>
              <button onClick={()=>setResolveModal(false)} style={{ fontSize:12,padding:'7px 16px',borderRadius:7,border:'1px solid rgba(255,255,255,0.12)',background:'transparent',color:'rgba(255,255,255,0.6)',cursor:'pointer' }}>إلغاء</button>
              <button onClick={handleResolve} style={{ fontSize:12,padding:'7px 16px',borderRadius:7,background:'#10b981',color:'white',border:'none',cursor:'pointer',fontWeight:700 }}>تأكيد الإغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
