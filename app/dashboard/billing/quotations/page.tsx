'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { request, adminApi, BASE } from '@/lib/api';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'مسودة',     color: '#71717a' },
  sent:      { label: 'مُرسل',     color: '#3b82f6' },
  accepted:  { label: 'مقبول',     color: '#16a34a' },
  rejected:  { label: 'مرفوض',     color: '#dc2626' },
  converted: { label: 'تم التحويل', color: '#7c3aed' },
};

export default function QuotationsPage() {
  const router = useRouter();
  const [items, setItems]       = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast]       = useState('');

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    try {
      const [qRes, cRes] = await Promise.allSettled([
        request<any>('GET', '/admin/billing/quotations?limit=100'),
        adminApi.listCompanies(),
      ]);
      if (qRes.status === 'fulfilled') setItems((qRes.value as any)?.data?.data || []);
      if (cRes.status === 'fulfilled') setCompanies(Array.isArray((cRes.value as any)?.data) ? (cRes.value as any).data : []);
    } catch {}
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleConvert = async (id: string, num: string) => {
    if (!confirm(`تحويل عرض السعر ${num} إلى فاتورة؟`)) return;
    try {
      await request('PATCH', `/admin/billing/quotations/${id}/convert`);
      showToast(`تم تحويل ${num} إلى فاتورة`);
      load();
    } catch (e: any) { showToast(e.message || 'خطأ'); }
  };

  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#18181b', color: '#fff', padding: '10px 28px', borderRadius: 7, fontSize: 13, zIndex: 9999 }}>{toast}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: '#18181b' }}>عروض الأسعار</h2>
        <button onClick={() => setShowCreate(true)} style={{ fontSize: 13, padding: '8px 18px', borderRadius: 7, background: '#18181b', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          + عرض سعر جديد
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#a1a1aa', textAlign: 'center', padding: 60 }}>جاري التحميل...</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#a1a1aa', background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5' }}>
          <p style={{ fontSize: 13 }}>لا توجد عروض أسعار بعد</p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {['الرقم', 'الشركة', 'المبلغ', 'الحالة', 'صالح حتى', 'إجراء'].map(h => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#a1a1aa', borderBottom: '1px solid #e5e5e5' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((q, i) => {
                const sc = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
                return (
                  <tr key={q.id} style={{ borderBottom: i < items.length - 1 ? '1px solid #f0f0f0' : 'none', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '12px 18px', fontSize: 12, fontWeight: 600, fontFamily: 'monospace', color: '#18181b' }}>{q.quotation_number}</td>
                    <td style={{ padding: '12px 18px', fontSize: 13, color: '#18181b' }}>{q.company?.name || q.company?.name_ar || '—'}</td>
                    <td style={{ padding: '12px 18px', fontSize: 13, fontWeight: 600, color: '#18181b' }}>{Number(q.total_sar || 0).toLocaleString()} ر.س</td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, color: sc.color, fontWeight: 500 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, display: 'inline-block' }} />
                        {sc.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#71717a' }}>{q.valid_until || '—'}</td>
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <a href={`${BASE}/admin/billing/quotations/${q.id}/pdf`} target="_blank" rel="noopener"
                          style={{ fontSize: 10, padding: '5px 8px', borderRadius: 7, background: '#fafafa', border: '1px solid #e5e5e5', color: '#18181b', textDecoration: 'none' }}>
                          PDF
                        </a>
                        {q.status === 'draft' && (
                          <button onClick={() => handleConvert(q.id, q.quotation_number)}
                            style={{ fontSize: 10, padding: '5px 8px', borderRadius: 7, background: '#fafafa', border: '1px solid #e5e5e5', color: '#16a34a', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                            فاتورة
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Quotation Modal */}
      {showCreate && (
        <CreateQuotationModal companies={companies} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); showToast('تم إنشاء عرض السعر'); }} />
      )}
    </div>
  );
}

function CreateQuotationModal({ companies, onClose, onDone }: { companies: any[]; onClose: () => void; onDone: () => void }) {
  const [companyId, setCompanyId] = useState('');
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_price: 0 }]);
  const [validDays, setValidDays] = useState(30);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const addItem = () => setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, k: string, v: any) => setItems(items.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  const submit = async () => {
    if (!companyId) { setErr('اختر الشركة'); return; }
    if (!items.some(i => i.description && i.unit_price > 0)) { setErr('أضف بنداً واحداً على الأقل'); return; }
    setLoading(true);
    try {
      await request('POST', '/admin/billing/quotations', {
        company_id: companyId,
        items: items.filter(i => i.description && i.unit_price > 0),
        valid_days: validDays,
        notes: notes || undefined,
      });
      onDone();
    } catch (e: any) { setErr(e.message || 'خطأ'); }
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #e5e5e5', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: '#fff', color: '#18181b' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: '32px 28px', width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 20px', color: '#18181b' }}>عرض سعر جديد</h3>

        <label style={{ fontSize: 11, fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>الشركة *</label>
        <select value={companyId} onChange={e => setCompanyId(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }}>
          <option value="">اختر شركة...</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <label style={{ fontSize: 11, fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: 8 }}>البنود</label>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 30px', gap: 8, marginBottom: 8 }}>
            <input placeholder="الوصف" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} style={inputStyle} />
            <input type="number" placeholder="الكمية" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} style={inputStyle} />
            <input type="number" placeholder="السعر" value={item.unit_price || ''} onChange={e => updateItem(i, 'unit_price', Number(e.target.value))} style={inputStyle} />
            {items.length > 1 && (
              <button onClick={() => removeItem(i)} style={{ background: '#fafafa', border: '1px solid #e5e5e5', color: '#dc2626', borderRadius: 7, cursor: 'pointer', fontSize: 14 }}>×</button>
            )}
          </div>
        ))}
        <button onClick={addItem} style={{ fontSize: 12, color: '#18181b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>+ إضافة بند</button>

        {/* Totals */}
        {subtotal > 0 && (
          <div style={{ background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: '#71717a' }}>المجموع الفرعي</span>
              <span style={{ color: '#18181b' }}>{subtotal.toLocaleString()} ر.س</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: '#71717a' }}>ضريبة 15%</span>
              <span style={{ color: '#18181b' }}>{vat.toLocaleString(undefined, { minimumFractionDigits: 2 })} ر.س</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, borderTop: '1px solid #e5e5e5', paddingTop: 6 }}>
              <span style={{ color: '#18181b' }}>الإجمالي</span>
              <span style={{ color: '#16a34a' }}>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })} ر.س</span>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>صلاحية العرض (أيام)</label>
            <select value={validDays} onChange={e => setValidDays(Number(e.target.value))} style={inputStyle}>
              {[7, 15, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d} يوم</option>)}
            </select>
          </div>
        </div>

        <label style={{ fontSize: 11, fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>ملاحظات</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: 16 }} />

        {err && <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 7, border: '1px solid #e5e5e5', background: '#fff', color: '#71717a', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>إلغاء</button>
          <button onClick={submit} disabled={loading} style={{ padding: '10px 24px', borderRadius: 7, border: 'none', background: '#18181b', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: loading ? .7 : 1 }}>
            {loading ? '...' : 'إنشاء عرض السعر'}
          </button>
        </div>
      </div>
    </div>
  );
}
