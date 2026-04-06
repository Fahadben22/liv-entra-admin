'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { request } from '@/lib/api';

// --- Types ---
type Channel = 'email' | 'whatsapp' | 'in_app';

interface TemplateVar {
  key: string;
  label_ar: string;
  example: string;
}

interface Template {
  id: string;
  key: string;
  name_ar: string;
  channel: Channel;
  subject?: string;
  html_body?: string;
  text_body?: string;
  variables: TemplateVar[];
  is_active: boolean;
  description?: string;
  updated_at: string;
  updated_by?: string;
}

// --- API helpers ---
const api = {
  list:   ()                       => request<Template[]>('GET',  '/admin/templates'),
  get:    (key: string)            => request<Template>('GET',    `/admin/templates/${key}`),
  save:   (key: string, body: any) => request<Template>('PUT',    `/admin/templates/${key}`, body),
  test:   (key: string, body: any) => request<any>('POST',        `/admin/templates/${key}/test`, body),
  smtp:   (body: any)              => request<any>('POST',        '/admin/templates/smtp-test', body),
};

const CHANNEL_LABELS: Record<Channel, string> = {
  email:    'بريد إلكتروني',
  whatsapp: 'واتساب',
  in_app:   'إشعار داخلي',
};
const CHANNEL_ICONS: Record<Channel, string> = { email: '📧', whatsapp: '💬', in_app: '🔔' };
const CHANNEL_COLORS: Record<Channel, { bg: string; border: string; text: string }> = {
  email:    { bg: '#eff6ff', border: '#bfdbfe', text: '#3b82f6' },
  whatsapp: { bg: '#f0fdf4', border: '#bbf7d0', text: '#22c55e' },
  in_app:   { bg: '#faf5ff', border: '#e9d5ff', text: '#8b5cf6' },
};

// Render {{var}} in a string with sample values
function preview(tpl: string, vars: TemplateVar[]): string {
  let out = tpl;
  vars.forEach(v => { out = out.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), `<mark style="background:#fef9c3;padding:0 2px;border-radius:3px">${v.example}</mark>`); });
  return out;
}

// --- Main page ---
export default function TemplateCenterPage() {
  const [templates, setTemplates]       = useState<Template[]>([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState<Channel>('email');
  const [editing, setEditing]           = useState<Template | null>(null);
  const [smtpModal, setSmtpModal]       = useState(false);

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const res: any = await api.list();
      setTemplates(res?.data || []);
    } finally { setLoading(false); }
  }

  const byChannel = (ch: Channel) => templates.filter(t => t.channel === ch);
  const counts = { email: byChannel('email').length, whatsapp: byChannel('whatsapp').length, in_app: byChannel('in_app').length };

  return (
    <div style={{ background: '#fafafa' }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e5e5e5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/dashboard" style={{ color: '#71717a', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#18181b', letterSpacing: '-0.02em' }}>مركز القوالب</div>
            <div style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 500 }}>إدارة قوالب البريد والإشعارات</div>
          </div>
        </div>
        <button onClick={() => setSmtpModal(true)}
          style={{ background: '#fff', border: '1px solid #e5e5e5', color: '#18181b', padding: '7px 16px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
          اختبار SMTP
        </button>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e5e5', padding: '0 28px', display: 'flex', gap: 0 }}>
        {(['email', 'whatsapp', 'in_app'] as Channel[]).map(ch => {
          const c = CHANNEL_COLORS[ch];
          const active = tab === ch;
          return (
            <button key={ch} onClick={() => setTab(ch)}
              style={{ padding: '14px 22px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#18181b' : '#71717a', borderBottom: active ? '2px solid #18181b' : '2px solid transparent', display: 'flex', alignItems: 'center', gap: 6 }}>
              {CHANNEL_ICONS[ch]} {CHANNEL_LABELS[ch]}
              <span style={{ background: active ? '#fafafa' : '#fafafa', border: '1px solid #e5e5e5', color: active ? '#18181b' : '#a1a1aa', fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 500 }}>
                {counts[ch]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#a1a1aa' }}>جاري التحميل...</div>
        ) : byChannel(tab).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#a1a1aa' }}>لا توجد قوالب</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {byChannel(tab).map(t => (
              <TemplateCard key={t.key} template={t} onEdit={() => setEditing(t)}
                onToggle={async () => {
                  await api.save(t.key, { is_active: !t.is_active });
                  loadTemplates();
                }} />
            ))}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {editing && (
        <EditorModal
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadTemplates(); }}
        />
      )}

      {/* SMTP Test Modal */}
      {smtpModal && <SmtpModal onClose={() => setSmtpModal(false)} />}
    </div>
  );
}

