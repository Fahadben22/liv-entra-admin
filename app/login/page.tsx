'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { colors, fontSize, fontWeight, radius, spacing, shadow } from '@/lib/design-tokens';

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

      // Set session cookie so any cookie-based guards pass
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
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, ${colors.bg.dark} 0%, #1e3a5f 100%)`,
    }}>
      <div style={{
        background: colors.bg.card, borderRadius: radius.xl,
        padding: 40, width: '100%', maxWidth: 360, boxShadow: shadow.lg,
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{
          width: 56, height: 56, borderRadius: radius.lg, background: colors.bg.dark,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px', fontSize: 22, fontWeight: 700,
          color: '#fff', fontFamily: 'var(--font-fraunces, serif)',
        }}>ل</div>

        <h1 style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text.primary, margin: '0 0 6px' }}>
          Liventra Admin
        </h1>
        <p style={{ fontSize: fontSize.sm, color: colors.text.muted, margin: '0 0 32px' }}>
          أدخل الرمز من Google Authenticator
        </p>

        {/* 6-digit input */}
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
            width: '100%', boxSizing: 'border-box',
            padding: '14px 16px', fontSize: 28, fontWeight: 700,
            letterSpacing: 12, textAlign: 'center',
            border: `2px solid ${err ? '#fca5a5' : 'var(--lv-line-strong, #e2e8f0)'}`,
            borderRadius: radius.md, outline: 'none',
            background: err ? '#fef2f2' : '#fff',
            color: colors.text.primary,
            transition: 'border-color .15s',
          }}
        />

        {err && (
          <p style={{
            fontSize: fontSize.sm, color: '#ef4444',
            background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: radius.md, padding: `${spacing.xs}px ${spacing.sm}px`,
            marginTop: spacing.sm,
          }}>
            {err}
          </p>
        )}

        {loading && (
          <p style={{ fontSize: fontSize.sm, color: colors.text.muted, marginTop: spacing.sm }}>
            جاري التحقق...
          </p>
        )}

        <p style={{ fontSize: 11, color: colors.text.muted, marginTop: 20 }}>
          الرمز يتجدد كل 30 ثانية
        </p>
      </div>
    </div>
  );
}
