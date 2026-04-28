'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/ui/FormField';
import { ButtonSpinner } from '@/components/ui/ButtonSpinner';
import { colors, fontSize, fontWeight, radius, spacing, shadow } from '@/lib/design-tokens';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://liv-entra-api-production.up.railway.app/api/v1';

export default function AdminLogin() {
  const router = useRouter();
  const [secret,    setSecret]    = useState('');
  const [totpCode,  setTotpCode]  = useState('');
  const [err,       setErr]       = useState('');
  const [loading,   setLoading]   = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) { setErr('المفتاح السري مطلوب'); return; }
    setLoading(true); setErr('');
    try {
      const res = await fetch(`${BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, totp_code: totpCode.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'فشل تسجيل الدخول');
      localStorage.setItem('admin_token', json.data?.token);
      localStorage.removeItem('admin_refresh_token');
      // Always set the session cookie so middleware allows /dashboard access.
      // Use refresh_token when the API provides one; fall back to the JWT itself.
      const cookieValue = json.data?.refresh_token || json.data?.token;
      if (cookieValue) {
        await fetch('/api/auth/session', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: cookieValue }),
        }).catch(() => {});
      }
      localStorage.setItem('admin_user', JSON.stringify(json.data?.user || { name: 'Admin', role: 'super_admin' }));
      router.push('/dashboard');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${colors.bg.dark} 0%, #1e3a5f 100%)` }}>
      <div style={{ background: colors.bg.card, borderRadius: radius.xl, padding: spacing.xxxl + 8, width: '100%', maxWidth: 380, boxShadow: shadow.lg }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: spacing.xxxl }}>
          <div style={{ width: 56, height: 56, borderRadius: radius.lg, background: colors.bg.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-fraunces, serif)' }}>ل</div>
          <h1 style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text.primary, margin: 0 }}>Liventra OS</h1>
          <p style={{ fontSize: fontSize.sm, color: colors.text.muted, marginTop: spacing.xs }}>لوحة التحكم — Super Admin</p>
        </div>

        <form onSubmit={handleLogin}>
          <FormField
            label="المفتاح السري"
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="أدخل المفتاح السري"
            required
            autocomplete="current-password"
            dir="ltr"
          />

          <FormField
            label="رمز المصادقة الثنائية (TOTP)"
            type="text"
            value={totpCode}
            onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="• • • • • •"
            autocomplete="one-time-code"
            dir="ltr"
            style={{ marginTop: spacing.sm }}
          />
          <p style={{ fontSize: 11, color: colors.text.muted, marginTop: 4, marginBottom: spacing.sm }}>
            من تطبيق Google Authenticator أو Authy — اتركه فارغاً إن لم يُفعَّل بعد
          </p>

          {err && (
            <p style={{ fontSize: fontSize.sm, color: '#ef4444', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: radius.md, padding: `${spacing.xs}px ${spacing.sm}px`, marginBottom: spacing.sm }}>
              {err}
            </p>
          )}

          <ButtonSpinner
            type="submit"
            label="دخول"
            loadingLabel="جاري الدخول..."
            loading={loading}
            disabled={!secret.trim()}
            variant="primary"
            fullWidth
            style={{ background: colors.bg.dark, marginTop: spacing.sm }}
          />
        </form>
      </div>
    </div>
  );
}