// --- Template Card ---
function TemplateCard({ template: t, onEdit, onToggle }: { template: Template; onEdit: () => void; onToggle: () => void }) {
  const c = CHANNEL_COLORS[t.channel];
  const updatedDate = t.updated_at ? new Date(t.updated_at).toLocaleDateString('ar-SA') : '—';

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, transition: 'all 0.15s', opacity: t.is_active ? 1 : 0.65 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>{CHANNEL_ICONS[t.channel]}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{t.name_ar}</span>
          </div>
          <code style={{ fontSize: 10, color: '#a1a1aa', background: '#fafafa', padding: '2px 7px', borderRadius: 5 }}>{t.key}</code>
        </div>
        {/* Active toggle */}
        <div onClick={onToggle} title={t.is_active ? 'تعطيل' : 'تفعيل'}
          style={{ width: 36, height: 20, borderRadius: 10, background: t.is_active ? '#22c55e' : '#e5e5e5', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: t.is_active ? 3 : 19, transition: 'left 0.2s', boxShadow: '0 1px 3px #0002' }} />
        </div>
      </div>

      {t.description && (
        <p style={{ fontSize: 11, color: '#71717a', margin: 0, lineHeight: 1.5 }}>{t.description}</p>
      )}

      {/* Variables chips */}
      {t.variables.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {t.variables.slice(0, 4).map(v => (
            <span key={v.key} style={{ fontSize: 10, background: c.bg, border: `1px solid ${c.border}`, color: c.text, padding: '2px 8px', borderRadius: 12 }}>
              {`{{${v.key}}}`}
            </span>
          ))}
          {t.variables.length > 4 && <span style={{ fontSize: 10, color: '#a1a1aa' }}>+{t.variables.length - 4}</span>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
        <span style={{ fontSize: 10, color: '#a1a1aa' }}>
          {t.updated_by ? `${t.updated_by} · ` : ''}{updatedDate}
        </span>
        <button onClick={onEdit}
          style={{ padding: '6px 14px', background: '#18181b', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          تعديل
        </button>
      </div>
    </div>
  );
}

// --- Editor Modal ---
function EditorModal({ template, onClose, onSaved }: { template: Template; onClose: () => void; onSaved: () => void }) {
  const [subject,  setSubject]  = useState(template.subject  || '');
  const [htmlBody, setHtmlBody] = useState(template.html_body || '');
  const [textBody, setTextBody] = useState(template.text_body || '');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');
  const [previewMode, setPreview] = useState(false);

  // Test send state
  const [testEmail, setTestEmail]   = useState('');
  const [testMsg,   setTestMsg]     = useState('');
  const [testing,   setTesting]     = useState(false);

  const bodyRef   = useRef<HTMLTextAreaElement>(null);
  const isEmail   = template.channel === 'email';
  const isWA      = template.channel === 'whatsapp';
  const c         = CHANNEL_COLORS[template.channel];

  function insertVar(key: string) {
    const tag = `{{${key}}}`;
    const el  = bodyRef.current;
    if (!el) { isEmail ? setHtmlBody(p => p + tag) : setTextBody(p => p + tag); return; }
    const start = el.selectionStart ?? 0;
    const end   = el.selectionEnd ?? 0;
    const val   = el.value;
    const next  = val.slice(0, start) + tag + val.slice(end);
    isEmail ? setHtmlBody(next) : setTextBody(next);
    // Restore cursor
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + tag.length; el.focus(); }, 0);
  }

  async function handleSave() {
    setSaving(true); setErr('');
    try {
      await api.save(template.key, { subject, html_body: htmlBody, text_body: textBody });
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleTest() {
    if (!testEmail) { setTestMsg('أدخل بريدًا إلكترونيًا أولاً'); return; }
    setTesting(true); setTestMsg('');
    try {
      const res: any = await api.test(template.key, { to_email: testEmail });
      setTestMsg(res?.message || (res?.data?.sent ? 'تم الإرسال' : 'فشل الإرسال'));
    } catch (e: any) { setTestMsg(`${e.message}`); }
    finally { setTesting(false); }
  }

  const previewHtml  = preview(htmlBody,  template.variables);
  const previewText  = preview(textBody,  template.variables);
  const previewSubj  = preview(subject,   template.variables);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0008', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 960, boxShadow: '0 8px 30px #0001', marginTop: 20, border: '1px solid #e5e5e5' }}>

        {/* Modal header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>{CHANNEL_ICONS[template.channel]}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{template.name_ar}</div>
              <code style={{ fontSize: 10, color: '#a1a1aa' }}>{template.key}</code>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPreview(p => !p)}
              style={{ padding: '7px 14px', background: previewMode ? '#18181b' : '#fafafa', color: previewMode ? '#fff' : '#71717a', border: '1px solid #e5e5e5', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
              {previewMode ? 'تعديل' : 'معاينة'}
            </button>
            <button onClick={onClose}
              style={{ padding: '7px 14px', background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#71717a' }}>
              إغلاق
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 0 }}>
          {/* Left: Editor */}
          <div style={{ padding: 24, borderLeft: '1px solid #e5e5e5' }}>
            {err && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#dc2626' }}>{err}</div>}

            {/* Subject (email only) */}
            {isEmail && !previewMode && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: 5 }}>سطر الموضوع</label>
                <input value={subject} onChange={e => setSubject(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e5e5', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                {subject && <div style={{ marginTop: 5, fontSize: 11, color: '#71717a' }}>معاينة: <span dangerouslySetInnerHTML={{ __html: previewSubj }} /></div>}
              </div>
            )}

            {/* Body editor / preview */}
            {previewMode ? (
              <div>
                {isEmail && (
                  <div style={{ border: '1px solid #e5e5e5', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ background: '#fafafa', padding: '8px 14px', fontSize: 11, color: '#71717a', borderBottom: '1px solid #e5e5e5' }}>
                      الموضوع: <span dangerouslySetInnerHTML={{ __html: previewSubj }} />
                    </div>
                    <div style={{ padding: 16, maxHeight: 480, overflowY: 'auto' }}
                      dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                )}
                {isWA && (
                  <div style={{ background: '#dcf8c6', borderRadius: 12, padding: 16, fontFamily: 'sans-serif', fontSize: 13, lineHeight: 1.7, maxWidth: 360, boxShadow: '0 1px 3px #0001', whiteSpace: 'pre-wrap' }}
                    dangerouslySetInnerHTML={{ __html: previewText.replace(/\*(.*?)\*/g, '<strong>$1</strong>') }} />
                )}
              </div>
            ) : (
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: 5 }}>
                  {isEmail ? 'محتوى HTML' : 'نص الرسالة'}
                </label>
                <textarea
                  ref={bodyRef}
                  value={isEmail ? htmlBody : textBody}
                  onChange={e => isEmail ? setHtmlBody(e.target.value) : setTextBody(e.target.value)}
                  rows={isEmail ? 18 : 12}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e5e5', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: isEmail ? 'monospace' : 'inherit', lineHeight: 1.6, direction: 'ltr', background: '#fff' }}
                />
                {isWA && (
                  <div style={{ fontSize: 10, color: '#a1a1aa', marginTop: 4 }}>
                    {(textBody || '').length} حرف · *نص عريض* · _مائل_
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Variables + Test Send */}
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Variables */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', marginBottom: 10 }}>المتغيرات المتاحة</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {template.variables.map(v => (
                  <div key={v.key} onClick={() => insertVar(v.key)}
                    style={{ cursor: 'pointer', padding: '8px 10px', border: '1px solid #e5e5e5', borderRadius: 8, background: '#fafafa', transition: 'all 0.1s' }}
                    title={`مثال: ${v.example}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <code style={{ fontSize: 11, color: '#18181b', fontWeight: 600 }}>{`{{${v.key}}}`}</code>
                      <span style={{ fontSize: 9, color: '#a1a1aa' }}>انقر للإدراج</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#71717a', marginTop: 2 }}>{v.label_ar}</div>
                    <div style={{ fontSize: 10, color: '#a1a1aa', fontFamily: 'monospace', marginTop: 1 }}>{v.example}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test send (email only) */}
            {isEmail && (
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', marginBottom: 10 }}>إرسال تجريبي</div>
                <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                  placeholder="test@example.com" dir="ltr"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e5e5', borderRadius: 7, fontSize: 12, outline: 'none', marginBottom: 8, boxSizing: 'border-box', background: '#fff' }} />
                <button onClick={handleTest} disabled={testing}
                  style={{ width: '100%', padding: '9px', background: testing ? '#a1a1aa' : '#18181b', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, cursor: testing ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                  {testing ? 'جاري الإرسال...' : 'إرسال تجريبي'}
                </button>
                {testMsg && <div style={{ marginTop: 8, fontSize: 11, color: testMsg.includes('تم') ? '#16a34a' : '#dc2626' }}>{testMsg}</div>}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose}
            style={{ padding: '10px 20px', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 7, fontSize: 13, cursor: 'pointer', color: '#71717a' }}>
            إلغاء
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '10px 24px', background: saving ? '#a1a1aa' : '#18181b', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'جاري الحفظ...' : 'حفظ القالب'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- SMTP Test Modal ---
function SmtpModal({ onClose }: { onClose: () => void }) {
  const [email,  setEmail]  = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function test() {
    if (!email) return;
    setLoading(true); setResult(null);
    try {
      const res: any = await api.smtp({ to_email: email });
      setResult({ ok: true, msg: res?.message || 'نجح الاتصال', host: res?.data?.smtp_host });
    } catch (e: any) {
      setResult({ ok: false, msg: e.message });
    } finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0008', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 32, width: 420, boxShadow: '0 8px 30px #0001', border: '1px solid #e5e5e5' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#18181b', margin: '0 0 6px' }}>اختبار اتصال SMTP</h3>
        <p style={{ fontSize: 12, color: '#a1a1aa', margin: '0 0 20px' }}>يرسل بريدًا تجريبيًا للتحقق من إعدادات GoDaddy SMTP</p>

        <div style={{ background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 11, fontFamily: 'monospace', color: '#3f3f46', direction: 'ltr' }}>
          <div>HOST: {process?.env?.NEXT_PUBLIC_SMTP_HOST || 'smtpout.secureserver.net'}</div>
          <div>PORT: 465 (SSL)</div>
        </div>

        <label style={{ fontSize: 11, fontWeight: 500, color: '#a1a1aa', display: 'block', marginBottom: 6 }}>إرسال بريد الاختبار إلى</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com" dir="ltr"
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e5e5', borderRadius: 7, fontSize: 13, outline: 'none', marginBottom: 14, boxSizing: 'border-box', background: '#fff' }} />

        {result && (
          <div style={{ background: result.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${result.ok ? '#bbf7d0' : '#fca5a5'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: result.ok ? '#16a34a' : '#dc2626' }}>
            {result.msg}
            {result.host && <div style={{ fontSize: 10, marginTop: 4, color: '#71717a' }}>Host: {result.host}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 7, fontSize: 13, cursor: 'pointer', color: '#71717a' }}>إغلاق</button>
          <button onClick={test} disabled={loading || !email}
            style={{ flex: 2, padding: '10px', background: loading ? '#a1a1aa' : '#18181b', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: loading || !email ? 'not-allowed' : 'pointer' }}>
            {loading ? 'جاري الاختبار...' : 'اختبار الآن'}
          </button>
        </div>
      </div>
    </div>
  );
}
