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
  // Meeting room — center of the building
  meeting_room:         { x: 40.6, y: 50.0, isLead: true,  zone: 'meeting' },

  // ── Executive zone (x 634–1235) ──────────────────────────────────────────
  // Lead desks sit in left sub-area (634–806), center x ≈ 58.1%
  // Spec desks sit in right sub-area (806–1235), center x ≈ 82.3%
  // Marketing has 2 specs (سارة ≈ 73.6%, ليلى ≈ 90.9%)
  it:                   { x: 58.1, y: 11.8, isLead: true,  zone: 'exec' },
  sales:                { x: 58.1, y: 31.4, isLead: true,  zone: 'exec' },
  marketing:            { x: 58.1, y: 50.9, isLead: true,  zone: 'exec' },
  finance:              { x: 58.1, y: 70.5, isLead: true,  zone: 'exec' },
  product:              { x: 58.1, y: 89.3, isLead: true,  zone: 'exec' },

  it_specialist:        { x: 82.3, y: 11.8, isLead: false, zone: 'exec' },
  sales_specialist:     { x: 82.3, y: 31.4, isLead: false, zone: 'exec' },
  marketing_specialist: { x: 73.6, y: 50.9, isLead: false, zone: 'exec' }, // سارة
  design_specialist:    { x: 90.9, y: 50.9, isLead: false, zone: 'exec' }, // ليلى
  finance_specialist:   { x: 82.3, y: 70.5, isLead: false, zone: 'exec' },
  product_specialist:   { x: 82.3, y: 89.3, isLead: false, zone: 'exec' },

  // ── Ops zone (x 5–375, col A ≈ 7.5%, col B ≈ 23.1%) ────────────────────
  leasing:              { x: 7.5,  y: 17.4, isLead: true,  zone: 'ops' }, // دانة
  collections:          { x: 23.1, y: 17.4, isLead: true,  zone: 'ops' }, // بدر
  ops:                  { x: 7.5,  y: 50.0, isLead: true,  zone: 'ops' }, // فارس
  tenant_exp:           { x: 23.1, y: 50.0, isLead: true,  zone: 'ops' }, // منى
  owner_rel:            { x: 7.5,  y: 82.6, isLead: true,  zone: 'ops' }, // نادية
  os_finance:           { x: 23.1, y: 82.6, isLead: true,  zone: 'ops' }, // رضا
};

// ── Exec combined rows (lead + specialist(s) share one wide room) ──────────
const EXEC_ROWS: { y: number; h: number; leadType: string; specType: string; specType2?: string }[] = [
  { y: 28,  h: 160, leadType: 'it',       specType: 'it_specialist'                                          },
  { y: 200, h: 160, leadType: 'sales',    specType: 'sales_specialist'                                       },
  { y: 372, h: 160, leadType: 'marketing',specType: 'marketing_specialist', specType2: 'design_specialist'   },
  { y: 544, h: 160, leadType: 'finance',  specType: 'finance_specialist'                                     },
  { y: 716, h: 156, leadType: 'product',  specType: 'product_specialist'                                     },
];
// OPS individual rooms
const OPS_ROOMS: { x: number; y: number; w: number; h: number; type: string }[] = [
  { x: 5,   y: 28,  w: 177, h: 272, type: 'leasing'    },
  { x: 197, y: 28,  w: 178, h: 272, type: 'collections' },
  { x: 5,   y: 315, w: 177, h: 272, type: 'ops'         },
  { x: 197, y: 315, w: 178, h: 272, type: 'tenant_exp'  },
  { x: 5,   y: 602, w: 177, h: 270, type: 'owner_rel'   },
  { x: 197, y: 602, w: 178, h: 270, type: 'os_finance'  },
];

