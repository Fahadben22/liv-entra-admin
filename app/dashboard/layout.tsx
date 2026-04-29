'use client';
import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getAdminUser, getAdminToken, clearAdminSession } from '@/lib/auth';
import { ToastProvider } from '@/components/Toast';
import { NAV_ITEMS } from '@/lib/constants';
import AdminSidebar from '@/components/AdminSidebar';
import Icon from '@/components/Icon';

const ACCENT_COLORS = [
  { name: 'Indigo',  value: '#4f46e5' },
  { name: 'Emerald', value: '#0a8f5f' },
  { name: 'Amber',   value: '#b4630a' },
  { name: 'Slate',   value: '#334155' },
  { name: 'Magenta', value: '#c026a5' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady]         = useState(false);
  const [userName, setUserName]   = useState('Fahad');
  const [accent, setAccent]       = useState('#4f46e5');
  const [accentOpen, setAccentOpen] = useState(false);

  useEffect(() => {
    if (!getAdminToken()) { router.push('/login'); return; }
    const user = getAdminUser();
    setUserName(user?.name || user?.email || 'Admin');
    const saved = typeof window !== 'undefined' ? localStorage.getItem('lv-accent') : null;
    if (saved) setAccent(saved);
    setReady(true);
  }, [router]);

  const setAndSaveAccent = (c: string) => {
    setAccent(c);
    localStorage.setItem('lv-accent', c);
    setAccentOpen(false);
  };

  const currentLabel =
    NAV_ITEMS.find(
      (n) => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href))
    )?.label || 'لوحة التحكم';

  if (!ready) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--lv-bg)',
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        border: `2px solid ${accent}44`, borderTopColor: accent,
        animation: 'spin .7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <ToastProvider>
      {/* Inject accent as CSS custom property */}
      <style>{`:root { --lv-accent: ${accent}; }`}</style>

      <div
        dir="rtl"
        style={{
          display: 'flex',
          minHeight: '100vh',
          background: 'var(--lv-bg)',
          fontFamily: 'var(--lv-font-ar)',
        }}
      >
        {/* Sidebar — always dark #141210, 240px */}
        <AdminSidebar
          lang="ar"
          accent={accent}
          userName={userName}
        />

        {/* Main area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* ── Topbar 54px ── */}
          <div
            style={{
              height: 54,
              display: 'flex',
              alignItems: 'center',
              paddingInline: 32,
              background: 'var(--lv-panel)',
              borderBottom: '1px solid var(--lv-line)',
              position: 'sticky',
              top: 0,
              zIndex: 20,
              gap: 10,
              flexShrink: 0,
            }}
          >
            {/* Breadcrumb */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: 'var(--lv-muted)',
              fontFamily: 'var(--lv-font-ar)',
            }}>
              <Link href="/dashboard" style={{ color: 'var(--lv-muted)', textDecoration: 'none' }}>
                ليفنترا
              </Link>
              <span style={{ opacity: 0.4 }}>/</span>
              <span style={{ color: 'var(--lv-fg)', fontWeight: 500 }}>{currentLabel}</span>
            </div>

            <div style={{ flex: 1 }} />

            {/* Accent picker */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setAccentOpen((o) => !o)}
                title="تغيير اللون"
                style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: accent, border: `2px solid ${accent}55`,
                  cursor: 'pointer', flexShrink: 0,
                  boxShadow: `0 0 0 3px ${accent}18`,
                }}
              />
              {accentOpen && (
                <div style={{
                  position: 'absolute', top: 32, insetInlineEnd: 0,
                  background: 'var(--lv-panel)', border: '1px solid var(--lv-line-strong)',
                  borderRadius: 10, padding: 8, display: 'flex', gap: 6,
                  boxShadow: 'var(--lv-shadow-panel)', zIndex: 100,
                }}>
                  {ACCENT_COLORS.map((ac) => (
                    <button
                      key={ac.value}
                      onClick={() => setAndSaveAccent(ac.value)}
                      title={ac.name}
                      style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: ac.value, cursor: 'pointer',
                        border: accent === ac.value ? `2px solid ${ac.value}` : '2px solid transparent',
                        outline: accent === ac.value ? `2px solid var(--lv-fg)` : 'none',
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Bell */}
            <button style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid var(--lv-line-strong)', background: 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--lv-muted)',
            }}>
              <Icon name="bell" size={15} color="var(--lv-muted)" />
            </button>

            {/* Docs */}
            <button style={{
              padding: '5px 12px', borderRadius: 8,
              border: '1px solid var(--lv-line-strong)', background: 'transparent',
              cursor: 'pointer', fontSize: 12.5, fontWeight: 500,
              color: 'var(--lv-muted)', fontFamily: 'var(--lv-font-ar)',
            }}>
              الوثائق
            </button>

            {/* New account CTA */}
            <button style={{
              padding: '7px 16px', borderRadius: 8,
              background: 'var(--lv-fg)', color: 'var(--lv-bg)',
              border: 'none', cursor: 'pointer', fontSize: 13,
              fontWeight: 600, fontFamily: 'var(--lv-font-ar)',
              whiteSpace: 'nowrap',
            }}>
              حساب جديد +
            </button>

            {/* Logout */}
            <button
              onClick={() => { clearAdminSession().then(() => router.push('/login')); }}
              style={{
                padding: '5px 10px', borderRadius: 8,
                border: '1px solid var(--lv-line-strong)', background: 'transparent',
                cursor: 'pointer', fontSize: 12, color: 'var(--lv-muted)',
                fontFamily: 'var(--lv-font-ar)',
              }}
            >
              خروج
            </button>
          </div>

          {/* ── Page content ── */}
          <div style={{ padding: 'var(--lv-page-pad)', flex: 1 }}>
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
