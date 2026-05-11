'use client';
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

const API = process.env.NEXT_PUBLIC_API_URL || '';

const AGENT_NAMES: Record<string, string> = {
  it: 'سالم تقنية المعلومات', sales: 'خالد المبيعات', marketing: 'نورة التسويق',
  finance: 'ريم المالية', product: 'عمر المنتج', leasing: 'سارة التأجير',
  collections: 'بدر التحصيل', ops: 'فارس العمليات', tenant_exp: 'لينا تجربة المستأجر',
  owner_rel: 'نادية علاقات الملاك', os_finance: 'رضا المالية التشغيلية',
};

interface Rule {
  id: string;
  agent_type: string;
  tool_name: string;
  max_amount: number | null;
  max_daily: number | null;
  requires: string[] | null;
  is_active: boolean;
  allowed_hours: { start: number; end: number } | null;
  rule_notes: string | null;
}

const BLANK_RULE: Omit<Rule, 'id' | 'agent_type'> = {
  tool_name: '', max_amount: null, max_daily: null,
  requires: [], is_active: true, allowed_hours: null, rule_notes: null,
};

function tok() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('admin_token') || '';
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}`, ...(opts.headers || {}) },
  });
  return r.json();
}

export default function ConstitutionPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({ ...BLANK_RULE });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/admin/agents/constitution');
    if (res.success) setRules(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const agents = Array.from(new Set(rules.map(r => r.agent_type))).sort();
  const visible = selectedAgent === 'all' ? rules : rules.filter(r => r.agent_type === selectedAgent);

  async function toggleActive(rule: Rule) {
    await apiFetch(`/admin/agents/constitution/${rule.id}`, {
      method: 'PATCH', body: JSON.stringify({ is_active: !rule.is_active }),
    });
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...BLANK_RULE, agent_type: selectedAgent === 'all' ? 'ops' : selectedAgent });
    setError('');
    setShowModal(true);
  }

  function openEdit(rule: Rule) {
    setEditingId(rule.id);
    setForm({
      agent_type: rule.agent_type, tool_name: rule.tool_name,
      max_amount: rule.max_amount ?? '', max_daily: rule.max_daily ?? '',
      requires: (rule.requires || []).join(', '),
      is_active: rule.is_active,
      allowed_hours_start: rule.allowed_hours?.start ?? '',
      allowed_hours_end: rule.allowed_hours?.end ?? '',
      rule_notes: rule.rule_notes ?? '',
    });
    setError('');
    setShowModal(true);
  }

  async function saveRule() {
    setSaving(true);
    setError('');
    const payload: Record<string, unknown> = {
      agent_type: form.agent_type,
      tool_name: String(form.tool_name || '').trim(),
      max_amount: form.max_amount !== '' && form.max_amount !== null ? Number(form.max_amount) : null,
      max_daily: form.max_daily !== '' && form.max_daily !== null ? Number(form.max_daily) : null,
      requires: String(form.requires || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      is_active: form.is_active,
      rule_notes: String(form.rule_notes || '').trim() || null,
      allowed_hours: (form.allowed_hours_start !== '' && form.allowed_hours_end !== '')
        ? { start: Number(form.allowed_hours_start), end: Number(form.allowed_hours_end) }
        : null,
    };
    const res = editingId
      ? await apiFetch(`/admin/agents/constitution/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      : await apiFetch('/admin/agents/constitution', { method: 'POST', body: JSON.stringify(payload) });
    if (res.success) {
      setShowModal(false);
      load();
    } else {
      setError(res.message || 'فشل الحفظ');
    }
    setSaving(false);
  }

  async function deleteRule(id: string) {
    if (!confirm('حذف هذه القاعدة؟')) return;
    await apiFetch(`/admin/agents/constitution/${id}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== id));
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--lv-text-primary)', margin: 0 }}>دستور الوكلاء</h1>
          <p style={{ fontSize: 13, color: 'var(--lv-text-muted)', margin: '4px 0 0' }}>
            إدارة حدود الصلاحيات والأدوات لكل وكيل ذكاء
          </p>
        </div>
        <button onClick={openCreate} style={btnStyle('#4f46e5')}>+ إضافة قاعدة</button>
      </div>

      {/* Agent selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <AgentTab label="الكل" active={selectedAgent === 'all'} onClick={() => setSelectedAgent('all')} count={rules.length} />
        {agents.map(a => (
          <AgentTab key={a} label={AGENT_NAMES[a] || a} active={selectedAgent === a}
            onClick={() => setSelectedAgent(a)} count={rules.filter(r => r.agent_type === a).length} />
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--lv-text-muted)', fontSize: 14 }}>جاري التحميل...</p>
      ) : visible.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(rule => (
            <RuleCard key={rule.id} rule={rule}
              onToggle={() => toggleActive(rule)}
              onEdit={() => openEdit(rule)}
              onDelete={() => deleteRule(rule.id)} />
          ))}
        </div>
      )}

      {showModal && (
        <Modal
          title={editingId ? 'تعديل القاعدة' : 'إضافة قاعدة جديدة'}
          onClose={() => setShowModal(false)}
          onSave={saveRule}
          saving={saving}
          error={error}
        >
          <FormRow label="الوكيل">
            <select value={String(form.agent_type || '')} onChange={e => setForm(f => ({ ...f, agent_type: e.target.value }))} style={inputStyle}>
              {Object.entries(AGENT_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </FormRow>
          <FormRow label="اسم الأداة">
            <input value={String(form.tool_name || '')} onChange={e => setForm(f => ({ ...f, tool_name: e.target.value }))} style={inputStyle} placeholder="مثال: approvePurchaseOrder" />
          </FormRow>
          <FormRow label="حد المبلغ (ر.س)">
            <input type="number" value={form.max_amount as string ?? ''} onChange={e => setForm(f => ({ ...f, max_amount: e.target.value }))} style={inputStyle} placeholder="فارغ = بلا حد" />
          </FormRow>
          <FormRow label="الحد اليومي (مرة)">
            <input type="number" value={form.max_daily as string ?? ''} onChange={e => setForm(f => ({ ...f, max_daily: e.target.value }))} style={inputStyle} placeholder="فارغ = بلا حد" />
          </FormRow>
          <div style={{ display: 'flex', gap: 10 }}>
            <FormRow label="ساعات العمل (من)">
              <input type="number" min={0} max={23} value={form.allowed_hours_start as string ?? ''} onChange={e => setForm(f => ({ ...f, allowed_hours_start: e.target.value }))} style={{ ...inputStyle, width: '100%' }} placeholder="8" />
            </FormRow>
            <FormRow label="ساعات العمل (إلى)">
              <input type="number" min={0} max={23} value={form.allowed_hours_end as string ?? ''} onChange={e => setForm(f => ({ ...f, allowed_hours_end: e.target.value }))} style={{ ...inputStyle, width: '100%' }} placeholder="21" />
            </FormRow>
          </div>
          <FormRow label="الشروط المسبقة">
            <input value={String(form.requires || '')} onChange={e => setForm(f => ({ ...f, requires: e.target.value }))} style={inputStyle} placeholder="شرط1, شرط2 (مفصولة بفاصلة)" />
          </FormRow>
          <FormRow label="ملاحظات">
            <input value={String(form.rule_notes || '')} onChange={e => setForm(f => ({ ...f, rule_notes: e.target.value }))} style={inputStyle} placeholder="سبب القاعدة أو تفاصيل إضافية" />
          </FormRow>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <input type="checkbox" checked={Boolean(form.is_active)} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#4f46e5' }} />
            <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>تفعيل القاعدة</span>
          </label>
        </Modal>
      )}
    </div>
  );
}

function RuleCard({ rule, onToggle, onEdit, onDelete }: {
  rule: Rule; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div style={{
      background: 'var(--lv-card-bg)', border: '1px solid var(--lv-card-border)',
      borderRadius: 10, padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 16,
      opacity: rule.is_active ? 1 : 0.55,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-text-primary)', fontFamily: 'var(--lv-font-mono)' }}>
            {rule.tool_name}
          </span>
          <span style={{ fontSize: 11, color: 'var(--lv-text-muted)', background: 'var(--lv-subtle-bg)', borderRadius: 4, padding: '2px 7px' }}>
            {AGENT_NAMES[rule.agent_type] || rule.agent_type}
          </span>
          {!rule.is_active && (
            <span style={{ fontSize: 11, color: '#ef4444', background: '#fef2f2', borderRadius: 4, padding: '2px 7px' }}>معطّل</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {rule.max_amount != null && <Chip label={`حد: ${rule.max_amount.toLocaleString()} ر.س`} />}
          {rule.max_daily != null && <Chip label={`يومي: ${rule.max_daily} مرة`} />}
          {rule.allowed_hours && <Chip label={`${rule.allowed_hours.start}:00–${rule.allowed_hours.end}:00`} />}
          {(rule.requires || []).map(r => <Chip key={r} label={r} />)}
          {rule.rule_notes && <span style={{ fontSize: 11, color: 'var(--lv-text-muted)' }}>{rule.rule_notes}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Toggle checked={rule.is_active} onChange={onToggle} />
        <button onClick={onEdit} style={ghostBtn}>تعديل</button>
        <button onClick={onDelete} style={{ ...ghostBtn, color: '#ef4444' }}>حذف</button>
      </div>
    </div>
  );
}

function AgentTab({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count: number }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 6, border: '1px solid',
      borderColor: active ? '#4f46e5' : 'var(--lv-card-border)',
      background: active ? '#4f46e520' : 'transparent',
      color: active ? '#4f46e5' : 'var(--lv-text-secondary)',
      fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
    }}>
      {label} <span style={{ opacity: 0.6 }}>({count})</span>
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div onClick={onChange} style={{
      width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
      background: checked ? '#4f46e5' : 'var(--lv-subtle-bg)',
      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: 8, background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 11, color: 'var(--lv-text-secondary)', background: 'var(--lv-subtle-bg)', borderRadius: 4, padding: '2px 7px' }}>
      {label}
    </span>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
      <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, onSave, saving, error, children }: {
  title: string; onClose: () => void; onSave: () => void;
  saving: boolean; error: string; children: React.ReactNode;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        direction: 'rtl',
      }}
    >
      <div style={{
        background: '#ffffff',
        borderRadius: 14, padding: '24px 28px',
        width: 520, maxWidth: 'calc(100vw - 32px)',
        maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        border: '1px solid #e8ecf0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 16, width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
        {error && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 14, padding: '8px 12px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'flex-start' }}>
          <button onClick={onSave} disabled={saving} style={btnStyle('#4f46e5')}>
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button onClick={onClose} style={ghostBtn}>إلغاء</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--lv-text-muted)' }}>
      <p style={{ fontSize: 15, marginBottom: 12 }}>لا توجد قواعد لهذا الوكيل بعد</p>
      <button onClick={onAdd} style={btnStyle('#4f46e5')}>+ إضافة أول قاعدة</button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 7,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
  color: '#0f172a',
  fontSize: 13, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
  outline: 'none',
};

const ghostBtn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 7, border: '1px solid #e2e8f0',
  background: '#f8fafc', color: '#475569', fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit',
};

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '8px 16px', borderRadius: 7, border: 'none',
    background: bg, color: '#fff', fontSize: 13,
    cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit',
  };
}
