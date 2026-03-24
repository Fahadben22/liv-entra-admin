'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    adminApi.listCompanies()
      .then(r => setCompanies((r as any)?.data || []))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = companies.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.slug?.includes(search)
  );

  return (
    <div style={{minHeight:'100vh',background:'#f8fafc'}}>
      <div style={{background:'#1d4070',padding:'12px 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <Link href="/dashboard" style={{color:'#93c5fd',textDecoration:'none',fontSize:13}}>← الرئيسية</Link>
          <span style={{fontSize:14,fontWeight:700,color:'white'}}>إدارة الشركات</span>
        </div>
        <Link href="/dashboard/companies/new"
          style={{fontSize:12,padding:'6px 14px',borderRadius:8,background:'white',color:'#1d4070',textDecoration:'none',fontWeight:600}}>
          + إضافة شركة
        </Link>
      </div>
      <div style={{padding:24}}>
        <div style={{marginBottom:16,display:'flex',gap:12,alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الرابط..."
            style={{padding:'8px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,outline:'none',minWidth:250}} dir="rtl" />
          <span style={{fontSize:12,color:'#94a3b8'}}>{filtered.length} شركة</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:16}}>
          {loading ? <p style={{color:'#94a3b8'}}>جاري التحميل...</p> : filtered.map(c => (
            <div key={c.id} style={{background:'white',borderRadius:12,padding:20,border:'1px solid #e2e8f0',boxShadow:'0 1px 3px rgba(0,0,0,.05)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:12}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:36,height:36,borderRadius:8,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,color:'#1d4070'}}>
                    {c.name?.charAt(0)}
                  </div>
                  <div>
                    <p style={{fontSize:13,fontWeight:600,margin:0}}>{c.name}</p>
                    <p style={{fontSize:11,color:'#94a3b8',margin:0}}>{c.slug}.app.liv-entra.com</p>
                  </div>
                </div>
                <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:c.is_active?'#f0fdf4':'#fef2f2',color:c.is_active?'#15803d':'#dc2626',fontWeight:500}}>
                  {c.is_active?'نشط':'موقوف'}
                </span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                {[
                  ['الخطة', c.plan==='enterprise'?'مؤسسي':c.plan==='professional'?'احترافي':c.plan==='trial'?'تجريبي':'أساسي'],
                  ['الحد الأقصى', (c.max_units||0)+' وحدة'],
                  ['تاريخ التسجيل', new Date(c.created_at).toLocaleDateString('ar-SA')],
                  ['التواصل', c.contact_email||'—'],
                ].map(([k,v])=>(
                  <div key={k as string}>
                    <p style={{fontSize:9,color:'#94a3b8',margin:0}}>{k}</p>
                    <p style={{fontSize:11,fontWeight:500,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v}</p>
                  </div>
                ))}
              </div>
              <Link href={`/dashboard/companies/${c.id}`}
                style={{display:'block',textAlign:'center',fontSize:12,padding:'7px',borderRadius:8,border:'1px solid #e2e8f0',color:'#1d4070',textDecoration:'none',fontWeight:500}}>
                عرض التفاصيل
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}