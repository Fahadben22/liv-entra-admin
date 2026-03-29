'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SystemLog {
  id: string;
  company_id: string | null;
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  details: Record<string, unknown>;
  stack_trace?: string;
  status: 'open' | 'analyzing' | 'resolved' | 'ignored';
  created_at: string;
  ai_analyses?: AiAnalysis[];
}

interface AiAnalysis {
  root_cause: string;
  suggested_fix: string;
  severity_note: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  created_at: string;
}

interface Summary {
  last_24h: Record<string, number>;
  total_7d: number;
  alerts_24h: number;
  open_criticals: SystemLog[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  critical: { label: 'حرج',     color: '#dc2626', bg: '#fef2f2', dot: '#dc2626' },
  error:    { label: 'خطأ',     color: '#ea580c', bg: '#fff7ed', dot: '#ea580c' },
  warning:  { label: 'تحذير',   color: '#d97706', bg: '#fffbeb', dot: '#d97706' },
  info:     { label: 'معلومة',  color: '#2563eb', bg: '#eff6ff', dot: '#2563eb' },
  debug:    { label: 'تصحيح',   color: '#64748b', bg: '#f8fafc', dot: '#94a3b8' },
};

const STATUS_LABELS: Record<string, string> = {
  open:      'مفتوح',
  analyzing: 'يحلّل...',
  resolved:  'محلول',
  ignored:   'مهمل',
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: 'حرج',    color: '#dc2626' },
  high:     { label: 'عالي',   color: '#ea580c' },
  medium:   { label: 'متوسط',  color: '#d97706' },
  low:      { label: 'منخفض',  color: '#16a34a' },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function IntelligencePage() {
  const router = useRouter();
  const [summary, setSummary]       = useState<Summary | null>(null);
  const [logs, setLogs]             = useState<SystemLog[]>([]);
  const [total, setTotal]           = useState(0);
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [loading, setLoading]       = useState(true);
  const [analyzing, setAnalyzing]   = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState('');
  const [filterStatus, setFilterStatus] = useState('open');
  const [page, setPage]             = useState(0);
  const [resolutionNote, setResolutionNote] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [tab, setTab]               = useState<'logs' | 'alerts'>('logs');
  const [alerts, setAlerts]         = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError]   = useState('');
  const LIMIT = 20;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      setLoadError('');
      const params: Record<string, string> = { limit: String(LIMIT), offset: String(page * LIMIT) };
      if (filterLevel)  params.level  = filterLevel;
      if (filterStatus) params.status = filterStatus;

