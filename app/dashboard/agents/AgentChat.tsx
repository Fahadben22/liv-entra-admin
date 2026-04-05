'use client';
import { useState, useRef, useEffect } from 'react';
import { request } from '@/lib/api';

interface AgentChatProps {
  agentType: 'it' | 'sales' | 'marketing';
  agentName: string;
  agentIcon: string;
  accentColor: string;
  quickActions: string[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface DraftEmail {
  lead_id: string;
  lead_name: string;
  lead_email: string;
  subject: string;
  body: string;
}

export default function AgentChat({ agentType, agentName, agentIcon, accentColor, quickActions }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
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

  async function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const res = await request<any>('POST', `/admin/agents/${agentType}/chat`, { message: msg });
      const reply = res?.data?.reply || 'لم أتمكن من الرد.';
      setTokens(prev => prev + (res?.data?.tokens_used || 0));
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);

      // Check if agent drafted an email outreach
      const draftAction = (res?.data?.actions || []).find((a: any) => {
        try { const r = typeof a.result === 'string' ? JSON.parse(a.result) : a.result; return r?.action === 'draft_email'; } catch { return false; }
      });
      if (draftAction) {
        try {
          const draftData = typeof draftAction.result === 'string' ? JSON.parse(draftAction.result) : draftAction.result;
          // Extract subject/body from the agent's reply text
          const subjectMatch = reply.match(/(?:الموضوع|Subject)[:\s]*(.+)/i);
          const bodyStart = reply.indexOf('\n\n');
          const emailSubject = subjectMatch?.[1]?.trim() || `Liventra OS — ${draftData.lead_name}`;
          const emailBody = bodyStart > 0 ? reply.slice(bodyStart + 2).trim() : reply;
          setDraft({ lead_id: draftData.lead_id, lead_name: draftData.lead_name, lead_email: draftData.lead_email, subject: emailSubject, body: emailBody });
          setEditSubject(emailSubject);
          setEditBody(emailBody);
        } catch { /* draft parse failed — show reply only */ }
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `خطأ: ${e.message}` }]);
    }
    setLoading(false);
  }

  async function sendDraftEmail() {
    if (!draft) return;
    setSending(true);
    try {
      const res = await request<any>('POST', '/admin/agents/sales/send-outreach', {
        lead_id: draft.lead_id, subject: editSubject, body: editBody,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res?.message || 'تم الإرسال ✓' }]);
      setDraft(null);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `فشل: ${e.message}` }]);
    }
    setSending(false);
  }

  async function clearChat() {
    try {
      await request('DELETE', `/admin/agents/${agentType}/clear`);
      setMessages([]);
      setTokens(0);
      setDraft(null);
    } catch { }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', background: '#05081a', direction: 'rtl' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: accentColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {agentIcon}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>{agentName}</h2>
          <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>
            {tokens > 0 ? `${tokens.toLocaleString()} رمز مستخدم` : 'جاهز للمساعدة'}
          </p>
        </div>
        <button onClick={clearChat}
          style={{ fontSize: 11, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
          مسح المحادثة
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
            <div style={{ fontSize: 48 }}>{agentIcon}</div>
            <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center' }}>اسأل {agentName} أي سؤال</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 500 }}>
              {quickActions.map((q, i) => (
                <button key={i} onClick={() => send(q)}
                  style={{
                    fontSize: 12, padding: '8px 16px', borderRadius: 20,
                    border: '1px solid rgba(255,255,255,.1)', background: '#0c1535',
                    color: '#e2e8f0', cursor: 'pointer',
                  }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end', gap: 8 }}>
            <div style={{
              maxWidth: '80%', padding: '12px 16px', borderRadius: 16,
              background: msg.role === 'user' ? '#1e293b' : '#0c1535',
              border: msg.role === 'assistant' ? `1px solid ${accentColor}30` : '1px solid rgba(255,255,255,.06)',
              color: '#e2e8f0', fontSize: 13, lineHeight: 1.7,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ padding: '12px 16px', borderRadius: 16, background: '#0c1535', border: `1px solid ${accentColor}30` }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: accentColor,
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    opacity: 0.5,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Draft Email Approval Panel */}
      {draft && (
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,.08)', background: '#0a1128' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>📧</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>مسودة بريد — {draft.lead_name}</span>
              <span style={{ fontSize: 11, color: '#64748b', marginRight: 'auto' }}>{draft.lead_email}</span>
            </div>
            <input value={editSubject} onChange={e => setEditSubject(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: '#0c1535', color: '#e2e8f0', fontSize: 13, marginBottom: 8, boxSizing: 'border-box', direction: 'rtl' }}
              placeholder="الموضوع" />
            <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={6}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: '#0c1535', color: '#e2e8f0', fontSize: 13, lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box', direction: 'rtl' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={sendDraftEmail} disabled={sending}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: '#15803d', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, opacity: sending ? 0.5 : 1 }}>
                {sending ? 'جاري الإرسال...' : 'إرسال ✓'}
              </button>
              <button onClick={() => setDraft(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ display: 'flex', gap: 10, maxWidth: 700, margin: '0 auto' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`اسأل ${agentName}...`}
            disabled={loading}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,.12)', background: '#0c1535',
              color: '#e2e8f0', fontSize: 14, outline: 'none',
              direction: 'rtl',
            }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()}
            style={{
              padding: '12px 24px', borderRadius: 12, border: 'none',
              background: loading ? '#1e293b' : accentColor,
              color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}>
            إرسال
          </button>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity:.3 } 50% { opacity:1 } }`}</style>
    </div>
  );
}
