'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import AgentChat, { Message } from './AgentChat';
import { adminApi, BASE, request } from '@/lib/api';
import Icon, { IconName } from '@/components/Icon';

// ─── Marketing Workshop ───────────────────────────────────────────────────────
interface WorkshopStep {
  step: number; title: string;
  status: 'waiting' | 'running' | 'done' | 'error'; content?: string;
}
interface WorkshopResult {
  brief: string; strategic_brief: string; copy_content: string;
  design_reply: string; noura_approval: string;
  post_url: string | null; canva_edit_url: string | null; post_id: string | null;
}

function MarketingWorkshop({ onClose }: { onClose: () => void }) {
  const [brief, setBrief] = useState('');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<WorkshopStep[]>([
    { step: 1, title: 'نورة تحلل وتضع الاستراتيجية', status: 'waiting' },
    { step: 2, title: 'سارة تكتب النصوص والـ Hook', status: 'waiting' },
    { step: 3, title: 'ليلى تصمم البوست', status: 'waiting' },
    { step: 4, title: 'نورة تراجع وتوافق', status: 'waiting' },
  ]);
  const [result, setResult] = useState<WorkshopResult | null>(null);
  const [error, setError] = useState('');
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const updateStep = (step: number, patch: Partial<WorkshopStep>) =>
    setSteps(prev => prev.map(s => s.step === step ? { ...s, ...patch } : s));

  async function runWorkshop() {
    if (!brief.trim()) return;
    setRunning(true); setError(''); setResult(null);
    setSteps(prev => prev.map(s => ({ ...s, status: 'waiting', content: undefined })));
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const abort = new AbortController(); abortRef.current = abort;
    try {
      const res = await fetch(`${BASE}/admin/agents/marketing/workshop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ brief }), signal: abort.signal,
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
      const reader = res.body!.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n'); buffer = parts.pop() || '';
        for (const part of parts) {
          const lines = part.split('\n'); let eventType = ''; let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
          }
          if (!dataStr) continue;
          try {
            const payload = JSON.parse(dataStr);
            if (eventType === 'step') {
              updateStep(payload.step, { title: payload.title, status: payload.status, content: payload.content });
              if (payload.status === 'running') setExpandedStep(payload.step);
              if (payload.status === 'done') setExpandedStep(null);
            } else if (eventType === 'complete') { setResult(payload); }
            else if (eventType === 'error') { setError(payload.message || 'حدث خطأ'); }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) { if (e.name !== 'AbortError') setError(e.message || 'فشل الاتصال'); }
    finally { setRunning(false); }
  }

  function handleStop() { abortRef.current?.abort(); setRunning(false); setError('تم إيقاف الورشة'); }
  const STEP_COLORS = ['#8b5cf6', '#3b82f6', '#ec4899', '#10b981'];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>ورشة التسويق</h2>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#9ca3af' }}>نورة ← سارة ← ليلى — من الفكرة إلى التصميم</p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af', padding: 4 }}>×</button>
        </div>
        {!running && !result && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,.06)', flexShrink: 0 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>ما الهدف التسويقي؟</label>
            <textarea value={brief} onChange={e => setBrief(e.target.value)}
              placeholder="مثال: بوست سناب ستوري لخصم 20% على باقة Liventra الاحترافية للمشتركين الجدد هذا الأسبوع فقط"
              rows={3} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 12, resize: 'none', outline: 'none', fontFamily: 'inherit', direction: 'rtl' }}
              onFocus={e => e.target.style.borderColor = '#8b5cf6'} onBlur={e => (e.target.style.borderColor = '')} />
            <button onClick={runWorkshop} disabled={!brief.trim()}
              style={{ marginTop: 8, width: '100%', padding: '11px', borderRadius: 8, background: brief.trim() ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : 'var(--border)', color: brief.trim() ? '#fff' : 'var(--text-muted)', border: 'none', fontSize: 13, fontWeight: 700, cursor: brief.trim() ? 'pointer' : 'not-allowed', transition: 'all .15s' }}>
              ابدأ الورشة
            </button>
          </div>
        )}
        {(running || result) && (
          <div style={{ padding: '10px 20px', background: 'var(--bg)', borderBottom: '1px solid rgba(0,0,0,.06)', flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--text-3)' }}>{brief}</p>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {steps.map((s, i) => {
            const isExpanded = expandedStep === s.step || (result && s.content);
            return (
              <div key={s.step} style={{ marginBottom: 8 }}>
                <button onClick={() => setExpandedStep(isExpanded ? null : s.step)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${s.status === 'done' ? STEP_COLORS[i] + '30' : s.status === 'running' ? STEP_COLORS[i] + '40' : 'rgba(0,0,0,.05)'}`, background: s.status === 'running' ? STEP_COLORS[i] + '08' : s.status === 'done' ? STEP_COLORS[i] + '05' : 'var(--bg)', cursor: s.content ? 'pointer' : 'default', transition: 'all .15s' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: s.status === 'waiting' ? 'var(--bg)' : s.status === 'running' ? STEP_COLORS[i] + '20' : STEP_COLORS[i] + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, transition: 'all .2s' }}>
                    {s.status === 'running' ? <div style={{ animation: 'ws-spin 1s linear infinite', display: 'flex' }}><Icon name="refresh" size={14} color={STEP_COLORS[i]} /></div>
                      : s.status === 'done' ? <span style={{ color: STEP_COLORS[i], fontSize: 12, fontWeight: 700 }}>تم</span>
                      : `0${i + 1}`}
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: s.status !== 'waiting' ? 600 : 400, color: s.status === 'waiting' ? 'var(--text-muted)' : s.status === 'running' ? STEP_COLORS[i] : 'var(--text-1)' }}>{s.title}</p>
                    {s.status === 'running' && <p style={{ margin: '2px 0 0', fontSize: 9, color: STEP_COLORS[i] }}>جارٍ العمل...</p>}
                    {s.status === 'done' && s.content && <p style={{ margin: '2px 0 0', fontSize: 9, color: 'var(--text-muted)' }}>اضغط لرؤية التفاصيل ▾</p>}
                  </div>
                  {s.status === 'done' && <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: STEP_COLORS[i] + '15', color: STEP_COLORS[i], fontWeight: 600, flexShrink: 0 }}>مكتمل</span>}
                </button>
                {isExpanded && s.content && (
                  <div style={{ margin: '4px 0 0', padding: '12px 14px', background: 'var(--bg)', borderRadius: '0 0 10px 10px', border: `1px solid ${STEP_COLORS[i]}20`, borderTop: 'none' }}>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', direction: 'rtl' }}>{s.content}</p>
                  </div>
                )}
              </div>
            );
          })}
          {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', marginTop: 4 }}><p style={{ margin: 0, fontSize: 11, color: '#ef4444' }}>{error}</p></div>}
          {result?.post_url && (
            <div style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden', border: '2px solid #8b5cf640', background: 'linear-gradient(135deg,#fdf4ff,#f0f9ff)' }}>
              <div style={{ padding: '12px 14px', background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: '#fff' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>التصميم جاهز!</p>
                <p style={{ margin: '2px 0 0', fontSize: 9, opacity: 0.85 }}>اكتملت الورشة — من الفكرة إلى التصميم النهائي</p>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <img src={result.post_url} alt="التصميم النهائي" style={{ width: '100%', borderRadius: 8, display: 'block', marginBottom: 10, border: '1px solid rgba(0,0,0,.08)' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  {result.canva_edit_url && <a href={result.canva_edit_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: '#fff', textDecoration: 'none', fontSize: 11, fontWeight: 700, textAlign: 'center', display: 'block' }}>فتح في Canva</a>}
                  <a href={result.post_url} download target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'var(--ink-900)', color: '#fff', textDecoration: 'none', fontSize: 11, fontWeight: 700, textAlign: 'center', display: 'block' }}>تحميل PNG</a>
                </div>
                {result.noura_approval && <div style={{ marginTop: 8, padding: '8px 10px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}><p style={{ margin: 0, fontSize: 10, color: '#166534', lineHeight: 1.6 }}>{result.noura_approval}</p></div>}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(0,0,0,.06)', display: 'flex', gap: 8, flexShrink: 0 }}>
          {running ? (
            <button onClick={handleStop} style={{ flex: 1, padding: '9px', borderRadius: 8, background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>إيقاف الورشة</button>
          ) : result ? (
            <button onClick={() => { setResult(null); setBrief(''); setSteps(prev => prev.map(s => ({ ...s, status: 'waiting', content: undefined }))); setExpandedStep(null); }}
              style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>ورشة جديدة</button>
          ) : null}
          {!running && <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, background: 'var(--bg)', color: 'var(--text-2)', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>إغلاق</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Morning Briefing Card ─────────────────────────────────────────────────────
function MorningBriefingCard({ onAskAgent }: { onAskAgent: (agentType: string, msg: string) => void }) {
  const [briefing, setBriefing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    adminApi.sa.getTodayBriefing?.().then((r: any) => {
      const b = r?.data; setBriefing(b || null);
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
    <div style={{ margin: '10px 10px 0', background: 'var(--surface)', border: '1px solid rgba(37,99,235,.15)', borderRadius: 10, overflow: 'hidden' }}>
      <button onClick={() => setExpanded(!expanded)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: 'none', background: expanded ? 'rgba(37,99,235,.04)' : 'transparent', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>●</span>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>ملخص اليوم</p>
            <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>{today}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {actionsCount > 0 && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: '#dcfce7', color: '#166534', fontWeight: 700 }}>{actionsCount} إجراء تلقائي</span>}
          {!briefing && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>لا يوجد</span>}
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
                  {briefing.actions_taken.map((a: any, i: number) => <p key={i} style={{ fontSize: 9, color: '#374151', margin: '2px 0' }}>• {a.company_name}: {a.result?.slice(0, 60)}</p>)}
                </div>
              )}
              <button onClick={() => onAskAgent('product', 'اشرح لي ملخص اليوم بالتفصيل وما الإجراءات التي تقترحها؟')}
                style={{ width: '100%', padding: '6px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: 'none', background: 'rgba(37,99,235,.08)', color: '#2563EB', cursor: 'pointer' }}>
                اسأل يوسف عن هذا
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 8px' }}>لا يوجد ملخص لليوم — يُنشأ تلقائياً في 7:15 صباحاً</p>
              <button onClick={handleTrigger} disabled={triggering}
                style={{ padding: '5px 16px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: '1px solid #2563EB', background: 'var(--surface)', color: '#2563EB', cursor: 'pointer' }}>
                {triggering ? 'جارٍ الإنشاء...' : 'أنشئ الآن'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Agent Registry ────────────────────────────────────────────────────────────
const AGENTS = [
  { type: 'meeting_room', name: 'الاجتماعات', icon: 'grid',     color: '#2563EB', role: 'غرفة الاجتماعات', quickActions: ['نظرة شاملة على كل الأقسام', 'KPIs اليوم', 'أنشئ تقرير تنفيذي', 'الخطط النشطة', 'مشاكل تحتاج انتباهي'] },
  { type: 'it',           name: 'سالم',      icon: 'shield',    color: '#3b82f6', role: 'IT', spec: 'it_specialist', specName: 'طارق', specIcon: 'wrench', quickActions: ['حالة النظام', 'Cloudflare', 'أنماط الأخطاء', 'أحداث أمنية', 'SSL'] },
  { type: 'sales',        name: 'خالد',      icon: 'briefcase', color: '#22c55e', role: 'مبيعات', spec: 'sales_specialist', specName: 'عمر', specIcon: 'phone', quickActions: ['تجارب قريبة الانتهاء — من منهم يستحق تمديداً؟', 'عملاء خاملون — من نحتاج نبعث لهم إيميل تفعيل؟', 'خط أنابيب المبيعات', 'MRR والاشتراكات', 'ملخص الأسبوع'] },
  { type: 'marketing',    name: 'نورة',      icon: 'bar-chart', color: '#8b5cf6', role: 'تسويق', spec: 'marketing_specialist', specName: 'سارة', specIcon: 'send', spec2: 'design_specialist', specName2: 'ليلى', specIcon2: 'sparkles', quickActions: ['KPIs الأسبوع', 'الحملات', 'الزوار', 'التحويل', 'المصادر'] },
  { type: 'finance',      name: 'ريم',       icon: 'dollar',    color: '#f59e0b', role: 'مالية', spec: 'finance_specialist', specName: 'ماجد', specIcon: 'receipt', quickActions: ['معدل التحصيل هذا الشهر لكل شركة', 'المتأخرات', 'MRR', 'المصروفات', 'التوقعات'] },
  { type: 'product',      name: 'يوسف',      icon: 'zap',       color: '#06b6d4', role: 'منتج', spec: 'product_specialist', specName: 'لينا (SaaS)', specIcon: 'search', quickActions: ['عملاء خاملون — قائمة مع توصية لكل منهم', 'شركات تواجه مشاكل تشغيلية أو مالية', 'تبني الميزات — أيها مُستخدم وأيها مهجور', 'الشركات الجديدة خلال آخر 14 يوم وحال انطلاقها', 'NPS والمغادرة'] },
  { type: 'leasing',      name: 'دانة',      icon: 'home',      color: '#10b981', role: 'تأجير',               quickActions: ['عقود تنتهي قريباً', 'وحدات شاغرة', 'حالة التأجير', 'تسجيلات إيجار معلقة', 'أنبوب العملاء المحتملين'] },
  { type: 'collections',  name: 'بدر',       icon: 'dollar',    color: '#f97316', role: 'تحصيل',              quickActions: ['من المتأخرون؟', 'تقرير التحصيل', 'خطط الدفع', 'المتأخرون +30 يوم', 'معدل التحصيل هذا الشهر'] },
  { type: 'ops',          name: 'فارس',      icon: 'wrench',    color: '#6366f1', role: 'عمليات',             quickActions: ['تذاكر مفتوحة', 'انتهاك SLA', 'طلبات الشراء المعلقة', 'تقرير تكاليف الصيانة', 'الحالات الطارئة'] },
  { type: 'tenant_exp',   name: 'منى',       icon: 'users',     color: '#ec4899', role: 'تجربة المستأجر',    quickActions: ['تجديدات قادمة', 'شكاوى مفتوحة', 'إرسال إعلان', 'المستأجرون المنتهية عقودهم', 'مؤشرات رضا المستأجرين'] },
  { type: 'owner_rel',    name: 'نادية',     icon: 'key',       color: '#0ea5e9', role: 'علاقات الملاك',     quickActions: ['تسويات معلقة', 'تقارير الملاك', 'أداء العقارات', 'كشف حساب مالك', 'قلق مالك جديد'] },
  { type: 'os_finance',   name: 'رضا',       icon: 'receipt',   color: '#a855f7', role: 'مراقب مالي',        quickActions: ['صافي الدخل التشغيلي', 'الميزانية مقابل الفعلي', 'التدفق النقدي', 'تقرير رسوم الإدارة', 'إنشاء تقرير شهري'] },
];

const SPEC_ACTIONS: Record<string, string[]> = {
  it_specialist:        ['مهامي', 'صحة النظام', 'أنماط الأخطاء'],
  sales_specialist:     ['مهامي', 'تواصل مع عميل', 'الوحدات الشاغرة'],
  marketing_specialist: ['مهامي', 'التحويل', 'المصادر'],
  finance_specialist:   ['مهامي', 'الفواتير', 'المتأخرات'],
  product_specialist:   ['مهامي', 'التذاكر', 'الميزات'],
  design_specialist:    ['مهامي', 'صمم بوست إنستجرام', 'اقترح هوية بصرية', 'كتابة نص إعلاني'],
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

// ─── Floor Plan ────────────────────────────────────────────────────────────────
// Layout (canvas 1240 × 880):
//   OPS ZONE  x=5–375    2-col × 3-row individual offices
//   CENTER    x=380–628  tall meeting room
//   EXEC ZONE x=634–1235 5 combined rows — lead desk left (634–806) + spec desk(s) right (806–1235)
//             internal dashed partition at x=806

interface SeatMeta { x: number; y: number; isLead: boolean; zone: 'exec' | 'ops' | 'meeting'; }

// Agent photos — real photos (PNG) + illustrated SVG portraits for the rest
const AGENT_PHOTOS: Record<string, string> = {
  // Real photos
  meeting_room:         '/agents/sultan.png',
  it:                   '/agents/nasser.png',
  sales:                '/agents/khalid.png',
  marketing:            '/agents/noura.png',
  product:              '/agents/abdullah.png',
  it_specialist:        '/agents/tariq.png',
  sales_specialist:     '/agents/turki.png',
  marketing_specialist: '/agents/sara.png',
  finance_specialist:   '/agents/majed.png',
  collections:          '/agents/yasser.png',
  // SVG illustrated portraits
  finance:              '/agents/reem.svg',
  leasing:              '/agents/dana.svg',
  ops:                  '/agents/fares.svg',
  tenant_exp:           '/agents/mona.svg',
  owner_rel:            '/agents/nadia.svg',
  os_finance:           '/agents/reza.svg',
  design_specialist:    '/agents/layla.svg',
  product_specialist:   '/agents/lina.svg',
};

const SEAT_POS: Record<string, SeatMeta> = {
  // ── Executive zone (x 715–1235) ──────────────────────────────────────────
  // Lead desks in left sub-area (715–880), center x ≈ 64.3%
  // Spec desks in right sub-area (880–1235), center x ≈ 85.3%
  // Marketing has 2 specs (سارة ≈ 78.1%, ليلى ≈ 92.4%)
  it:                   { x: 64.3, y: 11.8, isLead: true,  zone: 'exec' },
  sales:                { x: 64.3, y: 31.4, isLead: true,  zone: 'exec' },
  marketing:            { x: 64.3, y: 50.9, isLead: true,  zone: 'exec' },
  finance:              { x: 64.3, y: 70.5, isLead: true,  zone: 'exec' },
  product:              { x: 64.3, y: 89.3, isLead: true,  zone: 'exec' },

  it_specialist:        { x: 85.3, y: 11.8, isLead: false, zone: 'exec' },
  sales_specialist:     { x: 85.3, y: 31.4, isLead: false, zone: 'exec' },
  marketing_specialist: { x: 78.1, y: 50.9, isLead: false, zone: 'exec' }, // سارة
  design_specialist:    { x: 92.4, y: 50.9, isLead: false, zone: 'exec' }, // ليلى
  finance_specialist:   { x: 85.3, y: 70.5, isLead: false, zone: 'exec' },
  product_specialist:   { x: 85.3, y: 89.3, isLead: false, zone: 'exec' },

  // ── Ops zone (x 5–332, col A ≈ 6.8%, col B ≈ 20.4%) ────────────────────
  leasing:              { x: 6.8,  y: 17.4, isLead: true,  zone: 'ops' }, // دانة
  collections:          { x: 20.4, y: 17.4, isLead: true,  zone: 'ops' }, // بدر
  ops:                  { x: 6.8,  y: 50.0, isLead: true,  zone: 'ops' }, // فارس
  tenant_exp:           { x: 20.4, y: 50.0, isLead: true,  zone: 'ops' }, // منى
  owner_rel:            { x: 6.8,  y: 82.6, isLead: true,  zone: 'ops' }, // نادية
  os_finance:           { x: 20.4, y: 82.6, isLead: true,  zone: 'ops' }, // رضا
};

// ── Meeting room — 7 core agents seated around the conference table ────────
// Table centre in SVG: (522, 410). Positions are % of 1240×880 canvas.
// REEA presides at the head (top); clicking REEA opens the meeting overview.
const MEETING_SEATS: { type: string; name: string; photo: string; x: number; y: number; head?: boolean }[] = [
  { type: 'reea',        name: 'REEA',  photo: '/agents/reea.png',   x: 42.1, y: 28.0, head: true },
  { type: 'it',          name: 'سالم',  photo: '/agents/nasser.png', x: 51.8, y: 36.0 },
  { type: 'product',     name: 'يوسف',  photo: '/agents/abdullah.png', x: 53.6, y: 47.0 },
  { type: 'finance',     name: 'ريم',   photo: '/agents/reem.svg',   x: 51.8, y: 58.0 },
  { type: 'collections', name: 'بدر',   photo: '/agents/yasser.png', x: 32.4, y: 36.0 },
  { type: 'ops',         name: 'فارس',  photo: '/agents/fares.svg',  x: 30.6, y: 47.0 },
  { type: 'os_finance',  name: 'رضا',   photo: '/agents/reza.svg',   x: 32.4, y: 58.0 },
];

// ── Exec combined rows (lead + specialist(s) share one wide room) ──────────
const EXEC_X = 715, EXEC_W = 520, EXEC_PART = 880; // partition between lead & spec
const EXEC_ROWS: { y: number; h: number; leadType: string; specType: string; specType2?: string }[] = [
  { y: 28,  h: 160, leadType: 'it',       specType: 'it_specialist'                                          },
  { y: 200, h: 160, leadType: 'sales',    specType: 'sales_specialist'                                       },
  { y: 372, h: 160, leadType: 'marketing',specType: 'marketing_specialist', specType2: 'design_specialist'   },
  { y: 544, h: 160, leadType: 'finance',  specType: 'finance_specialist'                                     },
  { y: 716, h: 156, leadType: 'product',  specType: 'product_specialist'                                     },
];
// OPS individual rooms (left col x=5 w=158, right col x=173 w=159)
const OPS_ROOMS: { x: number; y: number; w: number; h: number; type: string }[] = [
  { x: 5,   y: 28,  w: 158, h: 272, type: 'leasing'     },
  { x: 173, y: 28,  w: 159, h: 272, type: 'collections' },
  { x: 5,   y: 315, w: 158, h: 272, type: 'ops'         },
  { x: 173, y: 315, w: 159, h: 272, type: 'tenant_exp'  },
  { x: 5,   y: 602, w: 158, h: 270, type: 'owner_rel'   },
  { x: 173, y: 602, w: 159, h: 270, type: 'os_finance'  },
];

// Wrap Arabic/LTR text into SVG lines
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  if (!text) return [];
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
    if (lines.length >= maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) {
    const used = lines.join(' ').length;
    if (text.trim().length > used + 1) lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1) + '…';
  }
  return lines.slice(0, maxLines);
}

// Strip markdown markers / collapse whitespace for clean SVG text
function sanitize(s?: string): string {
  return (s || '').replace(/[*#_`>]/g, '').replace(/\s+/g, ' ').trim();
}

function OfficeSVG({ meetingTopic, meetingDecisions, meetingDate, meetingLive }: { meetingTopic?: string; meetingDecisions?: string; meetingDate?: string; meetingLive?: boolean }) {
  const PART = EXEC_PART;
  const topicLines = wrapText(sanitize(meetingTopic), 26, 2);
  const noteLines  = wrapText(sanitize(meetingDecisions), 42, 6);

  return (
    <svg viewBox="0 0 1240 880" preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <defs>
        <clipPath id="notesClip"><rect x="364" y="646" width="316" height="138" rx="3" /></clipPath>
      </defs>

      {/* ── Floor ── */}
      <rect x="0" y="0" width="1240" height="880" fill="#edf1f6" />

      {/* ── Zone header strips ── */}
      <rect x="5" y="5" width="327" height="22" fill="#c8dcf0" rx="2" />
      <text x="168" y="20" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#1e4a6a"
        style={{ userSelect: 'none' }}>قسم العمليات</text>

      <rect x={EXEC_X} y="5" width={EXEC_W} height="22" fill="#ede0c0" rx="2" />
      <text x={EXEC_X + EXEC_W/2} y="20" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#7a5e10"
        style={{ userSelect: 'none' }}>القسم التنفيذي</text>

      {/* ── Corridors ── */}
      <rect x="163" y="28" width="10" height="844" fill="#cddae8" />   {/* OPS vertical */}
      <rect x="5"   y="301" width="327" height="13" fill="#cddae8" />  {/* OPS H-1 */}
      <rect x="5"   y="588" width="327" height="13" fill="#cddae8" />  {/* OPS H-2 */}
      <rect x="338" y="5"   width="369" height="870" fill="#dce6f2" /> {/* centre zone */}
      <rect x={EXEC_X} y="189" width={EXEC_W} height="10" fill="#cddae8" />  {/* EXEC H-1 */}
      <rect x={EXEC_X} y="361" width={EXEC_W} height="10" fill="#cddae8" />  {/* EXEC H-2 */}
      <rect x={EXEC_X} y="533" width={EXEC_W} height="10" fill="#cddae8" />  {/* EXEC H-3 */}
      <rect x={EXEC_X} y="705" width={EXEC_W} height="10" fill="#cddae8" />  {/* EXEC H-4 */}

      {/* ── OPS rooms — spacious individual offices ── */}
      {OPS_ROOMS.map(r => {
        const info = getAgentInfo(r.type);
        const by = r.y + r.h;
        return (
          <g key={r.type}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="2"
              fill="#e4f0fc" stroke="#70a0c4" strokeWidth="2.2" />
            <rect x={r.x+2} y={r.y+2} width={r.w-4} height={6} rx="1" fill={info.color} opacity="0.6" />
            <rect x={r.x+14} y={by-94} width={r.w-28} height={54} rx="3"
              fill="#aecce4" stroke="#80a8c0" strokeWidth="1.2" />
            <rect x={r.x+14} y={by-94} width={r.w-28} height={7} rx="2" fill="#98bcd8" />
            <rect x={r.x+r.w/2-16} y={by-132} width={32} height={22} rx="2" fill="#223850" />
            <rect x={r.x+r.w/2-5}  y={by-110} width={10} height={8}  rx="1" fill="#2e4a64" />
            <ellipse cx={r.x+r.w/2} cy={by-62} rx={16} ry={13} fill="#8ab8d4" stroke="#68a0bc" strokeWidth="1" />
            {r.y === 28 && [r.x+18, r.x+58, r.x+98].filter(wx => wx < r.x+r.w-16).map((wx, i) => (
              <rect key={i} x={wx} y={5} width={26} height={5} rx="1" fill="#80b8d8" opacity="0.7" />
            ))}
          </g>
        );
      })}

      {/* ── EXEC combined rooms — lead + specialist(s) in one wide room ── */}
      {EXEC_ROWS.map(r => {
        const li = getAgentInfo(r.leadType);
        const si = getAgentInfo(r.specType);
        const by = r.y + r.h;
        const deskY = by - 80;
        const specMid = (PART + (EXEC_X + EXEC_W)) / 2; // centre of single-spec sub-area
        return (
          <g key={r.leadType}>
            <rect x={EXEC_X} y={r.y} width={EXEC_W} height={r.h} rx="2"
              fill="#fff8e8" stroke="#b89840" strokeWidth="2" />
            <rect x={EXEC_X+2} y={r.y+2} width={PART-EXEC_X-4} height={5} rx="1" fill={li.color} opacity="0.55" />
            <rect x={PART+2} y={r.y+2} width={EXEC_X+EXEC_W-PART-4} height={5} rx="1" fill={si.color} opacity="0.45" />
            <line x1={PART} y1={r.y+10} x2={PART} y2={by-10} stroke="#c0a840" strokeWidth="1.4" strokeDasharray="6,4" />

            {/* LEAD DESK (715–880 = 165px) */}
            <rect x={EXEC_X+8} y={deskY} width="148" height="50" rx="3" fill="#d4c07c" stroke="#a89840" strokeWidth="1.2" />
            <rect x={EXEC_X+8} y={deskY} width="148" height="7" rx="2" fill="#c0b060" />
            <rect x={EXEC_X+71} y={deskY-32} width="26" height="22" rx="2" fill="#223850" />
            <ellipse cx={EXEC_X+82} cy={by-46} rx={15} ry={12} fill="#c4b068" stroke="#a09040" strokeWidth="1" />
            <circle cx={EXEC_X+16} cy={r.y+18} r="8" fill="#3a6a3a" opacity="0.6" />

            {/* SPECIALIST DESK(S) (880–1235 = 355px) */}
            {r.specType2 ? (
              <>
                <rect x={PART+8} y={deskY} width="158" height="50" rx="3" fill="#ccc0b4" stroke="#a09080" strokeWidth="1.2" />
                <rect x={PART+8} y={deskY} width="158" height="7" rx="2" fill="#bcb0a4" />
                <rect x={PART+74} y={deskY-32} width="24" height="22" rx="2" fill="#223850" />
                <ellipse cx={PART+87} cy={by-46} rx={12} ry={10} fill="#b8a898" stroke="#988878" strokeWidth="1" />

                <rect x={PART+182} y={deskY} width="161" height="50" rx="3" fill="#ccc0b4" stroke="#a09080" strokeWidth="1.2" />
                <rect x={PART+182} y={deskY} width="161" height="7" rx="2" fill="#bcb0a4" />
                <rect x={PART+250} y={deskY-32} width="24" height="22" rx="2" fill="#223850" />
                <ellipse cx={PART+262} cy={by-46} rx={12} ry={10} fill="#b8a898" stroke="#988878" strokeWidth="1" />

                <line x1={PART+174} y1={r.y+14} x2={PART+174} y2={by-12} stroke="#c0a898" strokeWidth="1" strokeDasharray="4,4" />
              </>
            ) : (
              <>
                <rect x={PART+8} y={deskY} width={EXEC_X+EXEC_W-PART-16} height="50" rx="3" fill="#ccc0b4" stroke="#a09080" strokeWidth="1.2" />
                <rect x={PART+8} y={deskY} width={EXEC_X+EXEC_W-PART-16} height="7" rx="2" fill="#bcb0a4" />
                <rect x={specMid-14} y={deskY-32} width="28" height="22" rx="2" fill="#223850" />
                <ellipse cx={specMid} cy={by-46} rx={15} ry={12} fill="#b8a898" stroke="#988878" strokeWidth="1" />
              </>
            )}

            {r.y === 28 && [EXEC_X+12, EXEC_X+60, PART+30, PART+120, PART+210, PART+300].map((wx, i) => (
              <rect key={i} x={wx} y={5} width={24} height={5} rx="1" fill="#c8ae60" opacity="0.6" />
            ))}
          </g>
        );
      })}

      {/* ── MEETING ROOM — centre, enlarged ── */}
      <rect x="345" y="78" width="355" height="724" rx="4" fill="#f5f9ff" stroke="#1e3a5f" strokeWidth="2.5" />
      {/* Header */}
      <rect x="346" y="79" width="353" height="28" rx="3" fill="#1e3a5f" />
      <text x="522" y="98" textAnchor="middle" fontSize="12" fill="white" fontWeight="800"
        style={{ userSelect: 'none' }}>غرفة الاجتماعات</text>

      {/* Projection screen — shows current meeting TOPIC + live date */}
      <rect x="372" y="116" width="300" height="98" rx="3" fill="#16263c" stroke="#90b0cc" strokeWidth="1.5" />
      <rect x="378" y="122" width="288" height="86" rx="2" fill="#1e3a5f" />
      {/* live badge */}
      {meetingLive && (
        <>
          <circle cx="392" cy="135" r="3.5" fill="#4ade80" />
          <text x="402" y="138" textAnchor="start" fontSize="7.5" fontWeight="700" fill="#4ade80" style={{ userSelect: 'none' }}>مباشر</text>
        </>
      )}
      <text x="652" y="138" textAnchor="end" fontSize="7.5" fill="#7aa0c4" style={{ userSelect: 'none' }}>
        {meetingDate || 'موضوع الاجتماع الحالي'}
      </text>
      {topicLines.length > 0 ? topicLines.map((ln, i) => (
        <text key={i} x="522" y={162 + i*19} textAnchor="middle" fontSize="13" fontWeight="700" fill="#ffffff" style={{ userSelect: 'none' }}>{ln}</text>
      )) : (
        <text x="522" y="172" textAnchor="middle" fontSize="11" fill="#6a88a8" style={{ userSelect: 'none' }}>لا يوجد اجتماع نشط</text>
      )}
      {/* projector mount */}
      <line x1="522" y1="214" x2="522" y2="236" stroke="#90b0cc" strokeWidth="1" strokeDasharray="3,3" />

      {/* Conference table — tall oval, seats around it */}
      <ellipse cx="522" cy="408" rx="116" ry="142" fill="#cce0f0" stroke="#7098bc" strokeWidth="2" />
      <ellipse cx="522" cy="408" rx="94" ry="120" fill="#d8e8f6" stroke="#a8c4dc" strokeWidth="1" />
      {/* documents on table */}
      {[[-38,362],[38,362],[-38,454],[38,454],[0,408]].map(([dx,dy],i) => (
        <rect key={i} x={522+dx-13} y={dy-9} width={26} height={18} rx="2" fill="#ffffff" stroke="#bcd0e0" strokeWidth="0.8" opacity="0.85" />
      ))}

      {/* Notes / Decisions area — bottom of room, clipped, never overflows */}
      <rect x="362" y="624" width="320" height="166" rx="4" fill="#fffdf2" stroke="#d8c88c" strokeWidth="1.4" />
      <rect x="362" y="624" width="320" height="24" rx="4" fill="#f0e6c2" />
      <rect x="362" y="638" width="320" height="10" fill="#f0e6c2" />
      <circle cx="376" cy="636" r="3" fill="#b8860b" />
      <text x="674" y="640" textAnchor="end" fontSize="10" fontWeight="800" fill="#8a6e20" style={{ userSelect: 'none' }}>
        محضر الاجتماع · القرارات
      </text>
      {noteLines.length > 0 ? (
        <g clipPath="url(#notesClip)">
          {noteLines.map((ln, i) => (
            <text key={i} x="672" y={664 + i*19} textAnchor="end" fontSize="10" fill="#4a4230" style={{ userSelect: 'none' }}>{ln}</text>
          ))}
        </g>
      ) : (
        <text x="522" y="712" textAnchor="middle" fontSize="10" fill="#b0a878" style={{ userSelect: 'none' }}>
          ستظهر قرارات آخر اجتماع هنا
        </text>
      )}

      {/* Meeting room windows on top wall */}
      {[358,410,470,530,590,650].map((wx,i) => (
        <rect key={i} x={wx} y={77} width={22} height={5} rx="1" fill="#7aacc8" opacity="0.55" />
      ))}

      {/* ── Outer building wall ── */}
      <rect x="5" y="5" width="1230" height="870" fill="none" stroke="#5a8ab0" strokeWidth="3" rx="3" />
    </svg>
  );
}

// ─── Agent Seat button ─────────────────────────────────────────────────────────
function AgentSeat({ type, isActive, onClick, hasConversation, pendingCount }: {
  type: string; isActive: boolean;
  onClick: () => void;
  hasConversation: boolean; pendingCount?: number;
}) {
  const pos = SEAT_POS[type]; if (!pos) return null;
  const info = getAgentInfo(type);
  const size = pos.isLead ? 38 : 30;

  return (
    <button onClick={onClick} title={`${info.name} — ${info.role}`}
      style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: isActive ? 9 : 5, padding: 0 }}>
      {/* Avatar */}
      <div style={{ width: size, height: size, borderRadius: '50%', background: info.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: pos.isLead ? 15 : 12, flexShrink: 0, position: 'relative', overflow: 'hidden',
        boxShadow: isActive ? `0 0 0 3px #1e3a5f, 0 8px 22px rgba(15,23,42,.32)` : `0 5px 12px rgba(15,23,42,.28), inset 0 0 0 1.5px rgba(255,255,255,.45)`,
        transition: 'box-shadow .18s',
      }}>
        {AGENT_PHOTOS[type]
          ? <img src={AGENT_PHOTOS[type]} alt={info.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', borderRadius: '50%' }} />
          : type === 'meeting_room'
            ? <Icon name="grid" size={pos.isLead ? 16 : 12} color="#fff" />
            : info.name.charAt(0)
        }
        <span style={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff', animation: 'seatPulse 2.4s infinite' }} />
        {(pendingCount ?? 0) > 0 && (
          <span style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pendingCount}</span>
        )}
      </div>
      {/* Nameplate */}
      <div style={{ background: 'rgba(255,255,255,.95)', border: `1px solid ${isActive ? '#1e3a5f' : '#e5eaef'}`, borderRadius: 8, padding: '4px 9px 5px', boxShadow: '0 4px 12px rgba(15,23,42,.10)', whiteSpace: 'nowrap', textAlign: 'center', transition: 'border-color .18s', pointerEvents: 'none' }}>
        {pos.isLead && type !== 'meeting_room' && (
          <span style={{ fontSize: 7.5, fontWeight: 700, color: '#a07d22', background: '#fdf7e6', border: '1px solid #ecdcb2', padding: '0 4px', borderRadius: 999, marginLeft: 5 }}>قائد</span>
        )}
        <span style={{ fontSize: pos.isLead ? 12 : 10.5, fontWeight: 700, color: '#1f2733' }}>{info.name}</span>
        <span style={{ display: 'block', fontSize: 9, color: '#6b7280', marginTop: 1 }}>{info.role}</span>
        {hasConversation && !isActive && (
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: info.color, margin: '2px auto 0' }} />
        )}
      </div>
    </button>
  );
}

// ─── Meeting Seat (core agent seated around the conference table) ───────────────
function MeetingSeat({ seat, onClick, badge }: {
  seat: typeof MEETING_SEATS[number];
  onClick: () => void;
  badge?: number;
}) {
  const size = seat.head ? 46 : 38;
  return (
    <button onClick={onClick} title={seat.name}
      style={{ position: 'absolute', left: `${seat.x}%`, top: `${seat.y}%`, transform: 'translate(-50%,-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 8, padding: 0 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, position: 'relative',
        boxShadow: seat.head
          ? '0 0 0 3px #b8860b, 0 6px 16px rgba(15,23,42,.35)'
          : '0 0 0 2px #ffffff, 0 5px 13px rgba(15,23,42,.30)',
        background: '#1e3a5f' }}>
        <img src={seat.photo} alt={seat.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
        <span style={{ position: 'absolute', right: 0, bottom: 0, width: 9, height: 9, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />
        {(badge ?? 0) > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 8, background: '#ef4444', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
        )}
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, color: seat.head ? '#8a6608' : '#1e3a5f', background: 'rgba(255,255,255,.92)', padding: '1px 6px', borderRadius: 6, boxShadow: '0 1px 4px rgba(15,23,42,.12)', whiteSpace: 'nowrap' }}>
        {seat.head ? `${seat.name} · المنسّق` : seat.name}
      </span>
    </button>
  );
}

// ─── Meeting Room Modal ────────────────────────────────────────────────────────
function MeetingRoomModal({ onClose, onOpenAgent, onAskAgent }: {
  onClose: () => void;
  onOpenAgent: (type: string) => void;
  onAskAgent: (type: string, msg: string) => void;
}) {
  const execTypes = ['meeting_room','it','sales','marketing','finance','product'];
  const opsTypes  = ['leasing','collections','ops','tenant_exp','owner_rel','os_finance'];

  function AgentRow({ a }: { a: typeof AGENTS[0] }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: a.color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
          {a.name.charAt(0)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1f2733' }}>{a.name}</div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>{a.role}</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#ecfdf3', color: '#15803d', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> متصل
        </span>
        <button onClick={() => { onOpenAgent(a.type); onClose(); }}
          style={{ fontSize: 10, padding: '4px 10px', borderRadius: 7, border: '1px solid #e5eaef', background: 'transparent', color: '#1e3a5f', cursor: 'pointer', fontWeight: 600 }}>
          محادثة
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.34)', zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 460, maxWidth: '100%', maxHeight: '86vh', background: 'var(--surface)', borderRadius: 18, boxShadow: '0 30px 70px rgba(15,23,42,.3)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1e3a5f', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="grid" size={18} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>غرفة الاجتماعات</h3>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '1px 0 0' }}>توفر الفريق في الوقت الحالي</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <Icon name="x" size={16} color="#9ca3af" />
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <MorningBriefingCard onAskAgent={(type, msg) => { onAskAgent(type, msg); onClose(); }} />
          <p style={{ fontSize: 10.5, fontWeight: 700, color: '#6b7280', padding: '12px 16px 4px' }}>المكتب التنفيذي</p>
          {AGENTS.filter(a => execTypes.includes(a.type)).map(a => <AgentRow key={a.type} a={a} />)}
          <p style={{ fontSize: 10.5, fontWeight: 700, color: '#6b7280', padding: '10px 16px 4px', borderTop: '1px solid var(--border)', marginTop: 6 }}>قسم العمليات</p>
          {AGENTS.filter(a => opsTypes.includes(a.type)).map(a => <AgentRow key={a.type} a={a} />)}
          <div style={{ height: 12 }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Workspace ────────────────────────────────────────────────────────────
export default function AgentsWorkspace() {
  const [activeAgent, setActiveAgent]   = useState<string | null>(null);
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const [reports, setReports]           = useState<any[]>([]);
  const [actions, setActions]           = useState<any[]>([]);
  const [briefing, setBriefing]         = useState<any>(null);
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [meetingOpen, setMeetingOpen]   = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);

  const loadMeeting = useCallback(async () => {
    const [r, a, b] = await Promise.allSettled([
      adminApi.sa.getMeetingReports?.(), adminApi.sa.getMeetingActions?.(), adminApi.sa.getTodayBriefing?.(),
    ]);
    if (r.status === 'fulfilled') setReports((r.value as any)?.data || []);
    if (a.status === 'fulfilled') setActions((a.value as any)?.data || []);
    if (b.status === 'fulfilled') setBriefing((b.value as any)?.data || null);
  }, []);

  useEffect(() => {
    loadMeeting();
    const iv = setInterval(loadMeeting, 30000);
    return () => clearInterval(iv);
  }, [loadMeeting]);

  const pendingCount = actions.filter(a => a.status === 'pending_approval').length;

  // Meeting board — real-time: prefer today's briefing, else latest exec report.
  function meetingDateLabel(iso?: string) {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  const latestReport = reports[0] || null;
  let meetingTopic = '', meetingDecisions = '', meetingDate = '', meetingLive = false;
  if (briefing) {
    meetingLive = true;
    meetingTopic = 'الموجز التنفيذي اليومي';
    meetingDate  = meetingDateLabel(briefing.created_at);
    const acts = (briefing.actions_taken || []).map((x: any) => `• ${x.company_name || ''}: ${x.result || ''}`).join('  ');
    meetingDecisions = [briefing.content, acts].filter(Boolean).join('  ').trim();
  } else if (latestReport) {
    meetingTopic = latestReport.title || '';
    meetingDate  = meetingDateLabel(latestReport.created_at);
    meetingDecisions = latestReport.summary || '';
  }

  function updateMessages(agentType: string, msgs: Message[]) {
    setConversations(prev => ({ ...prev, [agentType]: msgs }));
  }

  function openAgent(type: string) {
    if (type === 'meeting_room' || type === 'reea') { setMeetingOpen(true); return; }
    setPendingMessage('');
    setActiveAgent(prev => prev === type ? null : type);
  }

  function askAgent(agentType: string, msg: string) {
    setActiveAgent(agentType);
    setPendingMessage(msg);
  }

  async function handleClearChat() {
    if (!activeAgent) return;
    try { await request('DELETE', `/admin/agents/${activeAgent}/clear`); } catch {}
    setConversations(prev => ({ ...prev, [activeAgent]: [] }));
  }

  const info = activeAgent ? getAgentInfo(activeAgent) : null;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      {/* ── Main column: top bar + floor plan + bottom drawer ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* TOP BAR — own row, never overlaps SVG */}
        <div style={{ flexShrink: 0, background: '#e6ecf5', borderBottom: '1px solid #cdd8e8', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 20 }}>
          <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>لوحة التحكم / الوكلاء /</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f' }}>مكتب الوكلاء</span>
          <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setMeetingOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#1e3a5f', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '7px 14px', borderRadius: 9, boxShadow: '0 4px 12px rgba(30,58,95,.25)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', animation: 'seatPulse 2.4s infinite', display: 'inline-block' }} />
              غرفة الاجتماعات
            </button>
            <button onClick={() => setWorkshopOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: '#7c3aed', border: '1px solid #ddd6fe', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '7px 12px', borderRadius: 9 }}>
              <Icon name="layers" size={13} color="#7c3aed" />
              ورشة تسويق
            </button>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {[{ bg: '#22c55e', label: 'متصل' }, { bg: '#f59e0b', label: 'مشغول' }, { bg: '#9ca3af', label: 'بعيد' }].map(s => (
              <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#6b7280' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.bg, display: 'inline-block' }} />{s.label}
              </span>
            ))}
          </div>
        </div>

        {/* OFFICE CANVAS — container-query box; stage fits fully, never crops */}
        <div ref={canvasRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#edf1f6', minHeight: 0, containerType: 'size', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
          {/* Fixed-aspect stage — SVG and % avatars share one coordinate system */}
          <div style={{ position: 'relative', aspectRatio: '1240 / 880', width: 'min(100cqw, 100cqh * 1240 / 880)', maxWidth: '100%', maxHeight: '100%' }}>
            <OfficeSVG meetingTopic={meetingTopic} meetingDecisions={meetingDecisions} meetingDate={meetingDate} meetingLive={meetingLive} />
            {/* Office desk seats */}
            {Object.keys(SEAT_POS).map(type => (
              <AgentSeat key={type} type={type} isActive={activeAgent === type}
                onClick={() => openAgent(type)}
                hasConversation={(conversations[type]?.length ?? 0) > 0} />
            ))}
            {/* Meeting-room seated core agents */}
            {MEETING_SEATS.map(seat => (
              <MeetingSeat key={seat.type} seat={seat}
                onClick={() => openAgent(seat.type)}
                badge={seat.head ? pendingCount : undefined} />
            ))}
          </div>
        </div>

        {/* BOTTOM DRAWER — full-width chat panel, slides up */}
        {activeAgent && info && (
          <div style={{ flexShrink: 0, height: 460, display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderTop: `3px solid ${info.color}`, animation: 'drawerUp .22s cubic-bezier(.22,1,.36,1)', overflow: 'hidden' }}>
            {/* Drawer header */}
            <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: info.color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0, overflow: 'hidden', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.4)' }}>
                {AGENT_PHOTOS[activeAgent!]
                  ? <img src={AGENT_PHOTOS[activeAgent!]} alt={info.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                  : info.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2733' }}>{info.name}</div>
                <div style={{ fontSize: 10.5, color: '#6b7280' }}>{info.role}</div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: '#ecfdf3', color: '#15803d', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />متصل
              </span>
              <button onClick={handleClearChat}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(0,0,0,.08)', background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}>
                مسح
              </button>
              <button onClick={() => setActiveAgent(null)}
                style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                title="إغلاق">
                <Icon name="chevron-down" size={16} color="#6b7280" />
              </button>
            </div>
            {/* AgentChat fills the rest */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <AgentChat
                key={activeAgent}
                agentType={activeAgent}
                agentName={info.name}
                agentIcon={info.icon as IconName}
                accentColor={info.color}
                quickActions={info.quickActions || []}
                messages={conversations[activeAgent] || []}
                onMessagesChange={msgs => updateMessages(activeAgent, msgs)}
                compact={true}
                pendingMessage={pendingMessage}
                photoSrc={AGENT_PHOTOS[activeAgent] || ''}
              />
            </div>
          </div>
        )}

        <style>{`
          @keyframes seatPulse { 0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)} 70%{box-shadow:0 0 0 5px rgba(34,197,94,0)} 100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} }
          @keyframes drawerUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
          @keyframes ws-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
          @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
        `}</style>
      </div>

      {/* Modals */}
      {workshopOpen && <MarketingWorkshop onClose={() => setWorkshopOpen(false)} />}
      {meetingOpen && (
        <MeetingRoomModal
          onClose={() => setMeetingOpen(false)}
          onOpenAgent={t => { setActiveAgent(t); setPendingMessage(''); }}
          onAskAgent={askAgent}
        />
      )}
    </div>
  );
}
