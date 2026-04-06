'use client';
import { useEffect, useState } from 'react';
import { request } from '@/lib/api';
import { useBilling } from '../layout';
import { fmt, fmtDate, INV_STATUS } from '@/lib/billing-helpers';

const CN_STATUS: Record<string, { label: string; color: string }> = {
  draft:   { label: 'مسودة',   color: '#71717a' },
  issued:  { label: 'صادر',    color: '#3b82f6' },
  applied: { label: 'مطبّق',   color: '#16a34a' },
  void:    { label: 'ملغى',    color: '#dc2626' },
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
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: '#fafafa' }}>إشعارات دائنة</h2>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
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
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#a1a1aa' }}>جاري التحميل...</div>
      ) : creditNotes.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,.06)', padding: '60px', textAlign: 'center', color: '#a1a1aa', fontSize: 13 }}>
          لا توجد إشعارات دائنة
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                {['الرقم', 'الشركة', 'الفاتورة الأصلية', 'المبلغ', 'السبب', 'الحالة', 'التاريخ'].map(h => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#a1a1aa', borderBottom: '1px solid rgba(255,255,255,.06)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creditNotes.map((cn, i) => {
                const sc = CN_STATUS[cn.status] || CN_STATUS.issued;
                return (
                  <tr key={cn.id} style={{ borderBottom: i < creditNotes.length - 1 ? '1px solid rgba(255,255,255,.03)' : 'none', background: i % 2 === 1 ? 'rgba(255,255,255,.02)' : 'transparent' }}>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa', fontFamily: 'monospace' }}>{cn.credit_note_number}</span>
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 13, color: '#fafafa' }}>{cn.companies?.name || '—'}</td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#52525b', fontFamily: 'monospace' }}>{cn.original_invoice_id?.slice(0, 8) || '—'}</td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>-{fmt(cn.total_sar)} ر.س</span>
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#52525b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cn.reason}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, color: sc.color, fontWeight: 500 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, display: 'inline-block', boxShadow: `0 0 6px ${sc.color}` }} />
                        {sc.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#52525b' }}>{fmtDate(cn.issued_at)}</td>
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

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,.08)', fontSize: 13, boxSizing: 'border-box', background: 'rgba(255,255,255,.04)', color: '#fafafa' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#18181b', borderRadius: 8, padding: '28px 32px', width: 420, border: '1px solid rgba(255,255,255,.1)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 20px', color: '#fafafa' }}>إنشاء إشعار دائن</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: '#a1a1aa' }}>الفاتورة الأصلية *</label>
            <select value={form.invoice_id} onChange={e => set('invoice_id', e.target.value)}
              style={inputStyle}>
              <option value="">اختر فاتورة...</option>
              {invoices.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.invoice_number} — {fmt(inv.total_sar)} ر.س ({inv.companies?.name || inv.company?.name || ''})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: '#a1a1aa' }}>السبب *</label>
            <textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={2} placeholder="سبب الإشعار الدائن..."
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: '#a1a1aa' }}>المبلغ (ر.س)</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                placeholder={selectedInvoice ? String(selectedInvoice.total_sar) : 'كامل المبلغ'}
                style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: '#a1a1aa' }}>طريقة الاسترداد</label>
              <select value={form.refund_method} onChange={e => set('refund_method', e.target.value)}
                style={inputStyle}>
                <option value="manual">يدوي</option>
                <option value="gateway_refund">استرداد عبر بوابة الدفع</option>
                <option value="credit_balance">رصيد</option>
              </select>
            </div>
          </div>
        </div>
        {err && <p style={{ fontSize: 12, color: '#dc2626', margin: '12px 0 0' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', cursor: 'pointer', fontSize: 13, color: '#a1a1aa' }}>إلغاء</button>
          <button onClick={submit} disabled={loading}
            style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {loading ? '...' : 'إنشاء إشعار دائن'}
          </button>
        </div>
      </div>
    </div>
  );
}
