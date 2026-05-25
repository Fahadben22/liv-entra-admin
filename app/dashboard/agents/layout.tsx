'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard/agents',              label: 'الوكلاء',       exact: true },
  { href: '/dashboard/agents/health',       label: 'الصحة' },
  { href: '/dashboard/agents/economy',      label: 'الاقتصاد' },
  { href: '/dashboard/agents/correlations', label: 'الارتباطات' },
  { href: '/dashboard/agents/time-machine', label: 'آلة الزمن' },
  { href: '/dashboard/agents/constitution', label: 'الدستور' },
];

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
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
