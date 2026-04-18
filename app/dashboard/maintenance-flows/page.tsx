'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';

const FLOW_TYPE_AR: Record<string, string> = {
  emergency:  'طوارئ',
  standard:   'قياسي',
  preventive: 'وقائي',
  inspection: 'فحص',
};

const FLOW_TYPE_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  emergency:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  standard:   { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  preventive: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  inspection: { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe' },
};

const STEPS_AR: Record<string, string> = {
  open:          'مفتوح',
  assigned:      'مُعيَّن',
  in_progress:   'قيد التنفيذ',
  pending_parts: 'انتظار قطع',
  pending:       'بانتظار الموافقة',
  resolved:      'محلول',
  closed:        'مغلق',
};

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: value ? '#7c5cfc' : '#e2e8f0', padding: 0, position: 'relative', transition: 'background .2s', opacity: disabled ? 0.5 : 1,
      }}>
      <span style={{
        position: 'absolute', top: 3, left: value ? 21 : 3, width: 16, height: 16,
        borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </button>
  );
}

export default function MaintenanceFlowsPage() {
  const [flows, setFlows]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null); // flow id being saved
  const [error, setError]       = useState('');
  const [toast, setToast]       = useState('');

  useEffect(() => { loadFlows(); }, []);

  async function loadFlows() {
    setLoading(true);
    try {
      const res = await adminApi.maintenanceFlows.list();
      setFlows(res.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function updateField(id: string, field: string, value: boolean) {
    setSaving(id);
    try {
      const res = await adminApi.maintenanceFlows.update(id, { [field]: value });
      setFlows(prev => prev.map(f => f.id === id ? { ...f, ...(res.data || { [field]: value }) } : f));
      showToast('تم الحفظ');
    } catch (e: any) { showToast(e.message); }
    finally { setSaving(null); }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 24, height: 24, border: '3px solid #e2e8f0', borderTopColor: '#7c5cfc', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ padding: 32, color: '#dc2626' }}>خطأ في التحميل: {error}</div>
  );

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960, direction: 'rtl' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#1e293b' }}>إعدادات مسارات الصيانة</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
          كل مسار يحدد سير العمل لنوع طلب صيانة معين — يمكن تعديل الموافقة والتنفيذ التلقائي والتفعيل.
        </p>
      </div>

      {/* Flow cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
        {flows.map(flow => {
          const tc = FLOW_TYPE_COLOR[flow.type] || { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
          const steps: string[] = Array.isArray(flow.steps) ? flow.steps : (typeof flow.steps === 'string' ? JSON.parse(flow.steps) : []);
          const isSaving = saving === flow.id;

          return (
            <div key={flow.id} style={{ background: 'white', border: '1px solid #e8e6f0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
              {/* Card header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f0f8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                      {FLOW_TYPE_AR[flow.type] || flow.type}
                    </span>
                    {flow.is_default && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                        افتراضي محمي
                      </span>
                    )}
                    {!flow.is_active && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                        معطل
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#1e293b' }}>{flow.name}</h3>
                </div>
                {isSaving && (
                  <div style={{ width: 16, height: 16, border: '2px solid #e2e8f0', borderTopColor: '#7c5cfc', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                )}
              </div>

              {/* Toggles */}
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#374151' }}>يتطلب موافقة</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>يُوقف التذكرة حتى يوافق المالك على التكلفة</p>
                  </div>
                  <Toggle value={flow.requires_approval} onChange={v => updateField(flow.id, 'requires_approval', v)} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#374151' }}>تنفيذ تلقائي</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>ينتقل مباشرة إلى "قيد التنفيذ" عند الإنشاء</p>
                  </div>
                  <Toggle value={flow.auto_execute} onChange={v => updateField(flow.id, 'auto_execute', v)} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#374151' }}>مفعّل</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>المسار متاح للاستخدام</p>
                  </div>
                  <Toggle value={flow.is_active} onChange={v => updateField(flow.id, 'is_active', v)} />
                </div>
              </div>

              {/* Steps */}
              {steps.length > 0 && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f0f8', background: '#faf9fe' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#7c5cfc', marginBottom: 8 }}>خطوات المسار</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {steps.map((step, i) => (
                      <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'white', color: '#374151', border: '1px solid #e2e8f0', fontWeight: 500 }}>
                          {STEPS_AR[step] || step}
                        </span>
                        {i < steps.length - 1 && <span style={{ fontSize: 10, color: '#c4b5fd' }}>←</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: 'white', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,.25)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
