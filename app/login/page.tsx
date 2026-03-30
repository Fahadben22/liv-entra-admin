'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://liv-entra-api-production.up.railway.app/api/v1';

export default function AdminLogin() {
  const router = useRouter();
  const [secret,  setSecret]  = useState('');
  const [err,     setErr]     = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const res = await fetch(`${BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'فشل تسجيل الدخول');
      localStorage.setItem('admin_token', json.data?.token);
      localStorage.setItem('admin_user',  JSON.stringify(json.data?.user || { name: 'Admin', role: 'super_admin' }));
      router.push('/dashboard');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24 }}>⚡</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>Liventra OS</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>لوحة التحكم — Super Admin</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>المفتاح السري</label>
            <input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="أدخل المفتاح السري"
              autoFocus
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', direction: 'ltr' }}
            />
          </div>
          {err && (
            <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 14, textAlign: 'center', padding: '8px 12px', background: '#fef2f2', borderRadius: 8 }}>
              {err}
            </p>
          )}
          <button type="submit" disabled={loading || !secret}
            style={{ width: '100%', padding: '12px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: loading || !secret ? 0.6 : 1 }}>
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
