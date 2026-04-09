'use client';
import { useState, useEffect, useCallback } from 'react';
import AgentChat, { Message } from './AgentChat';
import { adminApi } from '@/lib/api';

// ─── Agent Registry (fixed order = spatial memory) ───────────────────────────
const AGENTS = [
  { type: 'meeting_room', name: 'الاجتماعات', icon: '🏛️', color: '#7c5cfc', role: 'غرفة الاجتماعات', quickActions: ['نظرة شاملة على كل الأقسام', 'KPIs اليوم', 'أنشئ تقرير تنفيذي', 'الخطط النشطة', 'مشاكل تحتاج انتباهي'] },
  { type: 'it', name: 'سالم', icon: '🛡️', color: '#3b82f6', role: 'IT', spec: 'it_specialist', specName: 'طارق', specIcon: '🔧', quickActions: ['حالة النظام', 'Cloudflare', 'أنماط الأخطاء', 'أحداث أمنية', 'SSL'] },
  { type: 'sales', name: 'خالد', icon: '💼', color: '#22c55e', role: 'مبيعات', spec: 'sales_specialist', specName: 'عمر', specIcon: '📞', quickActions: ['أفضل عميل', 'MRR', 'التجارب المنتهية', 'ملخص الأسبوع', 'خط الأنابيب'] },
  { type: 'marketing', name: 'نورة', icon: '📊', color: '#8b5cf6', role: 'تسويق', spec: 'marketing_specialist', specName: 'سارة', specIcon: '📱', quickActions: ['KPIs الأسبوع', 'الحملات', 'الزوار', 'التحويل', 'المصادر'] },
  { type: 'finance', name: 'ريم', icon: '💰', color: '#f59e0b', role: 'مالية', spec: 'finance_specialist', specName: 'ماجد', specIcon: '📋', quickActions: ['MRR', 'الفواتير', 'المتأخرات', 'المصروفات', 'التوقعات'] },
  { type: 'product', name: 'يوسف', icon: '🚀', color: '#06b6d4', role: 'منتج', spec: 'product_specialist', specName: 'لينا', specIcon: '🔍', quickActions: ['تبني الميزات', 'تذاكر مفتوحة', 'المغادرة', 'NPS', 'خريطة الطريق'] },
];

// Specialist quick actions
const SPEC_ACTIONS: Record<string, string[]> = {
  it_specialist: ['مهامي', 'صحة النظام', 'أنماط الأخطاء'],
  sales_specialist: ['مهامي', 'تواصل مع عميل', 'الوحدات الشاغرة'],
  marketing_specialist: ['مهامي', 'التحويل', 'المصادر'],
  finance_specialist: ['مهامي', 'الفواتير', 'المتأخرات'],
  product_specialist: ['مهامي', 'التذاكر', 'الميزات'],
};

function getAgentInfo(type: string) {
  const mgr = AGENTS.find(a => a.type === type);
  if (mgr) return mgr;
  const parent = AGENTS.find(a => a.spec === type);
  if (parent) return { type, name: parent.specName!, icon: parent.specIcon!, color: parent.color, role: `متخصص ${parent.role}`, quickActions: SPEC_ACTIONS[type] || ['مهامي'] };
  return AGENTS[0];
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending_approval: { label: 'انتظار', color: '#f59e0b', bg: '#fffbeb' },
  approved: { label: 'معتمد', color: '#10b981', bg: '#ecfdf5' },
  in_progress: { label: 'قيد التنفيذ', color: '#3b82f6', bg: '#eff6ff' },
  done: { label: 'منجز', color: '#059669', bg: '#f0fdf4' },
  blocked: { label: 'مرفوض', color: '#ef4444', bg: '#fef2f2' },
  pending: { label: 'معلق', color: '#f59e0b', bg: '#fffbeb' },
};

