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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>أكواد الخصم</h2>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1d4070', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          + كود جديد
        </button>
      </div>

      {showCreate && <CreateCouponModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); showToast('تم إنشاء كود الخصم'); }} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>جاري التحميل...</div>
      ) : coupons.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          لا توجد أكواد خصم — أنشئ كودك الأول
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['الكود', 'الخصم', 'الاستخدام', 'صالح حتى', 'الحالة', 'إجراء'].map(h => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < coupons.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <td style={{ padding: '12px 18px' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1d4070', fontFamily: 'monospace', background: '#eff6ff', padding: '3px 8px', borderRadius: 6 }}>{c.code}</span>
                    {c.description_ar && <p style={{ fontSize: 10, color: '#64748b', margin: '4px 0 0' }}>{c.description_ar}</p>}
                  </td>
                  <td style={{ padding: '12px 18px', fontSize: 13, fontWeight: 600 }}>
                    {c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value} ر.س`}
                  </td>
                  <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>
                    {c.current_uses}/{c.max_uses || '∞'}
                  </td>
                  <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>
                    {c.valid_until ? fmtDate(c.valid_until) : 'غير محدد'}
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: c.is_active ? '#f0fdf4' : '#f8fafc', color: c.is_active ? '#15803d' : '#64748b', fontWeight: 600 }}>
                      {c.is_active ? 'نشط' : 'معطّل'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleToggle(c.id, c.is_active)}
                        style={{ fontSize: 10, padding: '5px 8px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer' }}>
                        {c.is_active ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button onClick={() => handleDelete(c.id, c.code)}
                        style={{ fontSize: 10, padding: '5px 8px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer' }}>
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: 400, direction: 'rtl' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 20px' }}>إنشاء كود خصم</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>الكود *</label>
            <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="WELCOME2026"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, direction: 'ltr', boxSizing: 'border-box', fontFamily: 'monospace' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>الوصف</label>
            <input value={form.description_ar} onChange={e => set('description_ar', e.target.value)} placeholder="خصم ترحيبي 20%"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, direction: 'rtl', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>نوع الخصم</label>
              <select value={form.discount_type} onChange={e => set('discount_type', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }}>
                <option value="percentage">نسبة مئوية (%)</option>
                <option value="fixed">مبلغ ثابت (ر.س)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>القيمة *</label>
              <input type="number" value={form.discount_value} onChange={e => set('discount_value', e.target.value)}
                placeholder={form.discount_type === 'percentage' ? '20' : '100'}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>يطبق على</label>
              <select value={form.applies_to} onChange={e => set('applies_to', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }}>
                <option value="all">الكل</option>
                <option value="monthly">شهري فقط</option>
                <option value="yearly">سنوي فقط</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>حد الاستخدام</label>
              <input type="number" value={form.max_uses} onChange={e => set('max_uses', e.target.value)} placeholder="∞"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>صالح حتى</label>
            <input type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>
        {err && <p style={{ fontSize: 12, color: '#dc2626', margin: '12px 0 0' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>إلغاء</button>
          <button onClick={submit} disabled={loading}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1d4070', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {loading ? '...' : 'إنشاء'}
          </button>
        </div>
      </div>
    </div>
  );
}
