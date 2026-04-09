// lib/design-tokens.ts
// Single source of truth for all visual design decisions.
// Import and use instead of inline hex colors.

// ─── Colors ──────────────────────────────────────────────────────────────────
export const colors = {
  // Brand
  accent: {
    primary:   '#7c5cfc',  // Purple — buttons, links, highlights
    light:     '#ede9fe',  // Light purple — hover backgrounds
    bg:        '#f8f7fc',  // Very light purple — page backgrounds
    hover:     '#6b4ce0',  // Darker purple — hover state
  },

  // Semantic status
  status: {
    success:   '#10b981',  // Green — active, paid, confirmed
    successBg: '#ecfdf5',
    error:     '#ef4444',  // Red — suspended, failed, critical
    errorBg:   '#fef2f2',
    warning:   '#f59e0b',  // Amber — trial, overdue, caution
    warningBg: '#fffbeb',
    info:      '#3b82f6',  // Blue — info, links, IT
    infoBg:    '#eff6ff',
  },

  // Text hierarchy (3 levels only)
  text: {
    primary:   '#1a1a2e',  // Darkest — headings, primary content
    secondary: '#6b7280',  // Medium — labels, descriptions
    muted:     '#9ca3af',  // Lightest — timestamps, hints
  },

  // Backgrounds
  bg: {
    page:      '#f8f7fc',  // Page background
    card:      '#ffffff',  // Card/panel background
    input:     '#f8f7fc',  // Input field background
    hover:     '#f3f4f6',  // Hover state background
    dark:      '#1a1a2e',  // Dark sections (footer, dark cards)
  },

  // Borders
  border: {
    default:   'rgba(0,0,0,.06)',  // Default border
    medium:    'rgba(0,0,0,.1)',   // Slightly visible border
    focus:     '#7c5cfc',          // Focus ring (accent)
    error:     '#ef4444',          // Error border
    success:   '#10b981',          // Valid/success border
  },

  // Agent colors (fixed per agent — spatial memory)
  agent: {
    meeting:   '#7c5cfc',
    it:        '#3b82f6',
    sales:     '#22c55e',
    marketing: '#8b5cf6',
    finance:   '#f59e0b',
    product:   '#06b6d4',
  },

  // Plan colors
  plan: {
    trial:        '#64748b',
    basic:        '#0284c7',
    professional: '#7c3aed',
    enterprise:   '#b45309',
  },

  // Lifecycle
  lifecycle: {
    trial:     '#f59e0b',
    active:    '#10b981',
    overdue:   '#f97316',
    suspended: '#ef4444',
    deleted:   '#94a3b8',
  },
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────
export const fontSize = {
  xs:  10,   // Badges, tiny labels
  sm:  12,   // Secondary text, meta
  md:  13,   // Body text, nav items, labels
  lg:  16,   // Sub-headings
  xl:  20,   // Page titles
  xxl: 28,   // KPI values, large numbers
  hero: 32,  // Dashboard hero numbers
} as const;

export const fontWeight = {
  normal: 400,
  medium: 500,
  semi:   600,
  bold:   700,
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl: 32,
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────
export const radius = {
  sm:   6,
  md:  10,
  lg:  14,
  xl:  18,
  full: 9999,
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────
export const shadow = {
  sm:    '0 1px 3px rgba(0,0,0,.06)',
  md:    '0 4px 12px rgba(0,0,0,.08)',
  lg:    '0 8px 24px rgba(0,0,0,.12)',
  focus: `0 0 0 3px rgba(124,92,252,.15)`,
} as const;

// ─── Transitions ─────────────────────────────────────────────────────────────
export const transition = {
  fast:   'all .1s ease',
  normal: 'all .15s ease',
  slow:   'all .25s ease',
} as const;

// ─── Breakpoints ─────────────────────────────────────────────────────────────
export const breakpoint = {
  phone:  480,
  tablet: 768,
  laptop: 1024,
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
  // Card
  card: {
    background: colors.bg.card,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border.default}`,
    boxShadow: shadow.sm,
  },
  // Input field
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
  // Primary button
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
  // Secondary/ghost button
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
  // Danger button
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
  // Status badge
  badge: (status: 'success' | 'error' | 'warning' | 'info') => ({
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semi,
    padding: '2px 8px',
    borderRadius: radius.sm,
    background: colors.status[`${status}Bg` as keyof typeof colors.status],
    color: colors.status[status],
  }),
} as const;