function OfficeSVG() {
  const PART = 806; // x of lead/spec partition inside exec zone

  return (
    <svg viewBox="0 0 1240 880" preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>

      {/* ── Floor ── */}
      <rect x="0" y="0" width="1240" height="880" fill="#edf1f6" />

      {/* ── Zone header strips ── */}
      <rect x="5" y="5" width="370" height="22" fill="#c8dcf0" rx="2" />
      <text x="190" y="20" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#1e4a6a"
        style={{ userSelect: 'none' }}>قسم العمليات</text>

      <rect x="634" y="5" width="601" height="22" fill="#ede0c0" rx="2" />
      <text x="934" y="20" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#7a5e10"
        style={{ userSelect: 'none' }}>القسم التنفيذي</text>

      {/* ── Corridors ── */}
      <rect x="183" y="28" width="13" height="844" fill="#cddae8" />   {/* OPS vertical */}
      <rect x="5"   y="301" width="370" height="13" fill="#cddae8" />  {/* OPS H-1 */}
      <rect x="5"   y="588" width="370" height="13" fill="#cddae8" />  {/* OPS H-2 */}
      <rect x="378" y="5"   width="255" height="870" fill="#dce6f2" /> {/* centre zone */}
      <rect x="634" y="189" width="601" height="10" fill="#cddae8" />  {/* EXEC H-1 */}
      <rect x="634" y="361" width="601" height="10" fill="#cddae8" />  {/* EXEC H-2 */}
      <rect x="634" y="533" width="601" height="10" fill="#cddae8" />  {/* EXEC H-3 */}
      <rect x="634" y="705" width="601" height="10" fill="#cddae8" />  {/* EXEC H-4 */}

      {/* ── OPS rooms — spacious individual offices ── */}
      {OPS_ROOMS.map(r => {
        const info = getAgentInfo(r.type);
        const by = r.y + r.h; // room bottom y
        return (
          <g key={r.type}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="2"
              fill="#e4f0fc" stroke="#70a0c4" strokeWidth="2.2" />
            {/* Agent colour accent bar */}
            <rect x={r.x+2} y={r.y+2} width={r.w-4} height={6} rx="1" fill={info.color} opacity="0.6" />
            {/* Desk surface */}
            <rect x={r.x+14} y={by-94} width={r.w-28} height={54} rx="3"
              fill="#aecce4" stroke="#80a8c0" strokeWidth="1.2" />
            <rect x={r.x+14} y={by-94} width={r.w-28} height={7} rx="2" fill="#98bcd8" />
            {/* Monitor */}
            <rect x={r.x+r.w/2-16} y={by-132} width={32} height={22} rx="2" fill="#223850" />
            <rect x={r.x+r.w/2-5}  y={by-110} width={10} height={8}  rx="1" fill="#2e4a64" />
            {/* Chair */}
            <ellipse cx={r.x+r.w/2} cy={by-62} rx={16} ry={13}
              fill="#8ab8d4" stroke="#68a0bc" strokeWidth="1" />
            {/* Windows on outer top wall */}
            {r.y === 28 && [r.x+18, r.x+64, r.x+110].filter(wx => wx < r.x+r.w-16).map((wx, i) => (
              <rect key={i} x={wx} y={5} width={28} height={5} rx="1" fill="#80b8d8" opacity="0.7" />
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
        return (
          <g key={r.leadType}>
            {/* Room box */}
            <rect x="634" y={r.y} width="601" height={r.h} rx="2"
              fill="#fff8e8" stroke="#b89840" strokeWidth="2" />

            {/* Lead-side accent bar */}
            <rect x="636" y={r.y+2} width={PART-638} height={5} rx="1" fill={li.color} opacity="0.55" />
            {/* Spec-side accent bar */}
            <rect x={PART+2} y={r.y+2} width={1232-PART} height={5} rx="1" fill={si.color} opacity="0.45" />

            {/* Internal dashed partition (lead | spec) */}
            <line x1={PART} y1={r.y+10} x2={PART} y2={by-10}
              stroke="#c0a840" strokeWidth="1.4" strokeDasharray="6,4" />

            {/* ── LEAD DESK (x 634–806 = 172px wide) ── */}
            <rect x="642" y={deskY} width="156" height="50" rx="3"
              fill="#d4c07c" stroke="#a89840" strokeWidth="1.2" />
            <rect x="642" y={deskY} width="156" height="7" rx="2" fill="#c0b060" />
            <rect x="710" y={deskY-32} width="28" height="22" rx="2" fill="#223850" />
            <rect x="718" y={deskY-10} width="12" height="8"  rx="1" fill="#2e4a64" />
            <ellipse cx="720" cy={by-46} rx={15} ry={12} fill="#c4b068" stroke="#a09040" strokeWidth="1" />
            {/* Plant */}
            <circle cx="644" cy={r.y+18} r="8" fill="#3a6a3a" opacity="0.6" />

            {/* ── SPECIALIST DESK(S) (x 806–1235 = 429px) ── */}
            {r.specType2 ? (
              // Two specialists: سارة (left) + ليلى (right)
              <>
                <rect x="814" y={deskY} width="196" height="50" rx="3"
                  fill="#ccc0b4" stroke="#a09080" strokeWidth="1.2" />
                <rect x="814" y={deskY} width="196" height="7" rx="2" fill="#bcb0a4" />
                <rect x="895" y={deskY-32} width="26" height="22" rx="2" fill="#223850" />
                <ellipse cx="912" cy={by-46} rx={13} ry={11} fill="#b8a898" stroke="#988878" strokeWidth="1" />

                <rect x="1022" y={deskY} width="207" height="50" rx="3"
                  fill="#ccc0b4" stroke="#a09080" strokeWidth="1.2" />
                <rect x="1022" y={deskY} width="207" height="7" rx="2" fill="#bcb0a4" />
                <rect x="1116" y={deskY-32} width="26" height="22" rx="2" fill="#223850" />
                <ellipse cx="1126" cy={by-46} rx={13} ry={11} fill="#b8a898" stroke="#988878" strokeWidth="1" />

                {/* Shared room divider */}
                <line x1="1018" y1={r.y+14} x2="1018" y2={by-12}
                  stroke="#c0a898" strokeWidth="1" strokeDasharray="4,4" />

              </>
            ) : (
              // Single specialist
              <>
                <rect x="814" y={deskY} width="413" height="50" rx="3"
                  fill="#ccc0b4" stroke="#a09080" strokeWidth="1.2" />
                <rect x="814" y={deskY} width="413" height="7" rx="2" fill="#bcb0a4" />
                <rect x="1014" y={deskY-32} width="28" height="22" rx="2" fill="#223850" />
                <rect x="1022" y={deskY-10} width="12" height="8" rx="1" fill="#2e4a64" />
                <ellipse cx="1020" cy={by-46} rx={15} ry={12} fill="#b8a898" stroke="#988878" strokeWidth="1" />
              </>
            )}

            {/* Windows on outer top wall */}
            {r.y === 28 && [646, 700, 840, 940, 1040, 1140].map((wx, i) => (
              <rect key={i} x={wx} y={5} width={26} height={5} rx="1" fill="#c8ae60" opacity="0.6" />
            ))}
          </g>
        );
      })}

      {/* ── MEETING ROOM — centre of the building ── */}
      <rect x="382" y="78" width="244" height="724" rx="4"
        fill="#f5f9ff" stroke="#1e3a5f" strokeWidth="2.5" />
      {/* Header */}
      <rect x="383" y="79" width="242" height="28" rx="3" fill="#1e3a5f" />
      <text x="504" y="98" textAnchor="middle" fontSize="11" fill="white" fontWeight="800"
        style={{ userSelect: 'none' }}>غرفة الاجتماعات</text>
      {/* Projection screen */}
      <rect x="396" y="116" width="216" height="82" rx="3" fill="#d8e8f8" stroke="#90b0cc" strokeWidth="1" />
      <text x="504" y="162" textAnchor="middle" fontSize="9" fill="#6888a8"
        style={{ userSelect: 'none' }}>شاشة العرض</text>
      <line x1="504" y1="199" x2="504" y2="290" stroke="#90b0cc" strokeWidth="1" strokeDasharray="4,3" />
      {/* Conference table */}
      <ellipse cx="504" cy="450" rx="92" ry="60" fill="#cce0f0" stroke="#80a8c4" strokeWidth="1.8" />
      {/* Chairs */}
      {[0,40,80,120,160,200,240,280,320].map((deg, i) => {
        const rad = (deg-90)*Math.PI/180;
        return <circle key={i} cx={504+Math.cos(rad)*113} cy={450+Math.sin(rad)*76}
          r="12" fill="#b8d0e8" stroke="#80a8c4" strokeWidth="1" />;
      })}
      {[-44,0,44].map((dx,i) => (
        <circle key={i} cx={504+dx} cy={450} r="5" fill="#90c0e0" opacity="0.55" />
      ))}
      {/* Notes area */}
      <rect x="396" y="574" width="216" height="208" rx="3" fill="#eaf2fa" stroke="#b0c8e0" strokeWidth="1" />
      <text x="504" y="590" textAnchor="middle" fontSize="8.5" fill="#8aa4bc"
        style={{ userSelect: 'none' }}>ملاحظات الاجتماع</text>
      {[600,616,632,648,664,680,696,712,728,744,760,774].map((ly,i) => (
        <line key={i} x1="404" y1={ly} x2="604" y2={ly} stroke="#c0d4e8" strokeWidth="0.8" />
      ))}
      {/* Meeting room windows */}
      {[392,430,470,510,552].map((wx,i) => (
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
  const canvasRef = useRef<HTMLDivElement>(null);

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

  async function handleApprove(id: string) { setActing(id); try { await adminApi.sa.approveAction?.(id); await loadSidebar(); } catch {} setActing(null); }
  async function handleReject(id: string) { setActing(id); try { await adminApi.sa.rejectAction?.(id, 'Rejected'); await loadSidebar(); } catch {} setActing(null); }
  async function handleApproveReport(id: string) { setActing(id); try { await adminApi.sa.approveReport?.(id); await loadSidebar(); } catch {} setActing(null); }

  const pendingCount = actions.filter(a => a.status === 'pending_approval').length;

  function updateMessages(agentType: string, msgs: Message[]) {
    setConversations(prev => ({ ...prev, [agentType]: msgs }));
  }

  function openAgent(type: string) {
    if (type === 'meeting_room') { setMeetingOpen(true); return; }
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

        {/* OFFICE CANVAS */}
        <div ref={canvasRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#edf1f6', minHeight: 0 }}>
          <OfficeSVG />
          {Object.keys(SEAT_POS).map(type => (
            <AgentSeat key={type} type={type} isActive={activeAgent === type}
              onClick={() => openAgent(type)}
              hasConversation={(conversations[type]?.length ?? 0) > 0}
              pendingCount={type === 'meeting_room' ? pendingCount : undefined} />
          ))}
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
          onOpenAgent={t => { setActiveAgent(t); setPendingMessage(''); }}
          onAskAgent={askAgent}
        />
      )}
    </div>
  );
}
