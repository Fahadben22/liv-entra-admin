'use client';

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
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9998,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, padding: '28px 32px', maxWidth: 420,
        width: '90%', direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,.2)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>{title}</h3>
        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: '0 0 16px' }}>{message}</p>
        {requireReason && (
          <textarea
            value={reason} onChange={e => onReasonChange?.(e.target.value)}
            placeholder="السبب (10 أحرف على الأقل)..."
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
              border: '1px solid #e2e8f0', resize: 'vertical', minHeight: 60,
              marginBottom: 16, boxSizing: 'border-box', direction: 'rtl',
            }}
          />
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start' }}>
          <button onClick={onConfirm}
            disabled={requireReason && reason.length < 10}
            style={{
              padding: '10px 24px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600,
              background: danger ? '#dc2626' : '#1d4070', color: '#fff', cursor: 'pointer',
              opacity: requireReason && reason.length < 10 ? 0.5 : 1,
            }}>
            {confirmLabel}
          </button>
          <button onClick={onCancel} style={{
            padding: '10px 24px', borderRadius: 10, border: '1px solid #e2e8f0',
            background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer',
          }}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
