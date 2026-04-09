'use client';
import { colors, fontSize, fontWeight, radius, transition } from '@/lib/design-tokens';

interface ButtonSpinnerProps {
  label: string;
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  type?: 'button' | 'submit';
  style?: React.CSSProperties;
}

const VARIANTS = {
  primary:   { bg: colors.accent.primary, color: '#fff', border: 'none' },
  secondary: { bg: 'transparent', color: colors.text.secondary, border: `1px solid ${colors.border.default}` },
  danger:    { bg: colors.status.error, color: '#fff', border: 'none' },
};

const SIZES = {
  sm: { padding: '6px 14px', fontSize: fontSize.sm },
  md: { padding: '10px 20px', fontSize: fontSize.md },
  lg: { padding: '12px 28px', fontSize: fontSize.lg },
};

export function ButtonSpinner({ label, loadingLabel, loading, disabled, onClick, variant = 'primary', size = 'md', fullWidth, type = 'button', style }: ButtonSpinnerProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const isDisabled = loading || disabled;

  return (
    <button type={type} onClick={onClick} disabled={isDisabled}
      style={{
        ...s, borderRadius: radius.md, fontWeight: fontWeight.semi, cursor: isDisabled ? 'default' : 'pointer',
        background: v.bg, color: v.color, border: v.border,
        opacity: isDisabled ? 0.65 : 1, transition: transition.fast,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: fullWidth ? '100%' : undefined, fontFamily: 'inherit', ...style,
      }}>
      {loading && (
        <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .6s linear infinite', flexShrink: 0 }} />
      )}
      {loading ? (loadingLabel || label) : label}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </button>
  );
}
