'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import AgentChat, { Message } from './AgentChat';
import { adminApi, BASE } from '@/lib/api';

// ─── Marketing Workshop ───────────────────────────────────────────────────────
interface WorkshopStep {
  step: number;
  title: string;
  status: 'waiting' | 'running' | 'done' | 'error';
  content?: string;
}
interface WorkshopResult {
  brief: string;
  strategic_brief: string;
  copy_content: string;
  design_reply: string;
  noura_approval: string;
  post_url: string | null;
  canva_edit_url: string | null;
  post_id: string | null;
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

  const updateStep = (step: number, patch: Partial<WorkshopStep>) => {
    setSteps(prev => prev.map(s => s.step === step ? { ...s, ...patch } : s));
  };

  async function runWorkshop() {
    if (!brief.trim()) return;
    setRunning(true);
    setError('');
    setResult(null);
    setSteps(prev => prev.map(s => ({ ...s, status: 'waiting', content: undefined })));

    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch(`${BASE}/admin/agents/marketing/workshop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ brief }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = '';
          let dataStr = '';
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
            } else if (eventType === 'complete') {
              setResult(payload);
            } else if (eventType === 'error') {
              setError(payload.message || 'حدث خطأ');
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message || 'فشل الاتصال');
    } finally {
      setRunning(false);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setRunning(false);
    setError('تم إيقاف الورشة');
  }

  const STEP_ICONS = ['🎯', '✍️', '🎨', '✅'];
  const STEP_COLORS = ['#8b5cf6', '#3b82f6', '#ec4899', '#10b981'];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>🏭 ورشة التسويق</h2>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#9ca3af' }}>نورة ← سارة ← ليلى — من الفكرة إلى التصميم</p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af', padding: 4 }}>✕</button>
        </div>

        {/* Brief input */}
        {!running && !result && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,.06)', flexShrink: 0 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>ما الهدف التسويقي؟</label>
            <textarea
              value={brief}
              onChange={e => setBrief(e.target.value)}
              placeholder="مثال: بوست سناب ستوري لخصم 20% على باقة Liventra الاحترافية للمشتركين الجدد هذا الأسبوع فقط"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12, resize: 'none', outline: 'none', fontFamily: 'inherit', direction: 'rtl' }}
              onFocus={e => e.target.style.borderColor = '#8b5cf6'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
            <button
              onClick={runWorkshop}
              disabled={!brief.trim()}
              style={{ marginTop: 8, width: '100%', padding: '11px', borderRadius: 8, background: brief.trim() ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : '#e2e8f0', color: brief.trim() ? '#fff' : '#9ca3af', border: 'none', fontSize: 13, fontWeight: 700, cursor: brief.trim() ? 'pointer' : 'not-allowed', transition: 'all .15s' }}>
              🚀 ابدأ الورشة
            </button>
          </div>
        )}

        {/* Running brief display */}
        {(running || result) && (
          <div style={{ padding: '10px 20px', background: '#f8fafc', borderBottom: '1px solid rgba(0,0,0,.06)', flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: 10, color: '#64748b' }}>📋 {brief}</p>
          </div>
        )}

        {/* Steps */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {steps.map((s, i) => {
            const isExpanded = expandedStep === s.step || (result && s.content);
            return (
              <div key={s.step} style={{ marginBottom: 8 }}>
                <button
                  onClick={() => setExpandedStep(isExpanded ? null : s.step)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${s.status === 'done' ? STEP_COLORS[i] + '30' : s.status === 'running' ? STEP_COLORS[i] + '40' : 'rgba(0,0,0,.05)'}`, background: s.status === 'running' ? STEP_COLORS[i] + '08' : s.status === 'done' ? STEP_COLORS[i] + '05' : '#fafafa', cursor: s.content ? 'pointer' : 'default', transition: 'all .15s' }}>
                  {/* Icon */}
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: s.status === 'waiting' ? '#f1f5f9' : s.status === 'running' ? STEP_COLORS[i] + '20' : STEP_COLORS[i] + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, transition: 'all .2s' }}>
                    {s.status === 'running' ? (
                      <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 14 }}>⟳</span>
                    ) : s.status === 'done' ? (
                      <span style={{ color: STEP_COLORS[i], fontSize: 14 }}>✓</span>
                    ) : (
                      STEP_ICONS[i]
                    )}
                  </div>
                  {/* Title */}
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: s.status !== 'waiting' ? 600 : 400, color: s.status === 'waiting' ? '#94a3b8' : s.status === 'running' ? STEP_COLORS[i] : '#1e293b' }}>{s.title}</p>
                    {s.status === 'running' && <p style={{ margin: '2px 0 0', fontSize: 9, color: STEP_COLORS[i] }}>جارٍ العمل...</p>}
                    {s.status === 'done' && s.content && <p style={{ margin: '2px 0 0', fontSize: 9, color: '#94a3b8' }}>اضغط لرؤية التفاصيل ▾</p>}
                  </div>
                  {/* Status badge */}
                  {s.status === 'done' && (
                    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: STEP_COLORS[i] + '15', color: STEP_COLORS[i], fontWeight: 600, flexShrink: 0 }}>مكتمل</span>
                  )}
                </button>
                {/* Expanded content */}
                {isExpanded && s.content && (
                  <div style={{ margin: '4px 0 0', padding: '12px 14px', background: '#f8fafc', borderRadius: '0 0 10px 10px', border: `1px solid ${STEP_COLORS[i]}20`, borderTop: 'none' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#475569', lineHeight: 1.7, whiteSpace: 'pre-wrap', direction: 'rtl' }}>{s.content}</p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', marginTop: 4 }}>
              <p style={{ margin: 0, fontSize: 11, color: '#ef4444' }}>⚠️ {error}</p>
            </div>
          )}

          {/* Final result card */}
          {result?.post_url && (
            <div style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden', border: '2px solid #8b5cf640', background: 'linear-gradient(135deg,#fdf4ff,#f0f9ff)' }}>
              <div style={{ padding: '12px 14px', background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: '#fff' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>🎉 التصميم جاهز!</p>
                <p style={{ margin: '2px 0 0', fontSize: 9, opacity: 0.85 }}>اكتملت الورشة — من الفكرة إلى التصميم النهائي</p>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <img src={result.post_url} alt="التصميم النهائي" style={{ width: '100%', borderRadius: 8, display: 'block', marginBottom: 10, border: '1px solid rgba(0,0,0,.08)' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  {result.canva_edit_url && (
                    <a href={result.canva_edit_url} target="_blank" rel="noopener noreferrer"
                      style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: '#fff', textDecoration: 'none', fontSize: 11, fontWeight: 700, textAlign: 'center', display: 'block' }}>
                      ✏️ فتح في Canva
                    </a>
                  )}
                  <a href={result.post_url} download target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, padding: '9px', borderRadius: 8, background: '#1e293b', color: '#fff', textDecoration: 'none', fontSize: 11, fontWeight: 700, textAlign: 'center', display: 'block' }}>
                    ⬇️ تحميل PNG
                  </a>
                </div>
                {result.noura_approval && (
                  <div style={{ marginTop: 8, padding: '8px 10px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                    <p style={{ margin: 0, fontSize: 10, color: '#166534', lineHeight: 1.6 }}>📊 {result.noura_approval}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(0,0,0,.06)', display: 'flex', gap: 8, flexShrink: 0 }}>
          {running ? (
            <button onClick={handleStop} style={{ flex: 1, padding: '9px', borderRadius: 8, background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              ⬛ إيقاف الورشة
            </button>
          ) : result ? (
            <button onClick={() => { setResult(null); setBrief(''); setSteps(prev => prev.map(s => ({ ...s, status: 'waiting', content: undefined }))); setExpandedStep(null); }}
              style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              ➕ ورشة جديدة
            </button>
          ) : null}
          {!running && <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>إغلاق</button>}
        </div>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// ─── Morning Briefing Card ────────────────────────────────────────────────────
function MorningBriefingCard({ onAskAgent }: { onAskAgent: (agentType: string, msg: string) => void }) {
  const [briefing, setBriefing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    adminApi.sa.getTodayBriefing?.().then((r: any) => {
      const b = r?.data;
      setBriefing(b || null);
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
    <div style={{ margin: '10px 10px 0', background: '#fff', border: '1px solid rgba(37,99,235,.15)', borderRadius: 10, overflow: 'hidden' }}>
      <button onClick={() => setExpanded(!expanded)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: 'none', background: expanded ? 'rgba(37,99,235,.04)' : 'transparent', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 16 }}>☀️</span>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#1E293B', margin: 0 }}>ملخص اليوم</p>
            <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>{today}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {actionsCount > 0 && (
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: '#dcfce7', color: '#166534', fontWeight: 700 }}>
              {actionsCount} إجراء تلقائي
            </span>
          )}
          {!briefing && (
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
              لا يوجد
            </span>
          )}
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
                  {briefing.actions_taken.map((a: any, i: number) => (
                    <p key={i} style={{ fontSize: 9, color: '#374151', margin: '2px 0' }}>• {a.company_name}: {a.result?.slice(0, 60)}</p>
                  ))}
                </div>
              )}
              <button
                onClick={() => onAskAgent('product', 'اشرح لي ملخص اليوم بالتفصيل وما الإجراءات التي تقترحها؟')}
                style={{ width: '100%', padding: '6px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: 'none', background: 'rgba(37,99,235,.08)', color: '#2563EB', cursor: 'pointer' }}>
                اسأل يوسف عن هذا
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 8px' }}>لا يوجد ملخص لليوم — يُنشأ تلقائياً في 7:15 صباحاً</p>
              <button onClick={handleTrigger} disabled={triggering}
                style={{ padding: '5px 16px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: '1px solid #2563EB', background: '#fff', color: '#2563EB', cursor: 'pointer' }}>
                {triggering ? 'جارٍ الإنشاء...' : 'أنشئ الآن'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Agent Registry (fixed order = spatial memory) ───────────────────────────
const AGENTS = [
  { type: 'meeting_room', name: 'الاجتماعات', icon: '🏛️', color: '#2563EB', role: 'غرفة الاجتماعات', quickActions: ['نظرة شاملة على كل الأقسام', 'KPIs اليوم', 'أنشئ تقرير تنفيذي', 'الخطط النشطة', 'مشاكل تحتاج انتباهي'] },
  { type: 'it', name: 'سالم', icon: '🛡️', color: '#3b82f6', role: 'IT', spec: 'it_specialist', specName: 'طارق', specIcon: '🔧', quickActions: ['حالة النظام', 'Cloudflare', 'أنماط الأخطاء', 'أحداث أمنية', 'SSL'] },
  { type: 'sales', name: 'خالد', icon: '💼', color: '#22c55e', role: 'مبيعات', spec: 'sales_specialist', specName: 'عمر', specIcon: '📞', quickActions: ['تجارب قريبة الانتهاء — من منهم يستحق تمديداً؟', 'عملاء خاملون — من نحتاج نبعث لهم إيميل تفعيل؟', 'خط أنابيب المبيعات', 'MRR والاشتراكات', 'ملخص الأسبوع'] },
  { type: 'marketing', name: 'نورة', icon: '📊', color: '#8b5cf6', role: 'تسويق', spec: 'marketing_specialist', specName: 'سارة', specIcon: '📱', spec2: 'design_specialist', specName2: 'ليلى', specIcon2: '🎨', quickActions: ['KPIs الأسبوع', 'الحملات', 'الزوار', 'التحويل', 'المصادر'] },
  { type: 'finance', name: 'ريم', icon: '💰', color: '#f59e0b', role: 'مالية', spec: 'finance_specialist', specName: 'ماجد', specIcon: '📋', quickActions: ['معدل التحصيل هذا الشهر لكل شركة', 'المتأخرات', 'MRR', 'المصروفات', 'التوقعات'] },
  { type: 'product', name: 'يوسف', icon: '🚀', color: '#06b6d4', role: 'منتج', spec: 'product_specialist', specName: 'لينا', specIcon: '🔍', quickActions: ['عملاء خاملون — قائمة مع توصية لكل منهم', 'شركات تواجه مشاكل تشغيلية أو مالية', 'تبني الميزات — أيها مُستخدم وأيها مهجور', 'الشركات الجديدة خلال آخر 14 يوم وحال انطلاقها', 'NPS والمغادرة'] },
];

// Specialist quick actions
const SPEC_ACTIONS: Record<string, string[]> = {
  it_specialist: ['مهامي', 'صحة النظام', 'أنماط الأخطاء'],
  sales_specialist: ['مهامي', 'تواصل مع عميل', 'الوحدات الشاغرة'],
  marketing_specialist: ['مهامي', 'التحويل', 'المصادر'],
  finance_specialist: ['مهامي', 'الفواتير', 'المتأخرات'],
  product_specialist: ['مهامي', 'التذاكر', 'الميزات'],
  design_specialist: ['مهامي', 'صمم بوست إنستجرام', 'اقترح هوية بصرية', 'كتابة نص إعلاني'],
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
  pending_approval: { label: 'انتظار', color: '#f59e0b', bg: '#fffbeb' },
  approved: { label: 'معتمد', color: '#10b981', bg: '#ecfdf5' },
  in_progress: { label: 'قيد التنفيذ', color: '#3b82f6', bg: '#eff6ff' },
  done: { label: 'منجز', color: '#059669', bg: '#f0fdf4' },
  blocked: { label: 'مرفوض', color: '#ef4444', bg: '#fef2f2' },
  pending: { label: 'معلق', color: '#f59e0b', bg: '#fffbeb' },
};

export default function AgentsWorkspace() {
  const [activeAgent, setActiveAgent] = useState('meeting_room');
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'actions' | 'reports'>('actions');
  const [acting, setActing] = useState<string | null>(null);
  const [workshopOpen, setWorkshopOpen] = useState(false);

  const loadSidebar = useCallback(async () => {
    const [r, a] = await Promise.allSettled([adminApi.sa.getMeetingReports?.(), adminApi.sa.getMeetingActions?.()]);
    if (r.status === 'fulfilled') setReports((r.value as any)?.data || []);
    if (a.status === 'fulfilled') setActions((a.value as any)?.data || []);
  }, []);
  useEffect(() => { loadSidebar(); const iv = setInterval(loadSidebar, 30000); return () => clearInterval(iv); }, [loadSidebar]);

  async function handleApprove(id: string) { setActing(id); try { await adminApi.sa.approveAction?.(id); await loadSidebar(); } catch {} setActing(null); }
  async function handleReject(id: string) { setActing(id); try { await adminApi.sa.rejectAction?.(id, 'Rejected'); await loadSidebar(); } catch {} setActing(null); }
  async function handleApproveReport(id: string) { setActing(id); try { await adminApi.sa.approveReport?.(id); await loadSidebar(); } catch {} setActing(null); }

  const info = getAgentInfo(activeAgent);
  const pendingCount = actions.filter(a => a.status === 'pending_approval').length;

  // Update conversation for active agent
  function updateMessages(msgs: Message[]) {
    setConversations(prev => ({ ...prev, [activeAgent]: msgs }));
  }

  // Switch to agent and auto-send a message (used by briefing card)
  const [pendingMessage, setPendingMessage] = useState<string>('');
  function askAgent(agentType: string, msg: string) {
    setActiveAgent(agentType);
    setPendingMessage(msg);
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      {/* LEFT: Agent list panel */}
      <div style={{ width: 240, borderLeft: '1px solid rgba(0,0,0,.06)', background: '#fff', overflowY: 'auto', flexShrink: 0 }}>
        <MorningBriefingCard onAskAgent={askAgent} />
        <div style={{ padding: '14px 12px 8px', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', margin: 0 }}>الفريق</h2>
        </div>
        {AGENTS.map(a => {
          const isActive = activeAgent === a.type;
          const specActive = activeAgent === a.spec;
          const msgs = conversations[a.type] || [];
          const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
          return (
            <div key={a.type}>
              {/* Manager */}
              <button onClick={() => setActiveAgent(a.type)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: 'none', background: isActive ? `${a.color}08` : 'transparent', cursor: 'pointer', borderRight: isActive ? `3px solid ${a.color}` : '3px solid transparent', transition: 'all .1s' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{a.icon}</span>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? a.color : '#1E293B' }}>{a.name}</span>
                    <span style={{ fontSize: 9, color: '#9ca3af' }}>{a.role}</span>
                    {msgs.length > 0 && !isActive && <div style={{ width: 5, height: 5, borderRadius: '50%', background: a.color, marginRight: 'auto', flexShrink: 0 }} />}
                    {a.type === 'meeting_room' && pendingCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, marginRight: 'auto', flexShrink: 0 }}>{pendingCount}</span>}
                  </div>
                  {lastMsg && <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastMsg.content.slice(0, 40)}</p>}
                </div>
              </button>
              {/* Specialist (always visible, indented) */}
              {a.spec && (
                <button onClick={() => setActiveAgent(a.spec!)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px 6px 28px', border: 'none', background: specActive ? `${a.color}08` : 'transparent', cursor: 'pointer', borderRight: specActive ? `3px solid ${a.color}` : '3px solid transparent', transition: 'all .1s' }}>
                  <span style={{ fontSize: 13 }}>{a.specIcon}</span>
                  <span style={{ fontSize: 10, color: specActive ? a.color : '#9ca3af', fontWeight: specActive ? 600 : 400 }}>{a.specName}</span>
                </button>
              )}
              {/* Second specialist (e.g. design_specialist under marketing) */}
              {(a as any).spec2 && (() => {
                const spec2Active = activeAgent === (a as any).spec2;
                return (
                  <button onClick={() => setActiveAgent((a as any).spec2)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px 6px 28px', border: 'none', background: spec2Active ? `${a.color}08` : 'transparent', cursor: 'pointer', borderRight: spec2Active ? `3px solid ${a.color}` : '3px solid transparent', transition: 'all .1s' }}>
                    <span style={{ fontSize: 13 }}>{(a as any).specIcon2}</span>
                    <span style={{ fontSize: 10, color: spec2Active ? a.color : '#9ca3af', fontWeight: spec2Active ? 600 : 400 }}>{(a as any).specName2}</span>
                  </button>
                );
              })()}
              {/* Workshop button — only for marketing team */}
              {a.type === 'marketing' && (
                <button onClick={() => setWorkshopOpen(true)}
                  style={{ width: 'calc(100% - 24px)', margin: '4px 12px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 10px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg,#8b5cf620,#7c3aed15)', cursor: 'pointer', transition: 'all .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(135deg,#8b5cf630,#7c3aed25)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(135deg,#8b5cf620,#7c3aed15)')}>
                  <span style={{ fontSize: 11 }}>🏭</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed' }}>ورشة تسويق</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* CENTER: Active chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AgentChat
          agentType={activeAgent}
          agentName={`${info.icon} ${info.name}`}
          agentIcon={info.icon}
          accentColor={info.color}
          quickActions={info.quickActions || []}
          messages={conversations[activeAgent] || []}
          onMessagesChange={updateMessages}
          compact={false}
          pendingMessage={pendingMessage}
        />
      </div>

      {/* RIGHT: Sidebar */}
      {sidebarOpen && (
        <div style={{ width: 300, borderRight: '1px solid rgba(0,0,0,.06)', background: '#fafafa', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,.04)', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setSidebarTab('actions')} style={{ flex: 1, padding: '6px', borderRadius: 6, fontSize: 10, fontWeight: sidebarTab === 'actions' ? 700 : 400, border: `1px solid ${sidebarTab === 'actions' ? '#2563EB' : 'rgba(0,0,0,.06)'}`, background: sidebarTab === 'actions' ? 'rgba(124,92,252,.06)' : '#fff', color: sidebarTab === 'actions' ? '#2563EB' : '#9ca3af', cursor: 'pointer' }}>
                مهام {pendingCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '0 4px', fontSize: 8, marginRight: 2 }}>{pendingCount}</span>}
              </button>
              <button onClick={() => setSidebarTab('reports')} style={{ flex: 1, padding: '6px', borderRadius: 6, fontSize: 10, fontWeight: sidebarTab === 'reports' ? 700 : 400, border: `1px solid ${sidebarTab === 'reports' ? '#2563EB' : 'rgba(0,0,0,.06)'}`, background: sidebarTab === 'reports' ? 'rgba(124,92,252,.06)' : '#fff', color: sidebarTab === 'reports' ? '#2563EB' : '#9ca3af', cursor: 'pointer' }}>
                تقارير ({reports.length})
              </button>
            </div>
          </div>

          <div style={{ padding: '8px 10px' }}>
            {sidebarTab === 'actions' && actions.map(a => {
              const st = STATUS_MAP[a.status] || STATUS_MAP.pending_approval;
              return (
                <div key={a.id} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', marginBottom: 6, border: '1px solid rgba(0,0,0,.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', margin: '0 0 2px' }}>{a.title}</p>
                  {a.result && <p style={{ fontSize: 9, color: '#059669', margin: '2px 0' }}>{a.result?.slice(0, 80)}</p>}
                  {a.status === 'pending_approval' && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      <button onClick={() => handleApprove(a.id)} disabled={acting === a.id} style={{ flex: 1, padding: '4px', borderRadius: 5, fontSize: 9, fontWeight: 600, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer' }}>موافقة</button>
                      <button onClick={() => handleReject(a.id)} disabled={acting === a.id} style={{ flex: 1, padding: '4px', borderRadius: 5, fontSize: 9, fontWeight: 600, border: '1px solid #fecaca', background: '#fff', color: '#ef4444', cursor: 'pointer' }}>رفض</button>
                    </div>
                  )}
                </div>
              );
            })}
            {sidebarTab === 'actions' && actions.length === 0 && <p style={{ textAlign: 'center', fontSize: 10, color: '#9ca3af', padding: 16 }}>لا توجد مهام</p>}

            {sidebarTab === 'reports' && reports.map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
              return (
                <div key={r.id} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', marginBottom: 6, border: '1px solid rgba(0,0,0,.04)' }}>
                  <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                  <h4 style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', margin: '4px 0 2px' }}>{r.title}</h4>
                  <p style={{ fontSize: 9, color: '#6b7280', margin: '0 0 6px', maxHeight: 40, overflow: 'hidden' }}>{r.summary?.slice(0, 120)}</p>
                  {r.status === 'pending' && (
                    <button onClick={() => handleApproveReport(r.id)} disabled={acting === r.id} style={{ width: '100%', padding: '5px', borderRadius: 5, fontSize: 10, fontWeight: 600, border: 'none', background: '#2563EB', color: '#fff', cursor: 'pointer' }}>اعتماد</button>
                  )}
                </div>
              );
            })}
            {sidebarTab === 'reports' && reports.length === 0 && <p style={{ textAlign: 'center', fontSize: 10, color: '#9ca3af', padding: 16 }}>لا توجد تقارير</p>}
          </div>
        </div>
      )}

      {/* Sidebar toggle (floating) */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{ position: 'fixed', bottom: 16, left: 16, width: 32, height: 32, borderRadius: '50%', background: '#2563EB', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, boxShadow: '0 2px 8px rgba(124,92,252,.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {sidebarOpen ? '→' : '←'}
      </button>

      {/* Marketing Workshop Modal */}
      {workshopOpen && <MarketingWorkshop onClose={() => setWorkshopOpen(false)} />}
    </div>
  );
}
