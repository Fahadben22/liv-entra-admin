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
    <div style={{background:'#fafafa'}}>
      <div style={{background:'#fff',padding:'12px 24px',display:'flex',alignItems:'center',gap:16,borderBottom:'1px solid #e5e5e5'}}>
        <Link href="/dashboard" style={{color:'#71717a',textDecoration:'none',fontSize:13}}>← الرئيسية</Link>
        <span style={{fontSize:18,fontWeight:600,color:'#18181b',letterSpacing:'-0.02em'}}>مراقبة النظام</span>
      </div>
      <div style={{padding:24,maxWidth:1200,margin:'0 auto'}}>
        {/* System health */}
        <div style={{background:'#fff',borderRadius:8,padding:20,border:'1px solid #e5e5e5',marginBottom:20}}>
          <h2 style={{fontSize:13,fontWeight:600,color:'#18181b',margin:'0 0 16px'}}>حالة النظام</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {[
              {l:'API Backend', v:health?.status==='ok'?'يعمل':'توقف', c:health?.status==='ok'?'#16a34a':'#dc2626', bg:health?.status==='ok'?'#f0fdf4':'#fef2f2'},
              {l:'Supabase DB', v:stats?'يعمل':'غير معروف', c:stats?'#16a34a':'#a1a1aa', bg:stats?'#f0fdf4':'#fafafa'},
              {l:'Vercel Frontend', v:'يعمل', c:'#16a34a', bg:'#f0fdf4'},
            ].map(s=>(
              <div key={s.l} style={{background:s.bg,borderRadius:8,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid #f0f0f0'}}>
                <span style={{fontSize:13,color:'#3f3f46',fontWeight:500}}>{s.l}</span>
                <span style={{fontSize:11,fontWeight:600,color:s.c}}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
          {loading ? <p style={{color:'#a1a1aa',fontSize:13}}>جاري التحميل...</p> : [
            {l:'إجمالي الشركات', v:stats?.total_companies||0, c:'#18181b'},
            {l:'إجمالي الوحدات', v:stats?.total_units||0, c:'#18181b'},
            {l:'عقود نشطة', v:stats?.active_contracts||0, c:'#18181b'},
          ].map(k=>(
            <div key={k.l} style={{background:'#fff',borderRadius:8,padding:'16px 20px',border:'1px solid #e5e5e5'}}>
              <p style={{fontSize:11,color:'#a1a1aa',margin:'0 0 8px',fontWeight:500}}>{k.l}</p>
              <p style={{fontSize:28,fontWeight:600,color:k.c,margin:0}}>{k.v}</p>
            </div>
          ))}
        </div>
        {/* Last check */}
        <p style={{fontSize:11,color:'#a1a1aa',marginTop:16,direction:'ltr'}}>
          Last checked: {health?.ts ? new Date(health.ts).toLocaleString('ar-SA') : 'N/A'}
        </p>
      </div>
    </div>
  );
}
