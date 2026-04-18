'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, NAV_SECTIONS } from '@/lib/constants';
import Icon from '@/components/Icon';
import type { IconName } from '@/components/Icon';

// Nav icon map — flat SVG icons per route
const SECTION_ICONS: Record<string, IconName> = {
  '/dashboard': 'home',
  '/dashboard/companies': 'building',
  '/dashboard/features': 'zap',
  '/dashboard/billing': 'credit-card',
  '/dashboard/intelligence': 'cpu',
  '/dashboard/activity': 'activity',
  '/dashboard/command-center': 'grid',
  '/dashboard/agents': 'robot',
  '/dashboard/leads': 'clipboard',
  '/dashboard/demo-leads': 'target',
  '/dashboard/landing-page/analytics': 'trending-up',
  '/dashboard/template-center': 'inbox',
  '/dashboard/landing-page': 'globe',
  '/dashboard/audit': 'search',
  '/dashboard/maintenance-flows': 'wrench',
};

const PINNED_ACCOUNTS = [
  { name: 'شركة الأفق العقاري', id: 'afc-001' },
  { name: 'مجموعة النخبة', id: 'nkb-042' },
  { name: 'الإمارات للسكن', id: 'emr-017' },
];

export interface AdminSidebarProps {
  lang?: 'ar' | 'en';
  accent?: string;
  userName?: string;
  userRole?: string;
}

export default function AdminSidebar({
  lang = 'ar',
  accent = '#4f46e5',
  userName = 'Fahad',
  userRole,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const isAr = lang === 'ar';

  const brandName = isAr ? 'ليفنترا' : 'Liventra';
  const adminBadge = isAr ? 'إدارة' : 'ADMIN';
  const searchPlaceholder = isAr ? 'ابحث عن أي شيء…' : 'Search anything…';
  const pinnedLabel = isAr ? 'مثبّتة' : 'Pinned';
  const roleLabel = isAr ? 'مدير النظام' : 'System Admin';
  const logoChar = isAr ? 'ل' : 'L';

  const avatarInitials = userName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');

  const sections = ['main', 'ops', 'growth', 'settings'] as const;

  return (
    <aside
      style={{
        width: 240,
        height: '100vh',
        position: 'sticky',
        top: 0,
        flexShrink: 0,
        background: 'var(--lv-sidebar-bg)',
        borderInlineEnd: '1px solid var(--lv-sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 50,
      }}
    >
      {/* ── Brand bar ── */}
      <div
        style={{
          padding: '18px 16px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 800,
            color: '#fff',
            fontFamily: 'var(--lv-font-num)',
            flexShrink: 0,
            boxShadow: `0 2px 8px ${accent}44`,
          }}
        >
          {logoChar}
        </div>

        {/* Brand name */}
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#fff',
            fontFamily: isAr ? 'var(--lv-font-ar)' : 'var(--lv-font-ui)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {brandName}
        </span>

        {/* Admin badge */}
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--lv-font-mono)',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 4,
            padding: '2px 7px',
            color: 'rgba(255,255,255,0.55)',
            flexShrink: 0,
            letterSpacing: '0.06em',
          }}
        >
          {adminBadge}
        </span>
      </div>

      {/* ── Search bar ── */}
      <div style={{ padding: '0 12px 10px', flexShrink: 0 }}>
        <div
          style={{
            padding: '7px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            cursor: 'pointer',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="rgba(255,255,255,0.3)" strokeWidth="1.3" />
            <path d="M9 9l2.5 2.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span
            style={{
              fontSize: 12.5,
              color: 'rgba(255,255,255,0.32)',
              flex: 1,
              fontFamily: isAr ? 'var(--lv-font-ar)' : 'var(--lv-font-ui)',
            }}
          >
            {searchPlaceholder}
          </span>
          <kbd
            style={{
              fontSize: 10,
              fontFamily: 'var(--lv-font-mono)',
              color: 'rgba(255,255,255,0.22)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              padding: '1px 5px',
            }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: '4px 12px', overflowY: 'auto' }}>
        {sections.map((section) => {
          const items = NAV_ITEMS.filter((i) => i.section === section);
          if (!items.length) return null;
          return (
            <div key={section} style={{ marginBottom: 20 }}>
              {/* Section label */}
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.28)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  padding: '0 10px 6px',
                  fontFamily: 'var(--lv-font-ui)',
                }}
              >
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
                    className="lv-nav-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 10px',
                      borderRadius: 8,
                      marginBottom: 1,
                      textDecoration: 'none',
                      background: active ? 'rgba(255,255,255,0.10)' : 'transparent',
                      color: active ? '#ffffff' : 'rgba(255,255,255,0.48)',
                      fontSize: 13,
                      fontWeight: active ? 500 : 400,
                      fontFamily: isAr ? 'var(--lv-font-ar)' : 'var(--lv-font-ui)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Active indicator bar on inline-end */}
                    {active && (
                      <span
                        style={{
                          position: 'absolute',
                          insetInlineEnd: 0,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 3,
                          height: 20,
                          borderRadius: '3px 0 0 3px',
                          background: accent,
                        }}
                      />
                    )}
                    <span style={{ lineHeight: 1, flexShrink: 0, opacity: active ? 1 : 0.6 }}>
                      {iconName
                        ? <Icon name={iconName} size={14} color={active ? '#fff' : 'rgba(255,255,255,0.75)'} />
                        : <span style={{ fontSize: 14 }}>·</span>}
                    </span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}

        {/* ── Pinned accounts ── */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.28)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              padding: '0 10px 6px',
              fontFamily: 'var(--lv-font-ui)',
            }}
          >
            {pinnedLabel}
          </div>
          {PINNED_ACCOUNTS.map((acc) => (
            <div
              key={acc.id}
              className="lv-nav-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '6px 10px',
                borderRadius: 8,
                marginBottom: 1,
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.48)',
                fontSize: 12.5,
                fontFamily: isAr ? 'var(--lv-font-ar)' : 'var(--lv-font-ui)',
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: accent,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {acc.name}
              </span>
            </div>
          ))}
        </div>
      </nav>

      {/* ── User footer ── */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '12px 14px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Avatar */}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {avatarInitials}
          </div>

          {/* Name + role */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.85)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: isAr ? 'var(--lv-font-ar)' : 'var(--lv-font-ui)',
              }}
            >
              {userName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.32)',
                fontFamily: 'var(--lv-font-ui)',
              }}
            >
              {userRole || roleLabel}
            </div>
          </div>

          {/* Settings dots */}
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.28)',
              fontSize: 16,
              lineHeight: 1,
              padding: 4,
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            ⋯
          </button>
        </div>
      </div>
    </aside>
  );
}
