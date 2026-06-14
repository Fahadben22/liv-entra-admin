'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { request } from '@/lib/api';
import {
  Brain, ShieldCheck, Layers, Network, RefreshCw,
  ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle,
  AlertOctagon, Activity, ChevronDown, ChevronUp, SlidersHorizontal,
  Radio, Server, Cpu, Trash2, MessageSquare, ChevronRight, X,
  Clock, Zap, Terminal, Eye, Award,
} from 'lucide-react';

// ── Arabic agent name map ──────────────────────────────────────────────────────
const AGENT_AR: Record<string, string> = {
  reea:                'REEA — المدير التشغيلي',
  leasing:             'دانة — التأجير',
  collections:         'بدر — التحصيل',
  ops:                 'فارس — العمليات',
  tenant_exp:          'منى — المستأجرون',
  'tenant-exp':        'منى — المستأجرون',
  owner_rel:           'نادية — الملاك',
  'owner-rel':         'نادية — الملاك',
  os_finance:          'رضا — المالية التشغيلية',
  'os-finance':        'رضا — المالية التشغيلية',
  finance:             'ريم — المالية',
  finance_specialist:  'ماجد — متخصص مالية',
  sales:               'خالد — المبيعات',
  sales_specialist:    'عمر — متخصص مبيعات',
  marketing:           'نورة — التسويق',
  marketing_specialist:'سارة — متخصصة تسويق',
  design_specialist:   'ليلى — التصميم',
  product:             'يوسف — المنتج',
  product_specialist:  'لينا — متخصصة منتج',
  it:                  'سالم — تقنية المعلومات',
  it_specialist:       'طارق — متخصص IT',
  meeting_room:        'غرفة الاجتماعات',
  'icp-router':        'ICP Router',
};

// ── Score ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const s = Math.round(Math.max(0, Math.min(100, score)));
  const color = s >= 75 ? '#059669' : s >= 50 ? '#d97706' : '#dc2626';
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const dash = (s / 100) * c;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f0f0" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
        <p style={{ fontSize: size > 56 ? 15 : 11, fontWeight: 700, color, lineHeight: 1, margin: 0 }}>{s}</p>
      </div>
    </div>
  );
}

// ── Severity helpers ───────────────────────────────────────────────────────────
function sevStyle(sev: string): { bg: string; color: string } {
  if (sev === 'critical') return { bg: '#fef2f2', color: '#dc2626' };
  if (sev === 'high')     return { bg: '#fffbeb', color: '#d97706' };
  if (sev === 'medium')   return { bg: '#eff6ff', color: '#2563eb' };
  return { bg: '#f8fafc', color: '#64748b' };
}

function impStyle(imp: string): { bg: string; color: string } {
  if (imp === 'critical') return { bg: '#fef2f2', color: '#dc2626' };
  if (imp === 'high')     return { bg: '#fffbeb', color: '#d97706' };
  if (imp === 'medium')   return { bg: '#eff6ff', color: '#2563eb' };
  return { bg: '#f0fdf4', color: '#059669' };
}

// ── Signal type labels ─────────────────────────────────────────────────────────
const SIGNAL_AR: Record<string, string> = {
  task_resolved:    'مهمة منجزة',
  task_failed:      'مهمة فاشلة',
  escalation_fired: 'تصعيد',
  complaint_closed: 'شكوى مغلقة',
  sla_breach:       'خرق SLA',
  human_override:   'تدخل بشري',
  icp_expired:      'رسالة ICP منتهية',
  simulation_result:'نتيجة محاكاة',
};

