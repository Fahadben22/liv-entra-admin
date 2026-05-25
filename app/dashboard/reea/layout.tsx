'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard/reea',           label: 'AOM',        exact: true },
  { href: '/dashboard/reea/chat',      label: 'الدردشة' },
  { href: '/dashboard/reea/authority', label: 'الصلاحيات' },
];

export default function REEALayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{
        display: 'flex',
        gap: 0,
        overflowX: 'auto',
        borderBottom: '1px solid var(--border)',
        marginBottom: 0,
        flexShrink: 0,
      }}>
        {TABS.map(tab => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                textDecoration: 'none',
                color: active ? 'var(--brand-600)' : 'var(--text-muted)',
                borderBottom: active ? '2px solid var(--brand-600)' : '2px solid transparent',
                whiteSpace: 'nowrap',
                transition: 'color .15s',
                flexShrink: 0,
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
