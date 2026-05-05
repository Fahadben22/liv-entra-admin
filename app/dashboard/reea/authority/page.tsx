'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { request } from '@/lib/api';
import Icon from '@/components/Icon';
import Toggle from '@/components/Toggle';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthorityRow {
  id: string;
  key: string;
  category: string;
  label_ar: string;
  enabled: boolean;
  value: Record<string, any> | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  requires_fahad_approval: boolean;
  updated_at: string;
  updated_by: string | null;
}

interface AuthorityState {
  tools: AuthorityRow[];
  thresholds: AuthorityRow[];
  portals: AuthorityRow[];
  knowledge: AuthorityRow[];
  infrastructure: AuthorityRow[];
}

type TabKey = 'tools' | 'thresholds' | 'portals' | 'knowledge' | 'infrastructure';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'tools',          label: 'الأدوات' },
  { key: 'thresholds',     label: 'الحدود المالية' },
  { key: 'portals',        label: 'البوابات' },
  { key: 'knowledge',      label: 'المعرفة' },
  { key: 'infrastructure', label: 'البنية التحتية' },
];

const RISK_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  low:      { bg: '#f0fdf4', color: '#15803d', label: 'منخفض' },
  medium:   { bg: '#fffbeb', color: '#92400e', label: 'متوسط' },
  high:     { bg: '#fff7ed', color: '#c2410c', label: 'عالٍ' },
  critical: { bg: '#fef2f2', color: '#dc2626', label: 'حرج' },
};

const CORPUS_LABELS: Record<string, string> = {
  'liventra-legal-ejar-v1':         'عقود الإيجار (إيجار)',
  'liventra-legal-mot-str-v1':      'تراخيص STR',
  'liventra-ops-preventive-v1':     'الصيانة الوقائية',
  'liventra-ops-corrective-v1':     'الصيانة التصحيحية',
  'liventra-ops-asset-lifecycle-v1':'دورة حياة الأصول',
  'market':                         'بيانات السوق',
};

const INFRA_ENV: Record<string, string> = {
  'infrastructure.railway_logs_enabled':  'RAILWAY_API_TOKEN',
  'infrastructure.vercel_status_enabled': 'VERCEL_TOKEN',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const s = RISK_STYLES[level] || RISK_STYLES.low;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg,
      padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function FahadBadge() {
  return (
    <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
      <Icon name="shield" size={11} color="#64748b" />
      يتطلب موافقة فهد
    </span>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--lv-panel)', border: '1px solid var(--lv-line)',
      borderRadius: 10, padding: '10px 20px', fontSize: 13, color: 'var(--lv-fg)',
      boxShadow: 'var(--lv-shadow-card)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon name="check-circle" size={14} color="#22c55e" />
      {message}
    </div>
  );
}

// ─── Tab: Tools ───────────────────────────────────────────────────────────────

