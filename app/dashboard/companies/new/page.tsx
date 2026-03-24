'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

export default function NewCompanyPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState<any>(null);
  const [form, setForm] = useState({
    name:'', name_ar:'', slug:'', plan:'trial',
    max_units:50, max_staff:5,
    contact_email:'', contact_phone:'', city:'الرياض', cr_number:'',
    admin_name:'', admin_email:'', admin_phone:''
  });

  const f = (k: string) => (e: any) => setForm(p => ({...p, [k]: e.target.value}));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.slug || !form.admin_email) {
      setErr('الاسم والرابط وبريد المدير مطلوبة');
      return;
    }
    setSaving(true); setErr('');
    try {
      const res: any = await adminApi.createCompany(form);
      setSuccess(res?.data);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  // Success screen
  if (success) {
    return (
      <div style={{minHeight:'100vh',background:'#f8fafc'}}>
        <div style={{background:'#1d4070',padding:'12px 24px',display:'flex',alignItems:'center',gap:16}}>
          <span style={{fontSize:14,fontWeight:700,color:'white'}}>Liventra OS — Admin</span>
        </div>
        <div style={{padding:24,maxWidth:560,margin:'0 auto'}}>
          <div style={{background:'white',borderRadius:12,padding:32,border:'1px solid #e2e8f0',textAlign:'center'}}>
            <div style={{width:64,height:64,borderRadius:'50%',background:'#f0fdf4',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:28}}>
              ✅
            </div>
            <h2 style={{fontSize:18,fontWeight:700,color:'#0f172a',margin:'0 0 8px'}}>تم إنشاء الشركة بنجاح</h2>
            <p style={{fontSize:13,color:'#64748b',margin:'0 0 24px'}}>تم إرسال بريد الترحيب إلى {success.staff?.email || form.admin_email}</p>
            <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'16px 20px',textAlign:'right',marginBottom:20}}>
              <p style={{fontSize:11,color:'#64748b',margin:'0 0 12px',fontWeight:600}}>تفاصيل الدخول</p>
              {[
                ['اسم الشركة', success.company?.name],
                ['رابط الدخول', success.login_url],
                ['كلمة المرور المؤقتة', success.temp_password],
                ['البريد الإلكتروني للمدير', success.staff?.email || form.admin_email],
                ['حالة البريد', success.email_sent ? '✅ تم الإرسال' : '⚠️ تعذّر الإرسال'],
              ].map(([k,v])=>(
                <div key={k as string} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #dbeafe'}}>
                  <span style={{fontSize:12,color:'#64748b'}}>{k}</span>
                  <span style={{fontSize:12,fontWeight:600,color:'#1d4070',direction:'ltr'}}>{v as string}</span>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setSuccess(null)}
                style={{flex:1,padding:'10px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,cursor:'pointer',background:'white',color:'#64748b'}}>
                إضافة شركة أخرى
              </button>
              <button onClick={()=>router.push('/dashboard/companies')}
                style={{flex:2,padding:'10px',background:'#1d4070',color:'white',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                عرض جميع الشركات
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',background:'#f8fafc'}}>
      <div style={{background:'#1d4070',padding:'12px 24px',display:'flex',alignItems:'center',gap:16}}>
        <Link href="/dashboard/companies" style={{color:'#93c5fd',textDecoration:'none',fontSize:13}}>← الشركات</Link>
        <span style={{fontSize:14,fontWeight:700,color:'white'}}>إضافة شركة جديدة</span>
      </div>
      <div style={{padding:24,maxWidth:620,margin:'0 auto'}}>
        <form onSubmit={handleSubmit}>
          {err && <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#dc2626'}}>{err}</div>}

          {/* Company info */}
          <div style={{background:'white',borderRadius:12,padding:24,border:'1px solid #e2e8f0',marginBottom:16}}>
            <h3 style={{fontSize:13,fontWeight:600,margin:'0 0 16px',color:'#374151'}}>بيانات الشركة</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {[
                ['اسم الشركة *','name','text'],
                ['اسم بالعربي','name_ar','text'],
                ['رابط النظام * (slug)','slug','text'],
                ['رقم السجل التجاري','cr_number','text'],
                ['بريد الشركة','contact_email','email'],
                ['هاتف الشركة','contact_phone','text'],
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
                  <option value="trial">تجريبي — 30 يوم</option>
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
            {form.slug && (
              <div style={{marginTop:12,padding:'8px 12px',background:'#eff6ff',borderRadius:8,fontSize:11,color:'#1d4070'}}>
                رابط الشركة: <strong>{form.slug}.app.liv-entra.com</strong>
              </div>
            )}
          </div>

          {/* Admin user info */}
          <div style={{background:'white',borderRadius:12,padding:24,border:'1px solid #e2e8f0',marginBottom:16}}>
            <h3 style={{fontSize:13,fontWeight:600,margin:'0 0 4px',color:'#374151'}}>بيانات مدير النظام</h3>
            <p style={{fontSize:11,color:'#94a3b8',margin:'0 0 16px'}}>سيتلقى بريد ترحيب مع بيانات الدخول</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {[
                ['اسم المدير','admin_name','text'],
                ['رقم الجوال','admin_phone','text'],
                ['البريد الإلكتروني *','admin_email','email'],
              ].map(([label,key,type])=>(
                <div key={key as string}>
                  <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:4}}>{label}</label>
                  <input type={type as string} value={(form as any)[key as string]} onChange={f(key as string)}
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,outline:'none',boxSizing:'border-box' as any}} />
                </div>
              ))}
            </div>
          </div>

          <div style={{display:'flex',gap:10}}>
            <Link href="/dashboard/companies"
              style={{flex:1,padding:'10px',textAlign:'center',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,color:'#64748b',textDecoration:'none'}}>
              إلغاء
            </Link>
            <button type="submit" disabled={saving}
              style={{flex:2,padding:'10px',background:'#1d4070',color:'white',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',opacity:saving?0.6:1}}>
              {saving?'جاري الإنشاء...':'إنشاء الشركة وإرسال بريد الترحيب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}