'use client';
import { useState, useRef, useEffect } from 'react';
import { request } from '@/lib/api';
import Icon, { IconName } from '@/components/Icon';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  tools_used?: string[];
  tokens_used?: number;
}

interface AgentGoal {
  id: string;
  goal_text: string;
  target_value?: number;
  current_value?: number;
  deadline?: string;
  status: string;
}

interface OutreachDraft {
  draft_id: string;
  lead_name: string;
  lead_email: string | null;
  lead_phone: string | null;
  email_subject: string;
  email_body: string;
  whatsapp_body: string;
  client_type: string;
}

interface AgentChatProps {
  agentType: string;
  agentName: string;
  agentIcon: IconName;
  accentColor: string;
  quickActions: string[];
  messages?: Message[];
  onMessagesChange?: (msgs: Message[]) => void;
  compact?: boolean;
  pendingMessage?: string;
}

interface DraftEmail {
  lead_id: string;
  lead_name: string;
  lead_email: string;
  subject: string;
  body: string;
}

export default function AgentChat({ agentType, agentName, agentIcon, accentColor, quickActions, messages: externalMessages, onMessagesChange, compact, pendingMessage }: AgentChatProps) {
  const [internalMessages, setInternalMessages] = useState<Message[]>([]);
  const messages = externalMessages ?? internalMessages;
  const setMessages = onMessagesChange ?? setInternalMessages;

  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [tokens, setTokens]     = useState(0);
  const [goals, setGoals]       = useState<AgentGoal[]>([]);

  useEffect(() => {
    request<any>('GET', '/admin/agents/goals').then(res => {
      if (res?.data) setGoals((res.data as AgentGoal[]).filter(g => g.status === 'active'));
    }).catch(() => {});
  }, []);

  // Legacy email draft (old contactLead flow)
  const [draft, setDraft]       = useState<DraftEmail | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody]       = useState('');
  const [sending, setSending]   = useState(false);

  // New outreach draft approval flow
  const [outreachDraft, setOutreachDraft]   = useState<OutreachDraft | null>(null);
  const [outreachTab, setOutreachTab]       = useState<'email' | 'whatsapp'>('email');
  const [editEmailSubject, setEditEmailSubject]   = useState('');
  const [editEmailBody, setEditEmailBody]         = useState('');
  const [editWhatsApp, setEditWhatsApp]           = useState('');
  const [rejectNote, setRejectNote]               = useState('');
  const [showRejectInput, setShowRejectInput]     = useState(false);
  const [outreachSending, setOutreachSending]     = useState(false);
  const [outreachStatus, setOutreachStatus]       = useState<'idle' | 'sent' | 'rejected'>('idle');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, outreachDraft]);

  const pendingSentRef = useRef<string>('');
  useEffect(() => {
    if (pendingMessage && pendingMessage !== pendingSentRef.current && !loading) {
      pendingSentRef.current = pendingMessage;
      send(pendingMessage);
    }
  }, [pendingMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    const updated = [...messages, { role: 'user' as const, content: msg }];
    setMessages(updated);
    setLoading(true);

    try {
      const res = await request<any>('POST', `/admin/agents/${agentType}/chat`, { message: msg });
      const reply = res?.data?.reply || 'لم أتمكن من الرد.';
      const toolsUsed: string[] = res?.data?.tools_used || [];
      const msgTokens: number = res?.data?.tokens_used || 0;
      setTokens(prev => prev + msgTokens);
      setMessages([...updated, { role: 'assistant', content: reply, tools_used: toolsUsed, tokens_used: msgTokens || undefined }]);

      // Detect new outreach draft from tool actions
      const actions = res?.data?.actions || [];
      const draftAction = actions.find((a: any) => {
        try {
          const r = typeof a.result === 'string' ? JSON.parse(a.result) : a.result;
          return r?.action === 'outreach_draft_ready';
        } catch { return false; }
      });
      if (draftAction) {
        try {
          const d = typeof draftAction.result === 'string' ? JSON.parse(draftAction.result) : draftAction.result;
          setOutreachDraft({
            draft_id:      d.draft_id,
            lead_name:     d.lead_name,
            lead_email:    d.lead_email,
            lead_phone:    d.lead_phone,
            email_subject: d.email_subject,
            email_body:    d.email_body,
            whatsapp_body: d.whatsapp_body,
            client_type:   d.client_type,
          });
          setEditEmailSubject(d.email_subject);
          setEditEmailBody(d.email_body);
          setEditWhatsApp(d.whatsapp_body);
          setOutreachStatus('idle');
          setShowRejectInput(false);
          setRejectNote('');
          setOutreachTab('email');
        } catch {}
      }

      // Legacy draft email detection (old flow)
      const legacyDraft = actions.find((a: any) => {
        try { const r = typeof a.result === 'string' ? JSON.parse(a.result) : a.result; return r?.action === 'draft_email'; } catch { return false; }
      });
      if (legacyDraft) {
        try {
          const draftData = typeof legacyDraft.result === 'string' ? JSON.parse(legacyDraft.result) : legacyDraft.result;
          const subjectMatch = reply.match(/(?:الموضوع|Subject)[:\s]*(.+)/i);
          const bodyStart = reply.indexOf('\n\n');
          const emailSubject = subjectMatch?.[1]?.trim() || `Liventra OS — ${draftData.lead_name}`;
          const emailBody = bodyStart > 0 ? reply.slice(bodyStart + 2).trim() : reply;
          setDraft({ lead_id: draftData.lead_id, lead_name: draftData.lead_name, lead_email: draftData.lead_email, subject: emailSubject, body: emailBody });
          setEditSubject(emailSubject);
          setEditBody(emailBody);
        } catch {}
      }
    } catch (e: any) {
      setMessages([...updated, { role: 'assistant', content: `خطأ: ${e.message}` }]);
    }
    setLoading(false);
  }

  async function approveOutreach() {
    if (!outreachDraft) return;
    setOutreachSending(true);
    try {
      const res = await request<any>('POST', '/admin/agents/sales/send-approved-outreach', {
        draft_id:            outreachDraft.draft_id,
        edited_subject:      editEmailSubject !== outreachDraft.email_subject ? editEmailSubject : undefined,
        edited_email_body:   editEmailBody   !== outreachDraft.email_body    ? editEmailBody    : undefined,
        edited_whatsapp_body: editWhatsApp   !== outreachDraft.whatsapp_body ? editWhatsApp     : undefined,
      });
      if (res?.success) {
        setOutreachStatus('sent');
        setMessages([...messages, { role: 'assistant', content: `✅ تم إرسال رسالة التعريف إلى ${outreachDraft.lead_name} بنجاح${outreachDraft.lead_email ? ` (${outreachDraft.lead_email})` : ''}${outreachDraft.lead_phone ? ' + واتساب في القائمة' : ''}` }]);
        setTimeout(() => setOutreachDraft(null), 3000);
      } else {
        setMessages([...messages, { role: 'assistant', content: `❌ فشل الإرسال: ${res?.message || 'خطأ غير معروف'}` }]);
      }
    } catch (e: any) {
      setMessages([...messages, { role: 'assistant', content: `❌ خطأ: ${e.message}` }]);
    }
    setOutreachSending(false);
  }

  async function rejectOutreach() {
    if (!outreachDraft || !rejectNote.trim()) return;
    setOutreachSending(true);
    try {
      await request<any>('POST', '/admin/agents/sales/reject-outreach', {
        draft_id: outreachDraft.draft_id,
        rejection_note: rejectNote,
      });
      setOutreachStatus('rejected');
      // Tell خالد to revise with the rejection note
      setOutreachDraft(null);
      await send(`أعد صياغة رسالة التعريف لـ ${outreachDraft.lead_name}. ملاحظات: ${rejectNote}`);
    } catch (e: any) {
      setMessages([...messages, { role: 'assistant', content: `خطأ: ${e.message}` }]);
    }
    setOutreachSending(false);
  }

  async function sendDraftEmail() {
    if (!draft) return;
    setSending(true);
    try {
      const res = await request<any>('POST', '/admin/agents/sales/send-outreach', { lead_id: draft.lead_id, subject: editSubject, body: editBody });
      setMessages([...messages, { role: 'assistant', content: res?.message || 'تم الإرسال' }]);
      setDraft(null);
    } catch (e: any) {
      setMessages([...messages, { role: 'assistant', content: `فشل: ${e.message}` }]);
    }
    setSending(false);
  }

  async function clearChat() {
    try {
      await request('DELETE', `/admin/agents/${agentType}/clear`);
      setMessages([]);
      setTokens(0);
      setDraft(null);
      setOutreachDraft(null);
      setOutreachStatus('idle');
    } catch {}
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: compact ? '100%' : 'calc(100vh - 60px)', background: 'transparent' }}>
      {/* Header */}
      {!compact && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--lv-chip)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={agentIcon} size={16} color="var(--lv-accent)" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0 }}>{agentName}</h2>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>{tokens > 0 ? `${tokens.toLocaleString()} رمز` : 'جاهز'}</p>
          </div>
          <button onClick={clearChat} style={{ fontSize: 10, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(0,0,0,.06)', background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}>مسح</button>
        </div>
      )}

      {/* Goals bar */}
      {goals.length > 0 && (
        <div style={{ padding: '8px 20px', borderBottom: '1px solid rgba(0,0,0,.04)', background: '#fafafa', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>الأهداف:</span>
          {goals.map(g => (
            <span key={g.id} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 12, background: 'rgba(124,92,252,.08)', border: '1px solid rgba(124,92,252,.2)', color: '#7c5cfc', fontWeight: 600 }}>
              {g.goal_text}{g.target_value ? ` (${g.current_value || 0}/${g.target_value})` : ''}{g.deadline ? ` — ${g.deadline}` : ''}
            </span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && !outreachDraft && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--lv-chip)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={agentIcon} size={28} color="var(--lv-accent)" />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 480 }}>
              {quickActions.map((q, i) => (
                <button key={i} onClick={() => send(q)} style={{ fontSize: 11, padding: '7px 14px', borderRadius: 18, border: '1px solid rgba(0,0,0,.08)', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-start' : 'flex-end', gap: 4 }}>
            <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 14, background: msg.role === 'user' ? '#DBEAFE' : '#F1F5F9', border: msg.role === 'user' ? '1px solid rgba(124,92,252,.12)' : '1px solid rgba(0,0,0,.04)', color: '#1E293B', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {msg.content}
            </div>
            {msg.role === 'assistant' && msg.tools_used && msg.tools_used.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: '85%', justifyContent: 'flex-end' }}>
                {msg.tools_used.map((tool, ti) => (
                  <span key={ti} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(124,92,252,.08)', border: '1px solid rgba(124,92,252,.2)', color: '#7c5cfc', fontFamily: 'monospace' }}>{tool}</span>
                ))}
              </div>
            )}
            {msg.role === 'assistant' && msg.tokens_used && (
              <span style={{ fontSize: 9, color: '#d1d5db', alignSelf: 'flex-end' }}>{msg.tokens_used.toLocaleString()} token</span>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ padding: '10px 14px', borderRadius: 14, background: '#F1F5F9', border: '1px solid rgba(0,0,0,.04)' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (<div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#9ca3af', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`, opacity: 0.5 }} />))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Outreach Draft Approval Card ───────────────────────────────────── */}
      {outreachDraft && outreachStatus === 'idle' && (
        <div style={{ padding: '16px 20px', borderTop: '2px solid #7c5cfc', background: '#faf9ff', flexShrink: 0 }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#5b21b6', margin: 0 }}>
                  مسودة رسالة تعريفية — {outreachDraft.lead_name}
                </p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>
                  {outreachDraft.lead_email && `📧 ${outreachDraft.lead_email}`}
                  {outreachDraft.lead_email && outreachDraft.lead_phone && '  '}
                  {outreachDraft.lead_phone && `📱 ${outreachDraft.lead_phone}`}
                </p>
              </div>
              <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 12, background: '#ede9fe', color: '#7c5cfc', fontWeight: 600 }}>
                بانتظار موافقتك
              </span>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(124,92,252,.2)' }}>
              {(['email', 'whatsapp'] as const).map(tab => (
                <button key={tab} onClick={() => setOutreachTab(tab)} style={{ flex: 1, padding: '8px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: outreachTab === tab ? '#7c5cfc' : '#fff', color: outreachTab === tab ? '#fff' : '#7c5cfc', transition: 'all .15s' }}>
                  {tab === 'email' ? '📧 البريد الإلكتروني' : '💬 واتساب'}
                </button>
              ))}
            </div>

            {/* Email tab */}
            {outreachTab === 'email' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  value={editEmailSubject}
                  onChange={e => setEditEmailSubject(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,.1)', fontSize: 12, direction: 'rtl' }}
                  placeholder="موضوع البريد"
                />
                {/* HTML preview iframe */}
                <div style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                  <div style={{ padding: '6px 10px', background: '#f8f7fc', borderBottom: '1px solid rgba(0,0,0,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>معاينة البريد</span>
                    <button onClick={() => {
                      const area = document.getElementById('email-edit-area') as HTMLTextAreaElement;
                      if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
                    }} style={{ fontSize: 10, color: '#7c5cfc', background: 'none', border: 'none', cursor: 'pointer' }}>تعديل HTML</button>
                  </div>
                  <iframe
                    srcDoc={editEmailBody}
                    style={{ width: '100%', height: 240, border: 'none', display: 'block' }}
                    sandbox="allow-same-origin"
                    title="email preview"
                  />
                  <textarea
                    id="email-edit-area"
                    value={editEmailBody}
                    onChange={e => setEditEmailBody(e.target.value)}
                    rows={6}
                    style={{ display: 'none', width: '100%', padding: '8px 12px', border: 'none', borderTop: '1px solid rgba(0,0,0,.06)', fontSize: 11, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}

            {/* WhatsApp tab */}
            {outreachTab === 'whatsapp' && (
              <div>
                <div style={{ background: '#dcfce7', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
                  <p style={{ fontSize: 10, color: '#166534', margin: '0 0 6px', fontWeight: 600 }}>معاينة واتساب</p>
                  <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#1e293b', lineHeight: 1.7, whiteSpace: 'pre-wrap', direction: 'rtl' }}>
                    {editWhatsApp}
                  </div>
                </div>
                <textarea
                  value={editWhatsApp}
                  onChange={e => setEditWhatsApp(e.target.value)}
                  rows={5}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,.1)', fontSize: 12, lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box', direction: 'rtl' }}
                  placeholder="رسالة واتساب..."
                />
              </div>
            )}

            {/* Reject note input */}
            {showRejectInput && (
              <div style={{ marginTop: 10 }}>
                <textarea
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  rows={2}
                  placeholder="سبب الرفض وتعليماتك لخالد (مطلوب)..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #fca5a5', fontSize: 12, lineHeight: 1.6, resize: 'none', boxSizing: 'border-box', direction: 'rtl', background: '#fff5f5' }}
                />
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={approveOutreach}
                disabled={outreachSending}
                style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: outreachSending ? '#d1d5db' : '#7c5cfc', color: '#fff', cursor: outreachSending ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, opacity: outreachSending ? .6 : 1 }}
              >
                {outreachSending ? 'جاري الإرسال...' : '✅ موافقة وإرسال'}
              </button>
              {!showRejectInput ? (
                <button
                  onClick={() => setShowRejectInput(true)}
                  disabled={outreachSending}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  ✏️ أعد الصياغة
                </button>
              ) : (
                <button
                  onClick={rejectOutreach}
                  disabled={outreachSending || !rejectNote.trim()}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: rejectNote.trim() ? '#dc2626' : '#d1d5db', color: '#fff', cursor: rejectNote.trim() ? 'pointer' : 'default', fontSize: 12, fontWeight: 600 }}
                >
                  إرسال للمراجعة
                </button>
              )}
              <button
                onClick={() => { setOutreachDraft(null); setShowRejectInput(false); }}
                disabled={outreachSending}
                style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(0,0,0,.08)', background: '#fff', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sent confirmation */}
      {outreachDraft && outreachStatus === 'sent' && (
        <div style={{ padding: '12px 20px', borderTop: '2px solid #10b981', background: '#f0fdf4', flexShrink: 0, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#059669', fontWeight: 600, margin: 0 }}>✅ تم الإرسال إلى {outreachDraft.lead_name}</p>
        </div>
      )}

      {/* Legacy Draft Email */}
      {draft && (
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(0,0,0,.06)', background: '#F1F5F9' }}>
          <div style={{ maxWidth: 550, margin: '0 auto' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', margin: '0 0 8px' }}>مسودة بريد — {draft.lead_name} ({draft.lead_email})</p>
            <input value={editSubject} onChange={e => setEditSubject(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,.06)', fontSize: 12, marginBottom: 6, boxSizing: 'border-box' }} placeholder="الموضوع" />
            <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={4} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,.06)', fontSize: 12, lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={sendDraftEmail} disabled={sending} style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: sending ? .5 : 1 }}>{sending ? 'جاري...' : 'إرسال'}</button>
              <button onClick={() => setDraft(null)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid rgba(0,0,0,.06)', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 12 }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(0,0,0,.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={`اسأل ${agentName}...`} disabled={loading} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,.06)', background: '#F1F5F9', color: '#1E293B', fontSize: 13, outline: 'none' }} />
          <button onClick={() => send()} disabled={loading || !input.trim()} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: loading ? '#d1d5db' : '#2563EB', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: loading || !input.trim() ? .5 : 1 }}>إرسال</button>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
    </div>
  );
}