function ToolsTab({ rows, edits, onToggle }: { rows: AuthorityRow[]; edits: Record<string, Partial<AuthorityRow>>; onToggle: (r: AuthorityRow, v: boolean) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 12 }}>
      {rows.map(row => {
        const enabled = edits[row.key]?.enabled !== undefined ? edits[row.key].enabled! : row.enabled;
        return (
          <div key={row.key} style={{ background: 'var(--lv-panel)', borderRadius: 12,
            padding: '14px 16px', border: '1px solid var(--lv-line)',
            boxShadow: 'var(--lv-shadow-sm)', opacity: enabled ? 1 : 0.55,
            transition: 'opacity .2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="robot" size={15} color="var(--lv-accent)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)' }}>{row.label_ar}</span>
              </div>
              <Toggle checked={enabled} onChange={v => onToggle(row, v)} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <RiskBadge level={row.risk_level} />
              {row.requires_fahad_approval && <FahadBadge />}
            </div>
            <div style={{ fontSize: 10, color: 'var(--lv-muted)', marginTop: 8,
              fontFamily: 'var(--lv-font-mono)', direction: 'ltr', wordBreak: 'break-all' }}>
              {row.key}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Thresholds ─────────────────────────────────────────────────────────

function ThresholdsTab({ rows, edits, onToggle, onValueChange }: {
  rows: AuthorityRow[];
  edits: Record<string, Partial<AuthorityRow>>;
  onToggle: (r: AuthorityRow, v: boolean) => void;
  onValueChange: (r: AuthorityRow, amount: number) => void;
}) {
  return (
    <div style={{ background: 'var(--lv-panel)', borderRadius: 14, overflow: 'hidden',
      border: '1px solid var(--lv-line)' }}>
      {rows.map((row, i) => {
        const enabled = edits[row.key]?.enabled !== undefined ? edits[row.key].enabled! : row.enabled;
        const val     = edits[row.key]?.value !== undefined ? edits[row.key].value : row.value;
        const unit    = row.value?.unit   || '';
        const min     = row.value?.min    ?? 0;
        const max     = row.value?.max    ?? 999999;
        return (
          <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 20px', borderBottom: i < rows.length - 1 ? '1px solid var(--lv-line)' : 'none',
            opacity: enabled ? 1 : 0.5 }}>
            <Toggle checked={enabled} onChange={v => onToggle(row, v)} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--lv-fg)' }}>{row.label_ar}</div>
              <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginTop: 2 }}>{unit}</div>
            </div>
            <RiskBadge level={row.risk_level} />
            {row.requires_fahad_approval && <FahadBadge />}
            <input
              type="number" min={min} max={max}
              value={val?.amount ?? ''}
              disabled={!enabled}
              onChange={e => onValueChange(row, Number(e.target.value))}
              style={{ width: 90, padding: '6px 10px', borderRadius: 8, fontSize: 13,
                border: '1px solid var(--lv-line)', background: 'var(--lv-bg)',
                color: 'var(--lv-fg)', textAlign: 'center' as const }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Portals ─────────────────────────────────────────────────────────────

function PortalsTab({ rows, edits, onToggle }: { rows: AuthorityRow[]; edits: Record<string, Partial<AuthorityRow>>; onToggle: (r: AuthorityRow, v: boolean) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 12 }}>
      {rows.map(row => {
        const enabled = edits[row.key]?.enabled !== undefined ? edits[row.key].enabled! : row.enabled;
        return (
          <div key={row.key} style={{ background: 'var(--lv-panel)', borderRadius: 12,
            padding: '16px 18px', border: '1px solid var(--lv-line)',
            boxShadow: 'var(--lv-shadow-sm)', opacity: enabled ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="globe" size={15} color="var(--lv-accent)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)' }}>{row.label_ar}</span>
              </div>
              <Toggle checked={enabled} onChange={v => onToggle(row, v)} />
            </div>
            <RiskBadge level={row.risk_level} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Knowledge ───────────────────────────────────────────────────────────

function KnowledgeTab({ rows, edits, onToggle, onValueChange }: {
  rows: AuthorityRow[];
  edits: Record<string, Partial<AuthorityRow>>;
  onToggle: (r: AuthorityRow, v: boolean) => void;
  onValueChange: (r: AuthorityRow, amount: number) => void;
}) {
  const masterRow  = rows.find(r => r.key === 'knowledge.ai_knowledge_enabled');
  const corporaRow = rows.find(r => r.key === 'knowledge.allowed_corpora');
  const threshRow  = rows.find(r => r.key === 'knowledge.similarity_threshold');

  const masterEnabled = masterRow
    ? (edits[masterRow.key]?.enabled !== undefined ? edits[masterRow.key].enabled! : masterRow.enabled)
    : true;

  const corpusIds: string[] = (edits[corporaRow?.key || '']?.value ?? corporaRow?.value)?.corpus_ids || [];

  const handleCorpusToggle = (corpusId: string, checked: boolean) => {
    if (!corporaRow) return;
    const current = [...corpusIds];
    const next = checked ? [...new Set([...current, corpusId])] : current.filter(c => c !== corpusId);
    onValueChange(corporaRow, 0); // trigger the edit; we'll use a custom path
    // Update via direct state manipulation via parent — we need a special handler
    // For now re-use onValueChange with a sentinel to signal corpus update
    // This is handled by passing the full value object in the parent's handleValueChange
    const fakeEvent = { target: { value: JSON.stringify({ corpus_ids: next }) } } as any;
    (document.getElementById(`corpus-hidden-${corporaRow.key}`) as HTMLInputElement)?.dispatchEvent(new CustomEvent('corpus-change', { detail: next }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {masterRow && (
        <div style={{ background: 'var(--lv-panel)', borderRadius: 12, padding: '16px 18px',
          border: '1px solid var(--lv-line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)' }}>{masterRow.label_ar}</div>
              <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginTop: 2 }}>تفعيل أو تعطيل البحث الكامل في قاعدة المعرفة</div>
            </div>
            <Toggle checked={masterEnabled} onChange={v => onToggle(masterRow, v)} />
          </div>
        </div>
      )}

      {corporaRow && (
        <div style={{ background: 'var(--lv-panel)', borderRadius: 12, padding: '16px 18px',
          border: '1px solid var(--lv-line)', opacity: masterEnabled ? 1 : 0.5 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)', marginBottom: 12 }}>
            المصادر المسموح بها
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {Object.entries(CORPUS_LABELS).map(([id, label]) => {
              const active = corpusIds.includes(id);
              return (
                <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 13, color: 'var(--lv-fg)', cursor: masterEnabled ? 'pointer' : 'default' }}>
                  <input type="checkbox" checked={active} disabled={!masterEnabled}
                    onChange={e => {
                      if (!corporaRow) return;
                      const next = e.target.checked
                        ? [...new Set([...corpusIds, id])]
                        : corpusIds.filter(c => c !== id);
                      onValueChange({ ...corporaRow, value: { corpus_ids: next } } as AuthorityRow, 0);
                    }}
                    style={{ accentColor: 'var(--lv-accent)', width: 15, height: 15 }}
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {threshRow && (
        <div style={{ background: 'var(--lv-panel)', borderRadius: 12, padding: '16px 18px',
          border: '1px solid var(--lv-line)', opacity: masterEnabled ? 1 : 0.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)' }}>{threshRow.label_ar}</div>
              <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginTop: 2 }}>0 = بحث حر، 1 = تطابق تام</div>
            </div>
            <input
              type="number" min={0.1} max={0.99} step={0.05}
              disabled={!masterEnabled}
              value={(edits[threshRow.key]?.value ?? threshRow.value)?.amount ?? 0.55}
              onChange={e => onValueChange(threshRow, Number(e.target.value))}
              style={{ width: 80, padding: '6px 10px', borderRadius: 8, fontSize: 13,
                border: '1px solid var(--lv-line)', background: 'var(--lv-bg)', color: 'var(--lv-fg)',
                textAlign: 'center' as const }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Infrastructure ──────────────────────────────────────────────────────

function InfraTab({ rows, edits, onToggle }: { rows: AuthorityRow[]; edits: Record<string, Partial<AuthorityRow>>; onToggle: (r: AuthorityRow, v: boolean) => void }) {
  return (
    <div style={{ background: 'var(--lv-panel)', borderRadius: 14, overflow: 'hidden',
      border: '1px solid var(--lv-line)' }}>
      {rows.map((row, i) => {
        const enabled = edits[row.key]?.enabled !== undefined ? edits[row.key].enabled! : row.enabled;
        const envHint = INFRA_ENV[row.key];
        return (
          <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 20px', borderBottom: i < rows.length - 1 ? '1px solid var(--lv-line)' : 'none' }}>
            <Toggle checked={enabled} onChange={v => onToggle(row, v)} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--lv-fg)' }}>{row.label_ar}</div>
              {envHint && (
                <div style={{ fontSize: 11, color: 'var(--lv-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                  <Icon name="key" size={11} color="var(--lv-muted)" />
                  يتطلب متغير البيئة: {envHint}
                </div>
              )}
            </div>
            <RiskBadge level={row.risk_level} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function REEAAuthorityPage() {
  const router = useRouter();
  const [data,      setData]      = useState<AuthorityState | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('tools');
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState('');
  const [edits,     setEdits]     = useState<Record<string, Partial<AuthorityRow>>>({});

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    if (typeof window !== 'undefined' && !localStorage.getItem('admin_token')) {
      router.push('/login');
      return;
    }
    try {
      const res = await request<{ success: boolean; data: AuthorityState }>('GET', '/admin/reea/authority');
      setData((res as any).data);
    } catch (e: any) { showToast(e.message || 'خطأ في التحميل'); }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = (row: AuthorityRow, value: boolean) => {
    setEdits(prev => ({ ...prev, [row.key]: { ...prev[row.key], enabled: value } }));
  };

  const handleValueChange = (row: AuthorityRow, amount: number) => {
    // Special case: corpus row passes full value object via the modified row
    if (row.key === 'knowledge.allowed_corpora' && row.value?.corpus_ids) {
      setEdits(prev => ({ ...prev, [row.key]: { ...prev[row.key], value: { corpus_ids: row.value!.corpus_ids } } }));
      return;
    }
    setEdits(prev => ({
      ...prev,
      [row.key]: { ...prev[row.key], value: { ...(row.value || {}), amount } },
    }));
  };

  const save = async (category: TabKey) => {
    if (!data) return;
    setSaving(true);
    const rows = data[category].map(row => {
      const edit = edits[row.key] || {};
      return {
        key:     row.key,
        enabled: edit.enabled !== undefined ? edit.enabled : row.enabled,
        value:   edit.value   !== undefined ? edit.value   : row.value,
      };
    });
    try {
      await request('PUT', `/admin/reea/authority/${category}`, rows);
      showToast('تم الحفظ بنجاح');
      setEdits({});
      load();
    } catch (e: any) { showToast(e.message || 'خطأ في الحفظ'); }
    setSaving(false);
  };

  const hasEdits = Object.keys(edits).some(key => {
    const row = data?.[activeTab]?.find(r => r.key === key);
    return !!row;
  });

  if (loading) {
    return (
      <div style={{ padding: 32, color: 'var(--lv-muted)', fontSize: 14 }}>
        جارٍ تحميل مصفوفة الصلاحيات...
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ padding: 32, color: '#ef4444', fontSize: 14 }}>
        تعذّر تحميل البيانات
      </div>
    );
  }

  return (
    <div style={{ direction: 'rtl', padding: '28px 32px', maxWidth: 1100 }}>
      {toast && <Toast message={toast} />}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Icon name="shield" size={20} color="var(--lv-accent)" />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--lv-fg)', margin: 0 }}>
            مصفوفة صلاحيات REEA
          </h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--lv-muted)', margin: 0 }}>
          تحكم في كل أداة، حد مالي، وصول للبوابات، ومصادر المعرفة المتاحة لـ REEA
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--lv-line)', paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
            color: activeTab === tab.key ? 'var(--lv-accent)' : 'var(--lv-muted)',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === tab.key ? '2px solid var(--lv-accent)' : '2px solid transparent',
            marginBottom: -1, transition: 'color .15s',
          }}>
            {tab.label}
            <span style={{ marginRight: 6, fontSize: 11, background: 'var(--lv-chip)',
              color: 'var(--lv-muted)', borderRadius: 10, padding: '1px 6px' }}>
              {data[tab.key].length}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ minHeight: 300 }}>
        {activeTab === 'tools' && (
          <ToolsTab rows={data.tools} edits={edits} onToggle={handleToggle} />
        )}
        {activeTab === 'thresholds' && (
          <ThresholdsTab rows={data.thresholds} edits={edits} onToggle={handleToggle} onValueChange={handleValueChange} />
        )}
        {activeTab === 'portals' && (
          <PortalsTab rows={data.portals} edits={edits} onToggle={handleToggle} />
        )}
        {activeTab === 'knowledge' && (
          <KnowledgeTab rows={data.knowledge} edits={edits} onToggle={handleToggle} onValueChange={handleValueChange} />
        )}
        {activeTab === 'infrastructure' && (
          <InfraTab rows={data.infrastructure} edits={edits} onToggle={handleToggle} />
        )}
      </div>

      {/* Save row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12,
        marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--lv-line)' }}>
        {hasEdits && (
          <span style={{ fontSize: 12, color: 'var(--lv-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="alert-circle" size={12} color="#f59e0b" />
            يوجد تغييرات غير محفوظة
          </span>
        )}
        <button
          onClick={() => save(activeTab)}
          disabled={saving}
          style={{ padding: '8px 20px', background: 'var(--lv-accent)', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>
    </div>
  );
}
