'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

export default function NewCompanyPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    name:'', name_ar:'', slug:'', plan:'trial',
    max_units:50, max_staff:5,
    contact_email:'', contact_phone:'', city:'الرياض', cr_number:''
  });

  const f = (k: string) => (e: any) => setForm(p=>({...p,[k]:e.target.value}));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.slug) { setErr('الاسم والرابط مطلوبان'); return; }
    setSaving(true); setErr('');
    try {
      await adminApi.createCompany(form);
      router.push('/dashboard/companies');
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{minHeight:'100vh',background:'#f8fafc'}}>
      <div style={{background:'#1d4070',padding:'12px 24px',display:'flex',alignItems:'center',gap:16}}>
        <Link href="/dashboard/companies" style={{color:'#93c5fd',textDecoration:'none',fontSize:13}}>← الشركات</Link>
        <span style={{fontSize:14,fontWeight:700,color:'white'}}>إضافة شركة جديدة</span>
      </div>
      <div style={{padding:24,maxWidth:600,margin:'0 auto'}}>
        <div style={{background:'white',borderRadius:12,padding:24,border:'1px solid #e2e8f0'}}>
          <form onSubmit={handleSubmit}>
            {err && <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#dc2626'}}>{err}</div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              {[
                ['اسم الشركة *','name','text'],
                ['اسم بالعربي','name_ar','text'],
                ['رابط النظام * (slug)','slug','text'],
                ['رقم السجل التجاري','cr_number','text'],
                ['البريد الإلكتروني','contact_email','email'],
                ['رقم الجوال','contact_phone','text'],
              ].map(([label,key,type])=>(
                <div key={key as string}>
                  <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:4}}>{label}</label>
                  <input type={type as string} value={(form as any)[key as string]} onChange={f(key as string)}
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,outline:'none',boxSizing:'border-box' as any}} />
                </div>
              ))}
              <div>
                <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:4}}>الخطة</label>
                <select value={form.plan} onChange={f('plan')}
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,outline:'none'}}>
                  <option value="trial">تجريبي</option>
                  <option value="basic">أساسي</option>
                  <option value="professional">احترافي</option>
                  <option value="enterprise">مؤسسي</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:4}}>الحد الأقصى للوحدات</label>
                <input type="number" value={form.max_units} onChange={f('max_units')}
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,outline:'none',boxSizing:'border-box' as any}} />
              </div>
            </div>
            <div style={{marginTop:20,padding:'12px 14px',background:'#eff6ff',borderRadius:8,fontSize:11,color:'#1d4070'}}>
              الرابط سيكون: <strong>{form.slug||'...'}.app.liv-entra.com</strong>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20}}>
              <Link href="/dashboard/companies"
                style={{flex:1,padding:'10px',textAlign:'center',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,color:'#64748b',textDecoration:'none'}}>
                إلغاء
              </Link>
              <button type="submit" disabled={saving}
                style={{flex:2,padding:'10px',background:'#1d4070',color:'white',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',opacity:saving?0.6:1}}>
                {saving?'جاري...':'إنشاء الشركة'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}