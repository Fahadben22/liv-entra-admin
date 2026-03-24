'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

export default function BillingPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    adminApi.listCompanies()
      .then(r => setCompanies((r as any)?.data || []))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, []);

  const planCounts = {
    enterprise:   companies.filter(c=>c.plan==='enterprise').length,
    professional: companies.filter(c=>c.plan==='professional').length,
    basic:        companies.filter(c=>c.plan==='basic').length,
    trial:        companies.filter(c=>c.plan==='trial').length,
  };

  return (
    <div style={{minHeight:'100vh',background:'#f8fafc'}}>
      <div style={{background:'#1d4070',padding:'12px 24px',display:'flex',alignItems:'center',gap:16}}>
        <Link href="/dashboard" style={{color:'#93c5fd',textDecoration:'none',fontSize:13}}>← الرئيسية</Link>
        <span style={{fontSize:14,fontWeight:700,color:'white'}}>الفواتير والخطط</span>
      </div>
      <div style={{padding:24}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
          {[
            {l:'مؤسسي', v:planCounts.enterprise, c:'#92400e', bg:'#fef3c7'},
            {l:'احترافي', v:planCounts.professional, c:'#1d4070', bg:'#eff6ff'},
            {l:'أساسي', v:planCounts.basic, c:'#374151', bg:'#f8fafc'},
            {l:'تجريبي', v:planCounts.trial, c:'#15803d', bg:'#f0fdf4'},
          ].map(k=>(
            <div key={k.l} style={{background:'white',borderRadius:12,padding:'16px 20px',border:'1px solid #e2e8f0'}}>
              <p style={{fontSize:12,color:'#64748b',margin:'0 0 8px'}}>{k.l}</p>
              <p style={{fontSize:28,fontWeight:700,color:k.c,margin:0}}>{k.v}</p>
              <p style={{fontSize:10,color:'#94a3b8',margin:'4px 0 0'}}>شركة</p>
            </div>
          ))}
        </div>
        <div style={{background:'white',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid #e2e8f0'}}>
            <h2 style={{fontSize:14,fontWeight:600,margin:0}}>تفاصيل الخطط</h2>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#f8fafc'}}>
                {['الشركة','الخطة','الحد الأقصى','تنتهي التجربة','الحالة'].map(h=>(
                  <th key={h} style={{padding:'10px 16px',textAlign:'right',fontSize:11,fontWeight:600,color:'#64748b',borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{padding:24,textAlign:'center',color:'#94a3b8',fontSize:12}}>جاري التحميل...</td></tr>
              ) : companies.map((c,i)=>(
                <tr key={c.id} style={{borderBottom:i<companies.length-1?'1px solid #f1f5f9':'none'}}>
                  <td style={{padding:'12px 16px',fontSize:13,fontWeight:500}}>{c.name}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:c.plan==='enterprise'?'#fef3c7':c.plan==='professional'?'#eff6ff':'#f0fdf4',color:c.plan==='enterprise'?'#92400e':c.plan==='professional'?'#1d4070':'#15803d',fontWeight:500}}>
                      {c.plan==='enterprise'?'مؤسسي':c.plan==='professional'?'احترافي':c.plan==='trial'?'تجريبي':'أساسي'}
                    </span>
                  </td>
                  <td style={{padding:'12px 16px',fontSize:12,color:'#64748b'}}>{c.max_units} وحدة</td>
                  <td style={{padding:'12px 16px',fontSize:12,color:c.trial_ends_at&&new Date(c.trial_ends_at)<new Date()?'#ef4444':'#64748b',direction:'ltr'}}>
                    {c.trial_ends_at ? new Date(c.trial_ends_at).toLocaleDateString('ar-SA') : '—'}
                  </td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:c.is_active?'#f0fdf4':'#fef2f2',color:c.is_active?'#15803d':'#dc2626',fontWeight:500}}>
                      {c.is_active?'نشط':'موقوف'}
                    </span>
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