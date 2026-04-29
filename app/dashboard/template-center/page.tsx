'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Mail, MessageSquare, Bell, ChevronRight, RefreshCw, Send, Eye, Edit3, Zap, Clock, ToggleLeft, ToggleRight, X, CheckCircle, AlertCircle } from 'lucide-react';
import { request } from '@/lib/api';

type Channel = 'email' | 'whatsapp' | 'in_app';

interface Template {
  id: string;
  key: string;
  name_ar: string;
  channel: Channel;
  subject?: string;
  html_body?: string;
  text_body?: string;
  variables: { key: string; label_ar: string; example: string }[];
  is_active: boolean;
  description?: string;
  updated_at: string;
  updated_by?: string;
  trigger_event?: string;
  trigger_delay_hours?: number;
  is_automation_enabled?: boolean;
  send_count?: number;
  last_sent_at?: string;
}

const api = {
  list:   ()                       => request<any>('GET',  '/admin/templates'),
  get:    (key: string)            => request<any>('GET',  `/admin/templates/${key}`),
  save:   (key: string, body: any) => request<any>('PUT',  `/admin/templates/${key}`, body),
  test:   (key: string, body: any) => request<any>('POST', `/admin/templates/${key}/test`, body),
  smtp:   (body: any)              => request<any>('POST', '/admin/templates/smtp-test', body),
  seed:   ()                       => request<any>('POST', '/admin/templates/seed', {}),
};

const CH_LABEL: Record<Channel, string> = { email: 'البريد الإلكتروني', whatsapp: 'واتساب', in_app: 'إشعارات داخلية' };
const CH_ICON:  Record<Channel, any>    = { email: Mail, whatsapp: MessageSquare, in_app: Bell };
const CH_COLOR: Record<Channel, string> = { email: '#3b82f6', whatsapp: '#22c55e', in_app: '#8b5cf6' };

function renderVars(tpl: string, vars: Template['variables']): string {
  let out = tpl;
  vars.forEach(v => { out = out.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), v.example ?? `{{${v.key}}}`); });
  return out;
}

