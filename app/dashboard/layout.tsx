'use client';
import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getAdminUser, getAdminToken, clearAdminSession } from '@/lib/auth';
import { ToastProvider } from '@/components/Toast';
import { NAV_ITEMS } from '@/lib/constants';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (!getAdminToken()) { router.push('/login'); return; }
    const user = getAdminUser();
    setUserName(user?.name || user?.email || 'Admin');
    setReady(true);
  }, [router]);

  function handleLogout() {
    clearAdminSession();
    router.push('/login');
  }

  if (!ready) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ fontSize: 14, color: '#94a3b8' }}>جاري التحميل...</div>
    </div>
  );

  const sideW = collapsed ? 64 : 220;

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh', direction: 'rtl', background: '#f1f5f9' }}>
        {/* Sidebar */}
        <aside style={{
          width: sideW, background: '#0f172a', transition: 'width .2s',
          display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, right: 0,
          height: '100vh', zIndex: 100, overflow: 'hidden',
        }}>
          {/* Logo */}
          <div style={{
            padding: collapsed ? '20px 0' : '20px 18px', borderBottom: '1px solid rgba(255,255,255,.06)',
            display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #22c55e, #15803d)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff',
              flexShrink: 0,
            }}>L</div>
            {!collapsed && <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Liventra Admin</span>}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
            {NAV_ITEMS.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: collapsed ? '10px 0' : '10px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 10, marginBottom: 2, textDecoration: 'none',
                  background: active ? 'rgba(255,255,255,.08)' : 'transparent',
                  color: active ? '#fff' : '#94a3b8',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  transition: 'all .15s',
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Collapse toggle + user */}
          <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
            {!collapsed && (
              <div style={{ padding: '8px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>{userName}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 4, justifyContent: collapsed ? 'center' : 'flex-start', padding: '0 4px' }}>
              <button onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'توسيع' : 'طي'}
                style={{ ...iconBtn, fontSize: 14 }}>
                {collapsed ? '»' : '«'}
              </button>
              {!collapsed && (
                <button onClick={handleLogout} title="تسجيل خروج" style={{ ...iconBtn, fontSize: 12 }}>
                  خروج
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, marginRight: sideW, transition: 'margin .2s', padding: '24px 28px', minHeight: '100vh' }}>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}

const iconBtn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)',
  background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 12,
};
