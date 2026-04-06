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
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (!getAdminToken()) { router.push('/login'); return; }
    const user = getAdminUser();
    setUserName(user?.name || user?.email || 'Admin');
    setReady(true);
  }, [router]);

  if (!ready) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>جاري التحميل...</div>
    </div>
  );

  const sideW = collapsed ? 56 : 200;
  const sections = ['main', 'ops', 'growth', 'settings'];

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh', direction: 'rtl', background: '#fafafa' }}>
        {/* Sidebar — Figma-clean */}
        <aside style={{
          width: sideW, background: '#fff', transition: 'width .2s ease',
          display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, right: 0,
          height: '100vh', zIndex: 100, borderLeft: '1px solid #e5e5e5', overflow: 'hidden',
        }}>
          {/* Logo */}
          <div style={{
            height: 56, display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '0' : '0 16px', justifyContent: collapsed ? 'center' : 'flex-start',
            borderBottom: '1px solid #f0f0f0', flexShrink: 0,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0, letterSpacing: '-0.02em',
            }}>L</div>
            {!collapsed && (
              <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b', letterSpacing: '-0.01em' }}>
                Liventra
              </span>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: collapsed ? '8px 6px' : '8px 10px', overflowY: 'auto' }}>
            {sections.map(section => {
              const items = NAV_ITEMS.filter(i => i.section === section);
              if (!items.length) return null;
              return (
                <div key={section} style={{ marginBottom: 16 }}>
                  {!collapsed && (
                    <div style={{
                      fontSize: 10, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase',
                      letterSpacing: '0.06em', padding: '6px 8px 4px', userSelect: 'none',
                    }}>
                      {NAV_SECTIONS[section]}
                    </div>
                  )}
                  {items.map(item => {
                    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    return (
                      <Link key={item.href} href={item.href} style={{
                        display: 'flex', alignItems: 'center',
                        padding: collapsed ? '8px 0' : '7px 10px',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        borderRadius: 7, marginBottom: 1, textDecoration: 'none',
                        background: active ? '#f4f4f5' : 'transparent',
                        color: active ? '#18181b' : '#71717a',
                        fontSize: 13, fontWeight: active ? 600 : 400,
                        transition: 'all .12s ease',
                        letterSpacing: '-0.005em',
                      }}>
                        {collapsed ? (
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: active ? '#18181b' : '#d4d4d8',
                          }} />
                        ) : (
                          <span>{item.label}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #f0f0f0', padding: collapsed ? '10px 6px' : '12px 14px' }}>
            {!collapsed && (
              <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8, padding: '0 2px' }}>
                {userName}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, justifyContent: collapsed ? 'center' : 'flex-start' }}>
              <button onClick={() => setCollapsed(!collapsed)}
                style={footerBtn}>
                {collapsed ? '›' : '‹'}
              </button>
              {!collapsed && (
                <button onClick={() => { clearAdminSession(); router.push('/login'); }}
                  style={footerBtn}>
                  خروج
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main style={{
          flex: 1, marginRight: sideW, transition: 'margin .2s ease',
          padding: '28px 32px', minHeight: '100vh',
        }}>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}

const footerBtn: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e5e5',
  background: '#fff', color: '#71717a', cursor: 'pointer', fontSize: 11,
  fontWeight: 500, transition: 'all .12s',
};
