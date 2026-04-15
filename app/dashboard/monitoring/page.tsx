'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

export default function MonitoringPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    Promise.all([
      adminApi.getStats(),
      fetch('https://liv-entra-api-production.up.railway.app/api/v1/health').then(r=>r.json()),
    ]).then(([s, h]) => { setStats((s as any)?.data); setHealth(h); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{padding:'12px 24px',display:'flex',alignItems:'center',gap:16,borderBottom:'1px solid rgba(0,0,0,.08)'}}>
        <Link href="/dashboard" style={{color:'#2563EB',textDecoration:'none',fontSize:13}}>← الرئيسية</Link>
        <span style={{fontSize:18,fontWeight:600,color:'#1E293B',letterSpacing:'-0.02em'}}>مراقبة النظام</span>
      </div>
      <div style={{padding:24,maxWidth:1200,margin:'0 auto'}}>
        {/* System health */}
        <div className="card" style={{background:'#fff',borderRadius:14,padding:20,border:'none',boxShadow:'0 1px 3px rgba(0,0,0,.06)',marginBottom:20}}>
          <h2 style={{fontSize:13,fontWeight:600,color:'#1E293B',margin:'0 0 16px'}}>حالة النظام</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {[
              {l:'API Backend', v:health?.status==='ok'?'يعمل':'توقف', c:health?.status==='ok'?'#16a34a':'#dc2626', dot:health?.status==='ok'?'#16a34a':'#dc2626'},
              {l:'Supabase DB', v:stats?'يعمل':'غير معروف', c:stats?'#16a34a':'#6b7280', dot:stats?'#16a34a':'#6b7280'},
              {l:'Vercel Frontend', v:'يعمل', c:'#16a34a', dot:'#16a34a'},
            ].map(s=>(
              <div key={s.l} style={{background:'#F1F5F9',borderRadius:14,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid rgba(0,0,0,.06)'}}>
                <span style={{fontSize:13,color:'#6b7280',fontWeight:500}}>{s.l}</span>
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
          {loading ? <p style={{color:'#6b7280',fontSize:13}}>جاري التحميل...</p> : [
            {l:'إجمالي الشركات', v:stats?.total_companies||0},
            {l:'إجمالي الوحدات', v:stats?.total_units||0},
            {l:'عقود نشطة', v:stats?.active_contracts||0},
          ].map(k=>(
            <div key={k.l} className="card" style={{background:'#fff',borderRadius:14,padding:'16px 20px',border:'none',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
              <p style={{fontSize:11,color:'#6b7280',margin:'0 0 8px',fontWeight:500}}>{k.l}</p>
              <p style={{fontSize:28,fontWeight:600,color:'#1E293B',margin:0}}>{k.v}</p>
            </div>
          ))}
        </div>
        {/* Last check */}
        <p style={{fontSize:11,color:'#9ca3af',marginTop:16,direction:'ltr'}}>
          Last checked: {health?.ts ? new Date(health.ts).toLocaleString('en-US') : 'N/A'}
        </p>
      </div>
    </div>
  );
}
