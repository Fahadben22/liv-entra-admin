'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

type ConvStatus = 'open' | 'handoff' | 'idle' | 'all';

interface Conversation {
  id: string;
  phone: string;
  status: string;
  current_flow: string | null;
  current_state: string | null;
  handled_by: string | null;
  unread_count: number;
  last_active_at: string;
  sla_deadline: string | null;
  sla_breached: boolean;
  company_id: string;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: string;
  handled_by: string | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

export default function ConversationsPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [statusFilter, setStatusFilter] = useState<ConvStatus>('all');
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    adminApi.sa.listCompanies().then((res: any) => {
      const list = res?.data || res || [];
      setCompanies(list);
      if (list.length > 0) setSelectedCompany(list[0].id);
    }).catch(() => {});
  }, []);

  const loadConversations = useCallback(async () => {
    if (!selectedCompany) return;
    try {
      const res: any = await adminApi.wa.conversations(selectedCompany);
      setConversations(res?.data || res || []);
    } catch { /* swallow */ } finally {
      setLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    setLoading(true);
    loadConversations();
    clearInterval(pollRef.current);
    pollRef.current = setInterval(loadConversations, 5000);
    return () => clearInterval(pollRef.current);
  }, [loadConversations]);

  async function openConversation(conv: Conversation) {
    setSelectedConv(conv);
    try {
      const res: any = await adminApi.wa.conversation(conv.id);
      setMessages(res?.messages || res?.data?.messages || []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { setMessages([]); }
  }

  async function handleSend() {
    if (!inputText.trim() || !selectedConv || !selectedCompany) return;
    setSending(true);
    try {
      await adminApi.wa.sendMessage(selectedConv.id, inputText.trim(), selectedCompany);
      setInputText('');
      await openConversation(selectedConv);
    } catch { /* show toast ideally */ } finally { setSending(false); }
  }

  const filtered = conversations.filter(c =>
    statusFilter === 'all' ? true : c.status === statusFilter || c.handled_by === statusFilter
  );

  function slaBadge(conv: Conversation) {
    if (conv.sla_breached) return <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>SLA خرق</span>;
    if (conv.sla_deadline) {
      const mins = (new Date(conv.sla_deadline).getTime() - Date.now()) / 60000;
      if (mins < 30) return <span style={{ background: '#fef9c3', color: '#d97706', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>SLA قريب</span>;
    }
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', direction: 'rtl', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#1d4070', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/dashboard" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>💬</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>صندوق المحادثات</div>
            <div style={{ fontSize: 11, color: '#93c5fd' }}>متعدد الشركات — واتساب</div>
          </div>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/dashboard/whatsapp/settings" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 12 }}>⚙️ الإعدادات</Link>
          <Link href="/dashboard/whatsapp/queue" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 12 }}>📤 قائمة الإرسال</Link>
          <Link href="/dashboard/whatsapp/analytics" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 12 }}>📊 التحليلات</Link>
        </div>
      </div>

      {/* Company selector */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '10px 24px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>الشركة:</span>
        <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}
          style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 10px', fontSize: 13, background: 'white' }}>
          {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(['all', 'open', 'handoff', 'idle'] as ConvStatus[]).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid', fontSize: 12, cursor: 'pointer',
              background: statusFilter === s ? '#1d4070' : 'white',
              color: statusFilter === s ? 'white' : '#64748b',
              borderColor: statusFilter === s ? '#1d4070' : '#e2e8f0' }}>
            {s === 'all' ? 'الكل' : s === 'open' ? 'مفتوحة' : s === 'handoff' ? 'للموظف' : 'خاملة'}
          </button>
        ))}
      </div>

      {/* Split view */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 110px)' }}>
        {/* Conversation list */}
        <div style={{ width: 300, background: 'white', borderLeft: '1px solid #e2e8f0', overflowY: 'auto', flexShrink: 0 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>لا توجد محادثات</div>
          ) : filtered.map(conv => (
            <div key={conv.id} onClick={() => openConversation(conv)}
              style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                background: selectedConv?.id === conv.id ? '#eff6ff' : 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{conv.phone}</span>
                {conv.unread_count > 0 && (
                  <span style={{ background: '#ef4444', color: 'white', fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                    {conv.unread_count}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                {conv.current_flow || conv.status || 'IDLE'} · {new Date(conv.last_active_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ marginTop: 4 }}>{slaBadge(conv)}</div>
            </div>
          ))}
        </div>

        {/* Chat thread */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
          {!selectedConv ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>
              اختر محادثة للعرض
            </div>
          ) : (
            <>
              {/* Conv header */}
              <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{selectedConv.phone}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {selectedConv.current_flow || 'لا يوجد تدفق نشط'} · {selectedConv.handled_by === 'human' ? '👤 موظف' : '🤖 بوت'}
                </div>
                {slaBadge(selectedConv)}
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: 24 }}>لا توجد رسائل</div>
                ) : messages.map((msg: Message) => (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'inbound' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '70%', padding: '8px 12px', borderRadius: 12,
                      background: msg.direction === 'inbound' ? '#dcfce7' : '#1d4070',
                      color: msg.direction === 'inbound' ? '#15803d' : 'white',
                      fontSize: 13, lineHeight: 1.5,
                    }}>
                      <div>{msg.body}</div>
                      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, textAlign: 'left' }}>
                        {new Date(msg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        {msg.direction === 'outbound' && (msg.read_at ? ' ✓✓' : msg.delivered_at ? ' ✓' : '')}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ background: 'white', borderTop: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', gap: 8 }}>
                <input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="اكتب رسالة..."
                  style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }}
                />
                <button onClick={handleSend} disabled={sending || !inputText.trim()}
                  style={{ background: '#1d4070', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.7 : 1 }}>
                  {sending ? '...' : 'إرسال'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
