'use client';
import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getAdminUser, getAdminToken, clearAdminSession } from '@/lib/auth';
import { ToastProvider } from '@/components/Toast';
import { NAV_ITEMS } from '@/lib/constants';
import AdminSidebar from '@/components/AdminSidebar';
import Icon from '@/components/Icon';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady]       = useState(false);
  const [userName, setUserName] = useState('Fahad');

  useEffect(() => {
    if (!getAdminToken()) { router.push('/login'); return; }
    const user = getAdminUser();
    setUserName(user?.name || user?.email || 'Admin');
    setReady(true);
  }, [router]);

  async function logout() {
    await clearAdminSession();
    router.push('/login');
  }

  const currentNav = NAV_ITEMS.find(
    (n) => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href))
  );
  const currentLabel = currentNav?.label || 'لوحة التحكم';

  if (!ready) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--ink-200)', borderTopColor: 'var(--brand-600)', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <ToastProvider>
      <div
        dir="rtl"
        style={{
          display: 'flex',
          minHeight: '100vh',
          background: 'var(--bg)',
          fontFamily: "'Thmanyah', system-ui, sans-serif",
        }}
      >
        {/* Sidebar — light, matches other portals */}
        <AdminSidebar
          lang="ar"
          userName={userName}
          onLogout={logout}
        />

        {/* Main area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>

          {/* ── Topbar ── */}
          <div style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            paddingInline: 24,
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 20,
            gap: 10,
            flexShrink: 0,
          }}>
            {/* Page label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {currentNav && (
                <Icon name={(currentNav as any).icon || 'home'} size={14} color="var(--brand-600)" />
              )}
              <p style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>
                {currentLabel}
              </p>
            </div>

            <div style={{ flex: 1 }} />

            {/* Docs link */}
            <Link
              href="/dashboard/activity"
              className="le-btn ghost sm"
              style={{ textDecoration: 'none', fontSize: 'var(--fs-sm)', color: 'var(--text-2)' }}
            >
              سجل النشاط
            </Link>

            {/* New company CTA */}
            <Link
              href="/dashboard/companies/new"
              className="le-btn primary sm"
              style={{ textDecoration: 'none' }}
            >
              + شركة جديدة
            </Link>

            {/* Admin badge */}
            <span className="le-badge brand" style={{ fontSize: 10, height: 18 }}>بوابة المسؤول</span>
          </div>

          {/* ── Page content ── */}
          <div style={{ padding: 'var(--sp-6)', flex: 1 }}>
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
