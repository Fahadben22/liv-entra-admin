'use client';
import { useEffect, useState, useCallback } from 'react';
import { request } from '@/lib/api';
import {
  Brain, ShieldCheck, Layers, Network, RefreshCw,
  ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle,
  AlertOctagon, Activity, ChevronDown, ChevronUp,
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

  useEffect(() => { loadAll(); }, [loadAll]);

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
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>

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
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
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
      {/* TAB: AGENTS                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'agents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Scorecard grid */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>بطاقات أداء الوكلاء</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>يُحدَّث أسبوعياً الأحد 4:30 ص</span>
            </div>
            {scorecards.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <ShieldCheck style={{ width: 28, height: 28, margin: '0 auto 10px', opacity: 0.3 }} />
                <p>لا يوجد بيانات أداء — يبدأ جمع البيانات من أول دورة REEA</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 0 }}>
                {scorecards.map((s: any) => {
                  const name = AGENT_AR[s.agent_type] || s.agent_type;
                  const score = Math.round(s.reliability_score || 0);
                  return (
                    <div key={s.agent_type} style={{ padding: '20px 16px', borderInlineEnd: '1px solid var(--border)', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <ScoreRing score={score} size={64} />
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{name}</p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                          <span>حل: <strong style={{ color: '#059669' }}>{Math.round(s.resolution_rate || 0)}%</strong></span>
                          <span>فشل: <strong style={{ color: '#dc2626' }}>{Math.round(s.failure_rate || 0)}%</strong></span>
                        </div>
                      </div>
                      {score < 60 && (
                        <span className="le-badge danger" style={{ fontSize: 9 }}>يحتاج مراجعة</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Incidents */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>حوادث مفتوحة</span>
              {incidents.length > 0 && <span className="le-badge warning">{incidents.length}</span>}
            </div>
            {incidents.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <CheckCircle style={{ width: 24, height: 24, color: '#059669', margin: '0 auto 8px' }} />
                <p>لا توجد حوادث مفتوحة</p>
              </div>
            ) : (
              <table className="le-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>نوع الحادثة</th>
                    <th>الوكيل</th>
                    <th>الخطورة</th>
                    <th>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc: any) => {
                    const ss = sevStyle(inc.severity || 'low');
                    return (
                      <tr key={inc.id}>
                        <td style={{ fontWeight: 500 }}>{(inc.incident_type || '').replace(/_/g, ' ')}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{AGENT_AR[inc.agent_type] || inc.agent_type || '—'}</td>
                        <td>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: ss.bg, color: ss.color }}>
                            {inc.severity}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          {inc.created_at ? new Date(inc.created_at).toLocaleDateString('ar-SA') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
              <table className="le-table" style={{ width: '100%' }}>
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
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: OPERATIONAL METRICS                                            */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'metrics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
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

    </div>
  );
}
