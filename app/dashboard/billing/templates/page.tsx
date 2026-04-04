'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { request } from '@/lib/api';

type Template = { id: string; key: string; subject: string; body: string; updated_at: string };

const TEMPLATE_LABELS: Record<string, { label: string; desc: string }> = {
  welcome:               { label: 'رسالة ترحيب',           desc: 'تُرسل عند إنشاء حساب الشركة' },
  invoice_issued:        { label: 'فاتورة صادرة',          desc: 'تُرسل عند إصدار فاتورة جديدة' },
  invoice_reminder_3:    { label: 'تذكير دفع (3 أيام)',    desc: 'تُرسل قبل 3 أيام من تاريخ الاستحقاق' },
  invoice_reminder_7:    { label: 'تذكير دفع (7 أيام)',    desc: 'تُرسل بعد 7 أيام من التأخير' },
  invoice_reminder_15:   { label: 'إنذار نهائي (15 يوم)',   desc: 'تُرسل قبل الإيقاف بأيام' },
  invoice_paid:          { label: 'تأكيد الدفع',           desc: 'تُرسل عند تسجيل دفعة' },
  trial_expiring:        { label: 'انتهاء التجربة قريباً',   desc: 'تُرسل قبل 7 أيام من انتهاء التجربة' },
  trial_expired:         { label: 'انتهت التجربة',          desc: 'تُرسل عند انتهاء فترة التجربة' },
  account_suspended:     { label: 'إيقاف الحساب',           desc: 'تُرسل عند إيقاف شركة' },
  payment_receipt:       { label: 'إيصال دفع (مستأجر)',     desc: 'تُرسل للمستأجر عند تسجيل دفعة' },
  payment_reminder:      { label: 'تذكير دفع (مستأجر)',     desc: 'تُرسل للمستأجر قبل استحقاق الإيجار' },
  contract_activated:    { label: 'تفعيل عقد',              desc: 'تُرسل عند تفعيل عقد إيجار' },
  maintenance_update:    { label: 'تحديث صيانة',            desc: 'تُرسل عند تحديث حالة تذكرة صيانة' },
  renewal_reminder:      { label: 'تذكير تجديد',            desc: 'تُرسل قبل انتهاء عقد الإيجار' },
};

const VARIABLES = [
  '{{company_name}}', '{{to_name}}', '{{invoice_number}}', '{{total}}',
  '{{due_date}}', '{{plan_name}}', '{{days_left}}', '{{login_url}}',
  '{{payment_ref}}', '{{reason}}', '{{unit_name}}', '{{tenant_name}}',
];

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState<Template | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState('');

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    try {
      const res = await request<any>('GET', '/admin/billing/templates');
      setTemplates((res as any)?.data || []);
    } catch {}
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (t: Template) => {
    setEditing(t);
    setEditSubject(t.subject || '');
    setEditBody(t.body || '');
  };

  const saveTemplate = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await request('PUT', `/admin/billing/templates/${editing.key}`, { subject: editSubject, body: editBody });
      showToast('تم حفظ القالب ✓');
      setEditing(null);
      load();
    } catch (e: any) { showToast(e.message || 'خطأ'); }
    setSaving(false);
  };

  const insertVar = (v: string) => setEditBody(b => b + ' ' + v);

  const C = { bg: '#05081a', card: '#0c1535', border: 'rgba(255,255,255,.07)', text: '#e2e8f0', text2: '#94a3b8', accent: '#2563eb' };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Tajawal', sans-serif", direction: 'rtl' }}>
      {toast && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#059669', color: '#fff', padding: '10px 28px', borderRadius: 10, fontSize: 13, zIndex: 9999, fontWeight: 700 }}>{toast}</div>}

      <nav style={{ background: 'rgba(5,8,26,.95)', borderBottom: `1px solid ${C.border}`, padding: '12px 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/dashboard" style={{ fontWeight: 800, fontSize: 15, color: '#fff', textDecoration: 'none' }}>LIVENTRA OS</Link>
          <Link href="/dashboard/billing" style={{ fontSize: 13, color: C.text2, textDecoration: 'none' }}>← الفوترة</Link>
          <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>مركز القوالب</span>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>مركز القوالب 📨</h1>
        <p style={{ color: C.text2, fontSize: 14, marginBottom: 32 }}>خصّص قوالب البريد الإلكتروني للفواتير والإشعارات</p>

        {loading ? (
          <p style={{ color: C.text2, textAlign: 'center', padding: 60 }}>جاري التحميل...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {Object.entries(TEMPLATE_LABELS).map(([key, info]) => {
              const t = templates.find(t => t.key === key);
              return (
                <div key={key} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px', cursor: 'pointer', transition: 'border-color .2s' }}
                  onClick={() => t && startEdit(t)}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{info.label}</h3>
                    <span style={{ fontSize: 10, color: t ? '#059669' : '#f59e0b', fontWeight: 700 }}>{t ? 'مخصص' : 'افتراضي'}</span>
                  </div>
                  <p style={{ fontSize: 11, color: C.text2, margin: 0, lineHeight: 1.6 }}>{info.desc}</p>
                  {t && <p style={{ fontSize: 10, color: C.text2, margin: '8px 0 0', opacity: .6 }}>آخر تعديل: {new Date(t.updated_at).toLocaleDateString('ar-SA')}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEditing(null)}>
          <div style={{ background: '#0c1535', border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: '32px 28px', width: '100%', maxWidth: 700, direction: 'rtl', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px' }}>
              {TEMPLATE_LABELS[editing.key]?.label || editing.key}
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 20px' }}>
              {TEMPLATE_LABELS[editing.key]?.desc}
            </p>

            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>عنوان البريد</label>
            <input value={editSubject} onChange={e => setEditSubject(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', marginBottom: 16 }} />

            <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>محتوى البريد (HTML)</label>
            <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={12}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none', resize: 'vertical', marginBottom: 12, direction: 'ltr', textAlign: 'left' }} />

            {/* Variable chips */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 6 }}>المتغيرات المتاحة (اضغط للإدراج)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {VARIABLES.map(v => (
                  <button key={v} onClick={() => insertVar(v)}
                    style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.2)', color: '#3b82f6', cursor: 'pointer', fontFamily: 'monospace' }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(null)} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>إلغاء</button>
              <button onClick={saveTemplate} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', opacity: saving ? .7 : 1 }}>
                {saving ? '...' : 'حفظ القالب ✓'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
