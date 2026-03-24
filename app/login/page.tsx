'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [secret, setSecret] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || 'https://liv-entra-api-production.up.railway.app/api/v1') + '/admin/login',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret }) }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'فشل تسجيل الدخول');
      localStorage.setItem('admin_token', json.data?.token);
      localStorage.setItem('admin_user', JSON.stringify(json.data?.user));
      router.push('/dashboard');
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#1d4070 0%,#0f2647 100%)'}}>
      <div style={{background:'white',borderRadius:16,padding:40,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{width:56,height:56,borderRadius:14,background:'#1d4070',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',fontSize:24}}>⚡</div>
          <h1 style={{fontSize:20,fontWeight:700,color:'#0f172a',margin:0}}>Liventra OS</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:4}}>لوحة تحكم المشغّل</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12,color:'#64748b',display:'block',marginBottom:6}}>مفتاح الدخول</label>
            <input
              type="password" value={secret} onChange={e=>setSecret(e.target.value)}
              placeholder="أدخل المفتاح السري"
              style={{width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,outline:'none',boxSizing:'border-box' as any,direction:'ltr'}}
            />
          </div>
          {err && <p style={{fontSize:11,color:'#ef4444',marginBottom:12}}>{err}</p>}
          <button type="submit" disabled={loading||!secret}
            style={{width:'100%',padding:'11px',background:'#1d4070',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',opacity:loading||!secret?0.6:1}}>
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}