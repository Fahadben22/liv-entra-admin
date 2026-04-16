'use client';
import { useState, useRef, useEffect } from 'react';
import { request } from '@/lib/api';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentChatProps {
  agentType: string;
  agentName: string;
  agentIcon: string;
  accentColor: string;
  quickActions: string[];
  // Lifted state mode — parent controls messages
  messages?: Message[];
  onMessagesChange?: (msgs: Message[]) => void;
  compact?: boolean; // hide header when parent provides its own
  pendingMessage?: string; // auto-sent once when non-empty (used by briefing card)
}

interface DraftEmail {
  lead_id: string;
  lead_name: string;
  lead_email: string;
  subject: string;
  body: string;
}

export default function AgentChat({ agentType, agentName, agentIcon, accentColor, quickActions, messages: externalMessages, onMessagesChange, compact, pendingMessage }: AgentChatProps) {
  // Use external state if provided, otherwise internal
  const [internalMessages, setInternalMessages] = useState<Message[]>([]);
  const messages = externalMessages ?? internalMessages;
  const setMessages = onMessagesChange ?? setInternalMessages;

  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [tokens, setTokens]     = useState(0);
  const [draft, setDraft]       = useState<DraftEmail | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody]       = useState('');
  const [sending, setSending]   = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Auto-send pendingMessage once when it becomes non-empty
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
      setTokens(prev => prev + (res?.data?.tokens_used || 0));
      setMessages([...updated, { role: 'assistant', content: reply }]);

      // Check if agent drafted an email outreach
      const draftAction = (res?.data?.actions || []).find((a: any) => {
        try { const r = typeof a.result === 'string' ? JSON.parse(a.result) : a.result; return r?.action === 'draft_email'; } catch { return false; }
      });
      if (draftAction) {
        try {
          const draftData = typeof draftAction.result === 'string' ? JSON.parse(draftAction.result) : draftAction.result;
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
    } catch {}
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: compact ? '100%' : 'calc(100vh - 60px)', background: 'transparent' }}>
      {/* Header — hidden in compact mode */}
      {!compact && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>{agentIcon}</span>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0 }}>{agentName}</h2>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>{tokens > 0 ? `${tokens.toLocaleString()} رمز` : 'جاهز'}</p>
          </div>
          <button onClick={clearChat} style={{ fontSize: 10, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(0,0,0,.06)', background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}>مسح</button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ fontSize: 40 }}>{agentIcon}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 480 }}>
              {quickActions.map((q, i) => (
                <button key={i} onClick={() => send(q)} style={{ fontSize: 11, padding: '7px 14px', borderRadius: 18, border: '1px solid rgba(0,0,0,.08)', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end', gap: 6 }}>
            <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 14, background: msg.role === 'user' ? '#DBEAFE' : '#F1F5F9', border: msg.role === 'user' ? '1px solid rgba(124,92,252,.12)' : '1px solid rgba(0,0,0,.04)', color: '#1E293B', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {msg.content}
            </div>
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

      {/* Draft Email */}
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
