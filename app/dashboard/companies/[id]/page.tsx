'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

export default function CompanyDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  function load() {
    adminApi.getCompany(id)
      .then(r => setCompany((r as any)?.data))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    load();
  }, [id]);

  async function toggleStatus() {
    setSaving(true); setMsg('');
    try {
      if (company.is_active) await adminApi.suspendCompany(id);
      else await adminApi.activateCompany(id);
      setMsg(company.is_active ? 'تم إيقاف الشركة' : 'تم تفعيل الشركة');
      load();
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  async function upgradePlan(plan: string) {
    setSaving(true);
    try {
      await adminApi.updateCompany(id, { plan });
      setMsg('تم تحديث الخطة');
      load();
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><p style={{color:'#94a3b8'}}>جاري التحميل...</p></div>;
  if (!company) return null;

  const usage = company.usage || {};
  const occupancyRate = usage.total_units > 0 ? Math.round((usage.occupied_units / usage.total_units) * 100) : 0;
  const unitUsagePct = company.max_units > 0 ? Math.round((usage.total_units / company.max_units) * 100) : 0;

  return (
    <div style={{minHeight:'100vh',background:'#f8fafc'}}>
      <div style={{background:'#1d4070',padding:'12px 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <Link href="/dashboard/companies" style={{color:'#93c5fd',textDecoration:'none',fontSize:13}}>← الشركات</Link>
          <span style={{fontSize:14,fontWeight:700,color:'white'}}>{company.name}</span>
          <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:company.is_active?'#16a34a':'#dc2626',color:'white'}}>
            {company.is_active?'نشط':'موقوف'}
          </span>
        </div>
        <button onClick={toggleStatus} disabled={saving}
          style={{fontSize:12,padding:'6px 14px',borderRadius:8,background:company.is_active?'#dc2626':'#16a34a',color:'white',border:'none',cursor:'pointer',opacity:saving?0.6:1}}>
          {saving?'جاري...':company.is_active?'إيقاف الشركة':'تفعيل الشركة'}
        </button>
      </div>

      <div style={{padding:24}}>
        {msg && <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#15803d'}}>{msg}</div>}

        {/* KPI row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:20}}>
          {[
            {l:'إجمالي الوحدات', v:usage.total_units||0, sub:`من أصل ${company.max_units}`, c:'#1d4070'},
            {l:'نسبة الإشغال', v:occupancyRate+'%', sub:`${usage.occupied_units||0} وحدة مشغولة`, c:occupancyRate>=80?'#15803d':occupancyRate>=50?'#d97706':'#dc2626'},
            {l:'عقود نشطة', v:usage.active_contracts||0, sub:'عقد جاري', c:'#7c3aed'},
            {l:'عدد الموظفين', v:usage.total_staff||0, sub:`من أصل ${company.max_staff}`, c:'#0891b2'},
          ].map(k=>(
            <div key={k.l} style={{background:'white',borderRadius:12,padding:'16px 20px',border:'1px solid #e2e8f0'}}>
              <p style={{fontSize:11,color:'#64748b',margin:'0 0 6px'}}>{k.l}</p>
              <p style={{fontSize:24,fontWeight:700,color:k.c,margin:'0 0 4px'}}>{k.v}</p>
              <p style={{fontSize:10,color:'#94a3b8',margin:0}}>{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Usage bar */}
        <div style={{background:'white',borderRadius:12,padding:'16px 20px',border:'1px solid #e2e8f0',marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{fontSize:12,fontWeight:500}}>استخدام الخطة</span>
            <span style={{fontSize:12,color:unitUsagePct>=90?'#dc2626':'#64748b'}}>{unitUsagePct}%</span>
          </div>
          <div style={{height:8,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}>
            <div style={{height:'100%',width:unitUsagePct+'%',background:unitUsagePct>=90?'#dc2626':unitUsagePct>=70?'#f59e0b':'#22c55e',borderRadius:4,transition:'width 0.3s'}} />
          </div>
          <p style={{fontSize:10,color:'#94a3b8',marginTop:4}}>{usage.total_units||0} وحدة مستخدمة من أصل {company.max_units}</p>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {/* Company info */}
          <div style={{background:'white',borderRadius:12,padding:'16px 20px',border:'1px solid #e2e8f0'}}>
            <h3 style={{fontSize:13,fontWeight:600,margin:'0 0 16px'}}>بيانات الشركة</h3>
            {[
              ['الاسم', company.name],
              ['الرابط', company.slug+'.app.liv-entra.com'],
              ['الخطة', company.plan],
              ['البريد', company.contact_email||'—'],
              ['الجوال', company.contact_phone||'—'],
              ['السجل التجاري', company.cr_number||'—'],
              ['تاريخ التسجيل', new Date(company.created_at).toLocaleDateString('ar-SA')],
              ['نهاية التجربة', company.trial_ends_at ? new Date(company.trial_ends_at).toLocaleDateString('ar-SA') : '—'],
            ].map(([k,v])=>(
              <div key={k as string} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #f1f5f9'}}>
                <span style={{fontSize:11,color:'#94a3b8'}}>{k}</span>
                <span style={{fontSize:11,fontWeight:500,color:'#374151'}}>{v as string}</span>
              </div>
            ))}
          </div>

          {/* Plan upgrade */}
          <div style={{background:'white',borderRadius:12,padding:'16px 20px',border:'1px solid #e2e8f0'}}>
            <h3 style={{fontSize:13,fontWeight:600,margin:'0 0 16px'}}>تغيير الخطة</h3>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                {key:'trial', label:'تجريبي', units:50, price:'مجاني', color:'#15803d'},
                {key:'basic', label:'أساسي', units:100, price:'299 ر.س/شهر', color:'#374151'},
                {key:'professional', label:'احترافي', units:500, price:'799 ر.س/شهر', color:'#1d4070'},
                {key:'enterprise', label:'مؤسسي', units:99999, price:'حسب الاتفاق', color:'#92400e'},
              ].map(p=>(
                <div key={p.key} onClick={()=>!saving&&upgradePlan(p.key)}
                  style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',borderRadius:8,border:`2px solid ${company.plan===p.key?p.color:'#e2e8f0'}`,background:company.plan===p.key?p.color+'10':'white',cursor:'pointer',transition:'all 0.15s'}}>
                  <div>
                    <p style={{fontSize:12,fontWeight:600,margin:0,color:p.color}}>{p.label}</p>
                    <p style={{fontSize:10,color:'#94a3b8',margin:0}}>حتى {p.units===99999?'غير محدود':p.units+' وحدة'}</p>
                  </div>
                  <span style={{fontSize:11,fontWeight:600,color:p.color}}>{p.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}