export default function AgentsWorkspace() {
  const [activeAgent, setActiveAgent] = useState('meeting_room');
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'actions' | 'reports'>('actions');
  const [acting, setActing] = useState<string | null>(null);

  const loadSidebar = useCallback(async () => {
    const [r, a] = await Promise.allSettled([adminApi.sa.getMeetingReports?.(), adminApi.sa.getMeetingActions?.()]);
    if (r.status === 'fulfilled') setReports((r.value as any)?.data || []);
    if (a.status === 'fulfilled') setActions((a.value as any)?.data || []);
  }, []);
  useEffect(() => { loadSidebar(); const iv = setInterval(loadSidebar, 30000); return () => clearInterval(iv); }, [loadSidebar]);

  async function handleApprove(id: string) { setActing(id); try { await adminApi.sa.approveAction?.(id); await loadSidebar(); } catch {} setActing(null); }
  async function handleReject(id: string) { setActing(id); try { await adminApi.sa.rejectAction?.(id, 'Rejected'); await loadSidebar(); } catch {} setActing(null); }
  async function handleApproveReport(id: string) { setActing(id); try { await adminApi.sa.approveReport?.(id); await loadSidebar(); } catch {} setActing(null); }

  const info = getAgentInfo(activeAgent);
  const pendingCount = actions.filter(a => a.status === 'pending_approval').length;

  // Update conversation for active agent
  function updateMessages(msgs: Message[]) {
    setConversations(prev => ({ ...prev, [activeAgent]: msgs }));
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      {/* LEFT: Agent list panel */}
      <div style={{ width: 220, borderLeft: '1px solid rgba(0,0,0,.06)', background: '#fff', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '14px 12px 8px', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>الفريق</h2>
        </div>
        {AGENTS.map(a => {
          const isActive = activeAgent === a.type;
          const specActive = activeAgent === a.spec;
          const msgs = conversations[a.type] || [];
          const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
          return (
            <div key={a.type}>
              {/* Manager */}
              <button onClick={() => setActiveAgent(a.type)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: 'none', background: isActive ? `${a.color}08` : 'transparent', cursor: 'pointer', borderRight: isActive ? `3px solid ${a.color}` : '3px solid transparent', transition: 'all .1s' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{a.icon}</span>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? a.color : '#1a1a2e' }}>{a.name}</span>
                    <span style={{ fontSize: 9, color: '#9ca3af' }}>{a.role}</span>
                    {msgs.length > 0 && !isActive && <div style={{ width: 5, height: 5, borderRadius: '50%', background: a.color, marginRight: 'auto', flexShrink: 0 }} />}
                    {a.type === 'meeting_room' && pendingCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, marginRight: 'auto', flexShrink: 0 }}>{pendingCount}</span>}
                  </div>
                  {lastMsg && <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastMsg.content.slice(0, 40)}</p>}
                </div>
              </button>
              {/* Specialist (always visible, indented) */}
              {a.spec && (
                <button onClick={() => setActiveAgent(a.spec!)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px 6px 28px', border: 'none', background: specActive ? `${a.color}08` : 'transparent', cursor: 'pointer', borderRight: specActive ? `3px solid ${a.color}` : '3px solid transparent', transition: 'all .1s' }}>
                  <span style={{ fontSize: 13 }}>{a.specIcon}</span>
                  <span style={{ fontSize: 10, color: specActive ? a.color : '#9ca3af', fontWeight: specActive ? 600 : 400 }}>{a.specName}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* CENTER: Active chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AgentChat
          agentType={activeAgent}
          agentName={`${info.icon} ${info.name}`}
          agentIcon={info.icon}
          accentColor={info.color}
          quickActions={info.quickActions || []}
          messages={conversations[activeAgent] || []}
          onMessagesChange={updateMessages}
          compact={false}
        />
      </div>

      {/* RIGHT: Sidebar */}
      {sidebarOpen && (
        <div style={{ width: 300, borderRight: '1px solid rgba(0,0,0,.06)', background: '#fafafa', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,.04)', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setSidebarTab('actions')} style={{ flex: 1, padding: '6px', borderRadius: 6, fontSize: 10, fontWeight: sidebarTab === 'actions' ? 700 : 400, border: `1px solid ${sidebarTab === 'actions' ? '#7c5cfc' : 'rgba(0,0,0,.06)'}`, background: sidebarTab === 'actions' ? 'rgba(124,92,252,.06)' : '#fff', color: sidebarTab === 'actions' ? '#7c5cfc' : '#9ca3af', cursor: 'pointer' }}>
                مهام {pendingCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '0 4px', fontSize: 8, marginRight: 2 }}>{pendingCount}</span>}
              </button>
              <button onClick={() => setSidebarTab('reports')} style={{ flex: 1, padding: '6px', borderRadius: 6, fontSize: 10, fontWeight: sidebarTab === 'reports' ? 700 : 400, border: `1px solid ${sidebarTab === 'reports' ? '#7c5cfc' : 'rgba(0,0,0,.06)'}`, background: sidebarTab === 'reports' ? 'rgba(124,92,252,.06)' : '#fff', color: sidebarTab === 'reports' ? '#7c5cfc' : '#9ca3af', cursor: 'pointer' }}>
                تقارير ({reports.length})
              </button>
            </div>
          </div>

          <div style={{ padding: '8px 10px' }}>
            {sidebarTab === 'actions' && actions.map(a => {
              const st = STATUS_MAP[a.status] || STATUS_MAP.pending_approval;
              return (
                <div key={a.id} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', marginBottom: 6, border: '1px solid rgba(0,0,0,.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#1a1a2e', margin: '0 0 2px' }}>{a.title}</p>
                  {a.result && <p style={{ fontSize: 9, color: '#059669', margin: '2px 0' }}>{a.result?.slice(0, 80)}</p>}
                  {a.status === 'pending_approval' && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      <button onClick={() => handleApprove(a.id)} disabled={acting === a.id} style={{ flex: 1, padding: '4px', borderRadius: 5, fontSize: 9, fontWeight: 600, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer' }}>موافقة</button>
                      <button onClick={() => handleReject(a.id)} disabled={acting === a.id} style={{ flex: 1, padding: '4px', borderRadius: 5, fontSize: 9, fontWeight: 600, border: '1px solid #fecaca', background: '#fff', color: '#ef4444', cursor: 'pointer' }}>رفض</button>
                    </div>
                  )}
                </div>
              );
            })}
            {sidebarTab === 'actions' && actions.length === 0 && <p style={{ textAlign: 'center', fontSize: 10, color: '#9ca3af', padding: 16 }}>لا توجد مهام</p>}

            {sidebarTab === 'reports' && reports.map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
              return (
                <div key={r.id} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', marginBottom: 6, border: '1px solid rgba(0,0,0,.04)' }}>
                  <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                  <h4 style={{ fontSize: 11, fontWeight: 600, color: '#1a1a2e', margin: '4px 0 2px' }}>{r.title}</h4>
                  <p style={{ fontSize: 9, color: '#6b7280', margin: '0 0 6px', maxHeight: 40, overflow: 'hidden' }}>{r.summary?.slice(0, 120)}</p>
                  {r.status === 'pending' && (
                    <button onClick={() => handleApproveReport(r.id)} disabled={acting === r.id} style={{ width: '100%', padding: '5px', borderRadius: 5, fontSize: 10, fontWeight: 600, border: 'none', background: '#7c5cfc', color: '#fff', cursor: 'pointer' }}>اعتماد</button>
                  )}
                </div>
              );
            })}
            {sidebarTab === 'reports' && reports.length === 0 && <p style={{ textAlign: 'center', fontSize: 10, color: '#9ca3af', padding: 16 }}>لا توجد تقارير</p>}
          </div>
        </div>
      )}

      {/* Sidebar toggle (floating) */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{ position: 'fixed', bottom: 16, left: 16, width: 32, height: 32, borderRadius: '50%', background: '#7c5cfc', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, boxShadow: '0 2px 8px rgba(124,92,252,.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {sidebarOpen ? '→' : '←'}
      </button>
    </div>
  );
}
