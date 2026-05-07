'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

interface TelegramConversation {
  id: string;
  telegram_user_id: number;
  telegram_chat_id: number;
  status: string;
  last_message_at: string;
  message_count: number;
  created_at: string;
  last_message?: {
    direction: string;
    message_type: string;
    content: string;
    agent_routed_to: string | null;
    created_at: string;
  };
}

interface TelegramMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string;
  agent_routed_to: string | null;
  metadata: any;
  created_at: string;
}

const AGENT_LABELS: Record<string, string> = {
  reea: 'REEA',
  leasing: 'سارة',
  collections: 'بدر',
  ops: 'فارس',
  tenant_exp: 'لينا',
  owner_rel: 'نادية',
  os_finance: 'رضا',
  it: 'سالم',
  sales: 'خالد',
  marketing: 'نورة',
  finance: 'ريم',
  product: 'يوسف',
  design_specialist: 'ليلى',
};

const TYPE_ICON: Record<string, string> = {
  text:    'T',
  voice:   'V',
  image:   'I',
  command: 'C',
};

export default function TelegramConversationsPage() {
  const [conversations, setConversations] = useState<TelegramConversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<TelegramConversation | null>(null);
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    (adminApi as any).tg.conversations(page, 50)
      .then((res: any) => {
        setConversations(res?.data || []);
        setTotal(res?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  async function openConversation(conv: TelegramConversation) {
    setSelectedConv(conv);
    try {
      const res: any = await (adminApi as any).tg.conversation(conv.id);
      setMessages(res?.messages || []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { setMessages([]); }
  }

  function messageTypeBadge(type: string) {
    const labels: Record<string, { label: string; color: string }> = {
      text:    { label: 'نص',   color: '#6366f1' },
      voice:   { label: 'صوت',  color: '#f59e0b' },
      image:   { label: 'صورة', color: '#10b981' },
      command: { label: 'أمر',  color: '#6b7280' },
    };
    const b = labels[type] || { label: type, color: '#6b7280' };
    return (
      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: b.color + '1a', color: b.color, fontWeight: 600, border: `1px solid ${b.color}33` }}>
        {b.label}
      </span>
    );
  }

  const LIMIT = 50;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--lv-line)' }}>
        <Link href="/dashboard" style={{ color: 'var(--lv-accent)', textDecoration: 'none', fontSize: 13 }}>
          &larr; الرئيسية
        </Link>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lv-fg)' }}>أرشيف تيليجرام</div>
          <div style={{ fontSize: 11, color: 'var(--lv-muted)' }}>سجل محادثات فهد مع الوكلاء</div>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/dashboard/conversations" style={{ color: 'var(--lv-muted)', textDecoration: 'none', fontSize: 12 }}>
            محادثات واتساب
          </Link>
        </div>
      </div>

      {/* Split view */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 70px)' }}>
        {/* Conversation list */}
        <div style={{ width: 320, background: 'var(--lv-bg)', borderInlineStart: '1px solid var(--lv-line)', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--lv-muted)', fontSize: 13 }}>جاري التحميل...</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--lv-muted)', fontSize: 13 }}>لا توجد محادثات مسجلة</div>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                {conversations.map(conv => (
                  <div key={conv.id} onClick={() => openConversation(conv)}
                    style={{ padding: '12px 16px', borderBottom: '1px solid var(--lv-line)', cursor: 'pointer',
                      background: selectedConv?.id === conv.id ? '#f0edff' : 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--lv-fg)' }}>
                        ID: {conv.telegram_user_id}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--lv-muted)' }}>
                        {new Date(conv.last_message_at).toLocaleDateString('ar-SA')}
                      </span>
                    </div>
                    {conv.last_message && (
                      <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {messageTypeBadge(conv.last_message.message_type)}
                        {conv.last_message.agent_routed_to && (
                          <span style={{ color: 'var(--lv-accent)', fontWeight: 500 }}>
                            {AGENT_LABELS[conv.last_message.agent_routed_to] || conv.last_message.agent_routed_to}
                          </span>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {conv.last_message.content?.slice(0, 50)}
                        </span>
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--lv-muted)', marginTop: 3 }}>
                      {conv.message_count} رسالة
                    </div>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div style={{ borderTop: '1px solid var(--lv-line)', padding: '10px 16px', display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid var(--lv-line)', fontSize: 12, cursor: 'pointer', opacity: page === 1 ? 0.4 : 1, background: 'transparent', color: 'var(--lv-fg)' }}>
                    السابق
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--lv-muted)', lineHeight: '28px' }}>{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid var(--lv-line)', fontSize: 12, cursor: 'pointer', opacity: page === totalPages ? 0.4 : 1, background: 'transparent', color: 'var(--lv-fg)' }}>
                    التالي
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Message thread */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!selectedConv ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lv-muted)', fontSize: 13 }}>
              اختر محادثة للعرض
            </div>
          ) : (
            <>
              <div style={{ borderBottom: '1px solid var(--lv-line)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--lv-fg)' }}>
                  فهد — ID {selectedConv.telegram_user_id}
                </div>
                <div style={{ fontSize: 11, color: 'var(--lv-muted)' }}>
                  {selectedConv.message_count} رسالة · منذ {new Date(selectedConv.created_at).toLocaleDateString('ar-SA')}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--lv-muted)', fontSize: 13, padding: 24 }}>لا توجد رسائل</div>
                ) : messages.map((msg: TelegramMessage) => (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'inbound' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '72%', padding: '8px 12px', borderRadius: 8,
                      background: msg.direction === 'inbound' ? '#DBEAFE' : 'var(--lv-accent)',
                      color: msg.direction === 'inbound' ? 'var(--lv-fg)' : '#fff',
                      fontSize: 13, lineHeight: 1.5,
                    }}>
                      {msg.agent_routed_to && msg.direction === 'outbound' && (
                        <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 4, fontWeight: 600 }}>
                          {AGENT_LABELS[msg.agent_routed_to] || msg.agent_routed_to}
                        </div>
                      )}
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
                      {msg.metadata?.image_urls?.length > 0 && (
                        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {msg.metadata.image_urls.map((url: string, i: number) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer"
                              style={{ fontSize: 11, color: '#fff', background: 'rgba(255,255,255,.2)', padding: '3px 8px', borderRadius: 6, textDecoration: 'none' }}>
                              صورة {i + 1}
                            </a>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        {messageTypeBadge(msg.message_type)}
                        <span style={{ fontSize: 10, opacity: 0.6 }}>
                          {new Date(msg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
