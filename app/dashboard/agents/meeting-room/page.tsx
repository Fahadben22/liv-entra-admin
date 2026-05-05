'use client';
// v2 — live feed tab
import { useState, useEffect, useCallback } from 'react';
import AgentChat from '../AgentChat';
import { adminApi } from '@/lib/api';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending_approval: { label: 'بانتظار الموافقة', color: '#f59e0b', bg: '#fffbeb' },
  approved:         { label: 'تمت الموافقة', color: '#10b981', bg: '#ecfdf5' },
  in_progress:      { label: 'قيد التنفيذ', color: '#3b82f6', bg: '#eff6ff' },
  done:             { label: 'منجز', color: '#059669', bg: '#f0fdf4' },
  blocked:          { label: 'محظور', color: '#ef4444', bg: '#fef2f2' },
  pending:          { label: 'معلق', color: '#f59e0b', bg: '#fffbeb' },
  rejected:         { label: 'مرفوض', color: '#ef4444', bg: '#fef2f2' },
};

const DEPT_AR: Record<string, string> = { it: 'IT', sales: 'مبيعات', marketing: 'تسويق', finance: 'مالية', product: 'منتج' };

const AGENT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  reea:        { label: 'REEA',        color: '#7c3aed', bg: '#f5f3ff' },
  collections: { label: 'تحصيل',       color: '#dc2626', bg: '#fef2f2' },
  leasing:     { label: 'تأجير',       color: '#2563eb', bg: '#eff6ff' },
  maintenance: { label: 'صيانة',       color: '#d97706', bg: '#fffbeb' },
  renewals:    { label: 'تجديد',       color: '#059669', bg: '#ecfdf5' },
  onboarding:  { label: 'استقبال',     color: '#0891b2', bg: '#ecfeff' },
};

