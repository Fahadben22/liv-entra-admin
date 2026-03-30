'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://liv-entra-api-production.up.railway.app/api/v1';

async function tryNewLogin(email: string, password: string) {
  const res = await fetch(`${BASE}/superadmin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'failed');
  return { token: json.data?.token, user: json.data?.adminUser || json.data?.user };
}

async function tryOldLogin(secret: string) {
  const res = await fetch(`${BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'failed');
  return { token: json.data?.token, user: json.data?.user };
}

export default function AdminLogin() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [err,      setErr]      = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      let result: { token: string; user: any } | null = null;

      // 1. Try new email+password endpoint (requires superadmin_migration.sql to have run)
      try {
        result = await tryNewLogin(email, password);
      } catch {
        // New endpoint failed for any reason (table missing, wrong creds, etc.)
        // Always fall back to old secret-based login — uses password field as SUPER_ADMIN_SECRET
        try {
          result = await tryOldLogin(password);
        } catch {
          throw new Error('بيانات الدخول غير صحيحة');
        }
      }

      if (!result?.token) throw new Error('لم يتم استلام رمز المصادقة');
      localStorage.setItem('admin_token', result.token);
      localStorage.setItem('admin_user',  JSON.stringify(result.user || { name: 'Admin', role: 'super_admin' }));
      router.push('/dashboard');
    } catch (e: any) {
      setErr(e.message === 'failed' ? 'بيانات الدخول غير صحيحة' : e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24 }}>⚡</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>Liventra OS</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>لوحة التحكم — Super Admin</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>البريد الإلكتروني</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@liv-entra.com"
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', direction: 'ltr' }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>كلمة المرور / المفتاح السري</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', direction: 'ltr' }}
            />
            <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 5, marginBottom: 0 }}>
              أدخل كلمة مرور حساب المشرف أو المفتاح السري (SUPER_ADMIN_SECRET)
            </p>
          </div>
          {err && <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 12, textAlign: 'center', padding: '8px', background: '#fef2f2', borderRadius: 8 }}>{err}</p>}
          <button type="submit" disabled={loading || !email || !password}
            style={{ width: '100%', padding: '11px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading || !email || !password ? 0.6 : 1 }}>
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