export default function TemplateCenterPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<Channel>('email');
  const [editing,   setEditing]   = useState<Template | null>(null);
  const [smtpModal, setSmtpModal] = useState(false);
  const [seeding,   setSeeding]   = useState(false);
  const [seedMsg,   setSeedMsg]   = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { const r: any = await api.list(); setTemplates(r?.data || []); }
    finally { setLoading(false); }
  }

  async function handleSeed() {
    setSeeding(true); setSeedMsg('');
    try {
      const r: any = await api.seed();
      setSeedMsg(r?.message || 'تم التهيئة');
      await load();
    } catch (e: any) { setSeedMsg(e.message); }
    finally { setSeeding(false); }
  }

  const byChannel = (ch: Channel) => templates.filter(t => t.channel === ch);
  const counts = { email: byChannel('email').length, whatsapp: byChannel('whatsapp').length, in_app: byChannel('in_app').length };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--lv-bg)' }}>
      {/* Header */}
      <div style={{ padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--lv-line)', background: 'var(--lv-panel)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/dashboard" style={{ color: 'var(--lv-muted)', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            الرئيسية <ChevronRight size={13} />
          </Link>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--lv-fg)' }}>مركز القوالب</div>
            <div style={{ fontSize: 11, color: 'var(--lv-muted)' }}>إدارة قوالب البريد الإلكتروني والإشعارات والتشغيل الآلي</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {seedMsg && <span style={{ fontSize: 11, color: seedMsg.includes('خطأ') || seedMsg.includes('فشل') ? '#dc2626' : '#16a34a', maxWidth: 260 }}>{seedMsg}</span>}
          <button onClick={handleSeed} disabled={seeding}
            title="تسجيل جميع القوالب في قاعدة البيانات"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: '1px solid var(--lv-line)', borderRadius: 10, fontSize: 12, cursor: seeding ? 'not-allowed' : 'pointer', color: 'var(--lv-muted)', opacity: seeding ? .6 : 1 }}>
            <RefreshCw size={13} style={{ animation: seeding ? 'spin 1s linear infinite' : 'none' }} />
            تهيئة القوالب
          </button>
          <button onClick={() => setSmtpModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: '1px solid var(--lv-line)', borderRadius: 10, fontSize: 12, cursor: 'pointer', color: 'var(--lv-muted)' }}>
            <Send size={13} />
            اختبار البريد
          </button>
        </div>
      </div>

      {/* Channel tabs */}
      <div style={{ borderBottom: '1px solid var(--lv-line)', padding: '0 28px', display: 'flex', gap: 0, background: 'var(--lv-panel)' }}>
        {(['email', 'whatsapp', 'in_app'] as Channel[]).map(ch => {
          const active = tab === ch;
          const Icon = CH_ICON[ch];
          return (
            <button key={ch} onClick={() => setTab(ch)}
              style={{ padding: '13px 22px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? CH_COLOR[ch] : 'var(--lv-muted)', borderBottom: `2px solid ${active ? CH_COLOR[ch] : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 7, transition: 'all .15s' }}>
              <Icon size={14} />
              {CH_LABEL[ch]}
              <span style={{ background: active ? `${CH_COLOR[ch]}18` : 'var(--lv-bg)', color: active ? CH_COLOR[ch] : 'var(--lv-muted)', fontSize: 10, padding: '1px 8px', borderRadius: 12, fontWeight: 600, border: `1px solid ${active ? `${CH_COLOR[ch]}30` : 'var(--lv-line)'}` }}>
                {counts[ch]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div style={{ padding: '24px 28px', maxWidth: 1280, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--lv-muted)' }}>جاري التحميل...</div>
        ) : byChannel(tab).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--lv-muted)' }}>
            <p style={{ fontSize: 14, margin: '0 0 12px' }}>لا توجد قوالب مسجّلة لهذه القناة</p>
            <button onClick={handleSeed} disabled={seeding} style={{ padding: '9px 20px', background: 'var(--lv-accent)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              تهيئة القوالب الافتراضية
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {byChannel(tab).map(t => (
              <TemplateCard key={t.key} template={t}
                onEdit={() => setEditing(t)}
                onToggle={async () => { await api.save(t.key, { is_active: !t.is_active }); load(); }}
                onToggleAuto={async () => { await api.save(t.key, { is_automation_enabled: !t.is_automation_enabled }); load(); }}
              />
            ))}
          </div>
        )}
      </div>

      {editing  && <EditorModal template={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {smtpModal && <SmtpModal onClose={() => setSmtpModal(false)} />}

      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────────
function TemplateCard({ template: t, onEdit, onToggle, onToggleAuto }: { template: Template; onEdit(): void; onToggle(): void; onToggleAuto(): void }) {
  const color = CH_COLOR[t.channel];
  const Icon  = CH_ICON[t.channel];
  const updatedDate = t.updated_at ? new Date(t.updated_at).toLocaleDateString('ar-SA') : '—';
  const hasAuto = Boolean(t.trigger_event);

  return (
    <div style={{ background: 'var(--lv-panel)', borderRadius: 14, border: '1px solid var(--lv-line)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 11, opacity: t.is_active ? 1 : .6, transition: 'all .15s' }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <Icon size={14} color={color} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name_ar}</span>
          </div>
          <code style={{ fontSize: 10, color: 'var(--lv-muted)', background: 'var(--lv-bg)', padding: '2px 7px', borderRadius: 5, display: 'inline-block' }}>{t.key}</code>
        </div>
        <Toggle active={t.is_active} onToggle={onToggle} />
      </div>

      {t.description && <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: 0, lineHeight: 1.5 }}>{t.description}</p>}

      {/* Variables */}
      {t.variables?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {t.variables.slice(0, 5).map(v => (
            <span key={v.key} style={{ fontSize: 10, background: `${color}12`, border: `1px solid ${color}28`, color, padding: '2px 8px', borderRadius: 12 }}>{`{{${v.key}}}`}</span>
          ))}
          {t.variables.length > 5 && <span style={{ fontSize: 10, color: 'var(--lv-muted)' }}>+{t.variables.length - 5}</span>}
        </div>
      )}

      {/* Automation badge */}
      {hasAuto && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.is_automation_enabled ? 'rgba(34,197,94,.07)' : 'var(--lv-bg)', border: `1px solid ${t.is_automation_enabled ? 'rgba(34,197,94,.2)' : 'var(--lv-line)'}`, borderRadius: 8, padding: '6px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={11} color={t.is_automation_enabled ? '#22c55e' : 'var(--lv-muted)'} />
            <span style={{ fontSize: 10, color: t.is_automation_enabled ? '#16a34a' : 'var(--lv-muted)', fontWeight: 500 }}>
              {t.trigger_event}{t.trigger_delay_hours ? ` · +${t.trigger_delay_hours}س` : ''}
            </span>
          </div>
          <Toggle active={Boolean(t.is_automation_enabled)} onToggle={onToggleAuto} size={28} />
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--lv-line)', paddingTop: 10, marginTop: 2 }}>
        <div>
          {t.send_count != null && t.send_count > 0 && (
            <span style={{ fontSize: 10, color: 'var(--lv-muted)' }}>{t.send_count.toLocaleString('ar-SA')} إرسال</span>
          )}
          {!t.send_count && <span style={{ fontSize: 10, color: 'var(--lv-muted)' }}>{t.updated_by ? `${t.updated_by.split('@')[0]} · ` : ''}{updatedDate}</span>}
        </div>
        <button onClick={onEdit} style={{ padding: '6px 14px', background: 'var(--lv-accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          تعديل
        </button>
      </div>
    </div>
  );
}

function Toggle({ active, onToggle, size = 36 }: { active: boolean; onToggle(): void; size?: number }) {
  const h = size * .55;
  const dotSize = h - 6;
  return (
    <div onClick={e => { e.stopPropagation(); onToggle(); }} title={active ? 'تعطيل' : 'تفعيل'}
      style={{ width: size, height: h, borderRadius: h, background: active ? '#22c55e' : '#d1d5db', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
      <div style={{ width: dotSize, height: dotSize, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: active ? 3 : size - dotSize - 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.15)' }} />
    </div>
  );
}

// ── Editor Modal ──────────────────────────────────────────────────────────────
function EditorModal({ template, onClose, onSaved }: { template: Template; onClose(): void; onSaved(): void }) {
  const [subject,        setSubject]        = useState(template.subject || '');
  const [htmlBody,       setHtmlBody]       = useState(template.html_body || '');
  const [textBody,       setTextBody]       = useState(template.text_body || '');
  const [saving,         setSaving]         = useState(false);
  const [err,            setErr]            = useState('');
  const [activeTab,      setActiveTab]      = useState<'editor'|'preview'|'automation'>('editor');
  const [testEmail,      setTestEmail]      = useState('');
  const [testMsg,        setTestMsg]        = useState<{ok:boolean;msg:string}|null>(null);
  const [testing,        setTesting]        = useState(false);
  const [triggerEvent,   setTriggerEvent]   = useState(template.trigger_event || '');
  const [delayHours,     setDelayHours]     = useState(template.trigger_delay_hours ?? 0);
  const [autoEnabled,    setAutoEnabled]    = useState(template.is_automation_enabled !== false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const isEmail = template.channel === 'email';
  const color   = CH_COLOR[template.channel];

  function insertVar(key: string) {
    const tag = `{{${key}}}`;
    const el  = bodyRef.current;
    if (!el) { isEmail ? setHtmlBody(p => p + tag) : setTextBody(p => p + tag); return; }
    const s = el.selectionStart ?? 0, e2 = el.selectionEnd ?? 0;
    const next = el.value.slice(0, s) + tag + el.value.slice(e2);
    isEmail ? setHtmlBody(next) : setTextBody(next);
    setTimeout(() => { el.selectionStart = el.selectionEnd = s + tag.length; el.focus(); }, 0);
  }

  async function handleSave() {
    setSaving(true); setErr('');
    try {
      await api.save(template.key, {
        subject, html_body: htmlBody, text_body: textBody,
        trigger_event: triggerEvent || null,
        trigger_delay_hours: delayHours,
        is_automation_enabled: autoEnabled,
      });
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  async function handleTest() {
    if (!testEmail) { setTestMsg({ ok: false, msg: 'أدخل بريدًا إلكترونيًا' }); return; }
    setTesting(true); setTestMsg(null);
    try {
      const r: any = await api.test(template.key, { to_email: testEmail });
      setTestMsg({ ok: r?.data?.sent !== false, msg: r?.message || 'تم الإرسال' });
    } catch (e: any) { setTestMsg({ ok: false, msg: e.message }); } finally { setTesting(false); }
  }

  const previewHtml = renderVars(htmlBody, template.variables);

  const TRIGGER_EVENTS = [
    { group: 'إدارة الحسابات', options: [
      { v: 'company.created', l: 'إنشاء شركة جديدة' }, { v: 'account.reactivated', l: 'إعادة تفعيل حساب' },
      { v: 'account.suspended', l: 'إيقاف حساب' }, { v: 'subscription.plan_changed', l: 'تغيير خطة اشتراك' },
      { v: 'feature.toggled', l: 'تفعيل/تعطيل ميزة' },
    ]},
    { group: 'الفوترة', options: [
      { v: 'invoice.issued', l: 'إصدار فاتورة' }, { v: 'invoice.paid', l: 'دفع فاتورة' },
      { v: 'invoice.due', l: 'استحقاق فاتورة' }, { v: 'invoice.overdue_7', l: 'فاتورة متأخرة 7 أيام' },
      { v: 'invoice.overdue_15', l: 'فاتورة متأخرة 15 يوم' }, { v: 'payment.failed', l: 'فشل عملية الدفع' },
      { v: 'payment.credit_note', l: 'إصدار إشعار دائن' },
    ]},
    { group: 'التجربة المجانية', options: [
      { v: 'trial.expiring', l: 'اقتراب انتهاء التجربة' }, { v: 'trial.expired', l: 'انتهاء التجربة' },
    ]},
    { group: 'الموظفون والملاك', options: [
      { v: 'staff.created', l: 'إضافة موظف جديد' }, { v: 'owner.created', l: 'إضافة مالك جديد' },
      { v: 'owner.access_requested', l: 'طلب وصول مالك' }, { v: 'auth.otp_requested', l: 'طلب رمز OTP' },
    ]},
    { group: 'المستأجرون والعقارات', options: [
      { v: 'tenant.created', l: 'إضافة مستأجر جديد' }, { v: 'property.created', l: 'إضافة عقار جديد' },
      { v: 'contract.activated', l: 'تفعيل عقد إيجار' }, { v: 'contract.expiring', l: 'اقتراب انتهاء عقد' },
      { v: 'contract.terminated', l: 'إنهاء عقد إيجار' },
    ]},
    { group: 'المدفوعات', options: [
      { v: 'payment.receipt', l: 'استلام دفعة إيجار' }, { v: 'payment.due', l: 'استحقاق دفعة إيجار' },
      { v: 'payment.received', l: 'تأكيد استلام دفعة (للمالك)' },
    ]},
    { group: 'الصيانة', options: [
      { v: 'ticket.created', l: 'رفع بلاغ صيانة' }, { v: 'ticket.status_changed', l: 'تغيير حالة البلاغ' },
    ]},
    { group: 'التقارير', options: [
      { v: 'report.monthly_owner', l: 'تقرير شهري للمالك' }, { v: 'report.monthly_tenant', l: 'كشف حساب شهري للمستأجر' },
    ]},
    { group: 'أخرى', options: [
      { v: 'announcement.sent', l: 'إرسال إعلان عام' }, { v: 'lead.demo_requested', l: 'طلب ديمو من الصفحة الرئيسية' },
      { v: 'security.alert', l: 'تنبيه أمني' }, { v: 'budget.created', l: 'إعداد ميزانية عقار' },
    ]},
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--lv-panel)', borderRadius: 16, width: '100%', maxWidth: 1080, boxShadow: '0 20px 60px rgba(0,0,0,.2)', marginTop: 10, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>

        {/* Modal header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--lv-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(() => { const Icon = CH_ICON[template.channel]; return <Icon size={16} color={color} />; })()}
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lv-fg)' }}>{template.name_ar}</div>
              <code style={{ fontSize: 10, color: 'var(--lv-muted)' }}>{template.key}</code>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {(['editor','preview','automation'] as const).map(t2 => {
              const labels: Record<string, string> = { editor: 'تعديل', preview: 'معاينة', automation: 'أتمتة' };
              const icons: Record<string, any>     = { editor: Edit3, preview: Eye, automation: Zap };
              const IconC = icons[t2];
              const act = activeTab === t2;
              return (
                <button key={t2} onClick={() => setActiveTab(t2)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', background: act ? `${color}14` : 'transparent', color: act ? color : 'var(--lv-muted)', border: `1px solid ${act ? `${color}30` : 'var(--lv-line)'}`, borderRadius: 9, fontSize: 12, cursor: 'pointer', fontWeight: act ? 600 : 400 }}>
                  <IconC size={12} />{labels[t2]}
                </button>
              );
            })}
            <button onClick={onClose} style={{ padding: '7px', background: 'transparent', border: '1px solid var(--lv-line)', borderRadius: 9, cursor: 'pointer', color: 'var(--lv-muted)', display: 'flex' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* Left: main content */}
          <div style={{ flex: 1, padding: 22, overflow: 'auto' }}>
            {err && <div style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#dc2626' }}>{err}</div>}

            {/* ── EDITOR ── */}
            {activeTab === 'editor' && (
              <>
                {isEmail && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--lv-muted)', display: 'block', marginBottom: 5 }}>سطر الموضوع</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--lv-line)', borderRadius: 9, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'var(--lv-bg)', color: 'var(--lv-fg)' }} />
                  </div>
                )}
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--lv-muted)', display: 'block', marginBottom: 5 }}>
                  {isEmail ? 'محتوى HTML (يدعم {{المتغيرات}})' : 'نص الرسالة'}
                </label>
                <textarea ref={bodyRef} value={isEmail ? htmlBody : textBody}
                  onChange={e => isEmail ? setHtmlBody(e.target.value) : setTextBody(e.target.value)}
                  rows={22}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--lv-line)', borderRadius: 9, fontSize: 12, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.6, direction: 'ltr', background: 'var(--lv-bg)', color: 'var(--lv-fg)' }}
                />
              </>
            )}

            {/* ── PREVIEW (iframe for full CSS rendering) ── */}
            {activeTab === 'preview' && (
              <div>
                {isEmail ? (
                  <div style={{ border: '1px solid var(--lv-line)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ background: 'var(--lv-bg)', padding: '8px 14px', fontSize: 11, color: 'var(--lv-muted)', borderBottom: '1px solid var(--lv-line)', direction: 'rtl' }}>
                      الموضوع: <strong style={{ color: 'var(--lv-fg)' }}>{renderVars(subject, template.variables)}</strong>
                    </div>
                    <iframe
                      srcDoc={previewHtml || '<p style="padding:20px;color:#64748b;font-family:sans-serif">لا يوجد محتوى للمعاينة</p>'}
                      style={{ width: '100%', height: 520, border: 'none', background: '#fff' }}
                      title="email-preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                ) : (
                  <div style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 14, padding: 20, fontFamily: 'sans-serif', fontSize: 13, lineHeight: 1.75, maxWidth: 360, color: 'var(--lv-fg)', whiteSpace: 'pre-wrap', direction: 'rtl' }}
                    dangerouslySetInnerHTML={{ __html: renderVars(textBody, template.variables).replace(/\*(.*?)\*/g, '<strong>$1</strong>') }} />
                )}
              </div>
            )}

            {/* ── AUTOMATION ── */}
            {activeTab === 'automation' && (
              <div style={{ maxWidth: 560 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '12px 16px', background: autoEnabled ? 'rgba(34,197,94,.07)' : 'var(--lv-bg)', border: `1px solid ${autoEnabled ? 'rgba(34,197,94,.2)' : 'var(--lv-line)'}`, borderRadius: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)' }}>تفعيل التشغيل الآلي</div>
                    <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginTop: 2 }}>
                      {autoEnabled ? 'هذا القالب يُرسل تلقائياً عند وقوع الحدث المحدد' : 'التشغيل الآلي معطّل — يمكن الإرسال يدوياً فقط'}
                    </div>
                  </div>
                  <Toggle active={autoEnabled} onToggle={() => setAutoEnabled(p => !p)} />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--lv-muted)', display: 'block', marginBottom: 6 }}>حدث التشغيل</label>
                  <select value={triggerEvent} onChange={e => setTriggerEvent(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--lv-line)', borderRadius: 9, fontSize: 13, outline: 'none', background: 'var(--lv-bg)', color: 'var(--lv-fg)', cursor: 'pointer' }}>
                    <option value="">— بدون حدث (يدوي) —</option>
                    {TRIGGER_EVENTS.map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.options.map(o => <option key={o.v} value={o.v}>{o.l} ({o.v})</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--lv-muted)', display: 'block', marginBottom: 6 }}>
                    <Clock size={11} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                    التأخير (ساعات بعد الحدث)
                  </label>
                  <input type="number" min={0} max={720} value={delayHours} onChange={e => setDelayHours(Number(e.target.value))}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--lv-line)', borderRadius: 9, fontSize: 13, outline: 'none', background: 'var(--lv-bg)', color: 'var(--lv-fg)' }} />
                  <div style={{ fontSize: 10, color: 'var(--lv-muted)', marginTop: 4 }}>
                    {delayHours === 0 ? 'يُرسل فوراً عند وقوع الحدث' : `يُرسل بعد ${delayHours} ساعة من وقوع الحدث`}
                  </div>
                </div>

                {triggerEvent && (
                  <div style={{ padding: '12px 14px', background: 'rgba(37,99,235,.06)', border: '1px solid rgba(37,99,235,.15)', borderRadius: 9, fontSize: 12, color: '#1e40af', direction: 'rtl' }}>
                    <strong>ملخص:</strong> عند حدوث <code>{triggerEvent}</code>
                    {delayHours > 0 ? ` — انتظر ${delayHours} ساعة — ` : ' — '}
                    أرسل قالب <strong>{template.name_ar}</strong>
                    {autoEnabled ? '' : ' (معطّل حالياً)'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar: Variables + Test */}
          <div style={{ width: 260, borderRight: '1px solid var(--lv-line)', padding: '18px 16px', overflow: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Variables */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lv-fg)', marginBottom: 10 }}>المتغيرات المتاحة</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {template.variables.map(v => (
                  <div key={v.key} onClick={() => insertVar(v.key)}
                    style={{ cursor: 'pointer', padding: '7px 10px', border: '1px solid var(--lv-line)', borderRadius: 8, background: 'var(--lv-bg)', transition: 'background .1s' }}
                    title={`مثال: ${v.example}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <code style={{ fontSize: 11, color, fontWeight: 600 }}>{`{{${v.key}}}`}</code>
                      <span style={{ fontSize: 9, color: 'var(--lv-muted)' }}>انقر</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--lv-muted)', marginTop: 1 }}>{v.label_ar}</div>
                  </div>
                ))}
                {template.variables.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--lv-muted)', textAlign: 'center', padding: '14px 0' }}>لا توجد متغيرات</div>
                )}
              </div>
            </div>

            {/* Test send */}
            {isEmail && (
              <div style={{ borderTop: '1px solid var(--lv-line)', paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lv-fg)', marginBottom: 10 }}>إرسال تجريبي</div>
                <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                  placeholder="your@email.com" dir="ltr"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--lv-line)', borderRadius: 9, fontSize: 12, outline: 'none', marginBottom: 8, boxSizing: 'border-box', background: 'var(--lv-bg)', color: 'var(--lv-fg)' }} />
                <button onClick={handleTest} disabled={testing}
                  style={{ width: '100%', padding: '9px', background: testing ? '#d1d5db' : color, color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, cursor: testing ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {testing ? 'جاري الإرسال...' : <><Send size={12} />إرسال تجريبي</>}
                </button>
                {testMsg && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: testMsg.ok ? '#16a34a' : '#dc2626' }}>
                    {testMsg.ok ? <CheckCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />}
                    {testMsg.msg}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--lv-line)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--lv-line)', borderRadius: 10, fontSize: 13, cursor: 'pointer', color: 'var(--lv-muted)' }}>إلغاء</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '10px 28px', background: saving ? '#d1d5db' : 'var(--lv-accent)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'جاري الحفظ...' : 'حفظ القالب'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SMTP Test Modal ────────────────────────────────────────────────────────────
function SmtpModal({ onClose }: { onClose(): void }) {
  const [email,   setEmail]   = useState('');
  const [result,  setResult]  = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function test() {
    if (!email) return;
    setLoading(true); setResult(null);
    try {
      const r: any = await api.smtp({ to_email: email });
      setResult({ ok: true, msg: r?.message || 'نجح الاتصال', info: r?.data });
    } catch (e: any) { setResult({ ok: false, msg: e.message }); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--lv-panel)', borderRadius: 16, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lv-fg)' }}>اختبار اتصال البريد</div>
            <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginTop: 2 }}>يتحقق من إعدادات Resend أو SMTP</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--lv-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--lv-muted)', display: 'block', marginBottom: 6 }}>إرسال البريد الاختباري إلى</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="test@example.com" dir="ltr"
          style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--lv-line)', borderRadius: 9, fontSize: 13, outline: 'none', marginBottom: 12, boxSizing: 'border-box', background: 'var(--lv-bg)', color: 'var(--lv-fg)' }} />

        {result && (
          <div style={{ background: result.ok ? 'rgba(22,163,74,.08)' : 'rgba(220,38,38,.08)', border: `1px solid ${result.ok ? 'rgba(22,163,74,.2)' : 'rgba(220,38,38,.2)'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: result.ok ? '#16a34a' : '#dc2626' }}>
            {result.msg}
            {result.info?.provider && <div style={{ fontSize: 10, marginTop: 4, color: 'var(--lv-muted)' }}>المزود: {result.info.provider}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--lv-line)', borderRadius: 10, fontSize: 13, cursor: 'pointer', color: 'var(--lv-muted)' }}>إغلاق</button>
          <button onClick={test} disabled={loading || !email}
            style={{ flex: 2, padding: '10px', background: loading || !email ? '#d1d5db' : 'var(--lv-accent)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: loading || !email ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {loading ? 'جاري الاختبار...' : <><Send size={13} />اختبار الآن</>}
          </button>
        </div>
      </div>
    </div>
  );
}
