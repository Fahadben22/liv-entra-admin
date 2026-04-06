'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

interface WaSetup {
  wa_phone_number_id: string;
  wa_access_token: string;
  wa_webhook_secret: string;
  wa_display_name: string;
  wa_setup_complete: boolean;
  wa_verified: boolean;
}

const WEBHOOK_URL = 'https://liv-entra-api-production.up.railway.app/api/v1/whatsapp/webhook';
const VERIFY_TOKEN = 'liventra-wb-verify-2026';

export default function WhatsAppSettingsPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [form, setForm] = useState<WaSetup>({
    wa_phone_number_id: '',
    wa_access_token: '',
    wa_webhook_secret: '',
    wa_display_name: '',
    wa_setup_complete: false,
    wa_verified: false,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    adminApi.sa.listCompanies().then((res: any) => {
      const list = res?.data || res || [];
      setCompanies(list);
      if (list.length > 0) setSelectedCompany(list[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedCompany) return;
    const c = companies.find((co: any) => co.id === selectedCompany);
    if (c) {
      setForm({
        wa_phone_number_id: c.wa_phone_number_id || '',
        wa_access_token: c.wa_access_token || '',
        wa_webhook_secret: c.wa_webhook_secret || '',
        wa_display_name: c.wa_display_name || '',
        wa_setup_complete: c.wa_setup_complete || false,
        wa_verified: c.wa_verified || false,
      });
      setTestResult(null);
      setSaved(false);
    }
  }, [selectedCompany, companies]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await adminApi.wa.setup({ company_id: selectedCompany, ...form });
      setSaved(true);
    } catch { /* swallow */ } finally { setSaving(false); }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res: any = await adminApi.wa.testSetup(selectedCompany);
      setTestResult({ ok: true, msg: `الاتصال ناجح! ${res?.phoneInfo?.display_phone_number || ''}` });
    } catch (err: any) {
      setTestResult({ ok: false, msg: `فشل: ${err.message}` });
    } finally { setTesting(false); }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #e5e5e5', borderRadius: 7, padding: '8px 12px', fontSize: 13, boxSizing: 'border-box', color: '#18181b' };

  return (
    <div style={{ background: '#fafafa' }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #e5e5e5' }}>
        <Link href="/dashboard" style={{ color: '#71717a', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#18181b' }}>إعدادات واتساب</div>
          <div style={{ fontSize: 11, color: '#a1a1aa' }}>تكوين بيانات اعتماد واتساب لكل شركة</div>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 12 }}>
          <Link href="/dashboard/conversations" style={{ color: '#71717a', textDecoration: 'none', fontSize: 12 }}>المحادثات</Link>
          <Link href="/dashboard/whatsapp/queue" style={{ color: '#71717a', textDecoration: 'none', fontSize: 12 }}>قائمة الإرسال</Link>
          <Link href="/dashboard/whatsapp/analytics" style={{ color: '#71717a', textDecoration: 'none', fontSize: 12 }}>التحليلات</Link>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        {/* Company selector */}
        <div style={{ background: '#fff', borderRadius: 8, padding: '16px 20px', marginBottom: 20, border: '1px solid #e5e5e5' }}>
          <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 6, fontWeight: 500 }}>اختر الشركة</label>
          <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}
            style={{ ...inputStyle, fontSize: 13 }}>
            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Status card */}
        <div style={{ background: '#fff', borderRadius: 8, padding: '16px 20px', marginBottom: 20, border: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: form.wa_setup_complete ? '#16a34a' : '#dc2626' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#18181b' }}>
              {form.wa_setup_complete ? 'واتساب مُتصل' : 'واتساب غير مُكوَّن'}
            </div>
            <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
              {form.wa_verified ? 'تم التحقق من الرقم' : 'لم يتم التحقق بعد'}
              {form.wa_display_name && ` · ${form.wa_display_name}`}
            </div>
          </div>
        </div>

        {/* Setup form */}
        <div style={{ background: '#fff', borderRadius: 8, padding: '20px 24px', marginBottom: 20, border: '1px solid #e5e5e5' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', marginBottom: 16 }}>بيانات اعتماد Meta Business</div>

          {[
            { key: 'wa_phone_number_id', label: 'Phone Number ID', placeholder: 'مثال: 123456789012345', secret: false },
            { key: 'wa_access_token', label: 'Access Token (System User)', placeholder: 'EAAxxxx...', secret: true },
            { key: 'wa_webhook_secret', label: 'App Secret (Webhook Signature)', placeholder: 'لتحقق صحة الطلبات الواردة', secret: true },
            { key: 'wa_display_name', label: 'اسم العرض', placeholder: 'مثال: شركة ليفنترا', secret: false },
          ].map(field => (
            <div key={field.key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4, fontWeight: 500 }}>{field.label}</label>
              <input
                type={field.secret ? 'password' : 'text'}
                value={(form as any)[field.key]}
                onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                style={inputStyle}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={save} disabled={saving}
              style={{ background: '#18181b', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 22px', fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, fontWeight: 600 }}>
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
            <button onClick={testConnection} disabled={testing || !form.wa_phone_number_id}
              style={{ background: '#fafafa', color: '#18181b', border: '1px solid #e5e5e5', borderRadius: 7, padding: '9px 22px', fontSize: 13, cursor: testing ? 'default' : 'pointer', opacity: testing || !form.wa_phone_number_id ? 0.6 : 1 }}>
              {testing ? 'جاري الاختبار...' : 'اختبار الاتصال'}
            </button>
          </div>

          {saved && <div style={{ marginTop: 10, fontSize: 13, color: '#16a34a' }}>تم الحفظ بنجاح</div>}
          {testResult && (
            <div style={{ marginTop: 10, fontSize: 13, color: testResult.ok ? '#16a34a' : '#dc2626', background: '#fafafa', padding: '8px 12px', borderRadius: 7, border: '1px solid #e5e5e5' }}>
              {testResult.msg}
            </div>
          )}
        </div>

        {/* Webhook URL */}
        <div style={{ background: '#fff', borderRadius: 8, padding: '20px 24px', border: '1px solid #e5e5e5' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', marginBottom: 16 }}>إعدادات Webhook في Meta Business Manager</div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4, fontWeight: 500 }}>Webhook URL</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={WEBHOOK_URL} readOnly
                style={{ flex: 1, border: '1px solid #e5e5e5', borderRadius: 7, padding: '8px 12px', fontSize: 12, background: '#fafafa', color: '#71717a', fontFamily: 'monospace' }} />
              <button onClick={() => copy(WEBHOOK_URL, 'url')}
                style={{ background: copied === 'url' ? '#fafafa' : '#fff', border: '1px solid #e5e5e5', borderRadius: 7, padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: copied === 'url' ? '#16a34a' : '#71717a' }}>
                {copied === 'url' ? 'نُسخ' : 'نسخ'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4, fontWeight: 500 }}>Verify Token</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={VERIFY_TOKEN} readOnly
                style={{ flex: 1, border: '1px solid #e5e5e5', borderRadius: 7, padding: '8px 12px', fontSize: 12, background: '#fafafa', color: '#71717a', fontFamily: 'monospace' }} />
              <button onClick={() => copy(VERIFY_TOKEN, 'token')}
                style={{ background: copied === 'token' ? '#fafafa' : '#fff', border: '1px solid #e5e5e5', borderRadius: 7, padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: copied === 'token' ? '#16a34a' : '#71717a' }}>
                {copied === 'token' ? 'نُسخ' : 'نسخ'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 14, background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: 7, padding: '10px 14px', fontSize: 12, color: '#71717a' }}>
            <strong>بانتظار موافقة Meta:</strong> بعد الحصول على موافقة Meta Business، أضف WHATSAPP_PHONE_NUMBER_ID وWHATSAPP_ACCESS_TOKEN وWHATSAPP_APP_SECRET في Railway، ثم سجّل الـ Webhook URL أعلاه في Meta Business Manager.
          </div>
        </div>
      </div>
    </div>
  );
}
