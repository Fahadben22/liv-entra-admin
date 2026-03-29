'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    Promise.all([adminApi.getStats(), adminApi.listCompanies()])
      .then(([s, c]) => { setStats((s as any)?.data); setCompanies((c as any)?.data || []); })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><p style={{color:'#94a3b8'}}>جاري التحميل...</p></div>;

  const activeCompanies = companies.filter(c => c.is_active);
  const trialCompanies  = companies.filter(c => c.plan === 'trial');

  return (
    <div style={{minHeight:'100vh',background:'#f8fafc'}}>
      {/* Top nav */}
      <div style={{background:'#1d4070',padding:'12px 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:18}}>⚡</span>
          <span style={{fontSize:14,fontWeight:700,color:'white'}}>Liventra OS — Admin</span>
        </div>
        <div style={{display:'flex',gap:16,alignItems:'center'}}>
          <Link href="/dashboard/companies" style={{fontSize:12,color:'#93c5fd',textDecoration:'none'}}>الشركات</Link>
          <Link href="/dashboard/billing" style={{fontSize:12,color:'#93c5fd',textDecoration:'none'}}>الفواتير</Link>
          <Link href="/dashboard/monitoring"    style={{fontSize:12,color:'#93c5fd',textDecoration:'none'}}>المراقبة</Link>
          <Link href="/dashboard/intelligence"  style={{fontSize:12,color:'#93c5fd',textDecoration:'none'}}>🧠 الذكاء</Link>
          <button onClick={()=>{localStorage.clear();router.push('/login');}}
            style={{fontSize:11,padding:'4px 12px',borderRadius:6,background:'rgba(255,255,255,.15)',color:'white',border:'none',cursor:'pointer'}}>
            خروج
          </button>
        </div>
      </div>

      <div style={{padding:24}}>
        <div style={{marginBottom:24}}>
          <h1 style={{fontSize:20,fontWeight:700,margin:0}}>لوحة التحكم الرئيسية</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:4}}>إجمالي الشركات المسجلة على Liventra OS</p>
        </div>

        {/* KPI Cards */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
          {[
            {l:'إجمالي الشركات',  v:companies.length,        c:'#1d4070', icon:'🏢'},
            {l:'شركات نشطة',      v:activeCompanies.length,  c:'#16a34a', icon:'✅'},
            {l:'في فترة التجربة', v:trialCompanies.length,   c:'#d97706', icon:'⏳'},
            {l:'إجمالي الوحدات',  v:stats?.total_units||0,   c:'#7c3aed', icon:'🏠'},
          ].map(k=>(
            <div key={k.l} style={{background:'white',borderRadius:12,padding:'16px 20px',border:'1px solid #e2e8f0',boxShadow:'0 1px 3px rgba(0,0,0,.05)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:8}}>
                <p style={{fontSize:12,color:'#64748b',margin:0}}>{k.l}</p>
                <span style={{fontSize:20}}>{k.icon}</span>
              </div>
              <p style={{fontSize:28,fontWeight:700,color:k.c,margin:0}}>{k.v}</p>
            </div>
          ))}
        </div>

        {/* Companies table */}
        <div style={{background:'white',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <h2 style={{fontSize:14,fontWeight:600,margin:0}}>الشركات المسجلة</h2>
            <Link href="/dashboard/companies/new"
              style={{fontSize:12,padding:'6px 14px',borderRadius:8,background:'#1d4070',color:'white',textDecoration:'none',fontWeight:500}}>
              + إضافة شركة
            </Link>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#f8fafc'}}>
                {['الشركة','الخطة','الحد الأقصى','الحالة','تاريخ التسجيل','إجراءات'].map(h=>(
                  <th key={h} style={{padding:'10px 16px',textAlign:'right',fontSize:11,fontWeight:600,color:'#64748b',borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c,i) => (
                <tr key={c.id} style={{borderBottom:i<companies.length-1?'1px solid #f1f5f9':'none'}}>
                  <td style={{padding:'12px 16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:32,height:32,borderRadius:8,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#1d4070'}}>
                        {c.name?.charAt(0)}
                      </div>
                      <div>
                        <p style={{fontSize:13,fontWeight:500,margin:0}}>{c.name}</p>
                        <p style={{fontSize:11,color:'#94a3b8',margin:0}}>{c.slug}.app.liv-entra.com</p>
                      </div>
                    </div>
                  </td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:c.plan==='enterprise'?'#fef3c7':c.plan==='professional'?'#eff6ff':c.plan==='trial'?'#f0fdf4':'#f8fafc',color:c.plan==='enterprise'?'#92400e':c.plan==='professional'?'#1d4070':c.plan==='trial'?'#15803d':'#64748b',fontWeight:500}}>
                      {c.plan==='enterprise'?'مؤسسي':c.plan==='professional'?'احترافي':c.plan==='trial'?'تجريبي':'أساسي'}
                    </span>
                  </td>
                  <td style={{padding:'12px 16px',fontSize:12,color:'#64748b'}}>{c.max_units} وحدة</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:c.is_active?'#f0fdf4':'#fef2f2',color:c.is_active?'#15803d':'#dc2626',fontWeight:500}}>
                      {c.is_active?'نشط':'موقوف'}
                    </span>
                  </td>
                  <td style={{padding:'12px 16px',fontSize:11,color:'#94a3b8',direction:'ltr'}}>
                    {new Date(c.created_at).toLocaleDateString('ar-SA')}
                  </td>
                  <td style={{padding:'12px 16px'}}>
                    <Link href={`/dashboard/companies/${c.id}`}
                      style={{fontSize:11,padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',color:'#1d4070',textDecoration:'none'}}>
                      تفاصيل
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}