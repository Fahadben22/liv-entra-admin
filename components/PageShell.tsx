/**
 * PageShell — shared wrapper for every admin dashboard page.
 * Applies --lv-* design tokens, consistent page padding,
 * optional page header (eyebrow + title + subtitle).
 */

import { ReactNode, CSSProperties } from 'react';

interface PageShellProps {
  children: ReactNode;
  /** Eyebrow label above the title (small caps) */
  eyebrow?: string;
  /** Main page title */
  title?: ReactNode;
  /** Subtitle / meta row below title */
  subtitle?: ReactNode;
  /** Right-side slot for actions / buttons in the header row */
  actions?: ReactNode;
  /** Remove default padding — for full-bleed layouts */
  noPadding?: boolean;
  style?: CSSProperties;
}

export default function PageShell({
  children,
  eyebrow,
  title,
  subtitle,
  actions,
  noPadding = false,
  style,
}: PageShellProps) {
  const hasHeader = eyebrow || title || subtitle || actions;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--lv-section-gap)',
        fontFamily: 'var(--lv-font-ar)',
        color: 'var(--lv-fg)',
        ...(noPadding ? {} : {}),
        ...style,
      }}
    >
      {hasHeader && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div>
            {eyebrow && (
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--lv-muted)',
                marginBottom: 8,
                fontFamily: 'var(--lv-font-ui)',
              }}>
                {eyebrow}
              </div>
            )}
            {title && (
              <h1 style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                color: 'var(--lv-fg)',
                fontFamily: 'var(--lv-font-ar)',
              }}>
                {title}
              </h1>
            )}
            {subtitle && (
              <div style={{
                marginTop: 6,
                fontSize: 13.5,
                color: 'var(--lv-muted)',
                fontFamily: 'var(--lv-font-ar)',
                lineHeight: 1.4,
              }}>
                {subtitle}
              </div>
            )}
          </div>
          {actions && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/** Reusable card panel matching lv-* design system */
export function Panel({
  children,
  style,
  padding = '20px 24px',
}: {
  children: ReactNode;
  style?: CSSProperties;
  padding?: string;
}) {
  return (
    <div style={{
      background: 'var(--lv-panel)',
      border: '1px solid var(--lv-line-strong)',
      borderRadius: 'var(--lv-r-card)',
      boxShadow: 'var(--lv-shadow-card)',
      padding,
      ...style,
    }}>
      {children}
    </div>
  );
}

/** Section divider label */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--lv-muted)',
      fontFamily: 'var(--lv-font-ui)',
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

/** Primary action button */
export function PrimaryBtn({
  children,
  onClick,
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '7px 16px',
        borderRadius: 8,
        background: disabled ? 'var(--lv-chip)' : 'var(--lv-fg)',
        color: disabled ? 'var(--lv-muted)' : 'var(--lv-bg)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'var(--lv-font-ar)',
        whiteSpace: 'nowrap',
        transition: 'opacity .1s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Secondary / ghost button */
export function GhostBtn({
  children,
  onClick,
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 14px',
        borderRadius: 8,
        background: 'transparent',
        color: 'var(--lv-muted)',
        border: '1px solid var(--lv-line-strong)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'var(--lv-font-ar)',
        whiteSpace: 'nowrap',
        transition: 'all .1s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Status chip (inline pill with dot) */
export function Chip({
  label,
  dot,
  bg,
  color,
}: {
  label: string;
  dot?: string;
  bg: string;
  color: string;
}) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '2px 9px',
      borderRadius: 99,
      background: bg,
      color,
      fontSize: 12,
      fontWeight: 500,
      fontFamily: 'var(--lv-font-ar)',
      whiteSpace: 'nowrap',
    }}>
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: dot, flexShrink: 0,
        }} />
      )}
      {label}
    </span>
  );
}
