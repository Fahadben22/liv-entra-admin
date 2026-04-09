'use client';
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

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'الآن';
  if (sec < 3600) return `${Math.floor(sec / 60)}د`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}س`;
  return `${Math.floor(sec / 86400)}ي`;
}

export default function MeetingRoomPage() {
  const [tab, setTab] = useState<'reports' | 'actions'>('actions');
  const [reports, setReports] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, a] = await Promise.allSettled([
      adminApi.sa.getMeetingReports(),
      adminApi.sa.getMeetingActions(),
    ]);
    if (r.status === 'fulfilled') setReports((r.value as any)?.data || []);
    if (a.status === 'fulfilled') setActions((a.value as any)?.data || []);
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
        <AgentChat agentType="meeting_room" agentName="غرفة الاجتماعات" agentIcon="🏛️" accentColor="#7c5cfc"
          quickActions={['أعطيني نظرة شاملة على كل الأقسام', 'وش KPIs اليوم؟', 'أنشئ تقرير تنفيذي', 'وش الخطط النشطة؟', 'فيه مشاكل تحتاج انتباهي؟']} />
      </div>

      {/* Right: Sidebar */}
      <div style={{ width: 360, borderRight: '1px solid rgba(0,0,0,.06)', background: '#fafafa', overflowY: 'auto', flexShrink: 0 }}>
        {/* Sidebar header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(0,0,0,.06)', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button onClick={() => setTab('actions')} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: tab === 'actions' ? 700 : 400, border: `1px solid ${tab === 'actions' ? '#7c5cfc' : 'rgba(0,0,0,.08)'}`, background: tab === 'actions' ? 'rgba(124,92,252,.06)' : '#fff', color: tab === 'actions' ? '#7c5cfc' : '#6b7280', cursor: 'pointer' }}>
              المهام {pendingActions.length > 0 && <span style={{ marginRight: 4, background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '1px 6px', fontSize: 10 }}>{pendingActions.length}</span>}
            </button>
            <button onClick={() => setTab('reports')} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: tab === 'reports' ? 700 : 400, border: `1px solid ${tab === 'reports' ? '#7c5cfc' : 'rgba(0,0,0,.08)'}`, background: tab === 'reports' ? 'rgba(124,92,252,.06)' : '#fff', color: tab === 'reports' ? '#7c5cfc' : '#6b7280', cursor: 'pointer' }}>
              التقارير ({reports.length})
            </button>
          </div>
          <button onClick={load} style={{ width: '100%', padding: '6px', borderRadius: 6, fontSize: 11, border: '1px solid rgba(0,0,0,.06)', background: '#f8f7fc', color: '#6b7280', cursor: 'pointer' }}>تحديث</button>
        </div>

        {loading && <p style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>جاري التحميل...</p>}

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
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', margin: '0 0 4px' }}>{a.title}</h4>
                  {a.description && <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 8px', lineHeight: 1.5 }}>{a.description}</p>}
                  {a.result && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#15803d', margin: '0 0 2px' }}>نتيجة التنفيذ:</p>
                      <p style={{ fontSize: 11, color: '#1a1a2e', margin: 0 }}>{a.result}</p>
                    </div>
                  )}
                  {a.blocked_reason && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#dc2626', margin: '0 0 2px' }}>سبب الرفض:</p>
                      <p style={{ fontSize: 11, color: '#1a1a2e', margin: 0 }}>{a.blocked_reason}</p>
                    </div>
                  )}
                  {a.status === 'pending_approval' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleApprove(a.id)} disabled={acting === a.id}
                        style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', opacity: acting === a.id ? 0.5 : 1 }}>
                        موافقة ✓
                      </button>
                      <button onClick={() => handleReject(a.id)} disabled={acting === a.id}
                        style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #fecaca', background: '#fff', color: '#ef4444', cursor: 'pointer', opacity: acting === a.id ? 0.5 : 1 }}>
                        رفض ✗
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
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', margin: '0 0 6px' }}>{r.title}</h4>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 10px', lineHeight: 1.6, maxHeight: 80, overflow: 'hidden' }}>{r.summary}</p>
                  {Array.isArray(r.action_items) && r.action_items.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', margin: '0 0 4px' }}>إجراءات ({r.action_items.length}):</p>
                      {r.action_items.slice(0, 3).map((ai: any, i: number) => (
                        <p key={i} style={{ fontSize: 11, color: '#6b7280', margin: '2px 0', paddingRight: 8, borderRight: '2px solid #7c5cfc' }}>
                          {ai.department}: {ai.action}
                        </p>
                      ))}
                    </div>
                  )}
                  {r.status === 'pending' && (
                    <button onClick={() => handleApproveReport(r.id)} disabled={acting === r.id}
                      style={{ width: '100%', padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#7c5cfc', color: '#fff', cursor: 'pointer', opacity: acting === r.id ? 0.5 : 1 }}>
                      اعتماد التقرير ✓
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
