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
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (!getAdminToken()) { router.push('/login'); return; }
    const user = getAdminUser();
    setUserName(user?.name || user?.email || 'Admin');
    setReady(true);
  }, [router]);

  if (!ready) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f7fc' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #ede9fe', borderTopColor: '#7c5cfc', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const sections = ['main', 'ops', 'growth', 'settings'];

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh', direction: 'rtl', background: '#f8f7fc' }}>
        {/* Sidebar — icon-style like screenshot */}
        <aside style={{
          width: 68, background: '#f3f2f8',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          position: 'fixed', top: 0, right: 0, height: '100vh', zIndex: 100,
          borderLeft: '1px solid rgba(0,0,0,.04)', paddingTop: 16,
        }}>
          {/* Logo */}
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 28,
            boxShadow: '0 2px 8px rgba(124,92,252,.25)',
          }}>L</div>

          {/* Nav icons */}
          <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, width: '100%', padding: '0 8px' }}>
            {sections.map((section, si) => {
              const items = NAV_ITEMS.filter(i => i.section === section);
              return (
                <div key={section}>
                  {si > 0 && <div style={{ height: 1, background: 'rgba(0,0,0,.04)', margin: '8px 6px' }} />}
                  {items.map(item => {
                    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    return (
                      <Link key={item.href} href={item.href} title={item.label}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 42, height: 42, borderRadius: 12, margin: '2px auto',
                          background: active ? '#7c5cfc' : 'transparent',
                          color: active ? '#fff' : '#9ca3af',
                          textDecoration: 'none', transition: 'all .15s ease',
                          fontSize: 11, fontWeight: active ? 600 : 400,
                          boxShadow: active ? '0 2px 8px rgba(124,92,252,.25)' : 'none',
                        }}>
                        <span style={{ fontSize: 10, textAlign: 'center', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                          {item.label.slice(0, 4)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* User + Logout */}
          <div style={{ paddingBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: '#ede9fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, color: '#7c5cfc',
            }}>
              {userName.charAt(0)}
            </div>
            <button onClick={() => { clearAdminSession(); router.push('/login'); }}
              title="خروج"
              style={{
                width: 34, height: 34, borderRadius: 10, border: 'none',
                background: 'rgba(0,0,0,.03)', color: '#9ca3af',
                cursor: 'pointer', fontSize: 10, transition: 'all .15s',
              }}>
              ✕
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main style={{
          flex: 1, marginRight: 68, padding: '28px 36px',
          minHeight: '100vh', maxWidth: 1400,
        }}>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
