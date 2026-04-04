'use client';
import { useState } from 'react';
import { request } from '@/lib/api';
import { useBilling } from '../layout';
import { GW_LABELS } from '@/lib/billing-helpers';

const CONFIG_FIELDS: Record<string, { label: string; key: string; placeholder: string }[]> = {
  stripe:  [{ label: 'Secret Key', key: 'secret_key', placeholder: 'sk_...' }, { label: 'Webhook Secret', key: 'webhook_secret', placeholder: 'whsec_...' }],
  payfort: [{ label: 'Merchant ID', key: 'merchant_id', placeholder: 'TESTMERCHANT' }, { label: 'Access Code', key: 'access_code', placeholder: '' }, { label: 'SHA Request Phrase', key: 'sha_request', placeholder: '' }],
  telr:    [{ label: 'Store ID', key: 'store_id', placeholder: '12345' }, { label: 'Auth Key', key: 'auth_key', placeholder: '' }],
  tap:     [{ label: 'Secret Key', key: 'secret_key', placeholder: 'sk_test_...' }, { label: 'Publishable Key', key: 'public_key', placeholder: 'pk_test_...' }, { label: 'Webhook Secret', key: 'webhook_secret', placeholder: '' }],
};

function GatewayCard({ gateway, onSaved }: { gateway: any; onSaved: () => void }) {
  const { showToast } = useBilling();
  const [expanded, setExpanded] = useState(false);
  const [active, setActive]     = useState(gateway.is_active || false);
  const [sandbox, setSandbox]   = useState(!gateway.is_live);
  const [keys, setKeys]         = useState<Record<string, string>>(gateway.config || {});
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const setKey = (k: string, v: string) => setKeys(prev => ({ ...prev, [k]: v }));

  const fields = CONFIG_FIELDS[gateway.provider] || [];

  const handleSave = async () => {
    setSaving(true);
    try {
      await request('PUT', `/admin/billing/gateways/${gateway.provider}`, {
        is_active: active, is_live: !sandbox,
        ...keys,
      });
      showToast('تم حفظ الإعدادات');
      onSaved();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await request<any>('POST', `/admin/billing/gateways/${gateway.provider}/test`, {});
      const result = res?.data;
      showToast(result?.ok ? `الاتصال ناجح (${result.mode})` : `فشل الاتصال: ${result?.error || 'خطأ'}`);
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setTesting(false);
  };

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${active ? '#bbf7d0' : '#e2e8f0'}`, padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            {gateway.provider === 'stripe' ? '💳' : gateway.provider === 'payfort' ? '🏦' : gateway.provider === 'telr' ? '🔷' : '🟢'}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{GW_LABELS[gateway.provider] || gateway.provider}</p>
            <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>{gateway.provider}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: active ? '#f0fdf4' : '#f8fafc', color: active ? '#15803d' : '#64748b', fontWeight: 600, border: `1px solid ${active ? '#bbf7d0' : '#e2e8f0'}` }}>
            {active ? 'مفعّل' : 'معطّل'}
          </span>
          <button onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94a3b8' }}>
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              تفعيل البوابة
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={sandbox} onChange={e => setSandbox(e.target.checked)} />
              وضع الاختبار (Sandbox)
            </label>
          </div>
          {fields.map(f => (
            <div key={f.key} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, color: '#64748b' }}>{f.label}</label>
              <input value={keys[f.key] || ''} onChange={e => setKey(f.key, e.target.value)} placeholder={f.placeholder}
                type="password"
                style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#1d4070', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
            <button onClick={handleTest} disabled={testing || !active}
              style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              {testing ? '...' : 'اختبار'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function GatewaysPage() {
  const { gateways, loading, reload } = useBilling();

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>جاري التحميل...</div>;

  const defaultGateways = [
    { provider: 'tap',     is_active: false, is_live: false, config: {} },
    { provider: 'stripe',  is_active: false, is_live: false, config: {} },
    { provider: 'payfort', is_active: false, is_live: false, config: {} },
    { provider: 'telr',    is_active: false, is_live: false, config: {} },
  ];

  const displayGateways = gateways.length > 0 ? gateways : defaultGateways;

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>بوابات الدفع</h2>

      <div style={{ background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe', padding: '14px 18px', fontSize: 12, color: '#1d4070', lineHeight: 1.6, marginBottom: 20 }}>
        Tap Payments هي البوابة الرئيسية للسوق السعو��ي. أدخل مفاتيح API وفعّل البوابة لبدء استقبال المدفوعات.
        <br />Webhook URL: <code style={{ fontSize: 11, background: '#dbeafe', padding: '1px 5px', borderRadius: 4 }}>/api/v1/billing/webhook/tap</code>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(380px,1fr))', gap: 16 }}>
        {displayGateways.map((gw: any) => (
          <GatewayCard key={gw.provider} gateway={gw} onSaved={reload} />
        ))}
      </div>
    </div>
  );
}
