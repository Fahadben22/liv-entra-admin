'use client';
import { useState } from 'react';
import { request } from '@/lib/api';
import { useBilling } from '../layout';
import { GW_LABELS } from '@/lib/billing-helpers';

const CONFIG_FIELDS: Record<string, { label: string; key: string; placeholder: string }[]> = {
  stripe:  [{ label: 'Secret Key', key: 'secret_key', placeholder: 'sk_...' }, { label: 'Webhook Secret', key: 'webhook_secret', placeholder: 'whsec_...' }],
  tap:     [{ label: 'Secret Key', key: 'secret_key', placeholder: 'sk_test_...' }, { label: 'Publishable Key', key: 'public_key', placeholder: 'pk_test_...' }, { label: 'Webhook Secret', key: 'webhook_secret', placeholder: '' }],
  moyasar: [{ label: 'Secret Key', key: 'secret_key', placeholder: 'sk_test_...' }, { label: 'Publishable Key', key: 'public_key', placeholder: 'pk_test_...' }, { label: 'Webhook Secret', key: 'webhook_secret', placeholder: 'shared_secret' }],
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
    <div className="card" style={{ background: 'var(--lv-panel)', borderRadius: 14, boxShadow: 'var(--lv-shadow-sm)', padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 7, background: 'var(--lv-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, border: '1px solid var(--lv-line)', color: 'var(--lv-muted)', fontWeight: 600 }}>
            {gateway.provider.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--lv-fg)' }}>{GW_LABELS[gateway.provider] || gateway.provider}</p>
            <p style={{ fontSize: 10, color: 'var(--lv-muted)', margin: '2px 0 0' }}>{gateway.provider}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, color: active ? '#16a34a' : 'var(--lv-muted)', fontWeight: 500 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#16a34a' : 'var(--lv-muted)', display: 'inline-block' }} />
            {active ? 'مفعّل' : 'معطّل'}
          </span>
          <button onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--lv-muted)' }}>
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--lv-fg)' }}>
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              تفعيل البوابة
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--lv-fg)' }}>
              <input type="checkbox" checked={sandbox} onChange={e => setSandbox(e.target.checked)} />
              وضع الاختبار (Sandbox)
            </label>
          </div>
          {fields.map(f => (
            <div key={f.key} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--lv-muted)' }}>{f.label}</label>
              <input value={keys[f.key] || ''} onChange={e => setKey(f.key, e.target.value)} placeholder={f.placeholder}
                type="password"
                style={{ width: '100%', padding: '7px 10px', borderRadius: 10, border: '1px solid var(--lv-line)', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box', background: 'var(--lv-bg)', color: 'var(--lv-fg)' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: 'var(--lv-accent)', color: 'var(--lv-panel)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
            <button onClick={handleTest} disabled={testing}
              style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--lv-line)', background: 'var(--lv-bg)', cursor: 'pointer', fontSize: 13, color: 'var(--lv-muted)' }}>
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

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--lv-muted)' }}>جاري التحميل...</div>;

  const defaultGateways = [
    { provider: 'tap',     is_active: false, is_live: false, config: {} },
    { provider: 'moyasar', is_active: false, is_live: false, config: {} },
    { provider: 'stripe',  is_active: false, is_live: false, config: {} },
  ];

  // Merge: show all default gateways, but use API data if available
  const displayGateways = defaultGateways.map(dg => {
    const fromApi = gateways.find((g: any) => g.provider === dg.provider);
    return fromApi || dg;
  });

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px', color: 'var(--lv-fg)' }}>بوابات الدفع</h2>

      <div className="card" style={{ background: 'var(--lv-panel)', borderRadius: 14, boxShadow: 'var(--lv-shadow-sm)', padding: '14px 18px', fontSize: 12, color: 'var(--lv-muted)', lineHeight: 1.6, marginBottom: 20 }}>
        فعّل بوابة دفع واحدة فقط في وقت واحد. أدخل مفاتيح API وفعّل البوابة لبدء استقبال المدفوعات.
        <br />Webhook URL: <code style={{ fontSize: 11, background: 'var(--lv-bg)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--lv-line)', color: 'var(--lv-muted)' }}>/api/v1/billing/webhook/{'{'}<span style={{ color: 'var(--lv-accent)' }}>provider</span>{'}'}</code>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(380px,1fr))', gap: 16 }}>
        {displayGateways.map((gw: any) => (
          <GatewayCard key={gw.provider} gateway={gw} onSaved={reload} />
        ))}
      </div>
    </div>
  );
}
