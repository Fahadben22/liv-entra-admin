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
    <div style={{minHeight:'100vh',background:'#f8fafc'}}>
      <div style={{background:'#1d4070',padding:'12px 24px',display:'flex',alignItems:'center',gap:16}}>
        <Link href="/dashboard" style={{color:'#93c5fd',textDecoration:'none',fontSize:13}}>← الرئيسية</Link>
        <span style={{fontSize:14,fontWeight:700,color:'white'}}>مراقبة النظام</span>
      </div>
      <div style={{padding:24}}>
        {/* System health */}
        <div style={{background:'white',borderRadius:12,padding:20,border:'1px solid #e2e8f0',marginBottom:20}}>
          <h2 style={{fontSize:14,fontWeight:600,margin:'0 0 16px'}}>حالة النظام</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {[
              {l:'API Backend', v:health?.status==='ok'?'يعمل':'توقف', c:health?.status==='ok'?'#15803d':'#dc2626', bg:health?.status==='ok'?'#f0fdf4':'#fef2f2'},
              {l:'Supabase DB', v:stats?'يعمل':'غير معروف', c:stats?'#15803d':'#94a3b8', bg:stats?'#f0fdf4':'#f8fafc'},
              {l:'Vercel Frontend', v:'يعمل', c:'#15803d', bg:'#f0fdf4'},
            ].map(s=>(
              <div key={s.l} style={{background:s.bg,borderRadius:8,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:'#374151',fontWeight:500}}>{s.l}</span>
                <span style={{fontSize:11,fontWeight:700,color:s.c}}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
          {loading ? <p style={{color:'#94a3b8'}}>جاري التحميل...</p> : [
            {l:'إجمالي الشركات', v:stats?.total_companies||0, c:'#1d4070'},
            {l:'إجمالي الوحدات', v:stats?.total_units||0, c:'#7c3aed'},
            {l:'عقود نشطة', v:stats?.active_contracts||0, c:'#15803d'},
          ].map(k=>(
            <div key={k.l} style={{background:'white',borderRadius:12,padding:'16px 20px',border:'1px solid #e2e8f0'}}>
              <p style={{fontSize:12,color:'#64748b',margin:'0 0 8px'}}>{k.l}</p>
              <p style={{fontSize:28,fontWeight:700,color:k.c,margin:0}}>{k.v}</p>
            </div>
          ))}
        </div>
        {/* Last check */}
        <p style={{fontSize:11,color:'#94a3b8',marginTop:16,direction:'ltr'}}>
          Last checked: {health?.ts ? new Date(health.ts).toLocaleString('ar-SA') : 'N/A'}
        </p>
      </div>
    </div>
  );
}