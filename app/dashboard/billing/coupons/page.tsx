'use client';
import { useEffect, useState } from 'react';
import { request } from '@/lib/api';
import { useBilling } from '../layout';

function fmtDate(iso: string) { return iso ? new Date(iso).toLocaleDateString('ar-SA') : '—'; }

export default function CouponsPage() {
  const { showToast } = useBilling();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await request<any>('GET', '/admin/billing/coupons');
      setCoupons(res?.data || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`هل تريد حذف كود الخصم ${code}؟`)) return;
    try {
      await request('DELETE', `/admin/billing/coupons/${id}`);
      showToast('تم حذف كود الخصم');
      load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await request('PATCH', `/admin/billing/coupons/${id}`, { is_active: !isActive });
      showToast(isActive ? 'تم تعطيل كود الخصم' : 'تم تفعيل كود الخصم');
      load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
  };

  const ghostBtn: React.CSSProperties = { fontSize: 10, padding: '5px 8px', borderRadius: 7, background: 'var(--lv-bg)', border: '1px solid var(--lv-line)', cursor: 'pointer' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--lv-fg)' }}>أكواد الخصم</h2>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'var(--lv-accent)', color: 'var(--lv-panel)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          + كود جديد
        </button>
      </div>

      {showCreate && <CreateCouponModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); showToast('تم إنشاء كود الخصم'); }} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--lv-muted)' }}>جاري التحميل...</div>
      ) : coupons.length === 0 ? (
        <div className="card" style={{ background: 'var(--lv-panel)', borderRadius: 14, boxShadow: 'var(--lv-shadow-sm)', padding: '60px', textAlign: 'center', color: 'var(--lv-muted)', fontSize: 13 }}>
          لا توجد أكواد خصم — أنشئ كودك الأول
        </div>
      ) : (
        <div className="card" style={{ background: 'var(--lv-panel)', borderRadius: 14, boxShadow: 'var(--lv-shadow-sm)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--lv-bg)' }}>
                {['الكود', 'الخصم', 'الاستخدام', 'صالح حتى', 'الحالة', 'إجراء'].map(h => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: 'var(--lv-muted)', borderBottom: '1px solid var(--lv-line)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < coupons.length - 1 ? '1px solid var(--lv-line)' : 'none', background: i % 2 === 1 ? 'var(--lv-bg)' : 'var(--lv-panel)' }}>
                  <td style={{ padding: '12px 18px' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)', fontFamily: 'monospace', background: 'var(--lv-bg)', padding: '3px 8px', borderRadius: 7, border: '1px solid var(--lv-line)' }}>{c.code}</span>
                    {c.description_ar && <p style={{ fontSize: 10, color: 'var(--lv-muted)', margin: '4px 0 0' }}>{c.description_ar}</p>}
                  </td>
                  <td style={{ padding: '12px 18px', fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)' }}>
                    {c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value} ر.س`}
                  </td>
                  <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--lv-muted)' }}>
                    {c.current_uses}/{c.max_uses || '∞'}
                  </td>
                  <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--lv-muted)' }}>
                    {c.valid_until ? fmtDate(c.valid_until) : 'غير محدد'}
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, color: c.is_active ? '#16a34a' : 'var(--lv-muted)', fontWeight: 500 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.is_active ? '#16a34a' : 'var(--lv-muted)', display: 'inline-block' }} />
                      {c.is_active ? 'نشط' : 'معطّل'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleToggle(c.id, c.is_active)}
                        style={{ ...ghostBtn, color: 'var(--lv-muted)' }}>
                        {c.is_active ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button onClick={() => handleDelete(c.id, c.code)}
                        style={{ ...ghostBtn, color: 'var(--lv-danger)' }}>
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateCouponModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    code: '', description_ar: '', discount_type: 'percentage', discount_value: '',
    applies_to: 'all', max_uses: '', valid_until: '',
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.code || !form.discount_value) { setErr('الكود والقيمة مطلوبان'); return; }
    setLoading(true);
    try {
      await request('POST', '/admin/billing/coupons', {
        code: form.code, description_ar: form.description_ar,
        discount_type: form.discount_type, discount_value: Number(form.discount_value),
        applies_to: form.applies_to,
        max_uses: form.max_uses ? Number(form.max_uses) : undefined,
        valid_until: form.valid_until || undefined,
      });
      onDone();
    } catch (e: any) { setErr(e.message || 'خطأ'); setLoading(false); }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--lv-line)', fontSize: 13, boxSizing: 'border-box', background: 'var(--lv-bg)', color: 'var(--lv-fg)' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--lv-panel)', borderRadius: 16, padding: '28px 32px', width: 400, boxShadow: 'var(--lv-shadow-panel)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 20px', color: 'var(--lv-fg)' }}>إنشاء كود خصم</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>الكود *</label>
            <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="WELCOME2026"
              style={{ ...inputStyle, direction: 'ltr', fontFamily: 'monospace' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>الوصف</label>
            <input value={form.description_ar} onChange={e => set('description_ar', e.target.value)} placeholder="خصم ترحيبي 20%"
              style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>نوع الخصم</label>
              <select value={form.discount_type} onChange={e => set('discount_type', e.target.value)}
                style={inputStyle}>
                <option value="percentage">نسبة مئوية (%)</option>
                <option value="fixed">مبلغ ثابت (ر.س)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>القيمة *</label>
              <input type="number" value={form.discount_value} onChange={e => set('discount_value', e.target.value)}
                placeholder={form.discount_type === 'percentage' ? '20' : '100'}
                style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>يطبق على</label>
              <select value={form.applies_to} onChange={e => set('applies_to', e.target.value)}
                style={inputStyle}>
                <option value="all">الكل</option>
                <option value="monthly">شهري فقط</option>
                <option value="yearly">سنوي فقط</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>حد الاستخدام</label>
              <input type="number" value={form.max_uses} onChange={e => set('max_uses', e.target.value)} placeholder="∞"
                style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>صالح حتى</label>
            <input type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)}
              style={inputStyle} />
          </div>
        </div>
        {err && <p style={{ fontSize: 12, color: 'var(--lv-danger)', margin: '12px 0 0' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid var(--lv-line)', background: 'var(--lv-bg)', cursor: 'pointer', fontSize: 13, color: 'var(--lv-muted)' }}>إلغاء</button>
          <button onClick={submit} disabled={loading}
            style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'var(--lv-accent)', color: 'var(--lv-panel)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {loading ? '...' : 'إنشاء'}
          </button>
        </div>
      </div>
    </div>
  );
}
