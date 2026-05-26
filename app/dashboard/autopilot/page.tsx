'use client';
import { useState, useEffect, useCallback } from 'react';
import { request } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AutopilotGoal {
  id: string;
  goal_text: string;
  target_metric: string;
  target_value: number | null;
  current_value: number | null;
  deadline: string | null;
  status: 'active' | 'achieved' | 'dropped';
  assigned_to: string | null;
  created_at: string;
}

type FilterKey = 'all' | 'active' | 'achieved' | 'dropped';

// ── Constants ─────────────────────────────────────────────────────────────────
const METRICS: Record<string, string> = {
  occupancy_rate:      'معدل الإشغال',
  collections_rate:    'معدل التحصيل',
  maintenance_sla:     'الالتزام بمستوى الصيانة',
  vacancy_days:        'أيام الشواغر',
  financial_variance:  'انحراف الميزانية',
  tenant_satisfaction: 'رضا المستأجرين',
};

const STATUS_CFG: Record<AutopilotGoal['status'], { label: string; color: string; bg: string }> = {
  active:   { label: 'نشط',   color: '#16a34a', bg: '#f0fdf4' },
  achieved: { label: 'محقق',  color: '#6366f1', bg: '#eef2ff' },
  dropped:  { label: 'متوقف', color: '#6b7280', bg: '#f3f4f6' },
};

const AGENTS: { value: string; label: string }[] = [
  { value: '',          label: 'بدون تكليف' },
  { value: 'it',        label: 'سالم — IT' },
  { value: 'sales',     label: 'خالد — المبيعات' },
  { value: 'marketing', label: 'نورة — التسويق' },
  { value: 'finance',   label: 'ريم — المالية' },
  { value: 'product',   label: 'يوسف — المنتج' },
];

const BLANK: CreateForm = { goal_text: '', target_metric: 'occupancy_rate', target_value: '', deadline: '', assigned_to: '' };

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  borderRadius: 9, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text-1)',
  fontSize: 13, fontFamily: 'inherit', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--text-muted)', marginBottom: 5,
};
const primaryBtnStyle: React.CSSProperties = {
  padding: '9px 24px', borderRadius: 10, border: 'none',
  background: 'var(--brand-600, #1d4ed8)', color: '#fff',
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const ghostBtnStyle: React.CSSProperties = {
  padding: '9px 20px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function progressPct(current: number | null, target: number | null) {
  if (!target) return 0;
  return Math.min(Math.round(((current ?? 0) / target) * 100), 100);
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isOverdue(deadline: string | null, status: AutopilotGoal['status']) {
  return !!deadline && status === 'active' && new Date(deadline) < new Date();
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ current, target, status }: { current: number | null; target: number | null; status: AutopilotGoal['status'] }) {
  const c = current ?? 0;
  const t = target ?? 0;
  const pct = progressPct(c, t);
  const color = status === 'achieved' ? '#6366f1'
    : pct >= 80 ? '#10b981'
    : pct >= 40 ? '#f59e0b'
    : '#ef4444';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.toLocaleString()} / {t.toLocaleString()}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 6, transition: 'width .4s' }} />
      </div>
    </div>
  );
}

// ── Modal (create + edit) ─────────────────────────────────────────────────────
interface CreateForm { goal_text: string; target_metric: string; target_value: string; deadline: string; assigned_to: string; }
interface EditForm extends CreateForm { status: AutopilotGoal['status']; }

