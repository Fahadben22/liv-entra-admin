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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,.1)', borderTopColor: '#6366f1', animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const sideW = collapsed ? 60 : 220;
  const sections = ['main', 'ops', 'growth', 'settings'];

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh', direction: 'rtl', background: '#09090b' }}>
        {/* Sidebar */}
        <aside style={{
          width: sideW, background: '#09090b', transition: 'width .25s cubic-bezier(.4,0,.2,1)',
          display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, right: 0,
          height: '100vh', zIndex: 100, borderLeft: '1px solid rgba(255,255,255,.06)',
          overflow: 'hidden',
        }}>
          {/* Logo */}
          <div style={{
            height: 56, display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '0' : '0 16px', justifyContent: collapsed ? 'center' : 'flex-start',
            borderBottom: '1px solid rgba(255,255,255,.04)', flexShrink: 0,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
              boxShadow: '0 0 20px rgba(99,102,241,.3)',
            }}>L</div>
            {!collapsed && (
              <span style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', letterSpacing: '-0.02em' }}>
                Liventra
              </span>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: collapsed ? '12px 8px' : '12px 10px', overflowY: 'auto' }}>
            {sections.map(section => {
              const items = NAV_ITEMS.filter(i => i.section === section);
              if (!items.length) return null;
              return (
                <div key={section} style={{ marginBottom: 20 }}>
                  {!collapsed && (
                    <div style={{
                      fontSize: 10, fontWeight: 600, color: '#3f3f46',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      padding: '6px 10px 6px', userSelect: 'none',
                    }}>
                      {NAV_SECTIONS[section]}
                    </div>
                  )}
                  {items.map(item => {
                    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    return (
                      <Link key={item.href} href={item.href} style={{
                        display: 'flex', alignItems: 'center',
                        padding: collapsed ? '9px 0' : '8px 10px',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        borderRadius: 7, marginBottom: 2, textDecoration: 'none',
                        background: active ? 'rgba(99,102,241,.1)' : 'transparent',
                        color: active ? '#c7d2fe' : '#52525b',
                        fontSize: 13, fontWeight: active ? 500 : 400,
                        transition: 'all .15s ease',
                        position: 'relative',
                      }}>
                        {active && !collapsed && (
                          <div style={{
                            position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
                            width: 3, height: 16, borderRadius: 2,
                            background: '#6366f1',
                          }} />
                        )}
                        {collapsed ? (
                          <div style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: active ? '#6366f1' : '#3f3f46',
                            boxShadow: active ? '0 0 8px rgba(99,102,241,.5)' : 'none',
                          }} />
                        ) : (
                          <span style={{ paddingRight: 8 }}>{item.label}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,.04)', padding: collapsed ? '12px 8px' : '14px 14px' }}>
            {!collapsed && (
              <div style={{
                fontSize: 11, color: '#3f3f46', marginBottom: 10, padding: '0 4px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
                  boxShadow: '0 0 6px rgba(34,197,94,.5)',
                }} />
                <span>{userName}</span>
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
          flex: 1, marginRight: sideW, transition: 'margin .25s cubic-bezier(.4,0,.2,1)',
          padding: '24px 28px', minHeight: '100vh',
        }}>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}

const footerBtn: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.06)',
  background: 'rgba(255,255,255,.03)', color: '#52525b', cursor: 'pointer', fontSize: 11,
  fontWeight: 500, transition: 'all .15s',
};
