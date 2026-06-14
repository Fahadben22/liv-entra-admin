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

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending_approval: { label: 'انتظار',     color: '#f59e0b', bg: '#fffbeb' },
  approved:         { label: 'معتمد',      color: '#10b981', bg: '#ecfdf5' },
  in_progress:      { label: 'قيد التنفيذ',color: '#3b82f6', bg: '#eff6ff' },
  done:             { label: 'منجز',       color: '#059669', bg: '#f0fdf4' },
  blocked:          { label: 'مرفوض',      color: '#ef4444', bg: '#fef2f2' },
  pending:          { label: 'معلق',       color: '#f59e0b', bg: '#fffbeb' },
};

const AGENT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  reea:        { label: 'REEA',     color: '#7c3aed', bg: '#f5f3ff' },
  collections: { label: 'تحصيل',   color: '#dc2626', bg: '#fef2f2' },
  leasing:     { label: 'تأجير',   color: '#2563eb', bg: '#eff6ff' },
  maintenance: { label: 'صيانة',   color: '#d97706', bg: '#fffbeb' },
  renewals:    { label: 'تجديد',   color: '#059669', bg: '#ecfdf5' },
  onboarding:  { label: 'استقبال', color: '#0891b2', bg: '#ecfeff' },
};

const DIRECTIVE_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'بانتظار الرد', color: '#f59e0b' },
  replied: { label: 'تم الرد',      color: '#10b981' },
  failed:  { label: 'فشل',          color: '#ef4444' },
};