const DIRECTIVE_STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: 'بانتظار الرد', color: '#f59e0b' },
  replied:  { label: 'تم الرد',      color: '#10b981' },
  failed:   { label: 'فشل',          color: '#ef4444' },
};

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'الآن';
  if (sec < 3600) return `${Math.floor(sec / 60)}د`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}س`;
  return `${Math.floor(sec / 86400)}ي`;
}

export default function MeetingRoomPage() {
  const [tab, setTab] = useState<'actions' | 'reports' | 'feed'>('feed');
  const [reports, setReports]       = useState<any[]>([]);
  const [actions, setActions]       = useState<any[]>([]);
  const [directives, setDirectives] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    const [r, a, d] = await Promise.allSettled([
      adminApi.sa.getMeetingReports(),
      adminApi.sa.getMeetingActions(),
      adminApi.sa.getLiveDirectives(),
    ]);
    if (r.status === 'fulfilled') setReports((r.value as any)?.data || []);
    if (a.status === 'fulfilled') setActions((a.value as any)?.data || []);
    if (d.status === 'fulfilled') setDirectives((d.value as any)?.data || []);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const iv = setInterval(load, 30000); return () => clearInterval(iv); }, [load]);

  async function handleApprove(id: string) {
    setActing(id);
    try {
      await adminApi.sa.approveAction(id);
      await load();
    } catch {}
    setActing(null);
  }

  async function handleReject(id: string) {
    setActing(id);
    try {
      await adminApi.sa.rejectAction(id, 'Rejected by admin');
      await load();
    } catch {}
    setActing(null);
  }

  async function handleApproveReport(id: string) {
    setActing(id);
    try {
      await adminApi.sa.approveReport(id);
      await load();
    } catch {}
    setActing(null);
  }

  const pendingActions = actions.filter(a => a.status === 'pending_approval');

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Left: Chat */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <AgentChat agentType="meeting_room" agentName="غرفة الاجتماعات" agentIcon="users" accentColor="#2563EB"
          quickActions={['أعطيني نظرة شاملة على كل الأقسام', 'وش KPIs اليوم؟', 'أنشئ تقرير تنفيذي', 'وش الخطط النشطة؟', 'فيه مشاكل تحتاج انتباهي؟']} />
      </div>

      {/* Right: Sidebar */}
      <div style={{ width: 360, borderRight: '1px solid rgba(0,0,0,.06)', background: '#fafafa', overflowY: 'auto', flexShrink: 0 }}>
        {/* Sidebar header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(0,0,0,.06)', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button onClick={() => setTab('feed')} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: tab === 'feed' ? 700 : 400, border: `1px solid ${tab === 'feed' ? '#7c3aed' : 'rgba(0,0,0,.08)'}`, background: tab === 'feed' ? 'rgba(124,58,237,.07)' : '#fff', color: tab === 'feed' ? '#7c3aed' : '#6b7280', cursor: 'pointer' }}>
              مباشر <span style={{ fontSize: 10, opacity: .7 }}>({directives.length})</span>
            </button>
            <button onClick={() => setTab('actions')} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: tab === 'actions' ? 700 : 400, border: `1px solid ${tab === 'actions' ? '#2563EB' : 'rgba(0,0,0,.08)'}`, background: tab === 'actions' ? 'rgba(37,99,235,.06)' : '#fff', color: tab === 'actions' ? '#2563EB' : '#6b7280', cursor: 'pointer' }}>
              المهام {pendingActions.length > 0 && <span style={{ marginRight: 3, background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '1px 5px', fontSize: 10 }}>{pendingActions.length}</span>}
            </button>
            <button onClick={() => setTab('reports')} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: tab === 'reports' ? 700 : 400, border: `1px solid ${tab === 'reports' ? '#2563EB' : 'rgba(0,0,0,.08)'}`, background: tab === 'reports' ? 'rgba(37,99,235,.06)' : '#fff', color: tab === 'reports' ? '#2563EB' : '#6b7280', cursor: 'pointer' }}>
              التقارير ({reports.length})
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={load} style={{ flex: 1, padding: '6px', borderRadius: 6, fontSize: 11, border: '1px solid rgba(0,0,0,.06)', background: '#F1F5F9', color: '#6b7280', cursor: 'pointer' }}>تحديث</button>
            <span style={{ fontSize: 10, color: '#d1d5db', whiteSpace: 'nowrap' }}>آخر تحديث: {lastRefresh.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {loading && <p style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>جاري التحميل...</p>}

        {/* Live Feed Tab */}
        {tab === 'feed' && !loading && (
          <div style={{ padding: '12px 14px' }}>
            {directives.length === 0 && (
              <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', padding: 30, lineHeight: 1.7 }}>
                لا يوجد تواصل بين الوكلاء في آخر 24 ساعة<br />
                <span style={{ fontSize: 11, opacity: .6 }}>سيظهر هنا كل أمر وكل رد في الوقت الفعلي</span>
              </p>
            )}
            {directives.map((d, idx) => {
              const from = AGENT_STYLE[d.from_agent] || { label: d.from_agent, color: '#6b7280', bg: '#f9fafb' };
              const to   = AGENT_STYLE[d.to_agent]   || { label: d.to_agent,   color: '#6b7280', bg: '#f9fafb' };
              const st   = DIRECTIVE_STATUS[d.status] || DIRECTIVE_STATUS.pending;
              const isFirst = idx === 0 || new Date(directives[idx - 1].created_at).toDateString() !== new Date(d.created_at).toDateString();
              return (
                <div key={d.id}>
                  {isFirst && (
                    <div style={{ textAlign: 'center', margin: '8px 0', fontSize: 10, color: '#d1d5db' }}>
                      {new Date(d.created_at).toLocaleDateString('ar-SA', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </div>
                  )}
                  <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', marginBottom: 8, border: '1px solid rgba(0,0,0,.06)', borderRight: `3px solid ${from.color}` }}>
                    {/* Header: from → to + time */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: from.color, background: from.bg, padding: '2px 7px', borderRadius: 5 }}>{from.label}</span>
                        <span style={{ fontSize: 10, color: '#d1d5db' }}>←</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: to.color, background: to.bg, padding: '2px 7px', borderRadius: 5 }}>{to.label}</span>
                      </div>
                      <span style={{ fontSize: 10, color: '#d1d5db' }}>{timeAgo(d.created_at)}</span>
                    </div>
                    {/* Directive text */}
                    <p style={{ fontSize: 12, color: '#1e293b', margin: '0 0 8px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.directive}</p>
                    {/* Reply bubble */}
                    {d.reply && (
                      <div style={{ background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: 8, padding: '8px 10px', marginTop: 6, borderRight: `2px solid ${to.color}` }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: to.color, marginBottom: 4 }}>
                          رد {to.label} {d.replied_at ? `· ${timeAgo(d.replied_at)}` : ''}
                        </div>
                        <p style={{ fontSize: 11, color: '#374151', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.reply}</p>
                      </div>
                    )}
                    {/* Status footer */}
                    <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 10, color: st.color, fontWeight: 600 }}>{st.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {directives.length > 0 && (
              <p style={{ textAlign: 'center', fontSize: 10, color: '#d1d5db', margin: '8px 0 0' }}>
                يعرض آخر 24 ساعة · يتجدد كل 30 ثانية
              </p>
            )}
          </div>
        )}

        {/* Actions Tab */}
        {tab === 'actions' && !loading && (
          <div style={{ padding: '12px 14px' }}>
            {actions.length === 0 && <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', padding: 30 }}>لا توجد مهام بعد — اطلب من غرفة الاجتماعات إنشاء تقرير تنفيذي</p>}
            {actions.map(a => {
              const st = STATUS_MAP[a.status] || STATUS_MAP.pending_approval;
              return (
                <div key={a.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 10, border: '1px solid rgba(0,0,0,.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                      <span style={{ fontSize: 10, color: '#9ca3af', marginRight: 6 }}>{DEPT_AR[a.department] || a.department}</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#d1d5db' }}>{timeAgo(a.created_at)}</span>
                  </div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: '0 0 4px' }}>{a.title}</h4>
                  {a.description && <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 8px', lineHeight: 1.5 }}>{a.description}</p>}
                  {a.result && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#15803d', margin: '0 0 2px' }}>نتيجة التنفيذ:</p>
                      <p style={{ fontSize: 11, color: '#1E293B', margin: 0 }}>{a.result}</p>
                    </div>
                  )}
                  {a.blocked_reason && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#dc2626', margin: '0 0 2px' }}>سبب الرفض:</p>
                      <p style={{ fontSize: 11, color: '#1E293B', margin: 0 }}>{a.blocked_reason}</p>
                    </div>
                  )}
                  {a.status === 'pending_approval' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleApprove(a.id)} disabled={acting === a.id}
                        style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', opacity: acting === a.id ? 0.5 : 1 }}>
                        موافقة
                      </button>
                      <button onClick={() => handleReject(a.id)} disabled={acting === a.id}
                        style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #fecaca', background: '#fff', color: '#ef4444', cursor: 'pointer', opacity: acting === a.id ? 0.5 : 1 }}>
                        رفض
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Reports Tab */}
        {tab === 'reports' && !loading && (
          <div style={{ padding: '12px 14px' }}>
            {reports.length === 0 && <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', padding: 30 }}>لا توجد تقارير — اطلب "أنشئ تقرير تنفيذي"</p>}
            {reports.map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
              return (
                <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 10, border: '1px solid rgba(0,0,0,.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                    <span style={{ fontSize: 10, color: '#d1d5db' }}>{timeAgo(r.created_at)}</span>
                  </div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: '0 0 6px' }}>{r.title}</h4>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 10px', lineHeight: 1.6, maxHeight: 80, overflow: 'hidden' }}>{r.summary}</p>
                  {Array.isArray(r.action_items) && r.action_items.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', margin: '0 0 4px' }}>إجراءات ({r.action_items.length}):</p>
                      {r.action_items.slice(0, 3).map((ai: any, i: number) => (
                        <p key={i} style={{ fontSize: 11, color: '#6b7280', margin: '2px 0', paddingRight: 8, borderRight: '2px solid #2563EB' }}>
                          {ai.department}: {ai.action}
                        </p>
                      ))}
                    </div>
                  )}
                  {r.status === 'pending' && (
                    <button onClick={() => handleApproveReport(r.id)} disabled={acting === r.id}
                      style={{ width: '100%', padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#2563EB', color: '#fff', cursor: 'pointer', opacity: acting === r.id ? 0.5 : 1 }}>
                      اعتماد التقرير
                    </button>
                  )}
                  {r.status === 'approved' && r.approved_by && (
                    <p style={{ fontSize: 10, color: '#10b981', margin: 0, textAlign: 'center' }}>تم الاعتماد بواسطة {r.approved_by}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