      const [sumRes, logsRes] = await Promise.all([
        adminApi.intelligenceSummary(),
        adminApi.listLogs(params),
      ]);
      setSummary((sumRes as any).data);
      setLogs((logsRes as any).data || []);
      setTotal((logsRes as any).count || 0);
    } catch (e: any) {
      const msg: string = e?.message || '';
      // Only redirect to login on auth errors
      if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('401')) {
        router.push('/login');
      } else {
        setLoadError(msg || 'فشل في الاتصال بالخادم');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterLevel, filterStatus, page, router]);

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    load();
  }, [load]);

  useEffect(() => {
    if (tab !== 'alerts') return;
    adminApi.listAlerts().then(r => setAlerts((r as any).data || [])).catch(() => {});
  }, [tab]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  async function handleAnalyze(log: SystemLog) {
    setAnalyzing(log.id);
    try {
      const res = await adminApi.analyzeLog(log.id);
      // Refresh log in list
      setLogs(prev => prev.map(l => l.id === log.id
        ? { ...l, ai_analyses: [(res as any).data], status: 'open' }
        : l
      ));
      if (selectedLog?.id === log.id) {
        setSelectedLog(prev => prev ? { ...prev, ai_analyses: [(res as any).data], status: 'open' } : prev);
      }
    } catch (e: any) {
      alert('فشل تحليل السجل: ' + e.message);
    } finally {
      setAnalyzing(null);
    }
  }

  async function handleResolve() {
    if (!selectedLog) return;
    try {
      await adminApi.resolveLog(selectedLog.id, resolutionNote);
      setLogs(prev => prev.map(l => l.id === selectedLog.id ? { ...l, status: 'resolved' } : l));
      setSelectedLog(prev => prev ? { ...prev, status: 'resolved' } : prev);
      setShowResolveModal(false);
      setResolutionNote('');
    } catch (e: any) {
      alert('فشل: ' + e.message);
    }
  }

  async function handleIgnore(log: SystemLog) {
    try {
      await adminApi.ignoreLog(log.id);
      setLogs(prev => prev.map(l => l.id === log.id ? { ...l, status: 'ignored' } : l));
      if (selectedLog?.id === log.id) setSelectedLog(null);
    } catch {}
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#94a3b8' }}>جاري التحميل...</p>
    </div>
  );

  const analysis = selectedLog?.ai_analyses?.[0];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Top nav */}
      <div style={{ background: '#1d4070', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/dashboard" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🧠</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>ذكاء النظام</span>
            {refreshing && <span style={{ fontSize: 11, color: '#93c5fd' }}>يحدّث...</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link href="/dashboard/companies"  style={{ fontSize: 12, color: '#93c5fd', textDecoration: 'none' }}>الشركات</Link>
          <Link href="/dashboard/billing"    style={{ fontSize: 12, color: '#93c5fd', textDecoration: 'none' }}>الفواتير</Link>
          <Link href="/dashboard/monitoring" style={{ fontSize: 12, color: '#93c5fd', textDecoration: 'none' }}>المراقبة</Link>
          <span style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>الذكاء</span>
          <button onClick={() => { localStorage.clear(); router.push('/login'); }}
            style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: 'rgba(255,255,255,.15)', color: 'white', border: 'none', cursor: 'pointer' }}>
            خروج
          </button>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>مركز ذكاء النظام</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            مراقبة الأخطاء في الوقت الفعلي، تحليل ذكاء اصطناعي، تنبيهات واتساب للمشاكل الحرجة
          </p>
        </div>

        {/* Error banner */}
        {loadError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', margin: '0 0 4px' }}>⚠️ خطأ في تحميل البيانات</p>
              <p style={{ fontSize: 12, color: '#7f1d1d', margin: 0 }}>{loadError}</p>
              {loadError.includes('system_logs') && (
                <p style={{ fontSize: 11, color: '#991b1b', margin: '4px 0 0', fontWeight: 600 }}>
                  يجب تشغيل ملف system_intelligence_migration.sql على Supabase أولاً
                </p>
              )}
            </div>
            <button onClick={() => load()} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer' }}>
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* KPI Summary */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { l: 'حرج (24 ساعة)',   v: summary.last_24h.critical || 0, c: '#dc2626', bg: '#fef2f2', icon: '🚨' },
              { l: 'أخطاء (24 ساعة)', v: summary.last_24h.error    || 0, c: '#ea580c', bg: '#fff7ed', icon: '❌' },
              { l: 'تحذيرات (24 ساعة)', v: summary.last_24h.warning || 0, c: '#d97706', bg: '#fffbeb', icon: '⚠️' },
              { l: 'إجمالي 7 أيام',    v: summary.total_7d,              c: '#2563eb', bg: '#eff6ff', icon: '📊' },
              { l: 'تنبيهات أُرسلت',   v: summary.alerts_24h,            c: '#7c3aed', bg: '#faf5ff', icon: '📱' },
            ].map(k => (
              <div key={k.l} style={{ background: k.bg, borderRadius: 10, padding: '12px 16px', border: `1px solid ${k.c}20` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
                  <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{k.l}</p>
                  <span style={{ fontSize: 16 }}>{k.icon}</span>
                </div>
                <p style={{ fontSize: 26, fontWeight: 700, color: k.c, margin: 0 }}>{k.v}</p>
              </div>
            ))}
          </div>
        )}

        {/* Open Criticals Banner */}
        {summary && summary.open_criticals.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>🚨</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>
                {summary.open_criticals.length} حدث حرج مفتوح يحتاج انتباهاً
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {summary.open_criticals.map(c => (
                <div key={c.id} style={{ fontSize: 12, color: '#7f1d1d', display: 'flex', gap: 8 }}>
                  <span style={{ color: '#94a3b8' }}>{c.source}</span>
                  <span>{c.message.slice(0, 80)}{c.message.length > 80 ? '...' : ''}</span>
                  <button
                    onClick={() => setSelectedLog(c)}
                    style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                    عرض
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid #e2e8f0' }}>
          {[
            { id: 'logs',   label: `السجلات (${total})` },
            { id: 'alerts', label: `تنبيهات واتساب (${alerts.length})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as 'logs' | 'alerts')}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
                color: tab === t.id ? '#1d4070' : '#64748b',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: tab === t.id ? '2px solid #1d4070' : '2px solid transparent',
                marginBottom: -2,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'logs' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedLog ? '1fr 380px' : '1fr', gap: 16 }}>
            {/* Left: Log Feed */}
            <div>
              {/* Filters */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <select value={filterLevel} onChange={e => { setFilterLevel(e.target.value); setPage(0); }}
                  style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>
                  <option value="">كل المستويات</option>
                  {Object.entries(LEVEL_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
                  style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>
                  <option value="">كل الحالات</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <button onClick={() => load(true)}
                  style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, background: '#1d4070', color: 'white', border: 'none', cursor: 'pointer' }}>
                  تحديث
                </button>
              </div>

              {/* Log list */}
              <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                {logs.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    لا توجد سجلات تطابق الفلتر الحالي
                  </div>
                ) : logs.map((log, i) => {
                  const cfg = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
                  const hasAnalysis = (log.ai_analyses?.length || 0) > 0;
                  const isSelected = selectedLog?.id === log.id;

                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(isSelected ? null : log)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: i < logs.length - 1 ? '1px solid #f1f5f9' : 'none',
                        cursor: 'pointer',
                        background: isSelected ? '#f0f4ff' : log.status === 'resolved' ? '#f9fafb' : 'white',
                        transition: 'background .15s',
                        opacity: log.status === 'ignored' ? 0.5 : 1,
                      }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        {/* Level dot */}
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, marginTop: 5, flexShrink: 0 }} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color }}>
                              {cfg.label}
                            </span>
                            <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{log.source}</span>
                            {log.status !== 'open' && (
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: log.status === 'resolved' ? '#f0fdf4' : '#f8fafc', color: log.status === 'resolved' ? '#16a34a' : '#94a3b8' }}>
                                {STATUS_LABELS[log.status]}
                              </span>
                            )}
                            {hasAnalysis && (
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#faf5ff', color: '#7c3aed' }}>🧠 محلَّل</span>
                            )}
                            {analyzing === log.id && (
                              <span style={{ fontSize: 10, color: '#94a3b8' }}>يحلّل...</span>
                            )}
                          </div>

                          <p style={{ fontSize: 12, color: '#374151', margin: '0 0 4px', lineHeight: 1.4, wordBreak: 'break-word' }}>
                            {log.message.slice(0, 120)}{log.message.length > 120 ? '...' : ''}
                          </p>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>
                              {new Date(log.created_at).toLocaleString('ar-SA')}
                            </span>
                            {log.company_id && (
                              <span style={{ fontSize: 10, color: '#6366f1' }}>
                                شركة: {log.company_id.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick actions */}
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          {log.status === 'open' && !hasAnalysis && (
                            <button
                              onClick={() => handleAnalyze(log)}
                              disabled={analyzing === log.id}
                              style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: '#faf5ff', color: '#7c3aed', border: '1px solid #e9d5ff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              {analyzing === log.id ? '...' : '🧠 حلّل'}
                            </button>
                          )}
                          {log.status === 'open' && (
                            <button
                              onClick={() => handleIgnore(log)}
                              style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                              تجاهل
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {total > LIMIT && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: page === 0 ? 'not-allowed' : 'pointer', color: page === 0 ? '#cbd5e1' : '#374151' }}>
                    السابق
                  </button>
                  <span style={{ fontSize: 12, color: '#64748b', padding: '6px 10px' }}>
                    {page + 1} / {Math.ceil(total / LIMIT)}
                  </span>
                  <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * LIMIT >= total}
                    style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: (page + 1) * LIMIT >= total ? 'not-allowed' : 'pointer', color: (page + 1) * LIMIT >= total ? '#cbd5e1' : '#374151' }}>
                    التالي
                  </button>
                </div>
              )}
            </div>

            {/* Right: Detail / AI Analysis Panel */}
            {selectedLog && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Log detail card */}
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                    <div>
                      {(() => {
                        const cfg = LEVEL_CONFIG[selectedLog.level] || LEVEL_CONFIG.info;
                        return (
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        );
                      })()}
                    </div>
                    <button onClick={() => setSelectedLog(null)}
                      style={{ fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>
                      ✕
                    </button>
                  </div>

                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{selectedLog.source}</p>
                  <p style={{ fontSize: 12, color: '#374151', marginBottom: 8, lineHeight: 1.5 }}>{selectedLog.message}</p>

                  {selectedLog.stack_trace && (
                    <details style={{ marginBottom: 8 }}>
                      <summary style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>Stack Trace</summary>
                      <pre style={{ fontSize: 10, color: '#374151', background: '#f8fafc', padding: 8, borderRadius: 6, overflow: 'auto', marginTop: 6, maxHeight: 160 }}>
                        {selectedLog.stack_trace}
                      </pre>
                    </details>
                  )}

                  {Object.keys(selectedLog.details || {}).length > 0 && (
                    <div style={{ background: '#f8fafc', borderRadius: 6, padding: 8, marginBottom: 8 }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>التفاصيل</p>
                      <pre style={{ fontSize: 10, color: '#374151', margin: 0, whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(selectedLog.details, null, 2)}
                      </pre>
                    </div>
                  )}

                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '8px 0 0' }}>
                    {new Date(selectedLog.created_at).toLocaleString('ar-SA')}
                  </p>

                  {/* Actions */}
                  {selectedLog.status === 'open' && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                      <button
                        onClick={() => handleAnalyze(selectedLog)}
                        disabled={analyzing === selectedLog.id}
                        style={{ flex: 1, fontSize: 12, padding: '7px 0', borderRadius: 7, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        {analyzing === selectedLog.id ? '⏳ يحلّل...' : '🧠 تحليل بالذكاء الاصطناعي'}
                      </button>
                      <button
                        onClick={() => setShowResolveModal(true)}
                        style={{ fontSize: 12, padding: '7px 12px', borderRadius: 7, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', cursor: 'pointer' }}>
                        ✓ حُل
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Analysis Card */}
                {analysis ? (
                  <div style={{ background: 'linear-gradient(135deg,#faf5ff,#f5f3ff)', borderRadius: 12, border: '1px solid #e9d5ff', padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 18 }}>🧠</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>تحليل الذكاء الاصطناعي</span>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#ede9fe', color: '#7c3aed' }}>
                        ثقة {analysis.confidence}%
                      </span>
                      {(() => {
                        const pc = PRIORITY_CONFIG[analysis.priority];
                        return pc ? (
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: pc.color + '20', color: pc.color, fontWeight: 700 }}>
                            {pc.label}
                          </span>
                        ) : null;
                      })()}
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', margin: '0 0 4px' }}>السبب الجذري</p>
                      <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5 }}>{analysis.root_cause}</p>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', margin: '0 0 4px' }}>الإصلاح المقترح</p>
                      <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5 }}>{analysis.suggested_fix}</p>
                    </div>

                    {analysis.severity_note && (
                      <div style={{ background: 'rgba(124,58,237,.07)', borderRadius: 6, padding: '8px 10px' }}>
                        <p style={{ fontSize: 11, color: '#6d28d9', margin: 0, lineHeight: 1.4 }}>
                          <strong>الأثر على العمل:</strong> {analysis.severity_note}
                        </p>
                      </div>
                    )}

                    <p style={{ fontSize: 10, color: '#a78bfa', margin: '8px 0 0' }}>
                      حُلِّل بواسطة claude-sonnet-4-6 • {new Date(analysis.created_at).toLocaleString('ar-SA')}
                    </p>
                  </div>
                ) : selectedLog.status === 'open' && (
                  <div style={{ background: 'white', borderRadius: 12, border: '1px dashed #e9d5ff', padding: 20, textAlign: 'center' }}>
                    <p style={{ fontSize: 16, marginBottom: 6 }}>🧠</p>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>لا يوجد تحليل بعد</p>
                    <p style={{ fontSize: 11, color: '#cbd5e1', margin: '4px 0 0' }}>اضغط "تحليل بالذكاء الاصطناعي" لتشغيل Claude</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Alerts tab */}
        {tab === 'alerts' && (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {alerts.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                لا توجد تنبيهات مرسلة حتى الآن
              </div>
            ) : alerts.map((a, i) => (
              <div key={a.id} style={{ padding: '12px 16px', borderBottom: i < alerts.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>📱</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{a.recipient}</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: a.status === 'sent' ? '#f0fdf4' : '#fef2f2', color: a.status === 'sent' ? '#16a34a' : '#dc2626' }}>
                    {a.status === 'sent' ? 'أُرسل' : 'فشل'}
                  </span>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(a.sent_at).toLocaleString('ar-SA')}</span>
                </div>
                <p style={{ fontSize: 11, color: '#64748b', margin: 0, whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                  {a.message_body.slice(0, 200)}{a.message_body.length > 200 ? '...' : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolve Modal */}
      {showResolveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>تأكيد إغلاق السجل</h3>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>أضف ملاحظة اختيارية حول كيفية حل المشكلة:</p>
            <textarea
              value={resolutionNote}
              onChange={e => setResolutionNote(e.target.value)}
              placeholder="تم الإصلاح بـ..."
              style={{ width: '100%', minHeight: 80, padding: 10, fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowResolveModal(false)}
                style={{ fontSize: 12, padding: '7px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>
                إلغاء
              </button>
              <button onClick={handleResolve}
                style={{ fontSize: 12, padding: '7px 16px', borderRadius: 7, background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                تأكيد الإغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