function timeAgoFeed(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'الآن';
  if (sec < 3600) return `${Math.floor(sec / 60)}د`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}س`;
  return `${Math.floor(sec / 86400)}ي`;
}

// ─── Floor Plan ────────────────────────────────────────────────────────────────
interface SeatMeta { x: number; y: number; isLead: boolean; zone: 'exec' | 'ops' | 'meeting'; }

// Positions are % of canvas (1240 × 880).
// Each agent is placed at the desk centre inside their walled room.
// OPS: 2-col × 3-row grid (x 9.7% and 28.8%)
// EXEC LEADS: single col (x 71.2%), EXEC SPECS: single col (x 90.2%)
// Marketing specs (سارة/ليلى) share one room — placed side-by-side
const SEAT_POS: Record<string, SeatMeta> = {
  meeting_room:         { x: 49.3, y: 50,   isLead: true,  zone: 'meeting' },
  // Exec leads
  it:                   { x: 71.2, y: 9.4,  isLead: true,  zone: 'exec'    },
  sales:                { x: 71.2, y: 29.4, isLead: true,  zone: 'exec'    },
  marketing:            { x: 71.2, y: 49.4, isLead: true,  zone: 'exec'    },
  finance:              { x: 71.2, y: 69.4, isLead: true,  zone: 'exec'    },
  product:              { x: 71.2, y: 89.4, isLead: true,  zone: 'exec'    },
  // Exec specialists
  it_specialist:        { x: 90.2, y: 9.4,  isLead: false, zone: 'exec'    },
  sales_specialist:     { x: 90.2, y: 29.4, isLead: false, zone: 'exec'    },
  marketing_specialist: { x: 86.7, y: 46.6, isLead: false, zone: 'exec'    },
  design_specialist:    { x: 93.9, y: 52.2, isLead: false, zone: 'exec'    },
  finance_specialist:   { x: 90.2, y: 69.4, isLead: false, zone: 'exec'    },
  product_specialist:   { x: 90.2, y: 89.4, isLead: false, zone: 'exec'    },
  // Ops (col A = 9.7%, col B = 28.8%)
  leasing:              { x: 9.7,  y: 14.5, isLead: true,  zone: 'ops'     },
  collections:          { x: 28.8, y: 14.5, isLead: true,  zone: 'ops'     },
  ops:                  { x: 9.7,  y: 47.9, isLead: true,  zone: 'ops'     },
  tenant_exp:           { x: 28.8, y: 47.9, isLead: true,  zone: 'ops'     },
  owner_rel:            { x: 9.7,  y: 81.4, isLead: true,  zone: 'ops'     },
  os_finance:           { x: 28.8, y: 81.4, isLead: true,  zone: 'ops'     },
};

// Room definitions — (x, y, w, h) in SVG units (canvas 1240×880)
const OPS_ROOMS = [
  { x: 8,   y: 8,   w: 224, h: 274, type: 'leasing'    },
  { x: 248, y: 8,   w: 218, h: 274, type: 'collections' },
  { x: 8,   y: 302, w: 224, h: 274, type: 'ops'         },
  { x: 248, y: 302, w: 218, h: 274, type: 'tenant_exp'  },
  { x: 8,   y: 596, w: 224, h: 276, type: 'owner_rel'   },
  { x: 248, y: 596, w: 218, h: 276, type: 'os_finance'  },
];
const EXEC_LEAD_ROOMS = [
  { x: 778, y: 8,   w: 211, h: 161, type: 'it'        },
  { x: 778, y: 184, w: 211, h: 161, type: 'sales'     },
  { x: 778, y: 360, w: 211, h: 161, type: 'marketing' },
  { x: 778, y: 536, w: 211, h: 161, type: 'finance'   },
  { x: 778, y: 712, w: 211, h: 160, type: 'product'   },
];
const EXEC_SPEC_ROOMS = [
  { x: 1004, y: 8,   w: 228, h: 161, type: 'it_specialist',        shared: false },
  { x: 1004, y: 184, w: 228, h: 161, type: 'sales_specialist',     shared: false },
  { x: 1004, y: 360, w: 228, h: 161, type: 'marketing_specialist', shared: true  },
  { x: 1004, y: 536, w: 228, h: 161, type: 'finance_specialist',   shared: false },
  { x: 1004, y: 712, w: 228, h: 160, type: 'product_specialist',   shared: false },
];

function Desk({ x, y, w, h, fill, stroke }: { x:number; y:number; w:number; h:number; fill:string; stroke:string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill={fill} stroke={stroke} strokeWidth="1.2" />
      {/* monitor */}
      <rect x={x + w/2 - 14} y={y - 24} width={28} height={19} rx="2" fill="#2c4060" />
      <rect x={x + w/2 - 5} y={y - 5} width={10} height={6} rx="1" fill="#3a5070" />
      {/* chair */}
      <ellipse cx={x + w/2} cy={y + h + 14} rx={14} ry={11} fill={stroke} opacity="0.6" />
    </g>
  );
}

function OfficeSVG() {
  return (
    <svg viewBox="0 0 1240 880" preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>

      {/* ── Floor ── */}
      <rect x="0" y="0" width="1240" height="880" fill="#edf1f6" />

      {/* ── Corridor fills ── */}
      {/* OPS vertical corridor (between col A and col B) */}
      <rect x="233" y="8" width="14" height="864" fill="#d8e4f0" />
      {/* OPS horizontal corridors */}
      <rect x="8" y="283" width="458" height="18" fill="#d8e4f0" />
      <rect x="8" y="577" width="458" height="18" fill="#d8e4f0" />
      {/* Centre zone */}
      <rect x="467" y="8" width="310" height="864" fill="#e2eaf5" />
      {/* EXEC vertical corridor (between leads and specs) */}
      <rect x="990" y="8" width="13" height="864" fill="#d8e4f0" />
      {/* EXEC horizontal corridors */}
      <rect x="778" y="170" width="462" height="13" fill="#d8e4f0" />
      <rect x="778" y="346" width="462" height="13" fill="#d8e4f0" />
      <rect x="778" y="522" width="462" height="13" fill="#d8e4f0" />
      <rect x="778" y="698" width="462" height="13" fill="#d8e4f0" />

      {/* ── OPS rooms ── */}
      {OPS_ROOMS.map(r => {
        const info = getAgentInfo(r.type);
        const deskY = r.y + r.h - 90;
        return (
          <g key={r.type}>
            {/* Room box */}
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="2"
              fill="#e8f2ff" stroke="#7fa8cc" strokeWidth="2" />
            {/* Agent colour accent strip on top wall */}
            <rect x={r.x + 2} y={r.y + 2} width={r.w - 4} height={5} rx="1" fill={info.color} opacity="0.55" />
            {/* Desk furniture */}
            <Desk x={r.x + 14} y={deskY} w={r.w - 28} h={50} fill="#b8cfe4" stroke="#88a8c0" />
            {/* Corner nameplate */}
            <text x={r.x + r.w - 7} y={r.y + 18} textAnchor="end"
              fontSize="9.5" fontWeight="700" fill="#5a7a9a" style={{ userSelect: 'none' }}>
              {getAgentInfo(r.type).name}
            </text>
            {/* Window marks on outer top wall (rooms touching y=8) */}
            {r.y === 8 && [r.x + 22, r.x + 70, r.x + 118].map((wx, i) => (
              <rect key={i} x={wx} y={r.y - 1} width={28} height={5} rx="1" fill="#a8c8e4" opacity="0.75" />
            ))}
          </g>
        );
      })}

      {/* ── EXEC LEAD rooms (private offices) ── */}
      {EXEC_LEAD_ROOMS.map(r => {
        const info = getAgentInfo(r.type);
        const deskY = r.y + r.h - 75;
        return (
          <g key={r.type}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="2"
              fill="#fff9ed" stroke="#c4a84c" strokeWidth="1.8" />
            {/* Gold accent strip */}
            <rect x={r.x + 2} y={r.y + 2} width={r.w - 4} height={4} rx="1" fill={info.color} opacity="0.5" />
            {/* Executive desk (L-shape implied) */}
            <Desk x={r.x + 10} y={deskY} w={r.w - 20} h={44} fill="#d8c890" stroke="#b8a860" />
            {/* Plant in corner */}
            <circle cx={r.x + 16} cy={r.y + 16} r="8" fill="#3a6b3a" opacity="0.7" />
            <circle cx={r.x + 16} cy={r.y + 20} r="5" fill="#5a8a3a" opacity="0.5" />
            {/* Corner nameplate */}
            <text x={r.x + r.w - 7} y={r.y + 16} textAnchor="end"
              fontSize="9.5" fontWeight="700" fill="#8a7030" style={{ userSelect: 'none' }}>
              {info.name}
            </text>
            {/* "مدير" label */}
            <text x={r.x + 7} y={r.y + 16} textAnchor="start"
              fontSize="8" fontWeight="600" fill="#c4a84c" opacity="0.8" style={{ userSelect: 'none' }}>
              مدير
            </text>
            {r.y === 8 && [r.x + 18, r.x + 60, r.x + 102].map((wx, i) => (
              <rect key={i} x={wx} y={r.y - 1} width={24} height={5} rx="1" fill="#d4b860" opacity="0.6" />
            ))}
          </g>
        );
      })}

      {/* ── EXEC SPECIALIST rooms ── */}
      {EXEC_SPEC_ROOMS.map(r => {
        const info = getAgentInfo(r.type);
        const deskY = r.y + r.h - 75;
        return (
          <g key={r.type}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="2"
              fill="#fff5f0" stroke="#b8a090" strokeWidth="1.5" />
            {/* Accent strip */}
            <rect x={r.x + 2} y={r.y + 2} width={r.w - 4} height={4} rx="1" fill={info.color} opacity="0.4" />

            {r.shared ? (
              /* Shared room: dividing line + two desks */
              <>
                <line x1={r.x + r.w / 2} y1={r.y + 8} x2={r.x + r.w / 2} y2={r.y + r.h - 8}
                  stroke="#c8b0a8" strokeWidth="1" strokeDasharray="5,4" />
                {/* Left desk (سارة) */}
                <Desk x={r.x + 8} y={deskY} w={r.w / 2 - 14} h={44} fill="#d0b8b0" stroke="#b09888" />
                {/* Right desk (ليلى) */}
                <Desk x={r.x + r.w / 2 + 6} y={deskY} w={r.w / 2 - 14} h={44} fill="#d0b8b0" stroke="#b09888" />
                <text x={r.x + r.w - 7} y={r.y + 16} textAnchor="end"
                  fontSize="8.5" fontWeight="700" fill="#8a7068" style={{ userSelect: 'none' }}>سارة · ليلى</text>
                <text x={r.x + 7} y={r.y + 16} textAnchor="start"
                  fontSize="8" fill="#b0988a" style={{ userSelect: 'none' }}>مشترك</text>
              </>
            ) : (
              <>
                <Desk x={r.x + 10} y={deskY} w={r.w - 20} h={44} fill="#d0b8b0" stroke="#b09888" />
                <text x={r.x + r.w - 7} y={r.y + 16} textAnchor="end"
                  fontSize="9.5" fontWeight="700" fill="#7a6858" style={{ userSelect: 'none' }}>
                  {info.name}
                </text>
                <text x={r.x + 7} y={r.y + 16} textAnchor="start"
                  fontSize="8" fill="#b0988a" style={{ userSelect: 'none' }}>متخصص</text>
              </>
            )}
            {r.y === 8 && [r.x + 18, r.x + 60, r.x + 110, r.x + 155].map((wx, i) => (
              <rect key={i} x={wx} y={r.y - 1} width={22} height={5} rx="1" fill="#c8a898" opacity="0.55" />
            ))}
          </g>
        );
      })}

      {/* ── MEETING ROOM ── */}
      {/* Outer room walls */}
      <rect x="483" y="130" width="256" height="620" rx="4"
        fill="#f6faff" stroke="#1e3a5f" strokeWidth="2.5" />
      {/* Header bar */}
      <rect x="484" y="131" width="254" height="26" rx="3" fill="#1e3a5f" />
      <text x="611" y="149" textAnchor="middle" fontSize="10.5" fill="white" fontWeight="800"
        style={{ userSelect: 'none' }}>غرفة الاجتماعات</text>
      {/* Projection screen */}
      <rect x="510" y="166" width="202" height="80" rx="3" fill="#dce8f6" stroke="#9ab4cc" strokeWidth="1" />
      <rect x="516" y="172" width="190" height="68" rx="2" fill="#1e3a5f" opacity="0.07" />
      {/* Screen label */}
      <text x="611" y="210" textAnchor="middle" fontSize="9" fill="#6080a0" style={{ userSelect: 'none' }}>شاشة العرض</text>
      {/* Projector beam */}
      <line x1="611" y1="247" x2="611" y2="320" stroke="#9ab4cc" strokeWidth="1" strokeDasharray="4,3" />
      {/* Conference table */}
      <ellipse cx="611" cy="445" rx="92" ry="60" fill="#d4e2f0" stroke="#8ab0cc" strokeWidth="1.5" />
      {/* Chairs around table */}
      {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((deg, i) => {
        const rad = (deg - 90) * Math.PI / 180;
        return (
          <circle key={i} cx={611 + Math.cos(rad) * 112} cy={445 + Math.sin(rad) * 76}
            r="11" fill="#c0d4e8" stroke="#8ab0cc" strokeWidth="1" />
        );
      })}
      {/* Water glasses on table */}
      {[-50, 0, 50].map((dx, i) => (
        <circle key={i} cx={611 + dx} cy={445} r="5" fill="#a8c8e4" opacity="0.6" />
      ))}
      {/* Bottom note area */}
      <rect x="500" y="560" width="222" height="168" rx="3" fill="#edf3fa" stroke="#b8cce0" strokeWidth="1" />
      <text x="611" y="575" textAnchor="middle" fontSize="8.5" fill="#8aa0b8" style={{ userSelect: 'none' }}>ملاحظات الاجتماع</text>
      {[585, 600, 615, 630, 645, 658, 671, 684, 697, 710].map((ly, i) => (
        <line key={i} x1="510" y1={ly} x2="712" y2={ly} stroke="#c8d8e8" strokeWidth="0.8" />
      ))}
      {/* Meeting room window marks */}
      {[500, 552, 612, 664].map((wx, i) => (
        <rect key={i} x={wx} y={129} width={22} height={5} rx="1" fill="#8ab0cc" opacity="0.55" />
      ))}

      {/* ── Outer building wall ── */}
      <rect x="5" y="5" width="1230" height="870" fill="none" stroke="#6a90b0" strokeWidth="3" rx="3" />

      {/* ── Zone header labels ── */}
      <rect x="8" y="8" width="458" height="22" rx="1" fill="#dce8f8" />
      <text x="237" y="23" textAnchor="middle" fontSize="10" fontWeight="800" fill="#4a7090"
        style={{ userSelect: 'none' }}>قسم العمليات</text>
      <rect x="778" y="8" width="211" height="22" rx="1" fill="#f5ead5" />
      <text x="883" y="23" textAnchor="middle" fontSize="10" fontWeight="800" fill="#8a6a20"
        style={{ userSelect: 'none' }}>المكتب التنفيذي — مدراء</text>
      <rect x="1004" y="8" width="228" height="22" rx="1" fill="#f0e8e0" />
      <text x="1118" y="23" textAnchor="middle" fontSize="10" fontWeight="800" fill="#7a6050"
        style={{ userSelect: 'none' }}>المكتب التنفيذي — متخصصون</text>
    </svg>
  );
}

// ─── Agent Seat button ─────────────────────────────────────────────────────────
function AgentSeat({ type, isActive, onClick, hasConversation, pendingCount }: {
  type: string; isActive: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  hasConversation: boolean; pendingCount?: number;
}) {
  const pos = SEAT_POS[type]; if (!pos) return null;
  const info = getAgentInfo(type);
  const size = pos.isLead ? 38 : 30;

  return (
    <button onClick={onClick} title={`${info.name} — ${info.role}`}
      style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: isActive ? 9 : 5, padding: 0 }}>
      {/* Avatar */}
      <div style={{ width: size, height: size, borderRadius: '50%', background: info.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: pos.isLead ? 15 : 12, flexShrink: 0, position: 'relative',
        boxShadow: isActive ? `0 0 0 3px #1e3a5f, 0 8px 22px rgba(15,23,42,.32)` : `0 5px 12px rgba(15,23,42,.28), inset 0 0 0 1.5px rgba(255,255,255,.45)`,
        transition: 'box-shadow .18s',
      }}>
        {type === 'meeting_room' ? <Icon name="grid" size={pos.isLead ? 16 : 12} color="#fff" /> : info.name.charAt(0)}
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
  const [panelPos, setPanelPos]         = useState({ x: 0, y: 0 });
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [reports, setReports]           = useState<any[]>([]);
  const [actions, setActions]           = useState<any[]>([]);
  const [directives, setDirectives]     = useState<any[]>([]);
  const [pendingDirectivesCount, setPendingDirectivesCount] = useState(0);
  const [sidebarTab, setSidebarTab]     = useState<'actions' | 'reports' | 'feed'>('actions');
  const [acting, setActing]             = useState<string | null>(null);
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [meetingOpen, setMeetingOpen]   = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const loadSidebar = useCallback(async () => {
    const [r, a, d] = await Promise.allSettled([
      adminApi.sa.getMeetingReports?.(), adminApi.sa.getMeetingActions?.(), adminApi.sa.getLiveDirectives?.(),
    ]);
    if (r.status === 'fulfilled') setReports((r.value as any)?.data || []);
    if (a.status === 'fulfilled') setActions((a.value as any)?.data || []);
    if (d.status === 'fulfilled') {
      const dRes = d.value as any;
      setDirectives(dRes?.data || []);
      setPendingDirectivesCount(dRes?.pendingCount ?? 0);
    }
  }, []);

  useEffect(() => {
    loadSidebar();
    const iv = setInterval(loadSidebar, 30000);
    return () => clearInterval(iv);
  }, [loadSidebar]);

  // Close panel on outside click
  useEffect(() => {
    if (!activeAgent) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setActiveAgent(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeAgent]);

  async function handleApprove(id: string) { setActing(id); try { await adminApi.sa.approveAction?.(id); await loadSidebar(); } catch {} setActing(null); }
  async function handleReject(id: string) { setActing(id); try { await adminApi.sa.rejectAction?.(id, 'Rejected'); await loadSidebar(); } catch {} setActing(null); }
  async function handleApproveReport(id: string) { setActing(id); try { await adminApi.sa.approveReport?.(id); await loadSidebar(); } catch {} setActing(null); }

  const pendingCount = actions.filter(a => a.status === 'pending_approval').length;

  function updateMessages(agentType: string, msgs: Message[]) {
    setConversations(prev => ({ ...prev, [agentType]: msgs }));
  }

  function positionPanel(rect: DOMRect) {
    let x = rect.left + rect.width / 2 - 160;
    let y = rect.top - 450;
    x = Math.max(8, Math.min(x, window.innerWidth - 328));
    y = Math.max(56, Math.min(y, window.innerHeight - 460));
    setPanelPos({ x, y });
  }

  function openAgent(type: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (type === 'meeting_room') { setMeetingOpen(true); return; }
    setPendingMessage('');
    const rect = e.currentTarget.getBoundingClientRect();
    positionPanel(rect);
    setActiveAgent(prev => prev === type ? null : type);
  }

  function openAgentCentered(type: string) {
    setPendingMessage('');
    const x = Math.max(8, window.innerWidth / 2 - 160);
    const y = Math.max(56, window.innerHeight / 2 - 220);
    setPanelPos({ x, y });
    setActiveAgent(type);
  }

  function askAgent(agentType: string, msg: string) {
    const x = Math.max(8, window.innerWidth / 2 - 160);
    const y = Math.max(56, window.innerHeight / 2 - 220);
    setPanelPos({ x, y });
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

      {/* ── Office Floor Plan ─────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#edf1f6' }}>

        {/* Top bar inside canvas */}
        <div style={{ position: 'absolute', top: 0, inset: '0 0 auto 0', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 12 }}>
          <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500, pointerEvents: 'none' }}>لوحة التحكم / الوكلاء /</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', pointerEvents: 'none' }}>مكتب الوكلاء</span>
          <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setMeetingOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#1e3a5f', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '7px 14px', borderRadius: 9, boxShadow: '0 5px 14px rgba(30,58,95,.28)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', animation: 'seatPulse 2.4s infinite', display: 'inline-block' }} />
              غرفة الاجتماعات
            </button>
            <button onClick={() => setWorkshopOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.9)', color: '#7c3aed', border: '1px solid #ddd6fe', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '7px 12px', borderRadius: 9, backdropFilter: 'blur(4px)' }}>
              <Icon name="layers" size={13} color="#7c3aed" />
              ورشة تسويق
            </button>
          </div>
        </div>

        {/* Zone label chips */}
        <div style={{ position: 'absolute', top: 50, insetInlineEnd: 16, zIndex: 8, pointerEvents: 'none' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,253,247,.92)', border: '1px solid #efe2c2', padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#8a6608', boxShadow: '0 2px 8px rgba(15,23,42,.06)', backdropFilter: 'blur(4px)' }}>
            <Icon name="star" size={12} color="#b8860b" />
            المكتب التنفيذي
            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400 }}>5 مدراء · 6 متخصصين</span>
          </span>
        </div>
        <div style={{ position: 'absolute', bottom: 44, insetInlineStart: 16, zIndex: 8, pointerEvents: 'none' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.9)', border: '1px solid #d0e4f5', padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#1e3a5f', boxShadow: '0 2px 8px rgba(15,23,42,.06)', backdropFilter: 'blur(4px)' }}>
            <Icon name="building" size={12} color="#1e3a5f" />
            قسم العمليات
            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400 }}>6 وكلاء</span>
          </span>
        </div>

        {/* SVG background */}
        <OfficeSVG />

        {/* Agent seats */}
        {Object.keys(SEAT_POS).map(type => (
          <AgentSeat key={type} type={type} isActive={activeAgent === type}
            onClick={e => openAgent(type, e)}
            hasConversation={(conversations[type]?.length ?? 0) > 0}
            pendingCount={type === 'meeting_room' ? pendingCount : undefined} />
        ))}

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 12, insetInlineEnd: 18, zIndex: 8, display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'none' }}>
          {[{ bg: '#22c55e', label: 'متصل' }, { bg: '#f59e0b', label: 'مشغول' }, { bg: '#9ca3af', label: 'بعيد' }].map(s => (
            <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#6b7280', fontWeight: 500 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.bg, display: 'inline-block' }} />{s.label}
            </span>
          ))}
        </div>

        {/* Floating chat panel */}
        {activeAgent && info && (
          <div ref={panelRef}
            style={{ position: 'fixed', left: panelPos.x, top: panelPos.y, width: 320, height: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 22px 60px rgba(15,23,42,.22)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 30, direction: 'rtl' }}>
            {/* Panel header */}
            <div style={{ padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 9, borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: info.color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.45)' }}>
                {info.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2733' }}>{info.name}</div>
                <div style={{ fontSize: 10, color: '#6b7280' }}>{info.role}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#ecfdf3', color: '#15803d', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />متصل
              </span>
              <button onClick={handleClearChat}
                style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(0,0,0,.07)', background: 'transparent', color: '#9ca3af', cursor: 'pointer', flexShrink: 0 }}>
                مسح
              </button>
              <button onClick={() => setActiveAgent(null)}
                style={{ width: 24, height: 24, borderRadius: 7, border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name="x" size={14} color="#9ca3af" />
              </button>
            </div>
            {/* Chat */}
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
              />
            </div>
          </div>
        )}

        <style>{`
          @keyframes seatPulse { 0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)} 70%{box-shadow:0 0 0 5px rgba(34,197,94,0)} 100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} }
          @keyframes ws-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
          @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
        `}</style>
      </div>

      {/* ── Right Sidebar ─────────────────────────────────────── */}
      {sidebarOpen && (
        <div style={{ width: 300, borderRight: '1px solid rgba(0,0,0,.06)', background: 'var(--bg)', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,.04)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['feed', 'actions', 'reports'] as const).map(tab => {
                const labels: Record<string, string> = { feed: 'مباشر', actions: 'مهام', reports: `تقارير (${reports.length})` };
                const colors: Record<string, string> = { feed: '#7c3aed', actions: '#2563EB', reports: '#2563EB' };
                const isActive = sidebarTab === tab;
                return (
                  <button key={tab} onClick={() => setSidebarTab(tab)}
                    style={{ flex: 1, padding: '6px', borderRadius: 6, fontSize: 10, fontWeight: isActive ? 700 : 400, border: `1px solid ${isActive ? colors[tab] : 'rgba(0,0,0,.06)'}`, background: isActive ? `${colors[tab]}10` : 'var(--surface)', color: isActive ? colors[tab] : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    {labels[tab]}
                    {tab === 'feed' && pendingDirectivesCount > 0 && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 8, background: '#ef4444', color: '#fff', fontWeight: 700 }}>{pendingDirectivesCount}</span>}
                    {tab === 'actions' && pendingCount > 0 && <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: '50%', padding: '0 4px', fontSize: 8 }}>{pendingCount}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ padding: '8px 10px' }}>
            {/* Feed tab */}
            {sidebarTab === 'feed' && (
              <>
                {directives.length === 0 && <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', padding: 24, lineHeight: 1.7 }}>لا يوجد تواصل نشط الآن<br /><span style={{ fontSize: 10, opacity: .6 }}>ستظهر هنا الأوامر المعلّقة والردود الأخيرة</span></p>}
                {pendingDirectivesCount > 0 && <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse-dot 1.4s ease-in-out infinite' }} />{pendingDirectivesCount} بانتظار الرد</div>}
                {directives.map(d => {
                  const from = AGENT_STYLE[d.from_agent] || { label: d.from_agent, color: '#6b7280', bg: '#f9fafb' };
                  const to   = AGENT_STYLE[d.to_agent]   || { label: d.to_agent,   color: '#6b7280', bg: '#f9fafb' };
                  const st   = DIRECTIVE_STATUS[d.status] || DIRECTIVE_STATUS.pending;
                  const isPending = d.status === 'pending';
                  return (
                    <div key={d.id} style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 12px', marginBottom: 6, border: isPending ? '1px solid rgba(239,68,68,.25)' : '1px solid rgba(0,0,0,.04)', borderRight: `3px solid ${from.color}`, opacity: isPending ? 1 : 0.8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isPending && <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#ef4444', animation: 'pulse-dot 1.4s ease-in-out infinite', flexShrink: 0 }} />}
                          <span style={{ fontSize: 9, fontWeight: 700, color: from.color, background: from.bg, padding: '1px 6px', borderRadius: 4 }}>{from.label}</span>
                          <span style={{ fontSize: 9, color: '#d1d5db' }}>←</span>
                          <span style={{ fontSize: 9, fontWeight: 600, color: to.color, background: to.bg, padding: '1px 6px', borderRadius: 4 }}>{to.label}</span>
                        </div>
                        <span style={{ fontSize: 9, color: '#d1d5db' }}>{timeAgoFeed(d.created_at)}</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-1)', margin: '0 0 6px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{d.directive}</p>
                      {d.reply && (
                        <div style={{ background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: 6, padding: '6px 8px', borderRight: `2px solid ${to.color}` }}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: to.color, marginBottom: 3 }}>رد {to.label} {d.replied_at ? `· ${timeAgoFeed(d.replied_at)}` : ''}</div>
                          <p style={{ fontSize: 10, color: '#374151', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{d.reply}</p>
                        </div>
                      )}
                      <div style={{ marginTop: 4, textAlign: 'left' }}><span style={{ fontSize: 9, color: st.color, fontWeight: 600 }}>{st.label}</span></div>
                    </div>
                  );
                })}
                {directives.length > 0 && <p style={{ textAlign: 'center', fontSize: 9, color: '#d1d5db', margin: '4px 0 0' }}>معلّق + آخر 24 ساعة · تحديث كل 30 ثانية</p>}
              </>
            )}

            {/* Actions tab */}
            {sidebarTab === 'actions' && (
              <>
                {actions.map(a => {
                  const st = STATUS_MAP[a.status] || STATUS_MAP.pending_approval;
                  return (
                    <div key={a.id} style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 12px', marginBottom: 6, border: '1px solid rgba(0,0,0,.04)' }}>
                      <div style={{ marginBottom: 4 }}><span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span></div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px' }}>{a.title}</p>
                      {a.result && <p style={{ fontSize: 9, color: '#059669', margin: '2px 0' }}>{a.result?.slice(0, 80)}</p>}
                      {a.status === 'pending_approval' && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                          <button onClick={() => handleApprove(a.id)} disabled={acting === a.id} style={{ flex: 1, padding: '4px', borderRadius: 5, fontSize: 9, fontWeight: 600, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer' }}>موافقة</button>
                          <button onClick={() => handleReject(a.id)} disabled={acting === a.id} style={{ flex: 1, padding: '4px', borderRadius: 5, fontSize: 9, fontWeight: 600, border: '1px solid #fecaca', background: 'var(--surface)', color: 'var(--danger)', cursor: 'pointer' }}>رفض</button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {actions.length === 0 && <p style={{ textAlign: 'center', fontSize: 10, color: '#9ca3af', padding: 16 }}>لا توجد مهام</p>}
              </>
            )}

            {/* Reports tab */}
            {sidebarTab === 'reports' && (
              <>
                {reports.map(r => {
                  const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
                  return (
                    <div key={r.id} style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 12px', marginBottom: 6, border: '1px solid rgba(0,0,0,.04)' }}>
                      <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                      <h4 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)', margin: '4px 0 2px' }}>{r.title}</h4>
                      <p style={{ fontSize: 9, color: '#6b7280', margin: '0 0 6px', maxHeight: 40, overflow: 'hidden' }}>{r.summary?.slice(0, 120)}</p>
                      {r.status === 'pending' && (
                        <button onClick={() => handleApproveReport(r.id)} disabled={acting === r.id} style={{ width: '100%', padding: '5px', borderRadius: 5, fontSize: 10, fontWeight: 600, border: 'none', background: '#2563EB', color: '#fff', cursor: 'pointer' }}>اعتماد</button>
                      )}
                    </div>
                  );
                })}
                {reports.length === 0 && <p style={{ textAlign: 'center', fontSize: 10, color: '#9ca3af', padding: 16 }}>لا توجد تقارير</p>}
              </>
            )}
          </div>
        </div>
      )}

      {/* Sidebar toggle */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{ position: 'fixed', bottom: 16, left: 16, width: 32, height: 32, borderRadius: '50%', background: '#2563EB', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, boxShadow: '0 2px 8px rgba(124,92,252,.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {sidebarOpen ? '→' : '←'}
      </button>

      {/* Modals */}
      {workshopOpen && <MarketingWorkshop onClose={() => setWorkshopOpen(false)} />}
      {meetingOpen && (
        <MeetingRoomModal
          onClose={() => setMeetingOpen(false)}
          onOpenAgent={openAgentCentered}
          onAskAgent={askAgent}
        />
      )}
    </div>
  );
}
