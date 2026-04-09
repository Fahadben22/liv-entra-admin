'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { colors, fontSize, fontWeight, radius } from '@/lib/design-tokens';

interface ToastItem { id: number; msg: string; type: 'success' | 'error' | 'info'; created: number }

const DURATION = 4000;
const ICONS = { success: '✓', error: '✗', info: 'ℹ' };
const BG = { success: colors.status.success, error: colors.status.error, info: colors.accent.primary };

const ToastCtx = createContext<(msg: string, type?: 'success' | 'error' | 'info') => void>(() => {});

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type, created: id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), DURATION);
  }, []);

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div role="region" aria-label="Notifications" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        {toasts.map(t => (
          <div key={t.id} role="alert" style={{
            background: BG[t.type], color: '#fff', padding: '0', borderRadius: radius.md,
            fontSize: fontSize.md, fontWeight: fontWeight.semi, boxShadow: '0 4px 20px rgba(0,0,0,.2)',
            animation: 'toastIn .25s ease', direction: 'rtl', overflow: 'hidden', minWidth: 280,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px 10px 10px' }}>
              {/* Icon */}
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                {ICONS[t.type]}
              </span>
              {/* Message */}
              <span style={{ flex: 1 }}>{t.msg}</span>
              {/* Dismiss X */}
              <button onClick={() => dismiss(t.id)} aria-label="إغلاق" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: 14, padding: 4, lineHeight: 1 }}>✕</button>
            </div>
            {/* Progress bar — auto dismiss visual */}
            <div style={{ height: 3, background: 'rgba(255,255,255,.2)' }}>
              <div style={{ height: '100%', background: 'rgba(255,255,255,.5)', animation: `toastProgress ${DURATION}ms linear forwards` }} />
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toastProgress { from { width: 100%; } to { width: 0%; } }
      `}</style>
    </ToastCtx.Provider>
  );
}
