'use client';
import { useState, useEffect, useCallback } from 'react';
import AgentChat, { Message } from './AgentChat';
import { adminApi } from '@/lib/api';

// ─── Morning Briefing Card ────────────────────────────────────────────────────
function MorningBriefingCard({ onAskAgent }: { onAskAgent: (agentType: string, msg: string) => void }) {
  const [briefing, setBriefing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    adminApi.sa.getTodayBriefing?.().then((r: any) => {
      const b = r?.data;
      setBriefing(b || null);
      if (b?.actions_taken?.length > 0) setExpanded(true);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleTrigger() {
    setTriggering(true);
    try {
      await adminApi.sa.triggerBriefing?.();
      setTimeout(() => {
        adminApi.sa.getTodayBriefing?.().then((r: any) => setBriefing(r?.data || null)).catch(() => {});
        setTriggering(false);
      }, 5000);
    } catch { setTriggering(false); }
  }

  const today = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const actionsCount = briefing?.actions_taken?.length || 0;

  if (loading) return null;

  return (
    <div style={{ margin: '10px 10px 0', background: '#fff', border: '1px solid rgba(37,99,235,.15)', borderRadius: 10, overflow: 'hidden' }}>
      <button onClick={() => setExpanded(!expanded)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: 'none', background: expanded ? 'rgba(37,99,235,.04)' : 'transparent', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 16 }}>☀️</span>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#1E293B', margin: 0 }}>ملخص اليوم</p>
            <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>{today}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {actionsCount > 0 && (
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: '#dcfce7', color: '#166534', fontWeight: 700 }}>
              {actionsCount} إجراء تلقائي
            </span>
          )}
          {!briefing && (
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
              لا يوجد
            </span>
          )}
          <span style={{ fontSize: 10, color: '#9ca3af' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid rgba(0,0,0,.04)' }}>
          {briefing ? (
            <>
              <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.6, margin: '10px 0 8px', whiteSpace: 'pre-wrap' }}>{briefing.content}</p>
              {actionsCount > 0 && (
                <div style={{ background: '#f0fdf4', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#166534', margin: '0 0 4px' }}>الإجراءات التلقائية:</p>
                  {briefing.actions_taken.map((a: any, i: number) => (
                    <p key={i} style={{ fontSize: 9, color: '#374151', margin: '2px 0' }}>• {a.company_name}: {a.result?.slice(0, 60)}</p>
                  ))}
                </div>
              )}
              <button
                onClick={() => onAskAgent('product', 'اشرح لي ملخص اليوم بالتفصيل وما الإجراءات التي تقترحها؟')}
                style={{ width: '100%', padding: '6px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: 'none', background: 'rgba(37,99,235,.08)', color: '#2563EB', cursor: 'pointer' }}>
                اسأل يوسف عن هذا
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 8px' }}>لا يوجد ملخص لليوم — يُنشأ تلقائياً في 7:15 صباحاً</p>
              <button onClick={handleTrigger} disabled={triggering}
                style={{ padding: '5px 16px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: '1px solid #2563EB', background: '#fff', color: '#2563EB', cursor: 'pointer' }}>
                {triggering ? 'جارٍ الإنشاء...' : 'أنشئ الآن'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Agent Registry (fixed order = spatial memory) ───────────────────────────
const AGENTS = [
  { type: 'meeting_room', name: 'الاجتماعات', icon: '🏛️', color: '#2563EB', role: 'غرفة الاجتماعات', quickActions: ['نظرة شاملة على كل الأقسام', 'KPIs اليوم', 'أنشئ تقرير تنفيذي', 'الخطط النشطة', 'مشاكل تحتاج انتباهي'] },
  { type: 'it', name: 'سالم', icon: '🛡️', color: '#3b82f6', role: 'IT', spec: 'it_specialist', specName: 'طارق', specIcon: '🔧', quickActions: ['حالة النظام', 'Cloudflare', 'أنماط الأخطاء', 'أحداث أمنية', 'SSL'] },
  { type: 'sales', name: 'خالد', icon: '💼', color: '#22c55e', role: 'مبيعات', spec: 'sales_specialist', specName: 'عمر', specIcon: '📞', quickActions: ['تجارب قريبة الانتهاء — من منهم يستحق تمديداً؟', 'عملاء خاملون — من نحتاج نبعث لهم إيميل تفعيل؟', 'خط أنابيب المبيعات', 'MRR والاشتراكات', 'ملخص الأسبوع'] },
  { type: 'marketing', name: 'نورة', icon: '📊', color: '#8b5cf6', role: 'تسويق', spec: 'marketing_specialist', specName: 'سارة', specIcon: '📱', spec2: 'design_specialist', specName2: 'ليلى', specIcon2: '🎨', quickActions: ['KPIs الأسبوع', 'الحملات', 'الزوار', 'التحويل', 'المصادر'] },
  { type: 'finance', name: 'ريم', icon: '💰', color: '#f59e0b', role: 'مالية', spec: 'finance_specialist', specName: 'ماجد', specIcon: '📋', quickActions: ['معدل التحصيل هذا الشهر لكل شركة', 'المتأخرات', 'MRR', 'المصروفات', 'التوقعات'] },
  { type: 'product', name: 'يوسف', icon: '🚀', color: '#06b6d4', role: 'منتج', spec: 'product_specialist', specName: 'لينا', specIcon: '🔍', quickActions: ['عملاء خاملون — قائمة مع توصية لكل منهم', 'شركات تواجه مشاكل تشغيلية أو مالية', 'تبني الميزات — أيها مُستخدم وأيها مهجور', 'الشركات الجديدة خلال آخر 14 يوم وحال انطلاقها', 'NPS والمغادرة'] },
];

// Specialist quick actions
const SPEC_ACTIONS: Record<string, string[]> = {
  it_specialist: ['مهامي', 'صحة النظام', 'أنماط الأخطاء'],
  sales_specialist: ['مهامي', 'تواصل مع عميل', 'الوحدات الشاغرة'],
  marketing_specialist: ['مهامي', 'التحويل', 'المصادر'],
  finance_specialist: ['مهامي', 'الفواتير', 'المتأخرات'],
  product_specialist: ['مهامي', 'التذاكر', 'الميزات'],
  design_specialist: ['مهامي', 'صمم بوست إنستجرام', 'اقترح هوية بصرية', 'كتابة نص إعلاني'],
};

function getAgentInfo(type: string) {
  const mgr = AGENTS.find(a => a.type === type);
  if (mgr) return mgr;
  const parent = AGENTS.find(a => a.spec === type);
  if (parent) return { type, name: parent.specName!, icon: parent.specIcon!, color: parent.color, role: `متخصص ${parent.role}`, quickActions: SPEC_ACTIONS[type] || ['مهامي'] };
  const parent2 = AGENTS.find(a => (a as any).spec2 === type);
  if (parent2) return { type, name: (parent2 as any).specName2!, icon: (parent2 as any).specIcon2!, color: parent2.color, role: `متخصص ${parent2.role}`, quickActions: SPEC_ACTIONS[type] || ['مهامي'] };
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

  // Switch to agent and auto-send a message (used by briefing card)
  const [pendingMessage, setPendingMessage] = useState<string>('');
  function askAgent(agentType: string, msg: string) {
    setActiveAgent(agentType);
    setPendingMessage(msg);
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      {/* LEFT: Agent list panel */}
      <div style={{ width: 240, borderLeft: '1px solid rgba(0,0,0,.06)', background: '#fff', overflowY: 'auto', flexShrink: 0 }}>
        <MorningBriefingCard onAskAgent={askAgent} />
        <div style={{ padding: '14px 12px 8px', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', margin: 0 }}>الفريق</h2>
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
                    <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? a.color : '#1E293B' }}>{a.name}</span>
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
              {/* Second specialist (e.g. design_specialist under marketing) */}
              {(a as any).spec2 && (() => {
                const spec2Active = activeAgent === (a as any).spec2;
                return (
                  <button onClick={() => setActiveAgent((a as any).spec2)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px 6px 28px', border: 'none', background: spec2Active ? `${a.color}08` : 'transparent', cursor: 'pointer', borderRight: spec2Active ? `3px solid ${a.color}` : '3px solid transparent', transition: 'all .1s' }}>
                    <span style={{ fontSize: 13 }}>{(a as any).specIcon2}</span>
                    <span style={{ fontSize: 10, color: spec2Active ? a.color : '#9ca3af', fontWeight: spec2Active ? 600 : 400 }}>{(a as any).specName2}</span>
                  </button>
                );
              })()}
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
          pendingMessage={pendingMessage}
        />
      </div>

      {/* RIGHT: Sidebar */}
      {sidebarOpen && (
        <div style={{ width: 300, borderRight: '1px solid rgba(0,0,0,.06)', background: '#fafafa', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,.04)', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setSidebarTab('actions')} style={{ flex: 1, padding: '6px', borderRadius: 6, fontSize: 10, fontWeight: sidebarTab === 'actions' ? 700 : 400, border: `1px solid ${sidebarTab === 'actions' ? '#2563EB' : 'rgba(0,0,0,.06)'}`, background: sidebarTab === 'actions' ? 'rgba(124,92,252,.06)' : '#fff', color: sidebarTab === 'actions' ? '#2563EB' : '#9ca3af', cursor: 'pointer' }}>
                مهام {pendingCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '0 4px', fontSize: 8, marginRight: 2 }}>{pendingCount}</span>}
              </button>
              <button onClick={() => setSidebarTab('reports')} style={{ flex: 1, padding: '6px', borderRadius: 6, fontSize: 10, fontWeight: sidebarTab === 'reports' ? 700 : 400, border: `1px solid ${sidebarTab === 'reports' ? '#2563EB' : 'rgba(0,0,0,.06)'}`, background: sidebarTab === 'reports' ? 'rgba(124,92,252,.06)' : '#fff', color: sidebarTab === 'reports' ? '#2563EB' : '#9ca3af', cursor: 'pointer' }}>
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
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', margin: '0 0 2px' }}>{a.title}</p>
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
                  <h4 style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', margin: '4px 0 2px' }}>{r.title}</h4>
                  <p style={{ fontSize: 9, color: '#6b7280', margin: '0 0 6px', maxHeight: 40, overflow: 'hidden' }}>{r.summary?.slice(0, 120)}</p>
                  {r.status === 'pending' && (
                    <button onClick={() => handleApproveReport(r.id)} disabled={acting === r.id} style={{ width: '100%', padding: '5px', borderRadius: 5, fontSize: 10, fontWeight: 600, border: 'none', background: '#2563EB', color: '#fff', cursor: 'pointer' }}>اعتماد</button>
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
        style={{ position: 'fixed', bottom: 16, left: 16, width: 32, height: 32, borderRadius: '50%', background: '#2563EB', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, boxShadow: '0 2px 8px rgba(124,92,252,.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {sidebarOpen ? '→' : '←'}
      </button>
    </div>
  );
}
