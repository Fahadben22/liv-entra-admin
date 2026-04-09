'use client';
import { useState, useEffect, useCallback } from 'react';
import AgentChat from './AgentChat';
import { adminApi } from '@/lib/api';

// ─── Agent Registry ──────────────────────────────────────────────────────────
const AGENTS = [
  { type: 'meeting_room', name: 'غرفة الاجتماعات', icon: '🏛️', color: '#7c5cfc', role: 'مُيسّر', quickActions: ['أعطيني نظرة شاملة على كل الأقسام', 'وش KPIs اليوم؟', 'أنشئ تقرير تنفيذي', 'وش الخطط النشطة؟', 'فيه مشاكل تحتاج انتباهي؟'] },
  { type: 'it', name: 'سالم', icon: '🛡️', color: '#3b82f6', role: 'مدير IT', specialist: { type: 'it_specialist', name: 'طارق', icon: '🔧' }, quickActions: ['ما حالة النظام الآن؟', 'ما حالة Cloudflare؟', 'أنماط الأخطاء', 'أحداث أمنية', 'افحص SSL'] },
  { type: 'sales', name: 'خالد', icon: '💼', color: '#22c55e', role: 'مدير المبيعات', specialist: { type: 'sales_specialist', name: 'عمر', icon: '📞' }, quickActions: ['أفضل عميل للتواصل؟', 'كم MRR؟', 'التجارب المنتهية', 'ملخص الأسبوع', 'خط الأنابيب'] },
  { type: 'marketing', name: 'نورة', icon: '📊', color: '#8b5cf6', role: 'مديرة التسويق', specialist: { type: 'marketing_specialist', name: 'سارة', icon: '📱' }, quickActions: ['KPIs الأسبوع', 'أداء الحملات', 'زوار الموقع', 'قمع التحويل', 'مصادر العملاء'] },
  { type: 'finance', name: 'ريم', icon: '💰', color: '#f59e0b', role: 'مديرة المالية', specialist: { type: 'finance_specialist', name: 'ماجد', icon: '📋' }, quickActions: ['كم MRR؟', 'تقرير الفواتير', 'المتأخرات', 'المصروفات', 'توقعات الإيرادات'] },
  { type: 'product', name: 'يوسف', icon: '🚀', color: '#06b6d4', role: 'مدير المنتج', specialist: { type: 'product_specialist', name: 'لينا', icon: '🔍' }, quickActions: ['تبني الميزات', 'تذاكر مفتوحة', 'تحليل المغادرة', 'NPS', 'خريطة الطريق'] },
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending_approval: { label: 'بانتظار الموافقة', color: '#f59e0b', bg: '#fffbeb' },
  approved: { label: 'تمت الموافقة', color: '#10b981', bg: '#ecfdf5' },
  in_progress: { label: 'قيد التنفيذ', color: '#3b82f6', bg: '#eff6ff' },
  done: { label: 'منجز', color: '#059669', bg: '#f0fdf4' },
  blocked: { label: 'محظور', color: '#ef4444', bg: '#fef2f2' },
  pending: { label: 'معلق', color: '#f59e0b', bg: '#fffbeb' },
};

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'الآن';
  if (sec < 3600) return `${Math.floor(sec / 60)}د`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}س`;
  return `${Math.floor(sec / 86400)}ي`;
}

export default function AgentsWorkspace() {
  const [activeAgent, setActiveAgent] = useState('meeting_room');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [specDropdown, setSpecDropdown] = useState<string | null>(null);

  // Meeting room sidebar data
  const [reports, setReports] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'actions' | 'reports'>('actions');
  const [acting, setActing] = useState<string | null>(null);

  const loadSidebar = useCallback(async () => {
    const [r, a] = await Promise.allSettled([
      adminApi.sa.getMeetingReports?.(),
      adminApi.sa.getMeetingActions?.(),
    ]);
    if (r.status === 'fulfilled') setReports((r.value as any)?.data || []);
    if (a.status === 'fulfilled') setActions((a.value as any)?.data || []);
  }, []);

  useEffect(() => { loadSidebar(); }, [loadSidebar]);
  useEffect(() => { const iv = setInterval(loadSidebar, 30000); return () => clearInterval(iv); }, [loadSidebar]);

  async function handleApprove(id: string) {
    setActing(id);
    try { await adminApi.sa.approveAction?.(id); await loadSidebar(); } catch {}
    setActing(null);
  }
  async function handleReject(id: string) {
    setActing(id);
    try { await adminApi.sa.rejectAction?.(id, 'Rejected'); await loadSidebar(); } catch {}
    setActing(null);
  }
  async function handleApproveReport(id: string) {
    setActing(id);
    try { await adminApi.sa.approveReport?.(id); await loadSidebar(); } catch {}
    setActing(null);
  }

  const current = AGENTS.find(a => a.type === activeAgent) || AGENTS.find(a => a.specialist?.type === activeAgent) || AGENTS[0];
  const isSpecialist = AGENTS.some(a => a.specialist?.type === activeAgent);
  const currentSpec = AGENTS.find(a => a.specialist?.type === activeAgent);
  const displayAgent = isSpecialist
    ? { type: activeAgent, name: currentSpec?.specialist?.name || '', icon: currentSpec?.specialist?.icon || '', color: currentSpec?.color || '#6b7280', role: 'متخصص', quickActions: ['وش مهامي؟'] }
    : current;

  const pendingCount = actions.filter(a => a.status === 'pending_approval').length;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Agent tabs bar */}
        <div style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,.06)', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', flexShrink: 0, height: 52 }}>
          {AGENTS.map(a => {
            const isActive = activeAgent === a.type;
            const specActive = activeAgent === a.specialist?.type;
            const highlighted = isActive || specActive;
            return (
              <div key={a.type} style={{ position: 'relative', flexShrink: 0 }}>
                <button onClick={() => { setActiveAgent(a.type); setSpecDropdown(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10,
                    border: `1.5px solid ${highlighted ? a.color : 'rgba(0,0,0,.06)'}`,
                    background: highlighted ? `${a.color}10` : '#fff',
                    color: highlighted ? a.color : '#6b7280',
                    fontSize: 12, fontWeight: highlighted ? 700 : 500, cursor: 'pointer',
                    transition: 'all .15s', whiteSpace: 'nowrap',
                  }}>
                  <span style={{ fontSize: 16 }}>{a.icon}</span>
                  <span>{a.name}</span>
                  {a.type === 'meeting_room' && pendingCount > 0 && (
                    <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{pendingCount}</span>
                  )}
                </button>

                {/* Specialist dropdown */}
                {a.specialist && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setSpecDropdown(specDropdown === a.type ? null : a.type); }}
                      style={{ position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: specActive ? a.color : '#e2e8f0', border: 'none', cursor: 'pointer', fontSize: 7, color: specActive ? '#fff' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ▼
                    </button>
                    {specDropdown === a.type && (
                      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.12)', border: '1px solid rgba(0,0,0,.06)', padding: 4, zIndex: 100, whiteSpace: 'nowrap' }}>
                        <button onClick={() => { setActiveAgent(a.specialist!.type); setSpecDropdown(null); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: specActive ? `${a.color}10` : 'transparent', color: specActive ? a.color : '#6b7280', fontSize: 12, cursor: 'pointer', width: '100%' }}>
                          <span>{a.specialist.icon}</span>
                          <span>{a.specialist.name} — متخصص</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* Sidebar toggle */}
          <div style={{ marginRight: 'auto' }} />
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,.06)', background: sidebarOpen ? 'rgba(124,92,252,.06)' : '#fff', color: sidebarOpen ? '#7c5cfc' : '#9ca3af', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
            {sidebarOpen ? 'إخفاء ←' : '→ لوحة'}
          </button>
        </div>

        {/* Active agent chat */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <AgentChat
            key={activeAgent}
            agentType={activeAgent}
            agentName={`${displayAgent.icon} ${displayAgent.name} — ${displayAgent.role}`}
            agentIcon={displayAgent.icon}
            accentColor={displayAgent.color}
            quickActions={displayAgent.quickActions || []}
          />
        </div>
      </div>

      {/* Right sidebar */}
      {sidebarOpen && (
        <div style={{ width: 340, borderRight: '1px solid rgba(0,0,0,.06)', background: '#fafafa', overflowY: 'auto', flexShrink: 0 }}>
          {/* Sidebar header */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,.06)', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setSidebarTab('actions')}
                style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 11, fontWeight: sidebarTab === 'actions' ? 700 : 400, border: `1px solid ${sidebarTab === 'actions' ? '#7c5cfc' : 'rgba(0,0,0,.06)'}`, background: sidebarTab === 'actions' ? 'rgba(124,92,252,.06)' : '#fff', color: sidebarTab === 'actions' ? '#7c5cfc' : '#6b7280', cursor: 'pointer' }}>
                المهام {pendingCount > 0 && <span style={{ marginRight: 4, background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '1px 5px', fontSize: 9 }}>{pendingCount}</span>}
              </button>
              <button onClick={() => setSidebarTab('reports')}
                style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 11, fontWeight: sidebarTab === 'reports' ? 700 : 400, border: `1px solid ${sidebarTab === 'reports' ? '#7c5cfc' : 'rgba(0,0,0,.06)'}`, background: sidebarTab === 'reports' ? 'rgba(124,92,252,.06)' : '#fff', color: sidebarTab === 'reports' ? '#7c5cfc' : '#6b7280', cursor: 'pointer' }}>
                التقارير ({reports.length})
              </button>
            </div>
          </div>

          {/* Actions tab */}
          {sidebarTab === 'actions' && (
            <div style={{ padding: '10px 12px' }}>
              {actions.length === 0 && <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', padding: 24 }}>لا توجد مهام — اطلب تقرير تنفيذي من غرفة الاجتماعات</p>}
              {actions.map(a => {
                const st = STATUS_MAP[a.status] || STATUS_MAP.pending_approval;
                return (
                  <div key={a.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: '1px solid rgba(0,0,0,.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 5, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                      <span style={{ fontSize: 9, color: '#d1d5db' }}>{timeAgo(a.created_at)}</span>
                    </div>
                    <h4 style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', margin: '0 0 3px' }}>{a.title}</h4>
                    {a.description && <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 6px', lineHeight: 1.4 }}>{a.description?.slice(0, 100)}</p>}
                    {a.result && <p style={{ fontSize: 10, color: '#059669', background: '#f0fdf4', borderRadius: 6, padding: '4px 8px', margin: '0 0 6px' }}>{a.result?.slice(0, 100)}</p>}
                    {a.status === 'pending_approval' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => handleApprove(a.id)} disabled={acting === a.id} style={{ flex: 1, padding: '5px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', opacity: acting === a.id ? .5 : 1 }}>موافقة</button>
                        <button onClick={() => handleReject(a.id)} disabled={acting === a.id} style={{ flex: 1, padding: '5px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: '1px solid #fecaca', background: '#fff', color: '#ef4444', cursor: 'pointer', opacity: acting === a.id ? .5 : 1 }}>رفض</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Reports tab */}
          {sidebarTab === 'reports' && (
            <div style={{ padding: '10px 12px' }}>
              {reports.length === 0 && <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', padding: 24 }}>لا توجد تقارير</p>}
              {reports.map(r => {
                const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
                return (
                  <div key={r.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: '1px solid rgba(0,0,0,.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 5, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                      <span style={{ fontSize: 9, color: '#d1d5db' }}>{timeAgo(r.created_at)}</span>
                    </div>
                    <h4 style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', margin: '0 0 4px' }}>{r.title}</h4>
                    <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 8px', lineHeight: 1.4, maxHeight: 60, overflow: 'hidden' }}>{r.summary?.slice(0, 150)}</p>
                    {r.status === 'pending' && (
                      <button onClick={() => handleApproveReport(r.id)} disabled={acting === r.id} style={{ width: '100%', padding: '6px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none', background: '#7c5cfc', color: '#fff', cursor: 'pointer', opacity: acting === r.id ? .5 : 1 }}>اعتماد التقرير</button>
                    )}
                    {r.status === 'approved' && <p style={{ fontSize: 9, color: '#10b981', margin: 0, textAlign: 'center' }}>تم الاعتماد</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
