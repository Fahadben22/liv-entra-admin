// lib/design-tokens.ts
// Single source of truth for all visual design decisions.
// SaaS Blue theme — trust, professionalism, clarity.
// Inspired by: Stripe, Linear, Vercel

// ─── Colors ──────────────────────────────────────────────────────────────────
export const colors = {
  // Brand — SaaS Blue
  accent: {
    primary:   '#2563EB',  // Blue — primary buttons, links, active states
    light:     '#DBEAFE',  // Light blue — hover backgrounds, badges
    bg:        '#F8FAFC',  // Slate-50 — page backgrounds
    hover:     '#1D4ED8',  // Darker blue — hover state
    subtle:    '#EFF6FF',  // Very light blue — subtle highlights
  },

  // CTA / Action
  cta: {
    primary:   '#F97316',  // Orange — primary CTAs, important actions
    hover:     '#EA580C',  // Darker orange
    bg:        '#FFF7ED',  // Light orange bg
  },

  // Semantic status
  status: {
    success:   '#16A34A',  // Green — active, paid, confirmed
    successBg: '#F0FDF4',
    error:     '#DC2626',  // Red — suspended, failed, critical
    errorBg:   '#FEF2F2',
    warning:   '#D97706',  // Amber — trial, overdue, caution
    warningBg: '#FFFBEB',
    info:      '#2563EB',  // Blue — info (same as accent)
    infoBg:    '#EFF6FF',
  },

  // Text hierarchy (3 levels only)
  text: {
    primary:   '#1E293B',  // Slate-800 — headings, primary content
    secondary: '#64748B',  // Slate-500 — labels, descriptions
    muted:     '#94A3B8',  // Slate-400 — timestamps, hints
    inverse:   '#F8FAFC',  // White text on dark backgrounds
  },

  // Backgrounds
  bg: {
    page:      '#F8FAFC',  // Slate-50 — page background
    card:      '#FFFFFF',  // White — card/panel background
    input:     '#F1F5F9',  // Slate-100 — input field background
    hover:     '#F1F5F9',  // Slate-100 — hover state
    dark:      '#1E293B',  // Slate-800 — dark sections
    surface:   '#F8FAFC',  // Slate-50 — elevated surface
  },

  // Borders
  border: {
    default:   '#E2E8F0',  // Slate-200 — default border
    medium:    '#CBD5E1',  // Slate-300 — stronger border
    focus:     '#2563EB',  // Blue — focus ring
    error:     '#DC2626',  // Error border
    success:   '#16A34A',  // Success border
    subtle:    '#F1F5F9',  // Almost invisible border
  },

  // Agent colors (fixed per agent)
  agent: {
    meeting:   '#2563EB',
    it:        '#7C3AED',
    sales:     '#16A34A',
    marketing: '#EC4899',
    finance:   '#D97706',
    product:   '#0891B2',
  },

  // Plan colors
  plan: {
    trial:        '#64748B',
    basic:        '#2563EB',
    professional: '#7C3AED',
    enterprise:   '#D97706',
  },

  // Lifecycle
  lifecycle: {
    trial:     '#D97706',
    active:    '#16A34A',
    overdue:   '#EA580C',
    suspended: '#DC2626',
    deleted:   '#94A3B8',
  },
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────
export const fontSize = {
  xs:   10,   // Badges, tiny labels
  sm:   12,   // Secondary text, meta
  md:   13,   // Body text, nav items, labels
  base: 14,   // Standard body
  lg:   16,   // Sub-headings
  xl:   20,   // Page titles
  xxl:  28,   // KPI values, large numbers
  hero: 36,   // Dashboard hero numbers
} as const;

export const fontWeight = {
  normal: 400,
  medium: 500,
  semi:   600,
  bold:   700,
  black:  800,
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
  '4xl': 40,
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────
export const radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   18,
  full: 9999,
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────
export const shadow = {
  sm:    '0 1px 2px rgba(0,0,0,.05)',
  md:    '0 4px 6px -1px rgba(0,0,0,.07), 0 2px 4px -2px rgba(0,0,0,.05)',
  lg:    '0 10px 15px -3px rgba(0,0,0,.08), 0 4px 6px -4px rgba(0,0,0,.04)',
  xl:    '0 20px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.04)',
  focus: '0 0 0 3px rgba(37,99,235,.2)',
} as const;

// ─── Transitions ─────────────────────────────────────────────────────────────
export const transition = {
  fast:   'all .1s ease',
  normal: 'all .15s cubic-bezier(.4,0,.2,1)',
  slow:   'all .25s cubic-bezier(.4,0,.2,1)',
} as const;

// ─── Breakpoints ─────────────────────────────────────────────────────────────
export const breakpoint = {
  phone:   480,
  tablet:  768,
  laptop:  1024,
  desktop: 1280,
} as const;

// ─── Z-Index ─────────────────────────────────────────────────────────────────
export const zIndex = {
  dropdown:  100,
  sticky:    200,
  modal:     500,
  toast:     600,
  tooltip:   700,
} as const;

// ─── Shorthand: commonly used inline style objects ───────────────────────────
export const styles = {
  card: {
    background: colors.bg.card,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border.default}`,
    boxShadow: shadow.sm,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: radius.md,
    border: `1px solid ${colors.border.default}`,
    background: colors.bg.input,
    color: colors.text.primary,
    fontSize: fontSize.md,
    outline: 'none',
    transition: transition.fast,
  },
  btnPrimary: {
    padding: '10px 20px',
    borderRadius: radius.md,
    border: 'none',
    background: colors.accent.primary,
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semi,
    cursor: 'pointer',
    transition: transition.fast,
  },
  btnSecondary: {
    padding: '10px 20px',
    borderRadius: radius.md,
    border: `1px solid ${colors.border.default}`,
    background: 'transparent',
    color: colors.text.secondary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    cursor: 'pointer',
    transition: transition.fast,
  },
  btnDanger: {
    padding: '10px 20px',
    borderRadius: radius.md,
    border: 'none',
    background: colors.status.error,
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semi,
    cursor: 'pointer',
    transition: transition.fast,
  },
  badge: (status: 'success' | 'error' | 'warning' | 'info') => ({
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semi,
    padding: '2px 8px',
    borderRadius: radius.sm,
    background: colors.status[`${status}Bg` as keyof typeof colors.status],
    color: colors.status[status],
  }),
} as const;
