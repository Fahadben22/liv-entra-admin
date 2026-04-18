'use client';
import { useState, useEffect } from 'react';
import { request, BASE } from '@/lib/api';
import { useBilling } from '../layout';
import { fmt, fmtDate, PLAN_AR, INV_STATUS, DUNNING } from '@/lib/billing-helpers';

// ─── Mark Paid Modal ─────────────────────────────────────────────────────────
function MarkPaidModal({ invoice, onClose, onDone }: { invoice: any; onClose: () => void; onDone: () => void }) {
  const [ref, setRef]       = useState('');
  const [notes, setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState('');

  const submit = async () => {
    if (!ref.trim()) { setErr('أدخل مرجع الدفع'); return; }
    setLoading(true);
    try {
      await request('PATCH', `/admin/billing/invoices/${invoice.id}/mark-paid`, { payment_ref: ref, notes });
      onDone();
    } catch (e: any) { setErr(e.message || 'خطأ'); }
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--lv-line)', fontSize: 13, boxSizing: 'border-box', background: 'var(--lv-bg)', color: 'var(--lv-fg)' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: 'var(--lv-panel)', borderRadius: 16, padding: '28px 32px', width: 380, boxShadow: 'var(--lv-shadow-panel)', border: '1px solid var(--lv-line-strong)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: 'var(--lv-fg)' }}>تسجيل دفع</h3>
        <p style={{ fontSize: 12, color: 'var(--lv-muted)', margin: '0 0 20px' }}>{invoice.invoice_number} — {fmt(invoice.total_sar)} ر.س</p>
        <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>مرجع الدفع *</label>
        <input value={ref} onChange={e => setRef(e.target.value)} placeholder="رقم الحوالة / رقم المعاملة"
          style={{ ...inputStyle, marginBottom: 12 }} />
        <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>ملاحظات (اختياري)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          style={{ ...inputStyle, marginBottom: 16, resize: 'vertical' }} />
        {err && <p style={{ fontSize: 12, color: 'var(--lv-danger)', marginBottom: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid var(--lv-line)', background: 'var(--lv-bg)', cursor: 'pointer', fontSize: 13, color: 'var(--lv-muted)' }}>إلغاء</button>
          <button onClick={submit} disabled={loading}
            style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'var(--lv-accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {loading ? '...' : 'تأكيد الدفع'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Invoice Modal ────────────────────────────────────────────────────
function CreateInvoiceModal({ companies, onClose, onDone }: { companies: any[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    company_id: '', description: '', amount_sar: '', payment_terms: '15', notes: '',
    period_start: new Date().toISOString().split('T')[0],
    period_end: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.company_id || !form.amount_sar) { setErr('الشركة والمبلغ مطلوبان'); return; }
    setLoading(true);
    try {
      await request('POST', '/admin/billing/invoices', {
        company_id: form.company_id, description: form.description || 'اشتراك شهري',
        amount_sar: Number(form.amount_sar), payment_terms: Number(form.payment_terms),
        period_start: form.period_start, period_end: form.period_end,
        notes: form.notes || undefined,
      });
      onDone();
    } catch (e: any) { setErr(e.message || 'خطأ'); }
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--lv-line)', fontSize: 13, boxSizing: 'border-box', background: 'var(--lv-bg)', color: 'var(--lv-fg)' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: 'var(--lv-panel)', borderRadius: 16, padding: '28px 32px', width: 420, boxShadow: 'var(--lv-shadow-panel)', border: '1px solid var(--lv-line-strong)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 20px', color: 'var(--lv-fg)' }}>إنشاء فاتورة</h3>
        <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>الشركة *</label>
        <select value={form.company_id} onChange={e => set('company_id', e.target.value)}
          style={{ ...inputStyle, marginBottom: 12 }}>
          <option value="">اختر شركة...</option>
          {(Array.isArray(companies) ? companies : []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>الوصف</label>
        <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="اشتراك شهري — الخطة الاحترافية"
          style={{ ...inputStyle, marginBottom: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>المبلغ (ر.س) *</label>
            <input type="number" value={form.amount_sar} onChange={e => set('amount_sar', e.target.value)} placeholder="699"
              style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>أيام السداد</label>
            <select value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)}
              style={inputStyle}>
              {['7','10','15','30','45'].map(d => <option key={d} value={d}>{d} يوم</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>بداية الفترة</label>
            <input type="date" value={form.period_start} onChange={e => set('period_start', e.target.value)}
              style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>نهاية الفترة</label>
            <input type="date" value={form.period_end} onChange={e => set('period_end', e.target.value)}
              style={inputStyle} />
          </div>
        </div>
        {form.amount_sar && Number(form.amount_sar) > 0 && (
          <div style={{ background: 'var(--lv-bg)', border: '1px solid var(--lv-line)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: 'var(--lv-muted)' }}>المجموع الفرعي</span>
              <span style={{ fontWeight: 600, color: 'var(--lv-fg)' }}>{Number(form.amount_sar).toLocaleString()} ر.س</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: 'var(--lv-muted)' }}>ضريبة القيمة المضافة 15%</span>
              <span style={{ fontWeight: 600, color: 'var(--lv-fg)' }}>{(Number(form.amount_sar) * 0.15).toLocaleString(undefined, { minimumFractionDigits: 2 })} ر.س</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, borderTop: '1px solid var(--lv-line)', paddingTop: 6 }}>
              <span style={{ color: 'var(--lv-fg)' }}>الإجمالي شامل الضريبة</span>
              <span style={{ color: 'var(--lv-success)' }}>{(Number(form.amount_sar) * 1.15).toLocaleString(undefined, { minimumFractionDigits: 2 })} ر.س</span>
            </div>
          </div>
        )}
        <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>ملاحظات</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
          style={{ ...inputStyle, marginBottom: 16, resize: 'vertical' }} />
        {err && <p style={{ fontSize: 12, color: 'var(--lv-danger)', marginBottom: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid var(--lv-line)', background: 'var(--lv-bg)', cursor: 'pointer', fontSize: 13, color: 'var(--lv-muted)' }}>إلغاء</button>
          <button onClick={submit} disabled={loading}
            style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'var(--lv-accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {loading ? '...' : 'إنشاء الفاتورة'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Company Drawer ──────────────────────────────────────────────────────────
function CompanyDrawer({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request<any>('GET', `/admin/billing/company/${companyId}`)
      .then(r => setData(r?.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.2)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 480, background: 'var(--lv-panel)', height: '100%', overflowY: 'auto', padding: '28px', borderInlineStart: '1px solid var(--lv-line)', boxShadow: 'var(--lv-shadow-panel)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--lv-fg)' }}>سجل الفوترة — {data?.company?.name || '...'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--lv-muted)' }}>×</button>
        </div>
        {loading ? (
          <p style={{ color: 'var(--lv-muted)', textAlign: 'center', paddingTop: 60 }}>جاري التحميل...</p>
        ) : data ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div className="card" style={{ borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--lv-success)', margin: 0 }}>{fmt(data.total_paid || 0)}</p>
                <p style={{ fontSize: 10, color: 'var(--lv-muted)', margin: '4px 0 0' }}>إجمالي المدفوع (ر.س)</p>
              </div>
              <div className="card" style={{ borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--lv-warn)', margin: 0 }}>{fmt(data.total_outstanding || 0)}</p>
                <p style={{ fontSize: 10, color: 'var(--lv-muted)', margin: '4px 0 0' }}>مبالغ معلقة (ر.س)</p>
              </div>
            </div>
            <h3 style={{ fontSize: 11, fontWeight: 500, margin: '0 0 12px', color: 'var(--lv-muted)' }}>الفواتير ({data.invoices?.length || 0})</h3>
            {(data.invoices || []).map((inv: any) => {
              const sc = INV_STATUS[inv.status] || INV_STATUS.draft;
              return (
                <div key={inv.id} style={{ border: '1px solid var(--lv-line)', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--lv-fg)' }}>{inv.invoice_number}</span>
                    <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: sc.color, fontWeight: 500 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, display: 'inline-block' }} />
                      {sc.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--lv-muted)' }}>
                    <span>{fmt(inv.total_sar)} ر.س</span>
                    <span>استحقاق: {fmtDate(inv.due_date)}</span>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <p style={{ color: 'var(--lv-danger)', textAlign: 'center', paddingTop: 60 }}>فشل تحميل البيانات</p>
        )}
      </div>
    </div>
  );
}

// ─── Invoices Page ───────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const { invoices, companies, loading, reload, showToast } = useBilling();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]       = useState('');
  const [actioning, setActioning] = useState<string | null>(null);
  const [markPaidInv, setMarkPaidInv] = useState<any>(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [drawerCompId, setDrawerCompId] = useState<string | null>(null);

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--lv-muted)' }}>جاري التحميل...</div>;

  const safeInvoices = Array.isArray(invoices) ? invoices : [];

  const filteredInvoices = safeInvoices.filter(inv => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return inv.invoice_number?.toLowerCase().includes(q) || inv.companies?.name?.toLowerCase().includes(q) || inv.company?.name?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleVoid = async (id: string, invNum: string) => {
    if (!confirm(`هل تريد إلغاء الفاتورة ${invNum}؟`)) return;
    const reason = prompt('سبب الإلغاء:');
    if (!reason) return;
    setActioning(id);
    try {
      await request('POST', `/admin/billing/invoices/${id}/void`, { reason });
      showToast('تم إلغاء الفاتورة');
      await reload();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setActioning(null);
  };

  const handleWaive = async (id: string, invNum: string) => {
    const reason = prompt(`سبب إعفاء الفاتورة ${invNum}:`);
    if (!reason) return;
    setActioning(id);
    try {
      await request('PATCH', `/admin/billing/invoices/${id}/waive`, { reason });
      showToast('تم الإعفاء');
      await reload();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setActioning(null);
  };

  const handleResend = async (id: string) => {
    setActioning(id);
    try {
      await request('POST', `/admin/billing/invoices/${id}/send`, {});
      showToast('تم إعادة إرسال الفاتورة');
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setActioning(null);
  };

  const ghostBtn: React.CSSProperties = { fontSize: 12, padding: '8px 14px', borderRadius: 10, background: 'var(--lv-chip)', border: '1.5px solid var(--lv-line)', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 36, fontWeight: 500, transition: 'all .12s', color: 'var(--lv-muted)' };

  return (
    <>
      {markPaidInv && (
        <MarkPaidModal invoice={markPaidInv} onClose={() => setMarkPaidInv(null)}
          onDone={async () => { showToast('تم تسجيل الدفع'); setMarkPaidInv(null); await reload(); }} />
      )}
      {showCreate && (
        <CreateInvoiceModal companies={companies} onClose={() => setShowCreate(false)}
          onDone={async () => { showToast('تم إنشاء الفاتورة'); setShowCreate(false); await reload(); }} />
      )}
      {drawerCompId && <CompanyDrawer companyId={drawerCompId} onClose={() => setDrawerCompId(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--lv-fg)' }}>الفواتير</h2>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'var(--lv-accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          + فاتورة جديدة
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالشركة أو رقم الفاتورة..."
          style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--lv-line)', fontSize: 13, minWidth: 220, background: 'var(--lv-bg)', color: 'var(--lv-fg)' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'issued', 'overdue', 'paid', 'waived', 'void'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{
                padding: '6px 12px', borderRadius: 7,
                border: '1px solid var(--lv-line)',
                background: statusFilter === s ? 'var(--lv-accent)' : 'var(--lv-bg)',
                color: statusFilter === s ? '#fff' : 'var(--lv-muted)',
                fontSize: 11, cursor: 'pointer', fontWeight: statusFilter === s ? 600 : 400,
              }}>
              {s === 'all' ? 'الكل' : INV_STATUS[s]?.label}
              {s !== 'all' && <span style={{ marginRight: 4 }}>({safeInvoices.filter(i => i.status === s).length})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice table */}
      <div className="card" style={{ borderRadius: 14, overflow: 'hidden' }}>
        {filteredInvoices.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--lv-muted)', fontSize: 13 }}>لا توجد فواتير</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--lv-bg)' }}>
                {['رقم الفاتورة', 'الشركة', 'المبلغ', 'الحالة', 'الاستحقاق', 'التذكير', 'إجراء'].map(h => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: 'var(--lv-muted)', borderBottom: '1px solid var(--lv-line)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv, i) => {
                const sc = INV_STATUS[inv.status] || INV_STATUS.draft;
                const isAct = actioning === inv.id;
                const isActionable = ['issued', 'sent', 'overdue'].includes(inv.status);
                const companyName = inv.companies?.name || inv.company?.name || inv.company_id;
                return (
                  <tr key={inv.id} style={{ borderBottom: i < filteredInvoices.length - 1 ? '1px solid var(--lv-line)' : 'none', background: i % 2 === 1 ? 'var(--lv-bg)' : 'var(--lv-panel)' }}>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--lv-fg)', fontFamily: 'monospace' }}>{inv.invoice_number}</span>
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <button onClick={() => setDrawerCompId(inv.company_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'right' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)', margin: 0 }}>{companyName}</p>
                      </button>
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)', margin: 0 }}>{fmt(inv.total_sar)} ر.س</p>
                      {Number(inv.vat_sar) > 0 && <p style={{ fontSize: 10, color: 'var(--lv-muted)', margin: 0 }}>شامل {fmt(inv.vat_sar)} ض.ق.م</p>}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, color: sc.color, fontWeight: 500 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, display: 'inline-block' }} />
                        {sc.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: inv.status === 'overdue' ? 'var(--lv-warn)' : 'var(--lv-muted)', direction: 'ltr', textAlign: 'right' }}>
                      {fmtDate(inv.due_date)}
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 11, color: 'var(--lv-muted)' }}>
                      {DUNNING[inv.dunning_step] || '—'}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {isActionable && (
                          <>
                            <button onClick={() => setMarkPaidInv(inv)} disabled={isAct}
                              style={{ ...ghostBtn, color: 'var(--lv-success)' }}>
                              دفع
                            </button>
                            <button onClick={() => handleResend(inv.id)} disabled={isAct}
                              style={{ ...ghostBtn }}>
                              {isAct ? '...' : 'إرسال'}
                            </button>
                            <button onClick={() => handleWaive(inv.id, inv.invoice_number)} disabled={isAct}
                              style={{ ...ghostBtn }}>
                              إعفاء
                            </button>
                            <button onClick={() => handleVoid(inv.id, inv.invoice_number)} disabled={isAct}
                              style={{ ...ghostBtn, color: 'var(--lv-danger)' }}>
                              إلغاء
                            </button>
                          </>
                        )}
                        <button style={{ ...ghostBtn, cursor: 'pointer' }}
                          onClick={async () => {
                            try {
                              const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
                              const res = await fetch(`${BASE}/admin/billing/invoices/${inv.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
                              if (!res.ok) throw new Error();
                              const blob = await res.blob();
                              const u = URL.createObjectURL(blob);
                              const a = document.createElement('a'); a.href = u; a.download = `invoice-${inv.invoice_number || inv.id}.pdf`; a.click(); URL.revokeObjectURL(u);
                            } catch { alert('فشل تحميل الفاتورة'); }
                          }}>
                          PDF
                        </button>
                        {inv.status === 'paid' && (
                          <button style={{ ...ghostBtn, color: 'var(--lv-success)', cursor: 'pointer' }}
                            onClick={async () => {
                              try {
                                const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
                                const res = await fetch(`${BASE}/admin/billing/invoices/${inv.id}/receipt`, { headers: { Authorization: `Bearer ${token}` } });
                                if (!res.ok) throw new Error();
                                const blob = await res.blob();
                                const u = URL.createObjectURL(blob);
                                const a = document.createElement('a'); a.href = u; a.download = `receipt-${inv.invoice_number || inv.id}.pdf`; a.click(); URL.revokeObjectURL(u);
                              } catch { alert('فشل تحميل الإيصال'); }
                            }}>
                            إيصال
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
