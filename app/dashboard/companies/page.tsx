'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminApi, request } from '@/lib/api';
import { lcOf, daysUntil, fmt, fmtDate, PLAN_AR, PLAN_C } from '@/lib/billing-helpers';

// ─── Constants ────────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'trial',     label: 'تجريبي',  color: '#f59e0b', bg: '#fefce8', border: '#fde68a', icon: '⏳' },
  { key: 'active',    label: 'نشط',      color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' },
  { key: 'overdue',   label: 'متأخر',    color: '#f97316', bg: '#fff7ed', border: '#fed7aa', icon: '⚠️' },
  { key: 'suspended', label: 'موقوف',    color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: '🔴' },
];

const TABS = [
  { key: 'pipeline', label: 'خط الأنابيب', icon: '📊' },
  { key: 'create',   label: 'إنشاء شركة',  icon: '➕' },
  { key: 'matrix',   label: 'مصفوفة الميزات', icon: '🔧' },
];

const CITIES = ['الرياض','جدة','مكة','المدينة','الدمام','الخبر','أبها','تبوك','حائل','الطائف','بريدة','جازان','نجران','ينبع'];

function daysSince(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }
function toast(msg: string) { if (typeof window !== 'undefined') { const t = document.createElement('div'); t.textContent = msg; Object.assign(t.style, { position:'fixed',bottom:'20px',left:'50%',transform:'translateX(-50%)',background:'#1d4070',color:'white',padding:'10px 24px',borderRadius:'10px',fontSize:'13px',fontWeight:'600',zIndex:'9999',boxShadow:'0 4px 16px rgba(0,0,0,.15)' }); document.body.appendChild(t); setTimeout(() => t.remove(), 3000); } }

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function OnboardingCommandCenter() {
  const [tab, setTab] = useState('pipeline');
  const [companies, setCompanies] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [registry, setRegistry] = useState<Record<string, any>>({});
  const [matrix, setMatrix] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const [compRes, planRes, regRes] = await Promise.allSettled([
        adminApi.listCompanies(),
        adminApi.sa.listPlans().catch(() => ({ data: [] })),
        adminApi.sa.featureRegistry().catch(() => ({ data: {} })),
      ]);
      setCompanies((compRes as any).value?.data || []);
      setPlans((planRes as any).value?.data || []);
      setRegistry((regRes as any).value?.data || {});
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load matrix on tab switch
  useEffect(() => {
    if (tab === 'matrix') {
      adminApi.sa.featureMatrix().then(r => setMatrix(r?.data || [])).catch(() => {});
    }
  }, [tab]);

  // Load company detail when selected
  const loadDetail = useCallback(async (id: string) => {
    const [compRes, usageRes, flagsRes, auditRes] = await Promise.allSettled([
      adminApi.sa.getCompany(id).catch(() => adminApi.getCompany(id)),
      adminApi.sa.getCompanyUsage(id).catch(() => null),
      adminApi.sa.companyFlags(id).catch(() => null),
      adminApi.sa.listAudit({ target_id: id, limit: '20' }).catch(() => null),
    ]);
    setDetailData({
      company: (compRes as any).value?.data || null,
      usage: (usageRes as any).value?.data || null,
      flags: (flagsRes as any).value?.data || [],
      audit: (auditRes as any).value?.data || [],
    });
  }, []);

  const filtered = useMemo(() => {
    let list = companies;
    if (search) list = list.filter(c => (c.name || '').includes(search) || (c.name_ar || '').includes(search) || (c.slug || '').includes(search));
    if (planFilter !== 'all') list = list.filter(c => c.plan === planFilter);
    return list;
  }, [companies, search, planFilter]);

  async function handleAction(id: string, action: string, extra?: any) {
    try {
      if (action === 'activate') await adminApi.sa.activateCompany(id).catch(() => adminApi.activateCompany(id));
      else if (action === 'suspend') await adminApi.sa.suspendCompany(id, extra || 'إيقاف من لوحة التحكم').catch(() => adminApi.suspendCompany(id));
      else if (action === 'extend') await adminApi.sa.extendTrial(id, extra || 7);
      else if (action === 'assign-plan') await adminApi.sa.assignPlan(id, extra);
      toast('تم التنفيذ');
      await load();
      if (selected?.id === id) loadDetail(id);
    } catch (e: any) { toast('خطأ: ' + (e.message || '')); }
  }

  async function handleDrop(companyId: string, targetStage: string) {
    const c = companies.find(x => x.id === companyId);
    if (!c) return;
    const current = lcOf(c);
    if (current === targetStage) return;
    if (targetStage === 'active') await handleAction(companyId, 'activate');
    else if (targetStage === 'suspended') await handleAction(companyId, 'suspend');
    else toast('لا يمكن النقل لهذه المرحلة');
  }

  async function handleToggleFlag(companyId: string, key: string, enabled: boolean) {
    try {
      await adminApi.sa.setFlag(companyId, key, enabled);
      if (selected?.id === companyId) loadDetail(companyId);
      toast(enabled ? `تم تفعيل ${key}` : `تم تعطيل ${key}`);
    } catch (e: any) { toast('خطأ: ' + (e.message || '')); }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8', fontSize: 14 }}>جاري التحميل...</div>;

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>مركز القيادة</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{companies.length} شركة · {companies.filter(c => lcOf(c) === 'active').length} نشطة</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '8px 18px', borderRadius: 10, border: tab === t.key ? '2px solid #1d4070' : '1px solid #e2e8f0',
              background: tab === t.key ? '#1d4070' : 'white', color: tab === t.key ? 'white' : '#475569',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'pipeline' && <PipelineTab companies={filtered} search={search} setSearch={setSearch} planFilter={planFilter} setPlanFilter={setPlanFilter} selected={selected} setSelected={(c: any) => { setSelected(c); if (c) loadDetail(c.id); else setDetailData(null); }} detailData={detailData} handleAction={handleAction} handleDrop={handleDrop} handleToggleFlag={handleToggleFlag} plans={plans} registry={registry} />}
      {tab === 'create' && <CreateTab plans={plans} onCreated={() => { load(); setTab('pipeline'); }} />}
      {tab === 'matrix' && <MatrixTab companies={companies} matrix={matrix} registry={registry} onToggle={handleToggleFlag} reload={() => { adminApi.sa.featureMatrix().then(r => setMatrix(r?.data || [])).catch(() => {}); }} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════
function PipelineTab({ companies, search, setSearch, planFilter, setPlanFilter, selected, setSelected, detailData, handleAction, handleDrop, handleToggleFlag, plans, registry }: any) {
  return (
    <div>
      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرابط..." style={{ flex: 1, padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none' }} />
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, background: 'white' }}>
          <option value="all">كل الخطط</option>
          {['trial', 'basic', 'professional', 'enterprise'].map(p => <option key={p} value={p}>{PLAN_AR[p]}</option>)}
        </select>
      </div>

      {/* Kanban Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {STAGES.map(stage => {
          const stageCompanies = companies.filter((c: any) => lcOf(c) === stage.key);
          return (
            <div key={stage.key}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = stage.bg; }}
              onDragLeave={e => { e.currentTarget.style.background = 'white'; }}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.background = 'white'; const id = e.dataTransfer.getData('companyId'); if (id) handleDrop(id, stage.key); }}
              style={{ background: 'white', border: `1.5px solid ${stage.border}`, borderRadius: 14, padding: 12, minHeight: 200, transition: 'background .2s' }}>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{stage.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: stage.color }}>{stage.label}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: stage.bg, color: stage.color, border: `1px solid ${stage.border}` }}>
                  {stageCompanies.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stageCompanies.map((c: any) => (
                  <CompanyCard key={c.id} company={c} stage={stage} isSelected={selected?.id === c.id} onSelect={() => setSelected(selected?.id === c.id ? null : c)} onAction={handleAction} />
                ))}
                {stageCompanies.length === 0 && <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: 16 }}>لا توجد شركات</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline Detail Panel */}
      {selected && detailData && (
        <DetailPanel company={detailData.company || selected} usage={detailData.usage} flags={detailData.flags} audit={detailData.audit} plans={plans} registry={registry} onAction={handleAction} onToggleFlag={handleToggleFlag} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─── Company Card ────────────────────────────────────────────────────────────
function CompanyCard({ company: c, stage, isSelected, onSelect, onAction }: any) {
  const pc = PLAN_C[c.plan] || PLAN_C.basic;
  const trialDays = c.trial_ends_at ? daysUntil(c.trial_ends_at) : null;
  const unitPct = c.max_units > 0 ? Math.min(100, Math.round((c.unit_count || 0) / c.max_units * 100)) : 0;

  return (
    <div draggable onDragStart={e => e.dataTransfer.setData('companyId', c.id)}
      onClick={onSelect}
      style={{
        background: isSelected ? '#eff6ff' : '#fafafa', border: isSelected ? '2px solid #1d4070' : '1px solid #f1f5f9',
        borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'all .15s',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{c.name_ar || c.name}</span>
        <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, background: pc.bg, color: pc.color, fontWeight: 700, border: `1px solid ${pc.border || '#e2e8f0'}` }}>
          {PLAN_AR[c.plan] || c.plan}
        </span>
      </div>
      <p style={{ fontSize: 10, color: '#94a3b8', margin: '0 0 6px' }}>{c.slug || '—'} · {daysSince(c.created_at)} يوم</p>

      {/* Usage mini-bar */}
      <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', width: `${unitPct}%`, background: unitPct > 90 ? '#ef4444' : unitPct > 70 ? '#f59e0b' : '#22c55e', borderRadius: 2, transition: 'width .3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8' }}>
        <span>{c.unit_count || 0}/{c.max_units || '∞'} وحدة</span>
        {trialDays !== null && trialDays <= 7 && (
          <span style={{ color: trialDays <= 3 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
            {trialDays > 0 ? `${trialDays} يوم` : 'منتهي'}
          </span>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }} onClick={e => e.stopPropagation()}>
        {lcOf(c) === 'trial' && <MiniBtn label="تفعيل" color="#22c55e" onClick={() => onAction(c.id, 'activate')} />}
        {lcOf(c) === 'trial' && <MiniBtn label="+7 أيام" color="#3b82f6" onClick={() => onAction(c.id, 'extend', 7)} />}
        {lcOf(c) === 'active' && <MiniBtn label="إيقاف" color="#ef4444" onClick={() => onAction(c.id, 'suspend')} />}
        {lcOf(c) === 'suspended' && <MiniBtn label="تفعيل" color="#22c55e" onClick={() => onAction(c.id, 'activate')} />}
        {lcOf(c) === 'overdue' && <MiniBtn label="تفعيل" color="#22c55e" onClick={() => onAction(c.id, 'activate')} />}
      </div>
    </div>
  );
}

function MiniBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 6, border: `1px solid ${color}33`, background: `${color}11`, color, fontWeight: 600, cursor: 'pointer' }}>{label}</button>;
}

// ─── Detail Panel ────────────────────────────────────────────────────────────
function DetailPanel({ company: c, usage, flags, audit, plans, registry, onAction, onToggleFlag, onClose }: any) {
  const [dtab, setDtab] = useState('overview');
  const pc = PLAN_C[c?.plan] || PLAN_C.basic;

  if (!c) return null;

  const DTABS = [
    { key: 'overview', label: 'نظرة عامة' },
    { key: 'subscription', label: 'الاشتراك' },
    { key: 'features', label: 'الميزات' },
    { key: 'usage', label: 'الاستخدام' },
    { key: 'audit', label: 'التدقيق' },
  ];

  return (
    <div style={{ background: 'white', border: '2px solid #1d4070', borderRadius: 16, padding: 20, marginTop: 8, position: 'relative' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 12, left: 12, background: '#f1f5f9', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 14 }}>✕</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#1d4070', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 800 }}>{(c.name_ar || c.name || '?').charAt(0)}</div>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{c.name_ar || c.name}</h2>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{c.slug} · {PLAN_AR[c.plan] || c.plan} · {lcOf(c)}</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
        {DTABS.map(t => (
          <button key={t.key} onClick={() => setDtab(t.key)} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: dtab === t.key ? '#1d4070' : '#f8fafc', color: dtab === t.key ? 'white' : '#64748b',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Overview */}
      {dtab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <StatCard label="الوحدات" value={`${usage?.units || c.unit_count || 0} / ${c.max_units || '∞'}`} color="#3b82f6" />
          <StatCard label="الموظفين" value={`${usage?.staff || 0} / ${c.max_staff || '∞'}`} color="#8b5cf6" />
          <StatCard label="العقارات" value={`${usage?.properties || 0} / ${c.max_properties || '∞'}`} color="#f59e0b" />
          <StatCard label="العقود" value={`${usage?.contracts || 0} / ${c.max_contracts || '∞'}`} color="#22c55e" />
          <StatCard label="البريد" value={c.contact_email || '—'} color="#64748b" />
          <StatCard label="الهاتف" value={c.contact_phone || '—'} color="#64748b" />
        </div>
      )}

      {/* Subscription */}
      {dtab === 'subscription' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <StatCard label="الخطة الحالية" value={PLAN_AR[c.plan] || c.plan} color={pc.color} />
            <StatCard label="الحالة" value={lcOf(c)} color={lcOf(c) === 'active' ? '#22c55e' : '#f59e0b'} />
          </div>
          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>تغيير الخطة:</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {plans.filter((p: any) => p.is_active !== false).map((p: any) => (
              <button key={p.id} onClick={() => onAction(c.id, 'assign-plan', { plan_id: p.id, billing_cycle: 'monthly' })}
                disabled={p.name === c.plan}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${p.name === c.plan ? '#1d4070' : '#e2e8f0'}`, background: p.name === c.plan ? '#1d4070' : 'white', color: p.name === c.plan ? 'white' : '#475569', fontSize: 11, fontWeight: 600, cursor: p.name === c.plan ? 'default' : 'pointer', opacity: p.name === c.plan ? 0.6 : 1 }}>
                {p.name_ar || PLAN_AR[p.name] || p.name}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {lcOf(c) === 'trial' && <MiniBtn label="تمديد 7 أيام" color="#3b82f6" onClick={() => onAction(c.id, 'extend', 7)} />}
            {lcOf(c) === 'trial' && <MiniBtn label="تمديد 30 يوم" color="#3b82f6" onClick={() => onAction(c.id, 'extend', 30)} />}
          </div>
        </div>
      )}

      {/* Features */}
      {dtab === 'features' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {Object.entries(registry).map(([key, meta]: [string, any]) => {
            const flag = (flags || []).find((f: any) => f.feature_key === key);
            const enabled = flag?.is_enabled || false;
            return (
              <div key={key} onClick={() => onToggleFlag(c.id, key, !enabled)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, border: `1px solid ${enabled ? '#86efac' : '#e2e8f0'}`, background: enabled ? '#f0fdf4' : '#fafafa', cursor: 'pointer', transition: 'all .15s' }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: enabled ? '#16a34a' : '#94a3b8' }}>{meta.name_ar || key}</span>
                  <span style={{ fontSize: 9, color: '#94a3b8', marginRight: 6 }}>({meta.tier_min})</span>
                </div>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: enabled ? '#22c55e' : '#d1d5db', position: 'relative', transition: 'background .2s' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, transition: 'all .2s', ...(enabled ? { left: 2 } : { right: 2 }) }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Usage */}
      {dtab === 'usage' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'الوحدات', used: usage?.units || 0, max: c.max_units },
            { label: 'الموظفين', used: usage?.staff || 0, max: c.max_staff },
            { label: 'العقارات', used: usage?.properties || 0, max: c.max_properties },
            { label: 'العقود', used: usage?.contracts || 0, max: c.max_contracts },
          ].map(u => {
            const pct = u.max > 0 ? Math.round(u.used / u.max * 100) : 0;
            const color = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e';
            return (
              <div key={u.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>{u.label}</span>
                  <span style={{ color, fontWeight: 700 }}>{u.used} / {u.max || '∞'}</span>
                </div>
                <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .3s' }} />
                </div>
                <span style={{ fontSize: 9, color: '#94a3b8' }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Audit */}
      {dtab === 'audit' && (
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          {(audit || []).length === 0 ? <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 20 }}>لا توجد أنشطة</p> :
            (audit || []).map((a: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 11 }}>
                <span style={{ color: '#475569' }}>{a.action}</span>
                <span style={{ color: '#94a3b8' }}>{a.actor_email || '—'} · {fmtDate(a.created_at)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: CREATE (Enhanced Onboarding Wizard)
// ═══════════════════════════════════════════════════════════════════════════════
function CreateTab({ plans, onCreated }: { plans: any[]; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', name_ar: '', slug: '', city: 'الرياض', cr_number: '', contact_phone: '', contact_email: '', plan: 'trial', max_units: 50, max_staff: 5, trial_days: 30, billing_cycle: 'monthly', admin_name: '', admin_phone: '', admin_email: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<any>(null);
  const [progress, setProgress] = useState('');

  function f(key: string) { return (e: any) => setForm(p => ({ ...p, [key]: e.target.value })); }

  function toSlug(name: string) {
    return name.toLowerCase().replace(/[\u0600-\u06FF]/g, '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `co-${Date.now().toString(36)}`;
  }

  function canProceed() {
    if (step === 1) return form.name.trim() && form.slug.trim();
    if (step === 2) return form.max_units > 0 && form.max_staff > 0;
    if (step === 3) return form.admin_name.trim() && /^(\+966|966|05)\d{7,9}$/.test(form.admin_phone.replace(/\s/g, ''));
    return true;
  }

  async function handleCreate() {
    setSaving(true); setErr(''); setProgress('جاري إنشاء الشركة...');
    try {
      setProgress('إنشاء الحساب وتفعيل الميزات...');
      const res: any = await adminApi.createCompany({
        name: form.name, name_ar: form.name_ar || form.name, slug: form.slug, city: form.city,
        cr_number: form.cr_number, contact_phone: form.contact_phone, contact_email: form.contact_email,
        plan: form.plan, max_units: form.max_units, max_staff: form.max_staff, trial_days: form.trial_days,
        billing_cycle: form.billing_cycle, admin_name: form.admin_name, admin_phone: form.admin_phone, admin_email: form.admin_email,
      });
      setProgress('');
      setResult(res?.data || res);
      setStep(5);
    } catch (e: any) { setErr(e.message); setProgress(''); }
    finally { setSaving(false); }
  }

  const inp = { width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none' } as const;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {[1, 2, 3, 4].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? '#1d4070' : '#e2e8f0', transition: 'background .3s' }} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>بيانات الشركة</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div><label style={{ fontSize: 11, color: '#64748b' }}>اسم الشركة *</label><input style={inp} value={form.name} onChange={e => { f('name')(e); setForm(p => ({ ...p, slug: toSlug(e.target.value) })); }} placeholder="Company Name" /></div>
            <div><label style={{ fontSize: 11, color: '#64748b' }}>الاسم بالعربي</label><input style={inp} value={form.name_ar} onChange={f('name_ar')} placeholder="اسم الشركة" /></div>
            <div><label style={{ fontSize: 11, color: '#64748b' }}>الرابط (slug) *</label><input style={inp} value={form.slug} onChange={f('slug')} placeholder="company-slug" dir="ltr" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={{ fontSize: 11, color: '#64748b' }}>المدينة</label><select style={inp} value={form.city} onChange={f('city')}>{CITIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label style={{ fontSize: 11, color: '#64748b' }}>السجل التجاري</label><input style={inp} value={form.cr_number} onChange={f('cr_number')} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={{ fontSize: 11, color: '#64748b' }}>هاتف التواصل</label><input style={inp} value={form.contact_phone} onChange={f('contact_phone')} dir="ltr" /></div>
              <div><label style={{ fontSize: 11, color: '#64748b' }}>بريد التواصل</label><input style={inp} value={form.contact_email} onChange={f('contact_email')} dir="ltr" /></div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>الخطة والحدود</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
            {['trial', 'basic', 'professional', 'enterprise'].map(p => {
              const pc = PLAN_C[p] || PLAN_C.basic;
              return (
                <div key={p} onClick={() => setForm(prev => ({ ...prev, plan: p, max_units: p === 'trial' ? 50 : p === 'basic' ? 100 : p === 'professional' ? 500 : 9999, max_staff: p === 'trial' ? 5 : p === 'basic' ? 10 : p === 'professional' ? 25 : 100 }))}
                  style={{ padding: 14, borderRadius: 12, border: form.plan === p ? '2px solid #1d4070' : `1px solid ${pc.border || '#e2e8f0'}`, background: form.plan === p ? '#eff6ff' : 'white', cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: pc.color }}>{PLAN_AR[p]}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{p === 'trial' ? 'مجاني' : ''}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={{ fontSize: 11, color: '#64748b' }}>حد الوحدات</label><input style={inp} type="number" value={form.max_units} onChange={f('max_units')} /></div>
            <div><label style={{ fontSize: 11, color: '#64748b' }}>حد الموظفين</label><input style={inp} type="number" value={form.max_staff} onChange={f('max_staff')} /></div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>إعداد المدير</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div><label style={{ fontSize: 11, color: '#64748b' }}>اسم المدير *</label><input style={inp} value={form.admin_name} onChange={f('admin_name')} /></div>
            <div><label style={{ fontSize: 11, color: '#64748b' }}>رقم الجوال (اسم المستخدم) *</label><input style={inp} value={form.admin_phone} onChange={f('admin_phone')} dir="ltr" placeholder="05XXXXXXXX" /></div>
            <div><label style={{ fontSize: 11, color: '#64748b' }}>البريد (اختياري)</label><input style={inp} value={form.admin_email} onChange={f('admin_email')} dir="ltr" /></div>
            <div style={{ background: '#eff6ff', padding: 12, borderRadius: 10, fontSize: 11, color: '#1d4070' }}>
              سيتم إنشاء حساب مدير بصلاحية كاملة. تسجيل الدخول عبر رمز OTP يُرسل لهذا الرقم.
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>مراجعة وإنشاء</h3>
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, fontSize: 12 }}>
            <Row label="الشركة" value={`${form.name_ar || form.name} (${form.slug})`} />
            <Row label="المدينة" value={form.city} />
            <Row label="الخطة" value={PLAN_AR[form.plan] || form.plan} />
            <Row label="الحدود" value={`${form.max_units} وحدة · ${form.max_staff} موظف`} />
            <Row label="المدير" value={`${form.admin_name} · ${form.admin_phone}`} />
          </div>
          {progress && <p style={{ fontSize: 12, color: '#1d4070', marginTop: 12, fontWeight: 600 }}>{progress}</p>}
          {err && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{err}</p>}
        </div>
      )}

      {step === 5 && result && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>تم إنشاء الشركة بنجاح</h3>
          <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 16, fontSize: 12, textAlign: 'right', marginBottom: 16 }}>
            <Row label="رابط الدخول" value={`https://app.liv-entra.com`} />
            <Row label="اسم المستخدم" value={form.admin_phone} />
            <Row label="طريقة الدخول" value="رمز OTP عبر الجوال" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => { setStep(1); setForm({ name: '', name_ar: '', slug: '', city: 'الرياض', cr_number: '', contact_phone: '', contact_email: '', plan: 'trial', max_units: 50, max_staff: 5, trial_days: 30, billing_cycle: 'monthly', admin_name: '', admin_phone: '', admin_email: '' }); setResult(null); }} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', fontSize: 13, cursor: 'pointer' }}>إضافة شركة أخرى</button>
            <button onClick={onCreated} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#1d4070', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>عرض الشركات</button>
          </div>
        </div>
      )}

      {/* Navigation */}
      {step < 5 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          {step > 1 ? <button onClick={() => setStep(s => s - 1)} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', fontSize: 13, cursor: 'pointer' }}>السابق</button> : <div />}
          {step < 4 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: canProceed() ? '#1d4070' : '#94a3b8', color: 'white', fontSize: 13, fontWeight: 600, cursor: canProceed() ? 'pointer' : 'not-allowed' }}>التالي</button>
          ) : (
            <button onClick={handleCreate} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: saving ? '#94a3b8' : '#22c55e', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'جاري الإنشاء...' : 'إنشاء الشركة'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ color: '#94a3b8', fontSize: 11 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 12 }}>{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: FEATURES MATRIX
// ═══════════════════════════════════════════════════════════════════════════════
function MatrixTab({ companies, matrix, registry, onToggle, reload }: any) {
  const [filterPlan, setFilterPlan] = useState('all');
  const featureKeys = Object.keys(registry);
  const filtered = filterPlan === 'all' ? companies : companies.filter((c: any) => c.plan === filterPlan);

  // Build lookup: company_id → { feature_key → boolean }
  const flagMap: Record<string, Record<string, boolean>> = {};
  (matrix || []).forEach((row: any) => {
    if (!flagMap[row.company_id]) flagMap[row.company_id] = {};
    flagMap[row.company_id][row.feature_key] = row.is_enabled;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 700 }}>مصفوفة الميزات — {filtered.length} شركة × {featureKeys.length} ميزة</p>
        <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}>
          <option value="all">كل الخطط</option>
          {['trial', 'basic', 'professional', 'enterprise'].map(p => <option key={p} value={p}>{PLAN_AR[p]}</option>)}
        </select>
      </div>

      <div style={{ overflow: 'auto', maxHeight: 600 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', top: 0, right: 0, background: '#0f172a', color: 'white', padding: '8px 12px', textAlign: 'right', zIndex: 2, minWidth: 150 }}>الشركة</th>
              {featureKeys.map(key => (
                <th key={key} style={{ position: 'sticky', top: 0, background: '#0f172a', color: 'white', padding: '8px 6px', textAlign: 'center', fontSize: 9, minWidth: 70, zIndex: 1 }}>
                  {registry[key]?.name_ar || key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c: any) => {
              const pc = PLAN_C[c.plan] || PLAN_C.basic;
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 600, position: 'sticky', right: 0, background: 'white', zIndex: 1 }}>
                    <span>{c.name_ar || c.name}</span>
                    <span style={{ fontSize: 8, marginRight: 6, padding: '1px 6px', borderRadius: 20, background: pc.bg, color: pc.color }}>{PLAN_AR[c.plan]}</span>
                  </td>
                  {featureKeys.map(key => {
                    const enabled = flagMap[c.id]?.[key] || false;
                    return (
                      <td key={key} style={{ textAlign: 'center', padding: 4 }}>
                        <button onClick={() => { onToggle(c.id, key, !enabled); setTimeout(reload, 500); }}
                          style={{ width: 24, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                            background: enabled ? '#dcfce7' : '#f1f5f9', color: enabled ? '#16a34a' : '#cbd5e1' }}>
                          {enabled ? '✓' : '—'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
