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

export default function AgentChat({ agentType, agentName, agentIcon, accentColor, quickActions }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [tokens, setTokens]     = useState(0);
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
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `خطأ: ${e.message}` }]);
    }
    setLoading(false);
  }

  async function clearChat() {
    try {
      await request('DELETE', `/admin/agents/${agentType}/clear`);
      setMessages([]);
      setTokens(0);
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
