'use client';
import { useEffect, useState } from 'react';
import { request } from '@/lib/api';
import { useBilling } from '../layout';
import { fmt, fmtDate, INV_STATUS } from '@/lib/billing-helpers';

const CN_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  draft:   { label: 'مسودة',   bg: '#f8fafc', color: '#64748b' },
  issued:  { label: 'صادر',    bg: '#eff6ff', color: '#1d4070' },
  applied: { label: 'مطبّق',   bg: '#f0fdf4', color: '#15803d' },
  void:    { label: 'ملغى',    bg: '#fef2f2', color: '#dc2626' },
};

export default function CreditNotesPage() {
  const { invoices, companies, showToast, reload } = useBilling();
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadCN = async () => {
    try {
      const res = await request<any>('GET', '/admin/billing/credit-notes');
      setCreditNotes(res?.data || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { loadCN(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>إشعارات دائنة</h2>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1d4070', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          + إشعار دائن جديد
        </button>
      </div>

      {showCreate && (
        <CreateCreditNoteModal
          invoices={Array.isArray(invoices) ? invoices.filter(i => ['paid', 'issued', 'sent', 'overdue'].includes(i.status)) : []}
          onClose={() => setShowCreate(false)}
          onDone={() => { setShowCreate(false); loadCN(); showToast('تم إنشاء الإشعار الدائن'); }}
        />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>جاري التحميل...</div>
      ) : creditNotes.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          لا توجد إشعارات دائنة
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['الرقم', 'الشركة', 'الفاتورة الأصلية', 'المبلغ', 'السبب', 'الحالة', 'التاريخ'].map(h => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creditNotes.map((cn, i) => {
                const sc = CN_STATUS[cn.status] || CN_STATUS.issued;
                return (
                  <tr key={cn.id} style={{ borderBottom: i < creditNotes.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4070', fontFamily: 'monospace' }}>{cn.credit_note_number}</span>
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 13 }}>{cn.companies?.name || '—'}</td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{cn.original_invoice_id?.slice(0, 8) || '—'}</td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>-{fmt(cn.total_sar)} ر.س</span>
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cn.reason}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 600 }}>{sc.label}</span>
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>{fmtDate(cn.issued_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateCreditNoteModal({ invoices, onClose, onDone }: { invoices: any[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ invoice_id: '', reason: '', amount: '', refund_method: 'manual' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const selectedInvoice = invoices.find(i => i.id === form.invoice_id);

  const submit = async () => {
    if (!form.invoice_id || !form.reason) { setErr('الفاتورة والسبب مطلوبان'); return; }
    setLoading(true);
    try {
      await request('POST', '/admin/billing/credit-notes/create', {
        invoice_id: form.invoice_id, reason: form.reason,
        amount: form.amount ? Number(form.amount) : undefined,
        refund_method: form.refund_method,
      });
      onDone();
    } catch (e: any) { setErr(e.message || 'خطأ'); setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 420, direction: 'rtl' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 20px' }}>إنشاء إشعار دائن</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>الفاتورة الأصلية *</label>
            <select value={form.invoice_id} onChange={e => set('invoice_id', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }}>
              <option value="">اختر فاتورة...</option>
              {invoices.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.invoice_number} — {fmt(inv.total_sar)} ر.س ({inv.companies?.name || inv.company?.name || ''})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>السبب *</label>
            <textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={2} placeholder="سبب الإشعار الدائن..."
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, direction: 'rtl', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>المبلغ (ر.س)</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                placeholder={selectedInvoice ? String(selectedInvoice.total_sar) : 'كامل المبلغ'}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>طريقة الاسترداد</label>
              <select value={form.refund_method} onChange={e => set('refund_method', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }}>
                <option value="manual">يدوي</option>
                <option value="gateway_refund">استرداد عبر بوابة الدفع</option>
                <option value="credit_balance">رصيد</option>
              </select>
            </div>
          </div>
        </div>
        {err && <p style={{ fontSize: 12, color: '#dc2626', margin: '12px 0 0' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>إلغاء</button>
          <button onClick={submit} disabled={loading}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1d4070', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {loading ? '...' : 'إنشاء إشعار دائن'}
          </button>
        </div>
      </div>
    </div>
  );
}
