'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi, BASE } from '@/lib/api';

export default function MonitoringPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    Promise.all([
      adminApi.getStats(),
      fetch(`${BASE}/health`).then(r=>r.json()),
    ]).then(([s, h]) => { setStats((s as any)?.data); setHealth(h); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{padding:'12px 24px',display:'flex',alignItems:'center',gap:16,borderBottom:'1px solid var(--lv-line)'}}>
        <Link href="/dashboard" style={{color:'var(--lv-accent)',textDecoration:'none',fontSize:13}}>← الرئيسية</Link>
        <span style={{fontSize:18,fontWeight:600,color:'var(--lv-fg)',letterSpacing:'-0.02em'}}>مراقبة النظام</span>
      </div>
      <div style={{padding:24,maxWidth:1200,margin:'0 auto'}}>
        {/* System health */}
        <div className="card" style={{background:'var(--lv-panel)',borderRadius:14,padding:20,border:'none',boxShadow:'var(--lv-shadow-sm)',marginBottom:20}}>
          <h2 style={{fontSize:13,fontWeight:600,color:'var(--lv-fg)',margin:'0 0 16px'}}>حالة النظام</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {[
              {l:'API Backend', v:health?.status==='ok'?'يعمل':'توقف', c:health?.status==='ok'?'#16a34a':'#dc2626', dot:health?.status==='ok'?'#16a34a':'#dc2626'},
              {l:'Supabase DB', v:stats?'يعمل':'غير معروف', c:stats?'#16a34a':'var(--lv-muted)', dot:stats?'#16a34a':'var(--lv-muted)'},
              {l:'Vercel Frontend', v:'يعمل', c:'#16a34a', dot:'#16a34a'},
            ].map(s=>(
              <div key={s.l} style={{background:'var(--lv-bg)',borderRadius:14,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid var(--lv-line)'}}>
                <span style={{fontSize:13,color:'var(--lv-muted)',fontWeight:500}}>{s.l}</span>
                <span style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:6,height:6,borderRadius:'50%',background:s.dot,boxShadow:`0 0 6px ${s.dot}66`,display:'inline-block'}}/>
                  <span style={{fontSize:11,fontWeight:600,color:s.c}}>{s.v}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
          {loading ? <p style={{color:'var(--lv-muted)',fontSize:13}}>جاري التحميل...</p> : [
            {l:'إجمالي الشركات', v:stats?.total_companies||0},
            {l:'إجمالي الوحدات', v:stats?.total_units||0},
            {l:'عقود نشطة', v:stats?.active_contracts||0},
          ].map(k=>(
            <div key={k.l} className="card" style={{background:'var(--lv-panel)',borderRadius:14,padding:'16px 20px',border:'none',boxShadow:'var(--lv-shadow-sm)'}}>
              <p style={{fontSize:11,color:'var(--lv-muted)',margin:'0 0 8px',fontWeight:500}}>{k.l}</p>
              <p style={{fontSize:28,fontWeight:600,color:'var(--lv-fg)',margin:0}}>{k.v}</p>
            </div>
          ))}
        </div>
        {/* Last check */}
        <p style={{fontSize:11,color:'var(--lv-muted)',marginTop:16,direction:'ltr'}}>
          Last checked: {health?.ts ? new Date(health.ts).toLocaleString('en-US') : 'N/A'}
        </p>
      </div>
    </div>
  );
}
