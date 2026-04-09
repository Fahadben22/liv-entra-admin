'use client';
import { useEffect, useRef } from 'react';
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design-tokens';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  requireReason?: boolean;
  reason?: string;
  onReasonChange?: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'تأكيد', cancelLabel = 'إلغاء',
  danger = false, requireReason = false, reason = '', onReasonChange, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape key to dismiss
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  // Focus trap + auto-focus
  useEffect(() => {
    if (open && dialogRef.current) {
      const firstBtn = dialogRef.current.querySelector('button');
      firstBtn?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9998,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div ref={dialogRef} onClick={e => e.stopPropagation()} style={{
        background: colors.bg.card, borderRadius: radius.xl, padding: `${spacing.xxl}px ${spacing.xxxl}px`, maxWidth: 420,
        width: '90%', direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,.2)', position: 'relative',
      }}>
        {/* X close button */}
        <button onClick={onCancel} aria-label="إغلاق" style={{
          position: 'absolute', top: 12, left: 12, width: 28, height: 28, borderRadius: '50%',
          background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16,
          color: colors.text.muted, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>

        <h3 id="confirm-title" style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text.primary, margin: `0 0 ${spacing.sm}px` }}>{title}</h3>
        <p style={{ fontSize: fontSize.md, color: colors.text.secondary, lineHeight: 1.6, margin: `0 0 ${spacing.lg}px` }}>{message}</p>

        {requireReason && (
          <textarea
            value={reason} onChange={e => onReasonChange?.(e.target.value)}
            placeholder="السبب (10 أحرف على الأقل)..."
            aria-label="سبب الإجراء"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: radius.md, fontSize: fontSize.md,
              border: `1px solid ${colors.border.default}`, resize: 'vertical', minHeight: 60,
              marginBottom: spacing.lg, boxSizing: 'border-box', direction: 'rtl', fontFamily: 'inherit',
            }}
          />
        )}

        <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-start' }}>
          <button onClick={onConfirm}
            disabled={requireReason && reason.length < 10}
            style={{
              padding: '10px 24px', borderRadius: radius.md, border: 'none', fontSize: fontSize.md, fontWeight: fontWeight.semi,
              background: danger ? colors.status.error : colors.accent.primary, color: '#fff', cursor: 'pointer',
              opacity: requireReason && reason.length < 10 ? 0.5 : 1, transition: 'all .1s',
            }}>
            {confirmLabel}
          </button>
          <button onClick={onCancel} style={{
            padding: '10px 24px', borderRadius: radius.md, border: `1px solid ${colors.border.default}`,
            background: colors.bg.card, color: colors.text.secondary, fontSize: fontSize.md, cursor: 'pointer',
          }}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
