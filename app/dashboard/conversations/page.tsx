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
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

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
    if (conv.sla_breached) return <span style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#dc2626', fontWeight: 500 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#dc2626', boxShadow: '0 0 6px rgba(220,38,38,.4)', display: 'inline-block' }} />SLA خرق</span>;
    if (conv.sla_deadline) {
      const mins = (new Date(conv.sla_deadline).getTime() - Date.now()) / 60000;
      if (mins < 30) return <span style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#d97706', fontWeight: 500 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#d97706', boxShadow: '0 0 6px rgba(217,119,6,.4)', display: 'inline-block' }} />SLA قريب</span>;
    }
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid rgba(0,0,0,.08)' }}>
        <Link href="/dashboard" style={{ color: '#7c5cfc', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>صندوق المحادثات</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>متعدد الشركات — واتساب</div>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/dashboard/whatsapp/settings" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 12 }}>الإعدادات</Link>
          <Link href="/dashboard/whatsapp/queue" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 12 }}>قائمة الإرسال</Link>
          <Link href="/dashboard/whatsapp/analytics" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 12 }}>التحليلات</Link>
        </div>
      </div>

      {/* Company selector */}
      <div style={{ borderBottom: '1px solid rgba(0,0,0,.08)', padding: '10px 24px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>الشركة:</span>
        <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}
          style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '5px 10px', fontSize: 13, background: '#f8f7fc', color: '#1a1a2e' }}>
          {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(['all', 'open', 'handoff', 'idle'] as ConvStatus[]).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: '4px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.08)', fontSize: 12, cursor: 'pointer',
              background: statusFilter === s ? '#7c5cfc' : 'transparent',
              color: statusFilter === s ? '#fff' : '#6b7280' }}>
            {s === 'all' ? 'الكل' : s === 'open' ? 'مفتوحة' : s === 'handoff' ? 'للموظف' : 'خاملة'}
          </button>
        ))}
      </div>

      {/* Split view */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 110px)' }}>
        {/* Conversation list */}
        <div style={{ width: 300, background: '#fafafa', borderLeft: '1px solid rgba(0,0,0,.08)', overflowY: 'auto', flexShrink: 0 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>لا توجد محادثات</div>
          ) : filtered.map(conv => (
            <div key={conv.id} onClick={() => openConversation(conv)}
              style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,.06)', cursor: 'pointer',
                background: selectedConv?.id === conv.id ? '#f0edff' : 'transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{conv.phone}</span>
                {conv.unread_count > 0 && (
                  <span style={{ background: '#dc2626', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                    {conv.unread_count}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                {conv.current_flow || conv.status || 'IDLE'} · {new Date(conv.last_active_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ marginTop: 4 }}>{slaBadge(conv)}</div>
            </div>
          ))}
        </div>

        {/* Chat thread */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!selectedConv ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
              اختر محادثة للعرض
            </div>
          ) : (
            <>
              {/* Conv header */}
              <div style={{ borderBottom: '1px solid rgba(0,0,0,.08)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e' }}>{selectedConv.phone}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {selectedConv.current_flow || 'لا يوجد تدفق نشط'} · {selectedConv.handled_by === 'human' ? 'موظف' : 'بوت'}
                </div>
                {slaBadge(selectedConv)}
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 24 }}>لا توجد رسائل</div>
                ) : messages.map((msg: Message) => (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'inbound' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '70%', padding: '8px 12px', borderRadius: 8,
                      background: msg.direction === 'inbound' ? '#ede9fe' : '#7c5cfc',
                      color: msg.direction === 'inbound' ? '#1a1a2e' : '#fff',
                      border: msg.direction === 'inbound' ? '1px solid rgba(124,92,252,.15)' : 'none',
                      fontSize: 13, lineHeight: 1.5,
                    }}>
                      <div>{msg.body}</div>
                      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'left' }}>
                        {new Date(msg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        {msg.direction === 'outbound' && (msg.read_at ? ' ✓✓' : msg.delivered_at ? ' ✓' : '')}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', padding: '12px 20px', display: 'flex', gap: 8 }}>
                <input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="اكتب رسالة..."
                  style={{ flex: 1, border: '1px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', background: '#f8f7fc', color: '#1a1a2e' }}
                />
                <button onClick={handleSend} disabled={sending || !inputText.trim()}
                  style={{ background: '#7c5cfc', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 18px', fontSize: 13, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.7 : 1 }}>
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
