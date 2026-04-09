'use client';
import { useState, useId } from 'react';
import { colors, fontSize, fontWeight, spacing, radius, transition } from '@/lib/design-tokens';

interface FormFieldProps {
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  autocomplete?: string;
  dir?: 'rtl' | 'ltr';
  multiline?: boolean;
  rows?: number;
  min?: number;
  max?: number;
  maxLength?: number;
  style?: React.CSSProperties;
}

export function FormField({
  label, value, onChange, type = 'text', placeholder, required, disabled,
  error, helperText, autocomplete, dir, multiline, rows = 3, min, max, maxLength, style,
}: FormFieldProps) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const showError = touched && error;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: radius.md,
    border: `1.5px solid ${showError ? colors.border.error : colors.border.default}`,
    background: disabled ? colors.bg.hover : colors.bg.input,
    color: colors.text.primary,
    fontSize: fontSize.md,
    outline: 'none',
    transition: transition.fast,
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    direction: dir || 'inherit',
    opacity: disabled ? 0.6 : 1,
    ...style,
  };

  const InputTag = multiline ? 'textarea' : 'input';

  return (
    <div style={{ marginBottom: spacing.lg }}>
      {/* Label — always visible above input */}
      <label htmlFor={id} style={{
        display: 'block',
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semi,
        color: showError ? colors.status.error : colors.text.secondary,
        marginBottom: spacing.xs,
      }}>
        {label}
        {required && <span style={{ color: colors.status.error, marginRight: 2 }}> *</span>}
      </label>

      {/* Input */}
      <InputTag
        id={id}
        type={multiline ? undefined : type}
        value={value}
        onChange={onChange}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autocomplete}
        dir={dir}
        rows={multiline ? rows : undefined}
        min={min}
        max={max}
        maxLength={maxLength}
        aria-describedby={showError ? `${id}-error` : helperText ? `${id}-help` : undefined}
        aria-invalid={showError ? true : undefined}
        style={inputStyle}
        onFocus={(e: any) => { e.target.style.borderColor = showError ? colors.border.error : colors.border.focus; e.target.style.boxShadow = `0 0 0 3px ${showError ? 'rgba(239,68,68,.12)' : 'rgba(124,92,252,.12)'}`; }}
        onBlurCapture={(e: any) => { e.target.style.borderColor = showError ? colors.border.error : colors.border.default; e.target.style.boxShadow = 'none'; }}
      />

      {/* Helper or Error text */}
      {showError && (
        <p id={`${id}-error`} role="alert" style={{ fontSize: fontSize.xs, color: colors.status.error, margin: `${spacing.xs}px 0 0`, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>✗</span> {error}
        </p>
      )}
      {!showError && helperText && (
        <p id={`${id}-help`} style={{ fontSize: fontSize.xs, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>
          {helperText}
        </p>
      )}

      {/* Character count */}
      {maxLength && (
        <p style={{ fontSize: fontSize.xs, color: colors.text.muted, margin: `2px 0 0`, textAlign: 'left', direction: 'ltr' }}>
          {String(value).length}/{maxLength}
        </p>
      )}
    </div>
  );
}

// ─── Select variant ──────────────────────────────────────────────────────────
interface FormSelectProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
}

export function FormSelect({ label, value, onChange, options, required, disabled, error, helperText }: FormSelectProps) {
  const id = useId();
  return (
    <div style={{ marginBottom: spacing.lg }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: fontSize.sm, fontWeight: fontWeight.semi, color: error ? colors.status.error : colors.text.secondary, marginBottom: spacing.xs }}>
        {label}{required && <span style={{ color: colors.status.error, marginRight: 2 }}> *</span>}
      </label>
      <select id={id} value={value} onChange={onChange} required={required} disabled={disabled} aria-invalid={error ? true : undefined}
        style={{ width: '100%', padding: '10px 14px', borderRadius: radius.md, border: `1.5px solid ${error ? colors.border.error : colors.border.default}`, background: colors.bg.input, color: colors.text.primary, fontSize: fontSize.md, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p role="alert" style={{ fontSize: fontSize.xs, color: colors.status.error, margin: `${spacing.xs}px 0 0` }}>✗ {error}</p>}
      {!error && helperText && <p style={{ fontSize: fontSize.xs, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>{helperText}</p>}
    </div>
  );
}
