'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

// ─── Severity config ──────────────────────────────────────────────────────────
const SEV: Record<string, { bg: string; color: string; border: string; label: string }> = {
  critical: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'حرج'    },
  high:     { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'عالي'   },
  warning:  { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'عالي'   },
  medium:   { bg: '#fefce8', color: '#854d0e', border: '#fde68a', label: 'متوسط'  },
  info:     { bg: '#eff6ff', color: '#1d4070', border: '#bfdbfe', label: 'منخفض'  },
  low:      { bg: '#eff6ff', color: '#1d4070', border: '#bfdbfe', label: 'منخفض'  },
};

const THREAT_LEVEL: Record<string, { bg: string; color: string; label: string; dot: string }> = {
  normal:   { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e', label: 'طبيعي'  },
  guarded:  { bg: '#fefce8', color: '#854d0e', dot: '#f59e0b', label: 'تحذير'  },
  elevated: { bg: '#fff7ed', color: '#c2410c', dot: '#f97316', label: 'مرتفع'  },
  critical: { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444', label: 'حرج'    },
};

const EVENT_AR: Record<string, string> = {
  'auth.token_invalid':       'رمز مزيف',
  'auth.token_expired':       'جلسة منتهية',
  'auth.role_violation':      'تصعيد صلاحيات',
  'auth.tenant_token_invalid':'رمز مستأجر مزيف',
  'otp.failed':               'OTP خاطئ',
  'otp.locked':               'قفل OTP',
  'rate_limit.exceeded':      'تجاوز الحد',
  'superadmin.login.failed':  'فشل دخول المدير',
  'superadmin.login':         'دخول المدير',
  'auth.login':               'تسجيل دخول',
};

// ─── Simulation scenarios (21 — defensive analysis only) ─────────────────────
const SCENARIOS = [
  { domain: '1', domain_ar: 'المصادقة',        scenario: 'تكرار كلمة مرور خاطئة على لوحة المدير',          risk: 'critical', detected: true,  event: 'superadmin.login.failed',  alert: 'فوري',    fix: 'مطبّق — adminLoginLimiter + email alert' },
  { domain: '1', domain_ar: 'المصادقة',        scenario: 'OTP خاطئ 5 مرات في 30 دقيقة',                   risk: 'high',     detected: true,  event: 'otp.failed + otp.locked',  alert: 'لوحة',    fix: 'مطبّق — checkOtpLockout + recordOtpFailure' },
  { domain: '1', domain_ar: 'المصادقة',        scenario: 'طلب OTP لرقم غير مسجل',                          risk: 'medium',   detected: true,  event: 'auth.unregistered_otp',    alert: 'سجل',     fix: 'مطبّق — 404 بدون إفشاء' },
  { domain: '1', domain_ar: 'المصادقة',        scenario: '11 طلب OTP في ساعة (authLimiter)',                risk: 'high',     detected: true,  event: 'rate_limit.exceeded',      alert: 'لوحة',    fix: 'مطبّق — handler يسجّل الحدث' },
  { domain: '2', domain_ar: 'التحكم في الوصول', scenario: 'موظف viewer يحاول إنشاء وحدة',                   risk: 'high',     detected: true,  event: 'auth.role_violation',      alert: 'لوحة',    fix: 'مطبّق — authorize() يسجّل المحاولة' },
  { domain: '2', domain_ar: 'التحكم في الوصول', scenario: 'الوصول لبيانات شركة أخرى بتوكن صحيح',            risk: 'high',     detected: true,  event: 'cross_tenant_blocked',     alert: 'لوحة',    fix: 'مطبّق — company_id مُشفّر في JWT' },
  { domain: '2', domain_ar: 'التحكم في الوصول', scenario: 'موظف يغيّر دوره بنفسه',                          risk: 'critical', detected: true,  event: 'auth.self_role_escalation', alert: 'فوري',   fix: 'مطبّق — self-role guard في updateStaffUser' },
  { domain: '3', domain_ar: 'التحقق من المدخلات', scenario: 'رقم جوال بحروف أو 20+ رقم',                  risk: 'medium',   detected: true,  event: 'input.validation_failed',  alert: 'سجل',     fix: 'مطبّق — phoneField() 422' },
  { domain: '3', domain_ar: 'التحقق من المدخلات', scenario: 'حقن HTML/script في حقل النصوص',               risk: 'high',     detected: true,  event: 'input.xss_stripped',       alert: 'لوحة',    fix: 'مطبّق — textField() يزيل HTML' },
  { domain: '3', domain_ar: 'التحقق من المدخلات', scenario: 'مبلغ سالب أو صفر في الدفعات',                 risk: 'medium',   detected: true,  event: 'input.invalid_amount',     alert: 'سجل',     fix: 'مطبّق — amountField() isFloat min:0.01' },
  { domain: '4', domain_ar: 'أمان API',          scenario: 'استدعاء endpoint محمي بدون Authorization',      risk: 'low',      detected: true,  event: 'auth.no_token',            alert: 'سجل',     fix: 'طبيعي — 401 no-token' },
  { domain: '4', domain_ar: 'أمان API',          scenario: 'توكن مزيف أو منتهي الصلاحية',                  risk: 'high',     detected: true,  event: 'auth.token_invalid',       alert: 'لوحة',    fix: 'مطبّق — authenticate() يسجّل JWT errors' },
  { domain: '4', domain_ar: 'أمان API',          scenario: '200+ طلب في 15 دقيقة (globalLimiter)',          risk: 'high',     detected: true,  event: 'rate_limit.exceeded',      alert: 'لوحة',    fix: 'مطبّق — handler موحّد لجميع المحدودات' },
  { domain: '5', domain_ar: 'سلامة البيانات',    scenario: 'تفعيل عقد بجدول دفعات معطوب',                  risk: 'critical', detected: true,  event: 'payment_schedule_failed',  alert: 'فوري',    fix: 'مطبّق — revert to draft on failure' },
  { domain: '5', domain_ar: 'سلامة البيانات',    scenario: 'رقم هوية وطنية مكرر لمستأجرَين',               risk: 'medium',   detected: true,  event: 'duplicate_national_id',    alert: 'سجل',     fix: 'مطبّق — UNIQUE constraint + check' },
  { domain: '5', domain_ar: 'سلامة البيانات',    scenario: 'تعديل متزامن على نفس السجل',                    risk: 'medium',   detected: true,  event: 'concurrent_update',        alert: 'سجل',     fix: 'مطبّق — audit_log يحتفظ بالقيم القديمة' },
  { domain: '6', domain_ar: 'الأمان المالي',     scenario: 'تسجيل نفس الدفعة مرتين (ضغط مزدوج)',           risk: 'critical', detected: true,  event: 'payment.duplicate_attempt', alert: 'فوري',   fix: 'مطبّق — idempotency_key + sensitiveLimiter' },
  { domain: '6', domain_ar: 'الأمان المالي',     scenario: 'تكلفة صيانة لا تظهر في P&L',                   risk: 'high',     detected: true,  event: 'expense_auto_created',     alert: 'لوحة',    fix: 'مطبّق — auto expense عند إغلاق التذكرة' },
  { domain: '6', domain_ar: 'الأمان المالي',     scenario: 'محاسب يعفو عن دفعة',                            risk: 'low',      detected: true,  event: 'payment.waived',           alert: 'سجل',     fix: 'مطبّق — authorize + audit trail' },
  { domain: '7', domain_ar: 'إساءة الاستخدام',   scenario: '300 طلب GET في 15 دقيقة (DDoS-lite)',           risk: 'high',     detected: true,  event: 'rate_limit.exceeded',      alert: 'لوحة',    fix: 'مطبّق — globalLimiter 200/15min' },
  { domain: '7', domain_ar: 'إساءة الاستخدام',   scenario: '15 تذكرة صيانة في دقيقة واحدة',                risk: 'medium',   detected: true,  event: 'rate_limit.exceeded',      alert: 'لوحة',    fix: 'مطبّق — sensitiveLimiter على POST /maintenance' },
];

const PAGE_SIZE = 50;

export default function SecurityCenterPage() {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [tab,       setTab]       = useState<'dashboard' | 'events' | 'simulation' | 'anomalies'>('dashboard');
  const [summary,   setSummary]   = useState<any>(null);
  const [events,    setEvents]    = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [audit,     setAudit]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [evLoading, setEvLoading] = useState(false);
  const [toast,     setToast]     = useState('');

  // Filters — events
  const [sevFilter,  setSevFilter]  = useState('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [hours,      setHours]      = useState('24');
  const [evPage,     setEvPage]     = useState(0);

  // Filters — simulation
  const [simFilter,  setSimFilter]  = useState('all');

  // Filters — anomalies
  const [anomStatus, setAnomStatus] = useState('open');
  const [actioning,  setActioning]  = useState<string | null>(null);

  // Live state
  const [sseStatus,   setSseStatus]   = useState<'connecting'|'live'|'disconnected'>('connecting');
  const [liveFeed,    setLiveFeed]    = useState<any[]>([]);
  const [liveCount,   setLiveCount]   = useState(0);
  const [kpiFlash,    setKpiFlash]    = useState<string|null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const tickerRef = useRef<HTMLDivElement>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  // ── SSE real-time connection ───────────────────────────────────────────────
  useEffect(() => {
    const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://liv-entra-api-production.up.railway.app/api/v1';
    let es: EventSource, retryT: ReturnType<typeof setTimeout>;
    function connect() {
      setSseStatus('connecting');
      es = new EventSource(`${BASE}/admin/intelligence/stream`);
      es.onopen = () => setSseStatus('live');
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          if (ev.type === 'security_event') {
            const d = ev.data;
            setLiveFeed(prev => [{ ...d, _ts: Date.now() }, ...prev.slice(0, 29)]);
            setLiveCount(p => p + 1);
            // Normalize severity to 4-level for KPI update
            const sev = d.severity === 'warning' ? 'high' : d.severity === 'info' ? 'low' : (d.severity || 'low');
            setSummary((prev: any) => {
              if (!prev) return prev;
              return {
                ...prev,
                last_24h: {
                  ...prev.last_24h,
                  [sev]: (prev.last_24h?.[sev] || 0) + 1,
                  total:  (prev.last_24h?.total  || 0) + 1,
                },
                // Escalate threat level if needed
                threat_level:
                  sev === 'critical' ? 'critical' :
                  sev === 'high' && (prev.threat_level === 'normal' || prev.threat_level === 'guarded') ? 'elevated' :
                  prev.threat_level,
              };
            });
            setKpiFlash(sev); setTimeout(() => setKpiFlash(null), 700);
            setLastRefresh(new Date());
          }
        } catch {}
      };
      es.onerror = () => { setSseStatus('disconnected'); es.close(); retryT = setTimeout(connect, 5000); };
    }
    connect();
    return () => { es?.close(); clearTimeout(retryT); };
  }, []); // eslint-disable-line

  // ── Ticker scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = tickerRef.current; if (!el || liveFeed.length === 0) return;
    let x = 0;
    const id = setInterval(() => {
      x -= 0.4;
      if (x < -el.scrollWidth / 2) x = 0;
      el.style.transform = `translateX(${x}px)`;
    }, 16);
    return () => clearInterval(id);
  }, [liveFeed]);

  // ── Load data ──────────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    if (!silent) setLoading(true);
    const results = await Promise.allSettled([
      adminApi.platformSecuritySummary(),
      adminApi.sa.listAnomalies({ limit: '100' }),
      adminApi.sa.listAudit({ limit: '50' }),
    ]);
    if (results[0].status === 'fulfilled') setSummary((results[0].value as any)?.data || null);
    if (results[1].status === 'fulfilled') setAnomalies((results[1].value as any)?.data || []);
    if (results[2].status === 'fulfilled') setAudit((results[2].value as any)?.data || []);
    if (!silent) setLoading(false);
    setLastRefresh(new Date());
  }, [router]);

  const loadEvents = useCallback(async () => {
    setEvLoading(true);
    const params: Record<string, string> = { hours, limit: '200' };
    if (sevFilter !== 'all') params.severity = sevFilter;
    if (typeFilter)          params.event_type = typeFilter;
    const result = await adminApi.securityEvents(params).catch(() => null);
    setEvents((result as any)?.data || []);
    setEvLoading(false);
  }, [hours, sevFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'events') { setEvPage(0); loadEvents(); } }, [tab, loadEvents]);

  // Auto-refresh: summary + anomalies every 30 s, events every 15 s
  useEffect(() => { const id = setInterval(() => load(true), 30_000); return () => clearInterval(id); }, [load]);
  useEffect(() => {
    if (tab !== 'events') return;
    const id = setInterval(() => loadEvents(), 15_000);
    return () => clearInterval(id);
  }, [tab, loadEvents]);

  const handleUpdateAnomaly = async (id: string, status: string) => {
    const note = status === 'resolved' ? (prompt('ملاحظة الحل (اختياري):') ?? '') : undefined;
    setActioning(id);
    try {
      await adminApi.sa.updateAnomaly(id, status, note);
      showToast('تم التحديث ✓');
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setActioning(null);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const s24 = summary?.last_24h || {};
  const threatLevel = summary?.threat_level || 'normal';
  const tl = THREAT_LEVEL[threatLevel] || THREAT_LEVEL.normal;

  const openAnomalies  = anomalies.filter(a => a.status === 'open');
  const criticalAnoms  = anomalies.filter(a => a.severity === 'critical');
  const filteredAnomalies = anomalies.filter(a =>
    (anomStatus === 'all' || a.status === anomStatus)
  );

  const filteredSim = SCENARIOS.filter(s =>
    simFilter === 'all'  ? true :
    simFilter === 'pass' ? s.detected :
    simFilter === 'fail' ? !s.detected :
    s.domain === simFilter
  );
  const simPass = SCENARIOS.filter(s => s.detected).length;

  const pagedEvents = events.slice(evPage * PAGE_SIZE, (evPage + 1) * PAGE_SIZE);
  const evTotalPages = Math.ceil(events.length / PAGE_SIZE);

  const uniqueTypes = [...new Set(events.map(e => e.event_type))].sort();

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🛡️</div>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>جاري تحميل مركز الأمان...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', direction: 'rtl' }}>
      <style>{`@keyframes ping{75%,100%{transform:scale(2);opacity:0}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: 'white', padding: '10px 24px', borderRadius: 10, fontSize: 13, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
          {toast}
        </div>
      )}

      {/* ── Nav bar ── */}
      <div style={{ background: '#0f172a', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 8px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
          <span style={{ color: '#334155', fontSize: 13 }}>|</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>🛡️ مركز الأمان</span>
          {openAnomalies.length > 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#dc2626', color: 'white', fontWeight: 700, animation: 'pulse 2s infinite' }}>
              {openAnomalies.length} تنبيه مفتوح
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* SSE live indicator */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8' }}>
            <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
              {sseStatus === 'live' && <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#22c55e', animation: 'ping 1.5s cubic-bezier(0,0,.2,1) infinite', opacity: .6 }} />}
              <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: sseStatus === 'live' ? '#22c55e' : sseStatus === 'connecting' ? '#f59e0b' : '#ef4444' }} />
            </span>
            <span style={{ color: sseStatus === 'live' ? '#22c55e' : sseStatus === 'connecting' ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
              {sseStatus === 'live' ? 'مباشر' : sseStatus === 'connecting' ? 'جاري الاتصال...' : '⚠️ منقطع'}
            </span>
            {liveCount > 0 && (
              <span style={{ background: '#dc2626', color: 'white', fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 700, animation: 'pulse 2s infinite' }}>
                +{liveCount} حدث
              </span>
            )}
            <span style={{ color: '#475569' }}>· {lastRefresh.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </span>
          {/* Threat level badge */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: tl.bg, color: tl.color, fontSize: 12, fontWeight: 700, border: `1px solid ${tl.dot}44` }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: tl.dot, display: 'inline-block' }} />
            مستوى التهديد: {tl.label}
          </span>
          <button onClick={load} style={{ fontSize: 11, padding: '4px 14px', borderRadius: 8, background: 'rgba(255,255,255,.1)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,.15)', cursor: 'pointer' }}>
            ↻ تحديث
          </button>
        </div>
      </div>

      {/* ── Live ticker ── */}
      {liveFeed.length > 0 && (
        <div style={{ background: '#0a0f1e', overflow: 'hidden', height: 30, display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(239,68,68,0.3)' }}>
          <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: '#ef4444', padding: '0 14px', borderRight: '1px solid rgba(255,255,255,0.12)', letterSpacing: 1 }}>● LIVE</span>
          <div style={{ overflow: 'hidden', flex: 1, position: 'relative' }}>
            <div ref={tickerRef} style={{ display: 'flex', gap: 48, whiteSpace: 'nowrap', willChange: 'transform', padding: '0 16px' }}>
              {[...liveFeed, ...liveFeed].map((e, i) => {
                const sevColor = e.severity === 'critical' ? '#ef4444' : e.severity === 'high' || e.severity === 'warning' ? '#f97316' : e.severity === 'medium' ? '#f59e0b' : '#38bdf8';
                return (
                  <span key={i} style={{ fontSize: 11, color: sevColor, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: sevColor, color: '#000', fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3 }}>{(e.severity || 'info').toUpperCase()}</span>
                    {EVENT_AR[e.event_type] || e.event_type}
                    {e.ip_address && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>· {e.ip_address}</span>}
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>{new Date(e.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 32px', display: 'flex', gap: 4 }}>
        {[
          { k: 'dashboard',  l: 'نظرة عامة' },
          { k: 'events',     l: `سجل الأحداث` },
          { k: 'simulation', l: `اختبار الأمان (${simPass}/${SCENARIOS.length})` },
          { k: 'anomalies',  l: `التنبيهات (${anomalies.length})` },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            style={{ fontSize: 13, padding: '14px 18px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t.k ? 700 : 400, color: tab === t.k ? '#0f172a' : '#64748b', borderBottom: tab === t.k ? '2px solid #1d4070' : '2px solid transparent', transition: 'all .15s' }}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ═══════════════ TAB: DASHBOARD ═══════════════ */}
        {tab === 'dashboard' && (
          <div>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
              {[
                { key: 'critical', label: 'حرج (24h)',   val: s24.critical ?? '—', cfg: SEV.critical },
                { key: 'high',     label: 'عالي (24h)',  val: s24.high     ?? '—', cfg: SEV.high     },
                { key: 'medium',   label: 'متوسط (24h)', val: s24.medium   ?? '—', cfg: SEV.medium   },
                { key: 'low',      label: 'منخفض (24h)', val: s24.low      ?? '—', cfg: SEV.info     },
              ].map(({ key, label, val, cfg }) => (
                <div key={label} style={{ background: kpiFlash === key ? cfg.bg : '#fff', borderRadius: 14, border: `2px solid ${kpiFlash === key ? cfg.color : cfg.border}`, padding: '20px 22px', boxShadow: kpiFlash === key ? `0 0 16px ${cfg.color}44` : '0 1px 4px rgba(0,0,0,.04)', transition: 'all .3s' }}>
                  <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, margin: '0 0 8px' }}>{label}</p>
                  <p style={{ fontSize: 30, fontWeight: 800, color: cfg.color, margin: 0, lineHeight: 1 }}>{val}</p>
                  {kpiFlash === key && <p style={{ fontSize: 10, color: cfg.color, margin: '4px 0 0', fontWeight: 700 }}>▲ حدث جديد</p>}
                </div>
              ))}
            </div>

            {/* Second row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
              {[
                { label: 'إجمالي 24h',         val: s24.total            ?? '—', color: '#0f172a' },
                { label: 'شركات متأثرة (24h)',  val: summary?.affected_companies_24h ?? '—', color: '#1d4070' },
                { label: 'قفل OTP (24h)',        val: summary?.otp_lockouts_24h       ?? '—', color: '#c2410c' },
                { label: 'شذوذات مفتوحة',        val: openAnomalies.length,           color: criticalAnoms.length > 0 ? '#dc2626' : '#15803d' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 6px' }}>{label}</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color, margin: 0 }}>{val}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* Top attacking IPs */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>أكثر IPs هجوماً (24h)</p>
                </div>
                {!summary?.top_attacking_ips?.length ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                    لا نشاط مشبوه
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['IP', 'عدد الطلبات', 'المخاطرة'].map(h => (
                          <th key={h} style={{ padding: '9px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.top_attacking_ips.map((item: any, i: number) => {
                        const risk = item.count > 100 ? 'critical' : item.count > 30 ? 'high' : 'medium';
                        return (
                          <tr key={item.ip} style={{ borderBottom: i < summary.top_attacking_ips.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <td style={{ padding: '10px 18px', fontSize: 12, fontFamily: 'monospace', color: '#0f172a', direction: 'ltr', textAlign: 'left' }}>{item.ip}</td>
                            <td style={{ padding: '10px 18px', fontSize: 13, fontWeight: 700, color: SEV[risk]?.color }}>{item.count}</td>
                            <td style={{ padding: '10px 18px' }}>
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: SEV[risk]?.bg, color: SEV[risk]?.color, fontWeight: 600 }}>
                                {SEV[risk]?.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 7-day trend + open critical anomalies */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* 7-day stats */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 22px' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '0 0 14px' }}>آخر 7 أيام</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                      { label: 'إجمالي الأحداث', val: summary?.last_7d?.total    ?? '—', color: '#0f172a' },
                      { label: 'حرج',             val: summary?.last_7d?.critical  ?? '—', color: '#dc2626' },
                      { label: 'عالي',             val: summary?.last_7d?.high      ?? '—', color: '#c2410c' },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ textAlign: 'center', padding: '10px 0' }}>
                        <p style={{ fontSize: 22, fontWeight: 700, color, margin: '0 0 4px' }}>{val}</p>
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Open critical anomalies */}
                <div style={{ background: '#fff', borderRadius: 14, border: criticalAnoms.length > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0', overflow: 'hidden', flex: 1 }}>
                  <div style={{ padding: '12px 20px', background: criticalAnoms.length > 0 ? '#fef2f2' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: criticalAnoms.length > 0 ? '#dc2626' : '#64748b', margin: 0 }}>
                      {criticalAnoms.length > 0 ? `🚨 ${criticalAnoms.length} شذوذات حرجة مفتوحة` : '✅ لا شذوذات حرجة'}
                    </p>
                  </div>
                  {criticalAnoms.slice(0, 4).map((a, i) => (
                    <div key={a.id} style={{ padding: '10px 20px', borderBottom: i < criticalAnoms.length - 1 ? '1px solid #fef2f2' : 'none' }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: '0 0 2px' }}>
                        {a.anomaly_type?.replace(/_/g, ' ')}
                      </p>
                      <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{a.description}</p>
                    </div>
                  ))}
                  <button onClick={() => setTab('anomalies')}
                    style={{ display: 'block', width: '100%', textAlign: 'center', padding: '10px', fontSize: 12, color: '#1d4070', background: 'none', border: 'none', borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}>
                    عرض كل التنبيهات ←
                  </button>
                </div>
              </div>
            </div>

            {/* Recent audit actions */}
            {audit.length > 0 && (
              <div style={{ marginTop: 20, background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>آخر إجراءات المدير</p>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{audit.length} سجل</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['الإجراء', 'المشغّل', 'الدور', 'النوع', 'التاريخ'].map(h => (
                        <th key={h} style={{ padding: '9px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {audit.slice(0, 8).map((a, i) => (
                      <tr key={a.id} style={{ borderBottom: i < 7 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={{ padding: '10px 18px' }}><span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{a.action?.replace(/_/g, ' ')}</span></td>
                        <td style={{ padding: '10px 18px', fontSize: 12, color: '#475569' }}>{a.actor_email}</td>
                        <td style={{ padding: '10px 18px' }}>
                          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: a.actor_role === 'owner' ? '#fef3c7' : '#eff6ff', color: a.actor_role === 'owner' ? '#92400e' : '#1d4070', fontWeight: 500 }}>
                            {a.actor_role}
                          </span>
                        </td>
                        <td style={{ padding: '10px 18px', fontSize: 11, color: '#64748b' }}>{a.target_type}</td>
                        <td style={{ padding: '10px 18px', fontSize: 11, color: '#94a3b8', direction: 'ltr', whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleString('ar-SA')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ TAB: EVENTS ═══════════════ */}
        {tab === 'events' && (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Severity filter */}
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { k: 'all',      l: 'الكل' },
                  { k: 'critical', l: 'حرج' },
                  { k: 'high',     l: 'عالي' },
                  { k: 'warning',  l: 'تحذير' },
                  { k: 'medium',   l: 'متوسط' },
                  { k: 'info',     l: 'منخفض' },
                ].map(f => (
                  <button key={f.k} onClick={() => { setSevFilter(f.k); setEvPage(0); }}
                    style={{ fontSize: 12, padding: '6px 12px', borderRadius: 20, border: '1px solid', cursor: 'pointer',
                      background: sevFilter === f.k ? '#0f172a' : 'white',
                      color:      sevFilter === f.k ? 'white' : '#475569',
                      borderColor: sevFilter === f.k ? '#0f172a' : '#e2e8f0',
                      fontWeight: sevFilter === f.k ? 600 : 400 }}>
                    {f.l}
                  </button>
                ))}
              </div>

              {/* Event type filter */}
              <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setEvPage(0); }}
                style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#475569', outline: 'none' }}>
                <option value=''>كل الأنواع</option>
                {uniqueTypes.map(t => <option key={t} value={t}>{EVENT_AR[t] || t}</option>)}
              </select>

              {/* Time window */}
              <select value={hours} onChange={e => { setHours(e.target.value); setEvPage(0); }}
                style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#475569', outline: 'none' }}>
                {[{ v: '6', l: 'آخر 6 ساعات' }, { v: '24', l: 'آخر 24 ساعة' }, { v: '72', l: 'آخر 3 أيام' }, { v: '168', l: 'آخر 7 أيام' }]
                  .map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>

              <button onClick={loadEvents} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, background: '#1d4070', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {evLoading ? 'جارٍ...' : 'تطبيق'}
              </button>

              <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 'auto' }}>{events.length} حدث</span>
            </div>

            {/* Events table */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['الخطورة', 'نوع الحدث', 'IP', 'الجهة', 'الشركة', 'التفاصيل', 'الوقت'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {evLoading ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: 13 }}>جاري التحميل...</td></tr>
                  ) : pagedEvents.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: 13 }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
                      لا أحداث في هذه الفترة
                    </td></tr>
                  ) : pagedEvents.map((ev, i) => {
                    const sc = SEV[ev.severity] || SEV.info;
                    const details = ev.details || {};
                    return (
                      <tr key={ev.id} style={{ borderBottom: i < pagedEvents.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 700, whiteSpace: 'nowrap', border: `1px solid ${sc.border}` }}>
                            {sc.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: 0 }}>{EVENT_AR[ev.event_type] || ev.event_type?.replace(/_/g, ' ')}</p>
                          <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0', fontFamily: 'monospace' }}>{ev.event_type}</p>
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 11, fontFamily: 'monospace', color: '#475569', direction: 'ltr', textAlign: 'left' }}>
                          {ev.ip_address || '—'}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 11, color: '#64748b' }}>{ev.actor_type || '—'}</td>
                        <td style={{ padding: '10px 16px' }}>
                          {ev.company ? (
                            <Link href={`/dashboard/companies/${ev.company.id}`} style={{ fontSize: 11, color: '#1d4070', textDecoration: 'none', fontWeight: 500 }}>
                              {ev.company.name}
                            </Link>
                          ) : <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 10, color: '#64748b', maxWidth: 180 }}>
                          {Object.keys(details).length > 0 ? (
                            <span title={JSON.stringify(details, null, 2)} style={{ cursor: 'help', borderBottom: '1px dashed #94a3b8' }}>
                              {Object.entries(details).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left' }}>
                          {new Date(ev.created_at).toLocaleString('ar-SA')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {evTotalPages > 1 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                <button onClick={() => setEvPage(p => Math.max(0, p - 1))} disabled={evPage === 0}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: evPage > 0 ? 'pointer' : 'not-allowed', color: evPage > 0 ? '#0f172a' : '#94a3b8', fontSize: 12 }}>
                  السابق
                </button>
                <span style={{ padding: '6px 14px', fontSize: 12, color: '#64748b' }}>{evPage + 1} / {evTotalPages}</span>
                <button onClick={() => setEvPage(p => Math.min(evTotalPages - 1, p + 1))} disabled={evPage >= evTotalPages - 1}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: evPage < evTotalPages - 1 ? 'pointer' : 'not-allowed', color: evPage < evTotalPages - 1 ? '#0f172a' : '#94a3b8', fontSize: 12 }}>
                  التالي
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ TAB: SIMULATION ═══════════════ */}
        {tab === 'simulation' && (
          <div>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
              {[
                { label: 'سيناريوهات مكتشفة',  val: simPass,                     color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' },
                { label: 'ثغرات غير مكتشفة',   val: SCENARIOS.length - simPass,   color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '❌' },
                { label: 'درجة الأمان',          val: `${Math.round((simPass / SCENARIOS.length) * 100)}%`, color: '#1d4070', bg: '#eff6ff', border: '#bfdbfe', icon: '🛡️' },
              ].map(({ label, val, color, bg, border, icon }) => (
                <div key={label} style={{ background: bg, borderRadius: 14, border: `1px solid ${border}`, padding: '20px 24px' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
                  <p style={{ fontSize: 28, fontWeight: 800, color, margin: '0 0 4px', lineHeight: 1 }}>{val}</p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Domain filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { k: 'all',  l: `الكل (${SCENARIOS.length})` },
                { k: 'pass', l: `ناجح (${simPass})` },
                { k: 'fail', l: `ثغرة (${SCENARIOS.length - simPass})` },
                ...['1','2','3','4','5','6','7'].map(d => {
                  const first = SCENARIOS.find(s => s.domain === d);
                  return { k: d, l: `${d}. ${first?.domain_ar}` };
                }),
              ].map(f => (
                <button key={f.k} onClick={() => setSimFilter(f.k)}
                  style={{ fontSize: 12, padding: '6px 12px', borderRadius: 20, border: '1px solid', cursor: 'pointer',
                    background: simFilter === f.k ? '#0f172a' : 'white',
                    color:      simFilter === f.k ? 'white' : '#475569',
                    borderColor: simFilter === f.k ? '#0f172a' : '#e2e8f0',
                    fontWeight: simFilter === f.k ? 600 : 400 }}>
                  {f.l}
                </button>
              ))}
            </div>

            {/* Scenarios table */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['#', 'النطاق', 'السيناريو', 'حدث الأمان المسجَّل', 'المخاطرة', 'التنبيه', 'الإصلاح', 'الحالة'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSim.map((sc, i) => {
                    const riskCfg = SEV[sc.risk] || SEV.info;
                    return (
                      <tr key={i} style={{ borderBottom: i < filteredSim.length - 1 ? '1px solid #f1f5f9' : 'none', background: sc.detected ? 'white' : '#fef9f9' }}>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#94a3b8', fontWeight: 700, width: 32 }}>{i + 1}</td>
                        <td style={{ padding: '11px 14px', width: 120 }}>
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: '#eff6ff', color: '#1d4070', fontWeight: 600 }}>{sc.domain_ar}</span>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#0f172a', maxWidth: 200 }}>{sc.scenario}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <code style={{ fontSize: 10, color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{sc.event}</code>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: riskCfg.bg, color: riskCfg.color, fontWeight: 700, border: `1px solid ${riskCfg.border}` }}>
                            {riskCfg.label}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                          {sc.alert === 'فوري' ? '🔴 فوري' : sc.alert === 'لوحة' ? '🟡 لوحة' : '🔵 سجل'}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 11, color: sc.detected ? '#15803d' : '#dc2626', maxWidth: 180 }}>{sc.fix}</td>
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          {sc.detected
                            ? <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>✅ مكتشف</span>
                            : <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>❌ ثغرة</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════ TAB: ANOMALIES ═══════════════ */}
        {tab === 'anomalies' && (
          <div>
            {/* Status filters */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              {[
                { k: 'all',           l: `الكل (${anomalies.length})` },
                { k: 'open',          l: `مفتوح (${anomalies.filter(a => a.status === 'open').length})` },
                { k: 'acknowledged',  l: `مُعترف به (${anomalies.filter(a => a.status === 'acknowledged').length})` },
                { k: 'resolved',      l: `محلول (${anomalies.filter(a => a.status === 'resolved').length})` },
              ].map(f => (
                <button key={f.k} onClick={() => setAnomStatus(f.k)}
                  style={{ fontSize: 12, padding: '6px 12px', borderRadius: 20, border: '1px solid', cursor: 'pointer',
                    background: anomStatus === f.k ? '#0f172a' : 'white',
                    color:      anomStatus === f.k ? 'white' : '#475569',
                    borderColor: anomStatus === f.k ? '#0f172a' : '#e2e8f0',
                    fontWeight: anomStatus === f.k ? 600 : 400 }}>
                  {f.l}
                </button>
              ))}
            </div>

            {filteredAnomalies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                <p style={{ fontSize: 14 }}>لا توجد شذوذات</p>
              </div>
            ) : (
              filteredAnomalies.map(a => {
                const sc  = SEV[a.severity] || SEV.info;
                const isActing = actioning === a.id;
                const stMap: Record<string, { bg: string; color: string; label: string }> = {
                  open:           { bg: '#fef2f2', color: '#dc2626', label: 'مفتوح' },
                  acknowledged:   { bg: '#fff7ed', color: '#c2410c', label: 'مُعترف به' },
                  resolved:       { bg: '#f0fdf4', color: '#15803d', label: 'محلول' },
                  false_positive: { bg: '#f1f5f9', color: '#64748b', label: 'إيجابي كاذب' },
                };
                const st = stMap[a.status] || stMap.open;
                return (
                  <div key={a.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${a.status === 'open' ? sc.color + '33' : '#e2e8f0'}`, padding: '18px 22px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 700, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                        <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#0f172a' }}>{a.anomaly_type?.replace(/_/g, ' ')}</h4>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 500 }}>{st.label}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8', direction: 'ltr' }}>{new Date(a.created_at).toLocaleString('ar-SA')}</span>
                      </div>
                    </div>

                    <p style={{ fontSize: 13, color: '#475569', margin: '0 0 6px', lineHeight: 1.6 }}>{a.description}</p>

                    {a.ai_suggestion && (
                      <p style={{ fontSize: 12, color: '#1d4070', margin: '0 0 10px', padding: '8px 12px', background: '#eff6ff', borderRadius: 8 }}>
                        💡 {a.ai_suggestion}
                      </p>
                    )}

                    {a.company && (
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 10px' }}>
                        الشركة: <Link href={`/dashboard/companies/${a.company_id}`} style={{ color: '#1d4070' }}>{a.company.name}</Link>
                      </p>
                    )}

                    {a.status === 'open' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleUpdateAnomaly(a.id, 'acknowledged')} disabled={isActing}
                          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', cursor: 'pointer' }}>
                          {isActing ? '...' : 'اعتراف'}
                        </button>
                        <button onClick={() => handleUpdateAnomaly(a.id, 'resolved')} disabled={isActing}
                          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', cursor: 'pointer' }}>
                          حلّ
                        </button>
                        <button onClick={() => handleUpdateAnomaly(a.id, 'false_positive')} disabled={isActing}
                          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer' }}>
                          إيجابي كاذب
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
}
