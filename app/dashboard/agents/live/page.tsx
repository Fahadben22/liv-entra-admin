'use client';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import Icon from '@/components/Icon';

// ─── Shared maps ─────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending_approval: { label: 'انتظار موافقة', color: '#f59e0b', bg: '#fffbeb' },
  approved:         { label: 'معتمد',          color: '#10b981', bg: '#ecfdf5' },
  in_progress:      { label: 'قيد التنفيذ',    color: '#3b82f6', bg: '#eff6ff' },
  done:             { label: 'منجز',            color: '#059669', bg: '#f0fdf4' },
  blocked:          { label: 'مرفوض',           color: '#ef4444', bg: '#fef2f2' },
  pending:          { label: 'معلق',            color: '#f59e0b', bg: '#fffbeb' },
};
const AGENT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  reea:        { label: 'REEA',     color: '#7c3aed', bg: '#f5f3ff' },
  collections: { label: 'تحصيل',   color: '#dc2626', bg: '#fef2f2' },
  leasing:     { label: 'تأجير',   color: '#2563eb', bg: '#eff6ff' },
  maintenance: { label: 'صيانة',   color: '#d97706', bg: '#fffbeb' },
  renewals:    { label: 'تجديد',   color: '#059669', bg: '#ecfdf5' },
  onboarding:  { label: 'استقبال', color: '#0891b2', bg: '#ecfeff' },
};
const DIR_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'بانتظار الرد', color: '#f59e0b' },
  replied: { label: 'تم الرد',      color: '#10b981' },
  failed:  { label: 'فشل',          color: '#ef4444' },
};
function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'الآن';
  if (sec < 3600) return `${Math.floor(sec / 60)}د`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}س`;
  return `${Math.floor(sec / 86400)}ي`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatPill({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 10, padding: '7px 14px' }}>
      {pulse && value > 0 && (
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, animation: 'livePulse 1.6s infinite' }} />
      )}
      <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function ColHeader({ title, count, color, icon }: { title: string; count: number; color: string; icon: string }) {
  return (
    <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon name={icon as any} size={16} color={color} />
      <span style={{ fontSize: 13, fontWeight: 700, color: '#1f2733' }}>{title}</span>
      {count > 0 && (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: color, color: '#fff', marginRight: 4 }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LivePage() {
  const [reports, setReports]         = useState<any[]>([]);
  const [actions, setActions]         = useState<any[]>([]);
  const [directives, setDirectives]   = useState<any[]>([]);
  const [acting, setActing]           = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadData = useCallback(async () => {
    const [r, a, d] = await Promise.allSettled([
      adminApi.sa.getMeetingReports?.(),
      adminApi.sa.getMeetingActions?.(),
      adminApi.sa.getLiveDirectives?.(),
    ]);
    if (r.status === 'fulfilled') setReports((r.value as any)?.data || []);
    if (a.status === 'fulfilled') setActions((a.value as any)?.data || []);
    if (d.status === 'fulfilled') setDirectives(((d.value as any)?.data || []));
    setLastUpdated(new Date());
  }, []);

  useEffect(() => { loadData(); const iv = setInterval(loadData, 20000); return () => clearInterval(iv); }, [loadData]);

  async function handleApprove(id: string) {
    setActing(id);
    try { await adminApi.sa.approveAction?.(id); await loadData(); } catch {} setActing(null);
  }
  async function handleReject(id: string) {
    setActing(id);
    try { await adminApi.sa.rejectAction?.(id, 'Rejected'); await loadData(); } catch {} setActing(null);
  }
  async function handleApproveReport(id: string) {
    setActing(id);
    try { await adminApi.sa.approveReport?.(id); await loadData(); } catch {} setActing(null);
  }

  const pendingActions  = actions.filter(a => a.status === 'pending_approval');
  const pendingReports  = reports.filter(r => r.status === 'pending');
  const pendingDirs     = directives.filter(d => d.status === 'pending');
  const completedToday  = actions.filter(a => a.status === 'done').length;

  return (
    <div style={{ height: 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Stats bar ── */}
      <div style={{ flexShrink: 0, padding: '10px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e', animation: 'livePulse 1.8s infinite', display: 'inline-block' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>مباشر</span>
        </div>
        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
        <StatPill label="توجيهات بانتظار رد"   value={pendingDirs.length}    color="#7c3aed" pulse />
        <StatPill label="مهام بانتظار موافقة"  value={pendingActions.length} color="#ef4444" pulse />
        <StatPill label="تقارير معلقة"         value={pendingReports.length} color="#f59e0b" />
        <StatPill label="منجزة اليوم"          value={completedToday}        color="#10b981" />
        <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="refresh" size={12} color="#9ca3af" />
          <span style={{ fontSize: 10, color: '#9ca3af' }}>
            آخر تحديث {lastUpdated.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · كل 20 ثانية
          </span>
        </div>
      </div>

      {/* ── Three-column grid ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', minHeight: 0, overflow: 'hidden' }}>

        {/* ── Column 1: Live Directives Feed ── */}
        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', overflow: 'hidden' }}>
          <ColHeader title="بث مباشر — تواصل الوكلاء" count={directives.length} color="#7c3aed" icon="zap" />
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {directives.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: '#9ca3af' }}>
                <Icon name="message" size={28} color="#d1d5db" />
                <span style={{ fontSize: 12 }}>لا يوجد تواصل نشط الآن</span>
                <span style={{ fontSize: 10, opacity: .6 }}>ستظهر هنا الأوامر والردود</span>
              </div>
            )}
            {pendingDirs.length > 0 && (
              <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', animation: 'livePulse 1.4s infinite', display: 'inline-block' }} />
                {pendingDirs.length} بانتظار رد الوكيل
              </div>
            )}
            {directives.map(d => {
              const from = AGENT_STYLE[d.from_agent] || { label: d.from_agent, color: '#6b7280', bg: '#f9fafb' };
              const to   = AGENT_STYLE[d.to_agent]   || { label: d.to_agent,   color: '#6b7280', bg: '#f9fafb' };
              const st   = DIR_STATUS[d.status] || DIR_STATUS.pending;
              const isPending = d.status === 'pending';
              return (
                <div key={d.id} style={{ background: 'var(--surface)', borderRadius: 10, padding: '11px 13px', border: isPending ? '1px solid rgba(239,68,68,.22)' : '1px solid rgba(0,0,0,.05)', borderRight: `3px solid ${from.color}`, opacity: isPending ? 1 : 0.85 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    {isPending && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'livePulse 1.4s infinite', flexShrink: 0 }} />}
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: from.color, background: from.bg, padding: '2px 7px', borderRadius: 5 }}>{from.label}</span>
                    <span style={{ fontSize: 10, color: '#c4cdd6' }}>←</span>
                    <span style={{ fontSize: 9.5, fontWeight: 600, color: to.color, background: to.bg, padding: '2px 7px', borderRadius: 5 }}>{to.label}</span>
                    <span style={{ marginRight: 'auto', fontSize: 9, color: '#b0bec8' }}>{timeAgo(d.created_at)}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-1)', margin: '0 0 6px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.directive}</p>
                  {d.reply && (
                    <div style={{ background: '#f5f8ff', border: `1px solid ${to.color}30`, borderRight: `2px solid ${to.color}`, borderRadius: 7, padding: '7px 10px', marginTop: 4 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: to.color, marginBottom: 3 }}>رد {to.label} · {d.replied_at ? timeAgo(d.replied_at) : ''}</div>
                      <p style={{ fontSize: 11, color: '#374151', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{d.reply}</p>
                    </div>
                  )}
                  <div style={{ marginTop: 5, textAlign: 'left' }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: st.color, background: `${st.color}15`, padding: '1px 7px', borderRadius: 4 }}>{st.label}</span>
                  </div>
                </div>
              );
            })}
            {directives.length > 0 && (
              <p style={{ textAlign: 'center', fontSize: 9, color: '#d1d5db', marginTop: 4 }}>معلّق + آخر 24 ساعة</p>
            )}
          </div>
        </div>

        {/* ── Column 2: Actions Queue ── */}
        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', overflow: 'hidden' }}>
          <ColHeader title="مهام تحتاج قراراً" count={pendingActions.length} color="#2563EB" icon="check-circle" />
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {actions.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: '#9ca3af' }}>
                <Icon name="check-circle" size={28} color="#d1d5db" />
                <span style={{ fontSize: 12 }}>لا توجد مهام معلقة</span>
              </div>
            )}
            {/* Pending first */}
            {pendingActions.map(a => (
              <div key={a.id} style={{ background: 'var(--surface)', borderRadius: 10, padding: '11px 12px', border: '1px solid rgba(239,68,68,.18)', borderRight: '3px solid #ef4444' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'livePulse 1.6s infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', background: '#fffbeb', padding: '1px 7px', borderRadius: 4 }}>انتظار موافقة</span>
                </div>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 3px', lineHeight: 1.5 }}>{a.title}</p>
                {a.description && <p style={{ fontSize: 10.5, color: '#6b7280', margin: '0 0 8px', lineHeight: 1.5 }}>{a.description?.slice(0, 100)}</p>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleApprove(a.id)} disabled={acting === a.id}
                    style={{ flex: 1, padding: '6px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', opacity: acting === a.id ? .5 : 1 }}>
                    موافقة
                  </button>
                  <button onClick={() => handleReject(a.id)} disabled={acting === a.id}
                    style={{ flex: 1, padding: '6px', borderRadius: 7, fontSize: 11, fontWeight: 600, border: '1px solid #fecaca', background: 'var(--surface)', color: '#ef4444', cursor: 'pointer', opacity: acting === a.id ? .5 : 1 }}>
                    رفض
                  </button>
                </div>
              </div>
            ))}
            {/* Completed / in-progress */}
            {actions.filter(a => a.status !== 'pending_approval').map(a => {
              const st = STATUS_MAP[a.status] || STATUS_MAP.pending;
              return (
                <div key={a.id} style={{ background: 'var(--surface)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(0,0,0,.05)', opacity: 0.75 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: st.color, background: st.bg, padding: '1px 7px', borderRadius: 4 }}>{st.label}</span>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', margin: '5px 0 2px', lineHeight: 1.5 }}>{a.title}</p>
                  {a.result && <p style={{ fontSize: 10, color: '#059669', margin: 0 }}>{a.result?.slice(0, 80)}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Column 3: Reports ── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ColHeader title={`تقارير (${reports.length})`} count={pendingReports.length} color="#f59e0b" icon="file-text" />
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reports.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: '#9ca3af' }}>
                <Icon name="file-text" size={28} color="#d1d5db" />
                <span style={{ fontSize: 12 }}>لا توجد تقارير</span>
              </div>
            )}
            {/* Pending reports first */}
            {pendingReports.map(r => (
              <div key={r.id} style={{ background: 'var(--surface)', borderRadius: 10, padding: '11px 12px', border: '1px solid rgba(245,158,11,.22)', borderRight: '3px solid #f59e0b' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', background: '#fffbeb', padding: '1px 7px', borderRadius: 4 }}>بانتظار الاعتماد</span>
                </div>
                <h4 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>{r.title}</h4>
                {r.summary && <p style={{ fontSize: 10.5, color: '#6b7280', margin: '0 0 8px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.summary}</p>}
                <button onClick={() => handleApproveReport(r.id)} disabled={acting === r.id}
                  style={{ width: '100%', padding: '6px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', opacity: acting === r.id ? .5 : 1 }}>
                  اعتماد التقرير
                </button>
              </div>
            ))}
            {/* Done reports */}
            {reports.filter(r => r.status !== 'pending').map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
              return (
                <div key={r.id} style={{ background: 'var(--surface)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(0,0,0,.05)', opacity: 0.72 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: st.color, background: st.bg, padding: '1px 7px', borderRadius: 4 }}>{st.label}</span>
                  <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', margin: '5px 0 2px' }}>{r.title}</h4>
                  {r.summary && <p style={{ fontSize: 10, color: '#9ca3af', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.summary?.slice(0, 80)}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes livePulse { 0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)} 70%{box-shadow:0 0 0 6px rgba(34,197,94,0)} 100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} }
      `}</style>
    </div>
  );
}
