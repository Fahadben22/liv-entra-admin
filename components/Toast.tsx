'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ToastItem { id: number; msg: string; type: 'success' | 'error' | 'info' }

const ToastCtx = createContext<(msg: string, type?: 'success' | 'error' | 'info') => void>(() => {});

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const BG = { success: '#15803d', error: '#dc2626', info: '#1d4070' };

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: BG[t.type], color: '#fff', padding: '10px 24px', borderRadius: 10,
            fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,.15)',
            animation: 'fadeIn .2s ease', direction: 'rtl',
          }}>
            {t.msg}
          </div>
        ))}
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </ToastCtx.Provider>
  );
}
