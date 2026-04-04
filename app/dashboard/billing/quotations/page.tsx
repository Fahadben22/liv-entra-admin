'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { request, adminApi, BASE } from '@/lib/api';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'مسودة',     color: '#64748b', bg: 'rgba(100,116,139,.12)' },
  sent:      { label: 'مُرسل',     color: '#3b82f6', bg: 'rgba(59,130,246,.12)' },
  accepted:  { label: 'مقبول',     color: '#059669', bg: 'rgba(5,150,105,.12)' },
  rejected:  { label: 'مرفوض',     color: '#dc2626', bg: 'rgba(220,38,38,.12)' },
  converted: { label: 'تم التحويل', color: '#8b5cf6', bg: 'rgba(139,92,246,.12)' },
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
      showToast(`تم تحويل ${num} إلى فاتورة ✓`);
      load();
    } catch (e: any) { showToast(e.message || 'خطأ'); }
  };

  const C = { bg: '#05081a', card: '#0c1535', border: 'rgba(255,255,255,.07)', text: '#e2e8f0', text2: '#94a3b8', accent: '#2563eb' };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Tajawal', sans-serif", direction: 'rtl' }}>
      {toast && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#059669', color: '#fff', padding: '10px 28px', borderRadius: 10, fontSize: 13, zIndex: 9999, fontWeight: 700 }}>{toast}</div>}

      <nav style={{ background: 'rgba(5,8,26,.95)', borderBottom: `1px solid ${C.border}`, padding: '12px 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/dashboard" style={{ fontWeight: 800, fontSize: 15, color: '#fff', textDecoration: 'none' }}>LIVENTRA OS</Link>
          <Link href="/dashboard/billing" style={{ fontSize: 13, color: C.text2, textDecoration: 'none' }}>← الفوترة</Link>
          <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>عروض الأسعار</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowCreate(true)} style={{ fontSize: 13, padding: '8px 18px', borderRadius: 10, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
            + عرض سعر جديد
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>عروض الأسعار 📋</h1>

        {loading ? (
          <p style={{ color: C.text2, textAlign: 'center', padding: 60 }}>جاري التحميل...</p>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: C.text2 }}>
            <div style={{ fontSize: 48, opacity: .3, marginBottom: 16 }}>📋</div>
            <p>لا توجد عروض أسعار بعد</p>
          </div>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px 120px 120px 140px', gap: 0, background: 'rgba(255,255,255,.03)', borderBottom: `1px solid ${C.border}`, padding: '12px 20px' }}>
              {['الرقم', 'الشركة', 'المبلغ', 'الحالة', 'صالح حتى', 'إجراء'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>{h}</div>
              ))}
            </div>
            {items.map((q, i) => {
              const sc = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
              return (
                <div key={q.id} style={{
                  display: 'grid', gridTemplateColumns: '140px 1fr 120px 120px 120px 140px',
                  gap: 0, padding: '14px 20px', alignItems: 'center',
                  borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>{q.quotation_number}</span>
                  <span style={{ fontSize: 13 }}>{q.company?.name || q.company?.name_ar || '—'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{Number(q.total_sar || 0).toLocaleString()} ر.س</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg, borderRadius: 8, padding: '3px 10px', display: 'inline-block', width: 'fit-content' }}>{sc.label}</span>
                  <span style={{ fontSize: 12, color: C.text2 }}>{q.valid_until || '—'}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <a href={`${BASE}/admin/billing/quotations/${q.id}/pdf`} target="_blank" rel="noopener"
                      style={{ fontSize: 10, padding: '5px 8px', borderRadius: 6, background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.2)', color: '#3b82f6', textDecoration: 'none' }}>
                      📄 PDF
                    </a>
                    {q.status === 'draft' && (
                      <button onClick={() => handleConvert(q.id, q.quotation_number)}
                        style={{ fontSize: 10, padding: '5px 8px', borderRadius: 6, background: 'rgba(5,150,105,.1)', border: '1px solid rgba(5,150,105,.2)', color: '#059669', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                        → فاتورة
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Quotation Modal */}
      {showCreate && (
        <CreateQuotationModal companies={companies} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); showToast('تم إنشاء عرض السعر ✓'); }} />
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

  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, outline: 'none' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#0c1535', border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: '32px 28px', width: '100%', maxWidth: 600, direction: 'rtl', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 20px' }}>عرض سعر جديد 📋</h3>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>الشركة *</label>
        <select value={companyId} onChange={e => setCompanyId(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }}>
          <option value="">اختر شركة...</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 8 }}>البنود</label>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 30px', gap: 8, marginBottom: 8 }}>
            <input placeholder="الوصف" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} style={inputStyle} />
            <input type="number" placeholder="الكمية" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} style={inputStyle} />
            <input type="number" placeholder="السعر" value={item.unit_price || ''} onChange={e => updateItem(i, 'unit_price', Number(e.target.value))} style={inputStyle} />
            {items.length > 1 && (
              <button onClick={() => removeItem(i)} style={{ background: 'rgba(220,38,38,.1)', border: '1px solid rgba(220,38,38,.2)', color: '#dc2626', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>✕</button>
            )}
          </div>
        ))}
        <button onClick={addItem} style={{ fontSize: 12, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>+ إضافة بند</button>

        {/* Totals */}
        {subtotal > 0 && (
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: '#94a3b8' }}>المجموع الفرعي</span>
              <span>{subtotal.toLocaleString()} ر.س</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: '#94a3b8' }}>ضريبة 15%</span>
              <span>{vat.toLocaleString(undefined, { minimumFractionDigits: 2 })} ر.س</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 6 }}>
              <span>الإجمالي</span>
              <span style={{ color: '#059669' }}>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })} ر.س</span>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>صلاحية العرض (أيام)</label>
            <select value={validDays} onChange={e => setValidDays(Number(e.target.value))} style={inputStyle}>
              {[7, 15, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d} يوم</option>)}
            </select>
          </div>
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>ملاحظات</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: 16 }} />

        {err && <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>إلغاء</button>
          <button onClick={submit} disabled={loading} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', opacity: loading ? .7 : 1 }}>
            {loading ? '...' : 'إنشاء عرض السعر'}
          </button>
        </div>
      </div>
    </div>
  );
}
