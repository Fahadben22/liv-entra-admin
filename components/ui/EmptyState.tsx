'use client';
import { colors, fontSize, fontWeight, spacing, radius } from '@/lib/design-tokens';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = '', title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing.xxxl}px ${spacing.xl}px`, textAlign: 'center' }}>
      {icon && <div style={{ fontSize: 32, marginBottom: spacing.lg, color: 'var(--lv-muted)' }}>{icon}</div>}
      <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semi, color: colors.text.primary, margin: `0 0 ${spacing.sm}px` }}>{title}</h3>
      {description && <p style={{ fontSize: fontSize.md, color: colors.text.muted, margin: `0 0 ${spacing.xl}px`, maxWidth: 400, lineHeight: 1.6 }}>{description}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} style={{ padding: '10px 24px', borderRadius: radius.md, border: 'none', background: colors.accent.primary, color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.semi, cursor: 'pointer' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