interface ModalProps {
  mode: 'create' | 'edit';
  initial?: Partial<EditForm>;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

function GoalModal({ mode, initial, onSave, onClose }: ModalProps) {
  const [form, setForm]   = useState<EditForm>({ ...BLANK, status: 'active', ...initial });
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState<string | null>(null);

  function set(k: keyof EditForm, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.goal_text.trim()) return setErr('أدخل نص الهدف');
    if (!form.target_value || Number.isNaN(Number(form.target_value))) return setErr('أدخل قيمة رقمية صحيحة');
    setSaving(true); setErr(null);
    try {
      const payload: Record<string, unknown> = {
        goal_text:     form.goal_text.trim(),
        target_metric: form.target_metric,
        target_value:  Number(form.target_value),
      };
      if (form.deadline)     payload.deadline    = form.deadline;
      if (form.assigned_to)  payload.assigned_to = form.assigned_to;
      if (mode === 'edit')   payload.status      = form.status;
      await onSave(payload);
      onClose();
    } catch (e: any) {
      setErr(e.message || 'حدث خطأ، حاول مجدداً');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <form onSubmit={submit} style={{ background: 'var(--surface)', borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: 460, direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 20px' }}>
          {mode === 'create' ? 'إنشاء هدف جديد' : 'تعديل الهدف'}
        </h2>

        {err && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#dc2626' }}>
            {err}
          </div>
        )}

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={labelStyle}>نص الهدف *</span>
          <textarea
            value={form.goal_text} rows={3}
            onChange={e => set('goal_text', e.target.value)}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="مثال: رفع معدل الإشغال إلى 95% قبل نهاية الربع"
          />
        </label>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={labelStyle}>المقياس المستهدف *</span>
          <select value={form.target_metric} onChange={e => set('target_metric', e.target.value)} style={inputStyle}>
            {Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={labelStyle}>القيمة المستهدفة *</span>
          <input
            type="number" min={0} step="any"
            value={form.target_value}
            onChange={e => set('target_value', e.target.value)}
            style={inputStyle}
            placeholder="مثال: 95"
          />
        </label>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={labelStyle}>الموعد النهائي (اختياري)</span>
          <input
            type="date" value={form.deadline}
            onChange={e => set('deadline', e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: mode === 'edit' ? 14 : 22 }}>
          <span style={labelStyle}>تكليف الوكيل (اختياري)</span>
          <select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} style={inputStyle}>
            {AGENTS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </label>

        {mode === 'edit' && (
          <label style={{ display: 'block', marginBottom: 22 }}>
            <span style={labelStyle}>الحالة</span>
            <select value={form.status} onChange={e => set('status', e.target.value as AutopilotGoal['status'])} style={inputStyle}>
              <option value="active">نشط</option>
              <option value="achieved">محقق</option>
              <option value="dropped">متوقف</option>
            </select>
          </label>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtnStyle}>إلغاء</button>
          <button type="submit" disabled={saving} style={{ ...primaryBtnStyle, opacity: saving ? .6 : 1 }}>
            {saving ? 'جاري الحفظ…' : 'حفظ الهدف'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Goal row ──────────────────────────────────────────────────────────────────
function GoalRow({ goal, onEdit, onDrop }: { goal: AutopilotGoal; onEdit: () => void; onDrop: () => void }) {
  const st      = STATUS_CFG[goal.status] ?? STATUS_CFG.active;
  const overdue = isOverdue(goal.deadline, goal.status);

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>

      {/* Goal text + metric chip */}
      <td style={{ padding: '14px 14px', verticalAlign: 'top', minWidth: 220 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 5px', lineHeight: 1.4 }}>
          {goal.goal_text}
        </p>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--bg)', color: 'var(--text-muted)', fontWeight: 600, display: 'inline-block' }}>
          {METRICS[goal.target_metric] || goal.target_metric}
        </span>
      </td>

      {/* Progress */}
      <td style={{ padding: '14px 14px', verticalAlign: 'middle', minWidth: 170 }}>
        <ProgressBar current={goal.current_value} target={goal.target_value} status={goal.status} />
      </td>

      {/* Deadline */}
      <td style={{ padding: '14px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 12, color: overdue ? '#ef4444' : 'var(--text-muted)', fontWeight: overdue ? 700 : 400 }}>
          {fmtDate(goal.deadline)}
          {overdue && <span style={{ marginRight: 4 }}>— متأخر</span>}
        </span>
      </td>

      {/* Agent */}
      <td style={{ padding: '14px 14px', verticalAlign: 'middle' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {AGENTS.find(a => a.value === goal.assigned_to)?.label || goal.assigned_to || '—'}
        </span>
      </td>

      {/* Status badge */}
      <td style={{ padding: '14px 14px', verticalAlign: 'middle' }}>
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 700 }}>
          {st.label}
        </span>
      </td>

      {/* Actions */}
      <td style={{ padding: '14px 14px', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onEdit}
            style={{ padding: '4px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-2)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >
            تعديل
          </button>
          {goal.status === 'active' && (
            <button
              onClick={onDrop}
              style={{ padding: '4px 12px', borderRadius: 7, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              إيقاف
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
type ModalState =
  | null
  | { mode: 'create' }
  | { mode: 'edit'; goal: AutopilotGoal };

export default function AutopilotPage() {
  const [goals,   setGoals]   = useState<AutopilotGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<FilterKey>('all');
  const [modal,   setModal]   = useState<ModalState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request<any>('GET', '/admin/autopilot/goals');
      setGoals(res?.data ?? []);
    } catch { /* silent — empty state shown */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(data: Record<string, unknown>) {
    await request('POST', '/admin/autopilot/goals', data);
    load();
  }

  async function handleEdit(id: string, data: Record<string, unknown>) {
    await request('PATCH', `/admin/autopilot/goals/${id}`, data);
    load();
  }

  async function handleDrop(id: string) {
    if (!confirm('هل تريد إيقاف هذا الهدف؟')) return;
    try {
      await request('PATCH', `/admin/autopilot/goals/${id}`, { status: 'dropped' });
      load();
    } catch { /* silent */ }
  }

  const filtered = goals.filter(g => filter === 'all' || g.status === filter);

  const counts = {
    total:    goals.length,
    active:   goals.filter(g => g.status === 'active').length,
    achieved: goals.filter(g => g.status === 'achieved').length,
    dropped:  goals.filter(g => g.status === 'dropped').length,
  };

  const FILTERS: [FilterKey, string][] = [
    ['all',      'الكل'],
    ['active',   'نشط'],
    ['achieved', 'محقق'],
    ['dropped',  'متوقف'],
  ];

  return (
    <div style={{ maxWidth: 1020, margin: '0 auto', padding: '28px 24px', direction: 'rtl' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>الأهداف التشغيلية</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
            الطيار الآلي — يعمل الوكلاء تلقائياً نحو تحقيق الأهداف المحددة
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            onClick={load}
            disabled={loading}
            style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', opacity: loading ? .5 : 1 }}
          >
            {loading ? 'جاري التحديث...' : 'تحديث'}
          </button>
          <button
            onClick={() => setModal({ mode: 'create' })}
            style={{ ...primaryBtnStyle, padding: '8px 20px', fontSize: 13 }}
          >
            + إنشاء هدف
          </button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {([
          { label: 'إجمالي الأهداف', value: counts.total,    color: 'var(--text-1)' },
          { label: 'نشطة',           value: counts.active,   color: '#16a34a' },
          { label: 'محققة',          value: counts.achieved, color: '#6366f1' },
          { label: 'متوقفة',         value: counts.dropped,  color: '#6b7280' },
        ] as const).map(t => (
          <div key={t.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: t.color, margin: '0 0 4px' }}>
              {loading ? '—' : t.value}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>{t.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filter pills ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: '5px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: filter === key ? 'var(--text-1)' : 'var(--bg)',
              color:      filter === key ? 'var(--surface)'  : 'var(--text-2)',
            }}
          >
            {label}
            {key !== 'all' && (
              <span style={{ marginRight: 5, opacity: .6 }}>
                {key === 'active' ? counts.active : key === 'achieved' ? counts.achieved : counts.dropped}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Goals table ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {loading && goals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)', fontSize: 14 }}>
            جاري التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', margin: '0 0 4px' }}>
              {filter === 'all' ? 'لا توجد أهداف بعد' : `لا توجد أهداف ${filter === 'active' ? 'نشطة' : filter === 'achieved' ? 'محققة' : 'متوقفة'}`}
            </p>
            {filter === 'all' && (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
                  أنشئ أول هدف وسيبدأ الوكلاء العمل نحو تحقيقه تلقائياً
                </p>
                <button onClick={() => setModal({ mode: 'create' })} style={primaryBtnStyle}>
                  إنشاء أول هدف
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {['الهدف والمقياس', 'التقدم', 'الموعد النهائي', 'الوكيل', 'الحالة', 'إجراءات'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(goal => (
                  <GoalRow
                    key={goal.id}
                    goal={goal}
                    onEdit={() => setModal({ mode: 'edit', goal })}
                    onDrop={() => handleDrop(goal.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <GoalModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? {
            goal_text:     modal.goal.goal_text,
            target_metric: modal.goal.target_metric,
            target_value:  String(modal.goal.target_value),
            deadline:      modal.goal.deadline?.slice(0, 10) ?? '',
            status:        modal.goal.status,
          } : undefined}
          onSave={modal.mode === 'create'
            ? handleCreate
            : (data) => handleEdit((modal as { mode: 'edit'; goal: AutopilotGoal }).goal.id, data)
          }
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
