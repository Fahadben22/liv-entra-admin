'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, NAV_SECTIONS } from '@/lib/constants';
import Icon from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { LogOut } from 'lucide-react';

const SECTION_ICONS: Record<string, IconName> = {
  '/dashboard': 'home',
  '/dashboard/companies': 'building',
  '/dashboard/features': 'zap',
  '/dashboard/billing': 'credit-card',
  '/dashboard/intelligence': 'cpu',
  '/dashboard/activity': 'activity',
  '/dashboard/command-center':   'grid',
  '/dashboard/mission-control':  'layers',
  '/dashboard/agenda':           'bell',
  '/dashboard/agents/health':        'activity',
  '/dashboard/agents/constitution':  'shield',
  '/dashboard/agents/time-machine':  'clock',
  '/dashboard/agents': 'robot',
  '/dashboard/agents/reea': 'robot',
  '/dashboard/reea': 'cpu',
  '/dashboard/reea/authority': 'shield',
  '/dashboard/ai-ops':      'shield',
  '/dashboard/ai-knowledge': 'cpu',
  '/dashboard/companies/lifecycle': 'activity',
  '/dashboard/billing/settlements': 'coins',
  '/dashboard/leads': 'clipboard',
  '/dashboard/demo-leads': 'target',
  '/dashboard/landing-page/analytics': 'trending-up',
  '/dashboard/template-center': 'inbox',
  '/dashboard/landing-page': 'globe',
  '/dashboard/audit': 'search',
  '/dashboard/maintenance-flows': 'wrench',
  '/dashboard/cameras':           'camera',
'https://n8n.liv-entra.com':       'zap',
  'https://notes.liv-entra.com':     'file-text',
};

export interface AdminSidebarProps {
  lang?: 'ar' | 'en';
  accent?: string;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

export default function AdminSidebar({
  lang = 'ar',
  accent = '#1e3a5f',
  userName = 'Fahad',
  userRole,
  onLogout,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const isAr = lang === 'ar';

  const roleLabel = isAr ? 'مدير النظام' : 'System Admin';

  const avatarInitials = userName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');

  const sections = ['main', 'ops', 'growth', 'settings', 'tools'] as const;

  return (
    <aside
      style={{
        width: 232,
        height: '100vh',
        position: 'sticky',
        top: 0,
        flexShrink: 0,
        background: 'var(--surface)',
        borderInlineStart: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 50,
      }}
    >
      {/* ── Logo + badge ── */}
      <div style={{
        padding: '16px 16px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <svg width={30} height={30} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
            <path d="M60 6 L114 60 L60 114 L6 60 Z" fill="#0E5C3F" />
            <path d="M60 30 L90 60 L60 90 L48 78 L66 60 L48 42 Z" fill="#F4EDE0" />
          </svg>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '.02em' }}>LIV ENTRA</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '.16em' }}>ليڤ إنترا</div>
          </div>
        </div>
        <span className="le-badge brand" style={{ fontSize: 10, height: 18 }}>
          {isAr ? 'إدارة' : 'ADMIN'}
        </span>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: '6px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {sections.map((section) => {
          const items = NAV_ITEMS.filter((i) => i.section === section);
          if (!items.length) return null;
          return (
            <div key={section} style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 500,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                padding: '8px 10px 4px',
              }}>
                {NAV_SECTIONS[section]}
              </div>

              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const iconName = SECTION_ICONS[item.href];

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    {...('external' in item && item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '7px 10px',
                      borderRadius: 'var(--r-md)',
                      marginBottom: 1,
                      textDecoration: 'none',
                      background: active ? 'var(--brand-50)' : 'transparent',
                      color: active ? 'var(--brand-700)' : 'var(--text-1)',
                      fontSize: 12.5,
                      fontWeight: active ? 600 : 500,
                      transition: 'background .12s, color .12s',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--ink-100)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ lineHeight: 1, flexShrink: 0 }}>
                      {iconName
                        ? <Icon name={iconName} size={14} color={active ? 'var(--brand-600)' : 'var(--text-3)'} />
                        : <span style={{ width: 14, display: 'inline-block' }}>·</span>}
                    </span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── User footer ── */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        flexShrink: 0,
      }}>
        <div className="le-avatar" style={{ flexShrink: 0 }}>
          {avatarInitials || '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-1)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {userName}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
            {userRole || roleLabel}
          </div>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="le-btn icon ghost"
            title="تسجيل الخروج"
          >
            <LogOut style={{ width: 13, height: 13 }} />
          </button>
        )}
      </div>
    </aside>
  );
}
