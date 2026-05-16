'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://liv-entra-api-production.up.railway.app/api/v1';

export default function AdminLogin() {
  const router  = useRouter();
  const [code,    setCode]    = useState('');
  const [err,     setErr]     = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submit(totp_code: string) {
    if (loading) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch(`${BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totp_code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'فشل تسجيل الدخول');

      localStorage.setItem('admin_token', json.data?.token);
      localStorage.setItem('admin_user', JSON.stringify(json.data?.user || { name: 'Admin', role: 'super_admin' }));

      await fetch('/api/auth/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: json.data?.token }),
      }).catch(() => {});

      router.push('/dashboard');
    } catch (e: any) {
      setErr(e.message);
      setCode('');
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
    if (val.length === 6) submit(val);
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #062b1f 0%, #0E5C3F 60%, #083325 100%)',
      fontFamily: "'Thmanyah', system-ui, sans-serif",
      direction: 'rtl',
    }}>
      {/* Card */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--r-2xl)',
        padding: '40px 36px',
        width: '100%',
        maxWidth: 380,
        boxShadow: 'var(--sh-lg)',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <svg width={52} height={52} viewBox="0 0 120 120">
            <path d="M60 6 L114 60 L60 114 L6 60 Z" fill="#0E5C3F" />
            <path d="M60 30 L90 60 L60 90 L48 78 L66 60 L48 42 Z" fill="#F4EDE0" />
          </svg>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 6px' }}>
          LIV ENTRA
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 6px', letterSpacing: '.1em' }}>
          ليڤ إنترا
        </p>
        <span className="le-badge brand" style={{ marginBottom: 28, display: 'inline-flex' }}>بوابة المسؤول</span>

        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', margin: '0 0 24px' }}>
          أدخل الرمز من Google Authenticator
        </p>

        {/* 6-digit OTP input */}
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={code}
          onChange={handleChange}
          placeholder="• • • • • •"
          disabled={loading}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '14px 16px',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 12,
            textAlign: 'center',
            border: `2px solid ${err ? 'var(--danger)' : 'var(--border-strong)'}`,
            borderRadius: 'var(--r-lg)',
            outline: 'none',
            background: err ? 'var(--danger-bg)' : 'var(--ink-50)',
            color: 'var(--text-1)',
            fontFamily: "'JetBrains Mono', monospace",
            transition: 'border-color .15s, background .15s',
          }}
        />

        {err && (
          <p style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--danger)',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-bd)',
            borderRadius: 'var(--r-md)',
            padding: '8px 12px',
            marginTop: 10,
          }}>
            {err}
          </p>
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--ink-200)', borderTopColor: 'var(--brand-600)', animation: 'spin .7s linear infinite' }} />
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>جاري التحقق...</span>
          </div>
        )}

        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 20 }}>
          الرمز يتجدد كل 30 ثانية
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