const TABS = [
  { key: 'learning', label: 'التعلم',     icon: <Activity style={{ width: 13, height: 13 }} /> },
  { key: 'agents',   label: 'الوكلاء',    icon: <ShieldCheck style={{ width: 13, height: 13 }} /> },
  { key: 'optimize', label: 'التوصيات',   icon: <Layers style={{ width: 13, height: 13 }} /> },
  { key: 'icp',      label: 'ICP',         icon: <Network style={{ width: 13, height: 13 }} /> },
  { key: 'metrics',  label: 'المؤشرات',   icon: <Activity style={{ width: 13, height: 13 }} /> },
  { key: 'controls', label: 'تحكّم',      icon: <SlidersHorizontal style={{ width: 13, height: 13 }} /> },
  { key: 'quality',  label: 'جودة الوكلاء', icon: <Award style={{ width: 13, height: 13 }} /> },
];

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AIGovPage() {
  const [tab, setTab] = useState('learning');
  const [data, setData] = useState<Record<string, any>>({
    digest: {}, clusters: [], recs: [], scorecards: [], incidents: [], conflicts: [], stalled: [], metrics: {},
  });
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // WS-1 agent system controls
  const [ctrl, setCtrl] = useState<{ agents_write_freeze: { enabled: boolean }; agents_full_pause: { enabled: boolean } }>({
    agents_write_freeze: { enabled: false },
    agents_full_pause:   { enabled: false },
  });
  const [ctrlLoading, setCtrlLoading] = useState<string | null>(null);

  const loadControls = useCallback(async () => {
    try {
      const res = await request<any>('GET', '/superadmin/system/controls');
      if (res?.data?.controls) setCtrl(res.data.controls);
    } catch {}
  }, []);

  async function toggleControl(key: 'agents_write_freeze' | 'agents_full_pause') {
    const next = !ctrl[key]?.enabled;
    setCtrlLoading(key);
    try {
      const res = await request<any>('POST', '/superadmin/system/controls', { key, enabled: next });
      if (res?.data?.value) setCtrl(prev => ({ ...prev, [key]: res.data.value }));
      showToast(res?.data?.message || (next ? 'تم التفعيل' : 'تم الإيقاف'));
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setCtrlLoading(null);
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [digestRes, clustersRes, recsRes, scorecardsRes, incidentsRes, conflictsRes, stalledRes, metricsRes] =
      await Promise.allSettled([
        request<any>('GET', '/adaptive/digest?days=7'),
        request<any>('GET', '/adaptive/clusters?limit=25'),
        request<any>('GET', '/adaptive/recommendations?limit=30'),
        request<any>('GET', '/audit/intel/scorecards'),
        request<any>('GET', '/audit/intel/incidents?status=open&limit=20'),
        request<any>('GET', '/icp/conflicts'),
        request<any>('GET', '/icp/stalled'),
        request<any>('GET', '/admin/operational-metrics'),
      ]);
    setData({
      digest:     digestRes.status     === 'fulfilled' ? digestRes.value?.data     || {} : {},
      clusters:   clustersRes.status   === 'fulfilled' ? clustersRes.value?.data?.clusters     || [] : [],
      recs:       recsRes.status       === 'fulfilled' ? recsRes.value?.data?.recommendations  || [] : [],
      scorecards: scorecardsRes.status === 'fulfilled' ? scorecardsRes.value?.data?.scorecards || [] : [],
      incidents:  incidentsRes.status  === 'fulfilled' ? incidentsRes.value?.data?.incidents   || [] : [],
      conflicts:  conflictsRes.status  === 'fulfilled' ? conflictsRes.value?.data?.conflicts   || [] : [],
      stalled:    stalledRes.status    === 'fulfilled' ? stalledRes.value?.data?.stalled       || [] : [],
      metrics:    metricsRes.status    === 'fulfilled' ? metricsRes.value?.data              || {} : {},
    });
    setLoading(false);
  }, []);

  // ── Live agent sessions state ──────────────────────────────────────────────
  const [sessions, setSessions]     = useState<any[]>([]);
  const [directives, setDirectives] = useState<any[]>([]);
  const [gateway, setGateway]       = useState<any>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [agentHistory, setAgentHistory]   = useState<any[]>([]);
  const [histLoading, setHistLoading]     = useState(false);
  const [sendMsg, setSendMsg]             = useState('');
  const [sendLoading, setSendLoading]     = useState(false);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const [sRes, dRes, gRes] = await Promise.allSettled([
        request<any>('GET', '/admin/agents/sessions'),
        request<any>('GET', '/admin/agents/directives/recent?limit=40'),
        request<any>('GET', '/admin/agents/gateway'),
      ]);
      if (sRes.status === 'fulfilled') setSessions(sRes.value?.data || []);
      if (dRes.status === 'fulfilled') setDirectives(dRes.value?.data || []);
      if (gRes.status === 'fulfilled') setGateway(gRes.value?.data || null);
    } catch {}
  }, []);

  async function loadAgentHistory(agentType: string) {
    setHistLoading(true);
    try {
      const res = await request<any>('GET', `/admin/agents/${agentType}/history`);
      setAgentHistory(res?.data || []);
    } catch { setAgentHistory([]); }
    setHistLoading(false);
  }

  async function handleClearSession(agentType: string) {
    if (!confirm(`حذف محادثة ${agentType}؟`)) return;
    try {
      await request('DELETE', `/admin/agents/${agentType}/clear`);
      showToast('تم حذف المحادثة');
      if (selectedAgent === agentType) { setAgentHistory([]); setSelectedAgent(null); }
      loadSessions();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
  }

  async function handleFlushAll() {
    if (!confirm('حذف جميع محادثات الوكلاء؟ لا يمكن التراجع.')) return;
    try {
      await request('DELETE', '/admin/agents/flush-all');
      showToast('تم مسح جميع المحادثات');
      setSessions([]); setAgentHistory([]); setSelectedAgent(null);
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
  }

  async function handleSendMessage() {
    if (!selectedAgent || !sendMsg.trim() || sendLoading) return;
    setSendLoading(true);
    try {
      await request<any>('POST', `/admin/agents/${selectedAgent}/chat`, { message: sendMsg.trim() });
      setSendMsg('');
      showToast('تم الإرسال');
      await loadAgentHistory(selectedAgent);
      loadSessions();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSendLoading(false);
  }

  useEffect(() => { loadAll(); loadControls(); }, [loadAll, loadControls]);

  // ── Quality KPI state ─────────────────────────────────────────────────────
  const [qualityData, setQualityData]       = useState<any>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityAgent, setQualityAgent]     = useState<string | null>(null);

  const loadQuality = useCallback(async () => {
    setQualityLoading(true);
    try {
      const res = await request<any>('GET', '/admin/agents/quality/scores');
      if (res?.data) setQualityData(res.data);
    } catch {}
    setQualityLoading(false);
  }, []);

  useEffect(() => { if (tab === 'quality') loadQuality(); }, [tab, loadQuality]);

  const scoreColor = (s: number | null) =>
    s == null ? '#94a3b8' : s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#dc2626';

  const relTime = (iso: string | null) => {
    if (!iso) return '—';
    const d = Date.now() - new Date(iso).getTime();
    if (d < 3600000)  return `${Math.floor(d / 60000)} د`;
    if (d < 86400000) return `${Math.floor(d / 3600000)} س`;
    return `${Math.floor(d / 86400000)} ي`;
  };

  // Auto-load sessions on tab switch; poll every 15s while tab is active
  useEffect(() => {
    if (tab === 'agents') {
      loadSessions();
      liveIntervalRef.current = setInterval(loadSessions, 15000);
    } else {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    }
    return () => { if (liveIntervalRef.current) clearInterval(liveIntervalRef.current); };
  }, [tab, loadSessions]);

  async function handleApprove(id: string, action: 'approved' | 'rejected') {
    setActing(id);
    try { await request('POST', `/adaptive/recommendations/${id}/approve`, { action }); } catch {}
    await loadAll();
    setActing(null);
  }

  async function triggerCycle() {
    setActing('cycle');
    try { await request('POST', '/adaptive/cycle'); } catch {}
    await loadAll();
    setActing(null);
  }

  const { digest, clusters, recs, scorecards, incidents, conflicts, stalled } = data;
  const sig = digest.signal_summary || {};
  const pendingRecs = recs.filter((r: any) => r.status === 'pending');

  // ── Badges for bottom tab ──────────────────────────────────────────────────
  const badges: Record<string, number> = {
    agents:   incidents.length,
    optimize: pendingRecs.length,
    icp:      conflicts.length + stalled.length,
  };

  return (
    <div style={{ padding: '16px 20px', maxWidth: 1200, margin: '0 auto', minWidth: 0 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', color: 'var(--text-1)', padding: '8px 20px', borderRadius: 10, fontSize: 12, zIndex: 9999, border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
          {toast}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain style={{ width: 20, height: 20, color: 'var(--brand-600)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>حوكمة الذكاء الاصطناعي</h1>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>مراقبة الوكلاء · التعلم التكيفي · بروتوكول ICP</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="le-btn ghost sm" onClick={loadAll} title="تحديث">
            <RefreshCw style={{ width: 13, height: 13 }} />
          </button>
          <button className="le-btn primary sm" onClick={triggerCycle} disabled={acting === 'cycle'}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity style={{ width: 13, height: 13 }} />
            {acting === 'cycle' ? 'جارٍ التعلم...' : 'تشغيل دورة التعلم'}
          </button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '9px 18px', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: tab === t.key ? 600 : 500,
              color: tab === t.key ? 'var(--brand-600)' : 'var(--text-muted)',
              background: 'transparent',
              borderBottom: tab === t.key ? '2px solid var(--brand-600)' : '2px solid transparent',
              marginBottom: -1, display: 'flex', alignItems: 'center', gap: 5, transition: 'all .12s',
            }}>
            {t.icon} {t.label}
            {badges[t.key] > 0 && (
              <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: '#dc2626', color: 'white', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                {badges[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--brand-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: LEARNING                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'learning' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Signal summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
            {[
              { label: 'إشارات تعلم (7 أيام)', value: sig.total ?? '—', color: 'var(--brand-600)', sub: 'مجموع الإشارات' },
              { label: 'نجاحات', value: sig.success ?? '—', color: '#059669', sub: 'مهام ناجحة وشكاوى مغلقة' },
              { label: 'إخفاقات', value: sig.failure ?? '—', color: '#dc2626', sub: 'مهام فاشلة ورسائل منتهية' },
              { label: 'مجموعات إخفاق', value: clusters.length, color: '#d97706', sub: 'أنماط مرصودة' },
            ].map((k, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{k.label}</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: k.color, lineHeight: 1, margin: 0 }}>{k.value}</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Signal breakdown by type */}
          {sig.by_type && Object.keys(sig.by_type).length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>تفصيل الإشارات</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 0 }}>
                {Object.entries(sig.by_type).map(([type, count]: [string, any]) => (
                  <div key={type} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', borderInlineEnd: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-1)' }}>{SIGNAL_AR[type] || type}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-600)' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active learned policies */}
          {(digest.active_policies || []).length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>سياسات مستفادة نشطة</span>
                <span className="le-badge brand">{digest.active_policies.length}</span>
              </div>
              {digest.active_policies.map((p: any, i: number) => (
                <div key={p.policy_key} style={{ padding: '12px 18px', borderBottom: i < digest.active_policies.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-1)', margin: 0 }}>{p.description_ar}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{p.category} · ثقة {p.confidence}%</p>
                  </div>
                  <div style={{ height: 4, width: 80, background: '#f0f0f0', borderRadius: 2, flexShrink: 0, marginInlineStart: 16 }}>
                    <div style={{ height: '100%', borderRadius: 2, background: p.confidence >= 75 ? '#059669' : p.confidence >= 50 ? '#d97706' : '#dc2626', width: `${p.confidence}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Post-mortems */}
          {(digest.post_mortems?.count || 0) > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>تحليلات ما بعد الحادثة</span>
                <span className="le-badge">{digest.post_mortems.count} هذا الأسبوع</span>
              </div>
              {(digest.post_mortems.items || []).slice(0, 3).map((pm: any) => (
                <div key={pm.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-1)', margin: 0 }}>{pm.title_ar}</p>
                  <span className={`le-badge ${pm.status === 'published' ? 'success' : ''}`}>{pm.status === 'published' ? 'منشور' : 'مسودة'}</span>
                </div>
              ))}
            </div>
          )}

          {sig.total === 0 && clusters.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <Activity style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>لا توجد إشارات تعلم بعد</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>تُنشئ دورة التعلم التلقائية بيانات يومياً الساعة 3:00 صباحاً</p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: AGENTS — LIVE SESSION MONITORING                              */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'agents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Gateway Health bar ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Server style={{ width: 15, height: 15, color: 'var(--brand-600)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>بوابة الوكلاء</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {gateway?.gateway_url || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  { label: 'البيئة', value: gateway?.environment || '—' },
                  { label: 'Ollama', value: gateway?.ollama_enabled ? 'مفعّل' : 'معطّل', warn: !!gateway?.ollama_enabled },
                  { label: 'تجميد الكتابة', value: gateway?.write_freeze ? 'مفعّل' : 'إيقاف', warn: !!gateway?.write_freeze },
                  { label: 'إيقاف كامل', value: gateway?.full_pause ? 'مفعّل' : 'إيقاف', warn: !!gateway?.full_pause },
                ].map(({ label, value, warn }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
                    <span style={{ fontWeight: 600, color: warn ? '#d97706' : 'var(--text-1)' }}>{value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669', boxShadow: '0 0 6px rgba(5,150,105,.5)', animation: 'pulse 2s ease-in-out infinite' }} />
                  <span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>LIVE · يتحدث كل 15 ث</span>
                </div>
              </div>
            </div>
            {/* LLM routing table */}
            {gateway?.routes && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {gateway.routes.map((r: any) => (
                  <div key={r.agent} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: 'var(--ink-100)', color: 'var(--text-muted)', display: 'flex', gap: 4 }}>
                    <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{AGENT_AR[r.agent] || r.agent}</span>
                    <span>→</span>
                    <span style={{ color: r.provider === 'anthropic' ? '#6366f1' : '#059669' }}>{r.model}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Main layout: sessions list + detail panel ── */}
          <div style={{ display: 'grid', gridTemplateColumns: selectedAgent ? '1fr 380px' : '1fr', gap: 14 }}>

            {/* Sessions list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Radio style={{ width: 14, height: 14, color: 'var(--brand-600)' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>جلسات مباشرة ({sessions.length})</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="le-btn ghost sm" onClick={loadSessions} title="تحديث">
                    <RefreshCw style={{ width: 12, height: 12 }} />
                  </button>
                  <button className="le-btn ghost sm" onClick={handleFlushAll}
                    style={{ color: '#dc2626', borderColor: '#fca5a5' }} title="مسح الكل">
                    <Trash2 style={{ width: 12, height: 12 }} />
                    <span style={{ fontSize: 11 }}>مسح الكل</span>
                  </button>
                </div>
              </div>

              {sessions.length === 0 ? (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Cpu style={{ width: 28, height: 28, margin: '0 auto 10px', opacity: 0.3 }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>لا توجد جلسات في آخر 24 ساعة</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 8 }}>
                  {sessions.map((s: any) => {
                    const isLive   = s.status === 'live';
                    const isActive = s.status === 'active';
                    const dotColor = isLive ? '#059669' : isActive ? '#d97706' : '#94a3b8';
                    const selected = selectedAgent === s.agent_type;
                    const relTime  = s.last_message_at ? (() => {
                      const diff = Date.now() - new Date(s.last_message_at).getTime();
                      if (diff < 60000) return 'الآن';
                      if (diff < 3600000) return `${Math.floor(diff/60000)} د`;
                      if (diff < 86400000) return `${Math.floor(diff/3600000)} س`;
                      return `${Math.floor(diff/86400000)} ي`;
                    })() : '—';
                    return (
                      <div key={s.agent_type}
                        onClick={() => { setSelectedAgent(s.agent_type); loadAgentHistory(s.agent_type); }}
                        style={{ background: 'var(--surface)', border: `1.5px solid ${selected ? 'var(--brand-600)' : 'var(--border)'}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s', boxShadow: selected ? '0 0 0 2px rgba(99,102,241,.1)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, boxShadow: isLive ? `0 0 6px ${dotColor}88` : 'none' }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{s.agent_name}</span>
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{relTime}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                          <span><Clock style={{ width: 9, height: 9, display: 'inline', marginInlineEnd: 2 }} />{s.messages_1h} رسالة/س</span>
                          <span><Zap style={{ width: 9, height: 9, display: 'inline', marginInlineEnd: 2 }} />{s.tool_calls_24h} أداة/24س</span>
                        </div>
                        {s.last_model && (
                          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Terminal style={{ width: 9, height: 9 }} />
                            <span style={{ color: s.last_model?.includes('claude') ? '#6366f1' : '#059669' }}>{s.last_model}</span>
                            {s.last_outcome && <span style={{ marginInlineStart: 4, padding: '1px 6px', borderRadius: 10, fontSize: 9, background: s.last_outcome === 'success' ? '#f0fdf4' : s.last_outcome === 'escalated' ? '#fffbeb' : '#fef2f2', color: s.last_outcome === 'success' ? '#059669' : s.last_outcome === 'escalated' ? '#d97706' : '#dc2626' }}>{s.last_outcome}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Recent A2A dispatches ── */}
              {directives.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Network style={{ width: 13, height: 13, color: 'var(--brand-600)' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>تمريرات A2A الأخيرة</span>
                    </div>
                    <span className="le-badge">{directives.length}</span>
                  </div>
                  <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {directives.map((d: any) => {
                      const statusColor = d.status === 'replied' ? '#059669' : d.status === 'failed' ? '#dc2626' : d.status === 'processing' ? '#d97706' : '#6366f1';
                      return (
                        <div key={d.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)' }}>{AGENT_AR[d.from_agent] || d.from_agent}</span>
                              <ChevronRight style={{ width: 10, height: 10, color: 'var(--text-muted)' }} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)' }}>{AGENT_AR[d.to_agent] || d.to_agent}</span>
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {(d.directive || '').slice(0, 80)}
                            </p>
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'end' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: statusColor + '15', color: statusColor }}>{d.status}</span>
                            <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                              {d.created_at ? new Date(d.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Session Deep Dive panel */}
            {selectedAgent && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
                {/* Panel header */}
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--ink-100)' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{AGENT_AR[selectedAgent] || selectedAgent}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      {sessions.find(s => s.agent_type === selectedAgent)?.messages_24h || 0} رسالة اليوم
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="le-btn ghost sm" onClick={() => handleClearSession(selectedAgent)}
                      title="حذف الجلسة" style={{ color: '#dc2626' }}>
                      <Trash2 style={{ width: 12, height: 12 }} />
                    </button>
                    <button className="le-btn ghost sm" onClick={() => setSelectedAgent(null)} title="إغلاق">
                      <X style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                </div>

                {/* Transcript */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {histLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
                      <div style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--brand-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                  ) : agentHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>
                      <Eye style={{ width: 20, height: 20, margin: '0 auto 8px', opacity: 0.3 }} />
                      لا توجد رسائل في الذاكرة المؤقتة
                    </div>
                  ) : agentHistory.map((m: any, i: number) => (
                    <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: 6 }}>
                      <div style={{
                        maxWidth: '85%', padding: '8px 10px', borderRadius: 10, fontSize: 11, lineHeight: 1.5,
                        background: m.role === 'user' ? 'var(--brand-600)' : 'var(--ink-100)',
                        color: m.role === 'user' ? '#fff' : 'var(--text-1)',
                      }}>
                        {(m.content || '').slice(0, 400)}{(m.content || '').length > 400 ? '…' : ''}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Send message input */}
                <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
                  <input
                    value={sendMsg}
                    onChange={e => setSendMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="أرسل رسالة للوكيل..."
                    style={{ flex: 1, fontSize: 12, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-1)', outline: 'none' }}
                  />
                  <button className="le-btn primary sm" onClick={handleSendMessage} disabled={sendLoading || !sendMsg.trim()}>
                    <MessageSquare style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: RECOMMENDATIONS                                                */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'optimize' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Failure clusters */}
          {clusters.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>مجموعات الإخفاق المرصودة</span>
                <span className="le-badge">{clusters.length}</span>
              </div>
              {clusters.map((c: any, i: number) => {
                const ss = sevStyle(c.severity);
                return (
                  <div key={c.id} style={{ padding: '13px 18px', borderBottom: i < clusters.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: 'var(--text-1)', margin: 0, marginBottom: 4 }}>{c.label_ar}</p>
                      <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-muted)' }}>
                        {c.agent_type && <span>الوكيل: {AGENT_AR[c.agent_type] || c.agent_type}</span>}
                        {c.task_category && <span>· النوع: {c.task_category}</span>}
                        <span>· آخر ظهور: {new Date(c.last_seen_at).toLocaleDateString('ar-SA')}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{c.failure_count}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: ss.bg, color: ss.color }}>{c.severity}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recommendations */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>توصيات التحسين</span>
              {pendingRecs.length > 0 && <span className="le-badge warning">{pendingRecs.length} معلّقة</span>}
            </div>
            {recs.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <CheckCircle style={{ width: 24, height: 24, color: '#059669', margin: '0 auto 8px' }} />
                <p>لا توجد توصيات — ستظهر هنا بعد أول دورة تعلم ناجحة</p>
              </div>
            ) : (
              recs.map((rec: any, i: number) => {
                const is = impStyle(rec.impact_level);
                const isExpanded = !!expanded[rec.id];
                return (
                  <div key={rec.id} style={{ borderBottom: i < recs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Title row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{rec.title_ar}</p>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: is.bg, color: is.color }}>{rec.impact_level}</span>
                          {rec.affected_agent && (
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--ink-100)', color: 'var(--text-muted)' }}>
                              {AGENT_AR[rec.affected_agent] || rec.affected_agent}
                            </span>
                          )}
                          {rec.status !== 'pending' && (
                            <span className={`le-badge ${rec.status === 'approved' ? 'success' : rec.status === 'rejected' ? 'danger' : ''}`} style={{ fontSize: 10 }}>
                              {rec.status === 'approved' ? 'موافق عليها' : rec.status === 'rejected' ? 'مرفوضة' : rec.status}
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, marginBottom: 8 }}>{rec.description_ar}</p>

                        {/* Confidence bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>ثقة {rec.confidence}%</span>
                          <div style={{ flex: 1, height: 4, background: '#f0f0f0', borderRadius: 2 }}>
                            <div style={{ height: '100%', borderRadius: 2, background: rec.confidence >= 75 ? '#059669' : rec.confidence >= 50 ? '#d97706' : '#dc2626', width: `${rec.confidence}%`, transition: 'width .5s ease' }} />
                          </div>
                          <button onClick={() => setExpanded(e => ({ ...e, [rec.id]: !e[rec.id] }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}>
                            {isExpanded ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                          </button>
                        </div>

                        {/* Expanded: implementation steps */}
                        {isExpanded && (Array.isArray(rec.implementation_steps) && rec.implementation_steps.length > 0) && (
                          <div style={{ marginTop: 12, padding: 12, background: 'var(--ink-100)', borderRadius: 8 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>خطوات التطبيق:</p>
                            {rec.implementation_steps.map((step: string, si: number) => (
                              <p key={si} style={{ fontSize: 11, color: 'var(--text-muted)', margin: '3px 0', paddingInlineStart: 12 }}>
                                {si + 1}. {step}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      {rec.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button className="le-btn sm" onClick={() => handleApprove(rec.id, 'approved')} disabled={acting === rec.id}
                            style={{ borderColor: '#059669', color: '#059669', display: 'flex', alignItems: 'center', gap: 4, background: '#f0fdf4' }}>
                            <ThumbsUp style={{ width: 11, height: 11 }} /> موافقة
                          </button>
                          <button className="le-btn sm" onClick={() => handleApprove(rec.id, 'rejected')} disabled={acting === rec.id}
                            style={{ borderColor: '#fca5a5', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4, background: '#fef2f2' }}>
                            <ThumbsDown style={{ width: 11, height: 11 }} /> رفض
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: ICP                                                            */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'icp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Conflicts */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertOctagon style={{ width: 15, height: 15, color: '#dc2626' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>تعارضات التعليمات النشطة</span>
              </div>
              {conflicts.length > 0 && <span className="le-badge danger">{conflicts.length}</span>}
            </div>
            {conflicts.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <CheckCircle style={{ width: 24, height: 24, color: '#059669', margin: '0 auto 8px' }} />
                <p>لا توجد تعارضات نشطة</p>
              </div>
            ) : conflicts.map((c: any, i: number) => (
              <div key={c.message_id} style={{ padding: '14px 18px', borderBottom: i < conflicts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{AGENT_AR[c.source_agent] || c.source_agent}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>←</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{AGENT_AR[c.target_agent] || c.target_agent}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626' }}>{c.intent}</span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString('ar-SA') : ''}</span>
                </div>
                {Array.isArray(c.conflict_details) && c.conflict_details.length > 0 && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                    يتعارض مع: {c.conflict_details.map((d: any) => d.intent).join('، ')}
                  </p>
                )}
                {c.entity_id && <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '4px 0 0' }}>الكيان: {c.entity_id}</p>}
              </div>
            ))}
          </div>

          {/* Stalled workflows */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle style={{ width: 15, height: 15, color: '#d97706' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>سير عمل متوقف</span>
              </div>
              {stalled.length > 0 && <span className="le-badge warning">{stalled.length}</span>}
            </div>
            {stalled.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <CheckCircle style={{ width: 24, height: 24, color: '#059669', margin: '0 auto 8px' }} />
                <p>جميع سير العمل ضمن المواعيد</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
              <table className="le-table" style={{ width: '100%', minWidth: 480 }}>
                <thead>
                  <tr>
                    <th>المصدر</th>
                    <th>الهدف</th>
                    <th>النية</th>
                    <th>الأولوية</th>
                    <th>التأخير</th>
                  </tr>
                </thead>
                <tbody>
                  {stalled.map((s: any) => {
                    const ps = sevStyle(s.priority === 'critical' ? 'critical' : s.priority === 'high' ? 'high' : 'low');
                    return (
                      <tr key={s.message_id}>
                        <td style={{ fontWeight: 500 }}>{AGENT_AR[s.source] || s.source}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{AGENT_AR[s.target] || s.target}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{s.intent}</td>
                        <td>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: ps.bg, color: ps.color }}>{s.priority}</span>
                        </td>
                        <td style={{ color: '#dc2626', fontWeight: 600 }}>{s.overdue_by}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: OPERATIONAL METRICS                                            */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'metrics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
            {[
              {
                label: 'معدل التحصيل',
                value: data.metrics.collection_rate_pct != null ? `${data.metrics.collection_rate_pct}%` : '—',
                sub: 'هذا الشهر',
                color: data.metrics.collection_rate_pct >= 90 ? '#059669' : data.metrics.collection_rate_pct >= 75 ? '#d97706' : '#dc2626',
              },
              {
                label: 'عقود متعثرة',
                value: data.metrics.delinquency_count ?? '—',
                sub: 'عقود نشطة بتأخر دفع',
                color: (data.metrics.delinquency_count || 0) > 0 ? '#dc2626' : '#059669',
              },
              {
                label: 'متوسط تأهيل الوحدة',
                value: data.metrics.avg_vacancy_days != null ? `${data.metrics.avg_vacancy_days} يوم` : '—',
                sub: 'من الإخلاء للإيجار (هدف: 7 أيام)',
                color: (data.metrics.avg_vacancy_days || 0) <= 7 ? '#059669' : '#dc2626',
              },
              {
                label: 'أحداث فاشلة (DLQ)',
                value: data.metrics.dead_event_count ?? '—',
                sub: 'في قائمة الانتظار',
                color: (data.metrics.dead_event_count || 0) > 0 ? '#dc2626' : '#059669',
              },
              {
                label: 'امتثال SLA الإشغال',
                value: data.metrics.sla_compliant_units ?? '—',
                sub: `وحدة ضمن SLA — خرق: ${data.metrics.sla_breached_units ?? 0}`,
                color: (data.metrics.sla_breached_units || 0) > 0 ? '#dc2626' : '#059669',
              },
              {
                label: 'إنجاز الوكلاء',
                value: data.metrics.agent_completion_rate != null ? `${data.metrics.agent_completion_rate}%` : '—',
                sub: 'مهام منجزة / إجمالي (30 يوم)',
                color: (data.metrics.agent_completion_rate || 0) >= 80 ? '#059669' : '#d97706',
              },
            ].map((k, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{k.label}</p>
                <p style={{ fontSize: 26, fontWeight: 700, color: k.color, lineHeight: 1, margin: 0 }}>{k.value}</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{k.sub}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            آخر تحديث: {data.metrics.as_of ? new Date(data.metrics.as_of).toLocaleString('ar-SA') : '—'}
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: AGENT CONTROLS (WS-1 kill switch / write-freeze)               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'controls' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Status banner */}
          <div style={{
            background: ctrl.agents_full_pause?.enabled ? 'rgba(220,38,38,.06)' : ctrl.agents_write_freeze?.enabled ? 'rgba(217,119,6,.06)' : 'rgba(5,150,105,.06)',
            border: `1.5px solid ${ctrl.agents_full_pause?.enabled ? '#dc2626' : ctrl.agents_write_freeze?.enabled ? '#d97706' : '#059669'}33`,
            borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: ctrl.agents_full_pause?.enabled ? '#dc2626' : ctrl.agents_write_freeze?.enabled ? '#d97706' : '#059669', boxShadow: `0 0 8px ${ctrl.agents_full_pause?.enabled ? '#dc2626' : ctrl.agents_write_freeze?.enabled ? '#d97706' : '#059669'}66` }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                {ctrl.agents_full_pause?.enabled ? 'الوكلاء متوقفون كلياً' : ctrl.agents_write_freeze?.enabled ? 'الوكلاء في وضع القراءة فقط' : 'الوكلاء يعملون بشكل طبيعي'}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>الحالة محفوظة في قاعدة البيانات — تصمد بعد إعادة تشغيل Redis</span>
          </div>

          {/* Control toggles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
            {([
              {
                key:   'agents_write_freeze' as const,
                label: 'تجميد الكتابة',
                sub:   'الوكلاء يقرؤون البيانات فقط — جميع الأدوات التنفيذية محظورة. تبقى صمامات الأمان مفتوحة: addToAgenda، recordObservation، writeSharedMemory.',
                color: '#d97706',
                icon:  '🔒',
              },
              {
                key:   'agents_full_pause' as const,
                label: 'إيقاف كامل',
                sub:   'جميع إجراءات الوكلاء محظورة بلا استثناء. فقط addToAgenda تبقى مفتوحة حتى لا تُفقد البنود المعلّقة.',
                color: '#dc2626',
                icon:  '⛔',
              },
            ] as const).map(({ key, label, sub, color }) => {
              const on = !!ctrl[key]?.enabled;
              const busy = ctrlLoading === key;
              return (
                <div key={key} style={{ background: 'var(--surface)', border: `1.5px solid ${on ? color + '44' : 'var(--border)'}`, borderRadius: 12, padding: '18px 20px', transition: 'border-color .2s' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: on ? color : 'var(--text-1)', margin: '0 0 4px' }}>{label}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{sub}</p>
                    </div>
                    <button
                      onClick={() => toggleControl(key)}
                      disabled={busy}
                      style={{ position: 'relative', width: 44, height: 24, borderRadius: 12, background: on ? color : '#d1d5db', border: 'none', cursor: busy ? 'wait' : 'pointer', transition: 'background .2s', flexShrink: 0, padding: 0 }}
                      title={on ? `إيقاف ${label}` : `تفعيل ${label}`}
                    >
                      <span style={{ position: 'absolute', top: 4, left: on ? 22 : 4, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: on ? color + '14' : 'var(--ink-100)', color: on ? color : 'var(--text-muted)' }}>
                      {busy ? 'جارٍ التحديث...' : on ? 'مفعّل' : 'معطّل'}
                    </span>
                    {on && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>تم الحفظ في Postgres</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Explanation card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 10 }}>كيف يعمل نظام التحكّم</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'مصدر الحقيقة', value: 'قاعدة البيانات (جدول system_controls) — يصمد حتى لو أُعيد تشغيل Redis' },
                { label: 'وقت الاستجابة', value: 'التخزين المؤقت في Redis: 30 ثانية — يُطبَّق التغيير فورياً على الطلب التالي' },
                { label: 'الأدوات المحظورة', value: 'تجميد الكتابة: send*, create*, update*, assign*, approve*, schedule*, flag*, initiate* — كل ما يُغيّر البيانات أو يرسل رسائل' },
                { label: 'صمامات الأمان', value: 'addToAgenda · recordObservation · writeSharedMemory — تبقى مفتوحة دائماً حتى يتمكن الوكلاء من التصعيد' },
                { label: 'سجل التغييرات', value: 'كل تغيير يُسجَّل في admin_audit_logs مع اسم المدير ووقت التغيير' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 120 }}>{label}</span>
                  <span style={{ color: 'var(--text-1)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: AGENT QUALITY KPI                                              */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'quality' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award style={{ width: 15, height: 15, color: 'var(--brand-600)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>جودة الوكلاء</span>
              {qualityData?.computed_at && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  آخر تحديث: {relTime(qualityData.computed_at)}
                </span>
              )}
            </div>
            <button className="le-btn ghost sm" onClick={loadQuality} disabled={qualityLoading} title="تحديث">
              <RefreshCw style={{ width: 12, height: 12, animation: qualityLoading ? 'spin 0.8s linear infinite' : 'none' }} />
            </button>
          </div>

          {qualityLoading && !qualityData && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--brand-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {qualityData && (<>

            {/* Ecosystem KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
              {[
                { label: 'متوسط الدقة',          value: qualityData.ecosystem.avg_accuracy,          sub: 'آخر 30 يوم' },
                { label: 'يستخدمون الذاكرة',      value: qualityData.ecosystem.pct_agents_with_memory, sub: '% من الوكلاء', suffix: '%' },
                { label: 'متوسط موافقة فهد',      value: qualityData.ecosystem.avg_approval_rate,     sub: 'آخر 90 يوم' },
                { label: 'متوسط درجة الثقة',      value: qualityData.ecosystem.avg_trust_score,       sub: '0–100' },
              ].map(k => (
                <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{k.label}</p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: scoreColor(k.value), lineHeight: 1, margin: 0 }}>
                    {k.value != null ? `${k.value}${k.suffix || ''}` : '—'}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Main: agent grid + drill-down */}
            <div style={{ display: 'grid', gridTemplateColumns: qualityAgent ? '1fr 360px' : '1fr', gap: 14 }}>

              {/* Agent scorecard grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10, alignContent: 'start' }}>
                {(qualityData.agents as any[]).map((agent: any) => {
                  const selected = qualityAgent === agent.agent_type;
                  const tierAr: Record<string,string> = { full_autopilot:'أتمتة كاملة', autopilot:'أتمتة قياسية', high_risk_manual:'مراجعة يدوية', manual:'يدوي' };
                  const tierColor: Record<string,string> = { full_autopilot:'#059669', autopilot:'#2563eb', high_risk_manual:'#d97706', manual:'#dc2626' };
                  const tier = agent.meta.autonomy_tier;
                  const dims = ['accuracy','grounding_rate','memory','approval_rate','capability'] as const;
                  return (
                    <div key={agent.agent_type}
                      onClick={() => setQualityAgent(selected ? null : agent.agent_type)}
                      style={{ background: 'var(--surface)', border: `1.5px solid ${selected ? 'var(--brand-600)' : 'var(--border)'}`, borderRadius: 10, padding: '14px', cursor: 'pointer', transition: 'border-color .15s', boxShadow: selected ? '0 0 0 2px rgba(99,102,241,.1)' : 'none' }}>
                      {/* Card header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <ScoreRing score={agent.overall_score} size={48} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.agent_name}</p>
                          {tier && (
                            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: (tierColor[tier] || '#94a3b8') + '18', color: tierColor[tier] || '#94a3b8' }}>
                              {tierAr[tier] || tier}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Score bars */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {dims.map(dim => {
                          const s = agent.scores[dim];
                          return (
                            <div key={dim}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</span>
                                {s.insufficient
                                  ? <span className="le-badge" style={{ fontSize: 8 }}>بيانات غير كافية</span>
                                  : <span style={{ fontSize: 10, fontWeight: 600, color: scoreColor(s.score) }}>{s.score}%</span>
                                }
                              </div>
                              <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2 }}>
                                {!s.insufficient && s.score != null && (
                                  <div style={{ height: '100%', borderRadius: 2, background: scoreColor(s.score), width: `${s.score}%`, transition: 'width .4s ease' }} />
                                )}
                              </div>
                              {dim === 'memory' && s.active_memories > 0 && (
                                <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: '2px 0 0' }}>{s.active_memories} ذاكرة نشطة</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Drill-down panel */}
              {qualityAgent && (() => {
                const agent = (qualityData.agents as any[]).find((a: any) => a.agent_type === qualityAgent);
                if (!agent) return null;
                const tierAr: Record<string,string> = { full_autopilot:'أتمتة كاملة', autopilot:'أتمتة قياسية', high_risk_manual:'مراجعة يدوية', manual:'يدوي' };
                return (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', alignSelf: 'start', position: 'sticky', top: 80 }}>
                    {/* Panel header */}
                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--ink-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ScoreRing score={agent.overall_score} size={40} />
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{agent.agent_name}</p>
                          <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                            {agent.meta.autonomy_tier ? tierAr[agent.meta.autonomy_tier] : '—'}
                          </p>
                        </div>
                      </div>
                      <button className="le-btn ghost sm" onClick={() => setQualityAgent(null)}>
                        <X style={{ width: 13, height: 13 }} />
                      </button>
                    </div>

                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                      {/* درجات التفصيل */}
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>درجات التفصيل</p>
                        {(['accuracy','grounding_rate','memory','approval_rate','capability'] as const).map(dim => {
                          const s = agent.scores[dim];
                          return (
                            <div key={dim} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: s.insufficient ? '#94a3b8' : scoreColor(s.score) }}>
                                {s.insufficient ? '—' : `${s.score}%`}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* الذاكرة */}
                      <div style={{ background: 'var(--ink-100)', borderRadius: 8, padding: '10px 12px' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>الذاكرة الدائمة</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span style={{ color: 'var(--text-muted)' }}>ذاكرة نشطة</span>
                          <span style={{ fontWeight: 600, color: agent.scores.memory.active_memories > 0 ? '#059669' : '#dc2626' }}>
                            {agent.scores.memory.active_memories} إدخال
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                          <span style={{ color: 'var(--text-muted)' }}>آخر كتابة</span>
                          <span style={{ color: 'var(--text-1)' }}>{relTime(agent.scores.memory.last_write)}</span>
                        </div>
                      </div>

                      {/* ثقة فهد */}
                      <div style={{ background: 'var(--ink-100)', borderRadius: 8, padding: '10px 12px' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>قرارات فهد</p>
                        {agent.scores.approval_rate.insufficient ? (
                          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>بيانات غير كافية (أقل من 5 قرارات)</p>
                        ) : (
                          <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
                            <div style={{ textAlign: 'center' }}>
                              <p style={{ fontWeight: 700, fontSize: 18, color: '#059669', margin: 0 }}>{agent.scores.approval_rate.approved}</p>
                              <p style={{ color: 'var(--text-muted)', margin: '2px 0 0' }}>موافقة</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <p style={{ fontWeight: 700, fontSize: 18, color: '#dc2626', margin: 0 }}>{agent.scores.approval_rate.rejected}</p>
                              <p style={{ color: 'var(--text-muted)', margin: '2px 0 0' }}>رفض</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <p style={{ fontWeight: 700, fontSize: 18, color: scoreColor(agent.scores.approval_rate.score), margin: 0 }}>{agent.scores.approval_rate.score}%</p>
                              <p style={{ color: 'var(--text-muted)', margin: '2px 0 0' }}>معدل</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* تنوع الأدوات */}
                      <div style={{ background: 'var(--ink-100)', borderRadius: 8, padding: '10px 12px' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>تنوع الأدوات</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span style={{ color: 'var(--text-muted)' }}>أدوات مختلفة (30 يوم)</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{agent.scores.capability.unique_tools}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                          <span style={{ color: 'var(--text-muted)' }}>درجة التنوع</span>
                          <span style={{ fontWeight: 600, color: scoreColor(agent.scores.capability.tool_diversity) }}>{agent.scores.capability.tool_diversity}%</span>
                        </div>
                      </div>

                      {/* إحصاءات الجلسة */}
                      {!agent.scores.accuracy.insufficient && (
                        <div style={{ background: 'var(--ink-100)', borderRadius: 8, padding: '10px 12px' }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>
                            إحصاءات الجلسة — {agent.scores.accuracy.total} استجابة (30 يوم)
                          </p>
                          <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            نجاح · فشل · تصعيد · جزئي — مبني على حقل outcome في agent_conversation_history
                          </p>
                        </div>
                      )}

                      {agent.meta.trust_score != null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '8px 12px', background: 'var(--ink-100)', borderRadius: 8 }}>
                          <span style={{ color: 'var(--text-muted)' }}>درجة الثقة الكلية</span>
                          <span style={{ fontWeight: 700, fontSize: 14, color: scoreColor(agent.meta.trust_score) }}>{agent.meta.trust_score}/100</span>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })()}

            </div>
          </>)}

        </div>
      )}

    </div>
  );
}
