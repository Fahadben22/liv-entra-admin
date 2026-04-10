'use client';
import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getAdminUser, getAdminToken, clearAdminSession } from '@/lib/auth';
import { ToastProvider } from '@/components/Toast';
import { NAV_ITEMS, NAV_SECTIONS } from '@/lib/constants';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (!getAdminToken()) { router.push('/login'); return; }
    const user = getAdminUser();
    setUserName(user?.name || user?.email || 'Admin');
    setReady(true);
  }, [router]);

  if (!ready) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #DBEAFE', borderTopColor: '#2563EB', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const sideW = sidebarOpen ? 230 : 0;
  const sections = ['main', 'ops', 'growth', 'settings'];

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh', direction: 'rtl', background: '#F8FAFC' }}>

        {/* Sidebar overlay on mobile — click to close */}
        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)}
            style={{ display: 'none', position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 199 }}
            className="sidebar-overlay" />
        )}

        {/* Sidebar */}
        <aside style={{
          width: 230,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(230px)',
          background: '#fff',
          transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, right: 0, height: '100vh', zIndex: 200,
          borderLeft: '1px solid rgba(0,0,0,.06)',
          boxShadow: sidebarOpen ? '0 0 20px rgba(0,0,0,.04)' : 'none',
        }}>
          {/* Header */}
          <div style={{
            height: 56, display: 'flex', alignItems: 'center', gap: 10,
            padding: '0 18px', borderBottom: '1px solid rgba(0,0,0,.04)', flexShrink: 0,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'linear-gradient(135deg, #2563EB, #60A5FA)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
              boxShadow: '0 2px 8px rgba(124,92,252,.2)',
            }}>L</div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', letterSpacing: '-0.02em' }}>
              Liventra Admin
            </span>
            {/* Close button inside sidebar */}
            <button onClick={() => setSidebarOpen(false)}
              style={{ marginRight: 'auto', width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(0,0,0,.06)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#9ca3af', transition: 'all .15s' }}>
              ✕
            </button>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '12px 12px', overflowY: 'auto' }}>
            {sections.map(section => {
              const items = NAV_ITEMS.filter(i => i.section === section);
              if (!items.length) return null;
              return (
                <div key={section} style={{ marginBottom: 18 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 600, color: '#9ca3af',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '4px 8px 6px', userSelect: 'none',
                  }}>
                    {NAV_SECTIONS[section]}
                  </div>
                  {items.map(item => {
                    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    return (
                      <Link key={item.href} href={item.href} style={{
                        display: 'flex', alignItems: 'center',
                        padding: '8px 12px', borderRadius: 8,
                        marginBottom: 2, textDecoration: 'none',
                        background: active ? '#DBEAFE' : 'transparent',
                        color: active ? '#2563EB' : '#6b7280',
                        fontSize: 13, fontWeight: active ? 600 : 400,
                        transition: 'all .12s ease',
                      }}>
                        {active && (
                          <div style={{
                            width: 3, height: 16, borderRadius: 2,
                            background: '#2563EB', marginLeft: 8, flexShrink: 0,
                          }} />
                        )}
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,.04)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: '#DBEAFE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600, color: '#2563EB',
              }}>
                {userName.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a2e' }}>{userName}</div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>مدير النظام</div>
              </div>
            </div>
            <button onClick={() => { clearAdminSession(); router.push('/login'); }}
              style={{
                width: '100%', padding: '7px', borderRadius: 8,
                border: '1px solid rgba(0,0,0,.06)', background: '#fff',
                color: '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                transition: 'all .12s',
              }}>
              تسجيل خروج
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main style={{
          flex: 1, marginRight: sidebarOpen ? sideW : 0,
          transition: 'margin .25s cubic-bezier(.4,0,.2,1)',
          minHeight: '100vh',
        }}>
          {/* Top bar with hamburger */}
          <div style={{
            height: 52, display: 'flex', alignItems: 'center', gap: 12,
            padding: '0 24px', background: '#fff',
            borderBottom: '1px solid rgba(0,0,0,.04)',
            position: 'sticky', top: 0, zIndex: 100,
          }}>
            {/* Hamburger toggle */}
            <button onClick={() => setSidebarOpen(o => !o)}
              style={{
                width: 36, height: 36, borderRadius: 8,
                border: '1px solid rgba(0,0,0,.06)', background: '#fff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .12s', flexShrink: 0,
              }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            {/* Breadcrumb */}
            <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 400 }}>
              {NAV_ITEMS.find(n => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)))?.label || 'لوحة التحكم'}
            </span>

            <div style={{ flex: 1 }} />
          </div>

          {/* Page content */}
          <div style={{ padding: '24px 28px' }}>
            {children}
          </div>
        </main>
      </div>

      {/* Mobile responsive: show overlay */}
      <style>{`
        @media (max-width: 900px) {
          .sidebar-overlay { display: block !important; }
        }
      `}</style>
    </ToastProvider>
  );
}
