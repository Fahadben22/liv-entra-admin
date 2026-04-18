'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, request } from '@/lib/api';
import { lcOf, daysUntil, fmt, fmtDate, PLAN_C } from '@/lib/billing-helpers';
import { STAGES, PLAN_AR, CITIES } from '@/lib/constants';
import { useDebounce } from '@/lib/hooks';
import { useToast } from '@/components/Toast';
import { KanbanSkeleton } from '@/components/LoadingSkeleton';
import ConfirmDialog from '@/components/ConfirmDialog';
import AccountsTable from '@/components/AccountsTable';
import KpiStrip from '@/components/KpiStrip';
import type { Company } from '@/lib/types';

function daysSince(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }

const TABS = [
  { key: 'pipeline', label: 'خط الأنابيب' },
  { key: 'matrix',   label: 'مصفوفة الميزات' },
  { key: 'accounts', label: 'جدول الحسابات' },
];

export default function OnboardingCommandCenter() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState('pipeline');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [registry, setRegistry] = useState<Record<string, any>>({});
  const [matrix, setMatrix] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Company | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string; extra?: any } | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const debouncedSearch = useDebounce(search, 300);

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

  const filtered = useMemo(() => {
    let list = companies;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(c => (c.name || '').toLowerCase().includes(q) || (c.name_ar || '').includes(q) || (c.slug || '').includes(q));
    }
    if (planFilter !== 'all') list = list.filter(c => c.plan === planFilter);
    return list;
  }, [companies, debouncedSearch, planFilter]);

  async function loadDetail(id: string) {
    try {
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
    } catch {}
  }

  async function handleAction(id: string, action: string, extra?: any) {
    // Suspend needs confirmation
    if (action === 'suspend') {
      setConfirmAction({ id, action, extra });
      setSuspendReason('');
      setConfirmOpen(true);
      return;
    }
    try {
      if (action === 'activate') await adminApi.sa.activateCompany(id).catch(() => adminApi.activateCompany(id));
      else if (action === 'extend') await adminApi.sa.extendTrial(id, extra || 7);
      else if (action === 'assign-plan') await adminApi.sa.assignPlan(id, extra);
      toast('تم التنفيذ');
      await load();
      if (selected?.id === id) loadDetail(id);
    } catch (e: any) { toast('خطأ: ' + (e.message || ''), 'error'); }
  }

  async function confirmSuspend() {
    if (!confirmAction) return;
    setConfirmOpen(false);
    try {
      await adminApi.sa.suspendCompany(confirmAction.id, suspendReason || 'إيقاف من لوحة التحكم').catch(() => adminApi.suspendCompany(confirmAction.id));
      toast('تم الإيقاف');
      await load();
      if (selected?.id === confirmAction.id) loadDetail(confirmAction.id);
    } catch (e: any) { toast('خطأ: ' + (e.message || ''), 'error'); }
  }

  async function handleDrop(companyId: string, targetStage: string) {
    const c = companies.find(x => x.id === companyId);
    if (!c) return;
    const current = lcOf(c);
    if (current === targetStage) return;
    if (targetStage === 'active') await handleAction(companyId, 'activate');
    else if (targetStage === 'suspended') await handleAction(companyId, 'suspend');
    else toast('لا يمكن النقل لهذه المرحلة', 'error');
  }

  async function handleToggleFlag(companyId: string, key: string, enabled: boolean) {
    try {
      await adminApi.sa.setFlag(companyId, key, enabled);
      if (selected?.id === companyId) loadDetail(companyId);
      toast(enabled ? `تم تفعيل ${key}` : `تم تعطيل ${key}`);
    } catch (e: any) { toast('خطأ: ' + (e.message || ''), 'error'); }
  }

  if (loading) return <KanbanSkeleton />;

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#18181b', margin: 0, letterSpacing: '-0.02em' }}>الشركات</h1>
          <p style={{ fontSize: 12, color: '#a1a1aa', marginTop: 3 }}>{companies.length} شركة · {companies.filter(c => lcOf(c) === 'active').length} نشطة</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '6px 14px', borderRadius: 7, border: '1px solid ' + (tab === t.key ? '#18181b' : '#e5e5e5'),
              background: tab === t.key ? '#18181b' : '#fff', color: tab === t.key ? '#fff' : '#71717a',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .12s',
            }}>
              {t.label}
            </button>
          ))}
          <button onClick={() => router.push('/dashboard/companies/new')} style={{
            padding: '6px 16px', borderRadius: 7, border: 'none',
            background: '#18181b', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}>
            + إنشاء شركة
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'pipeline' && (
        <div>
          {/* Search + Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
              style={{ flex: 1, padding: '7px 12px', border: '1px solid #e5e5e5', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fff', color: '#18181b' }} />
            <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
              style={{ padding: '7px 12px', border: '1px solid #e5e5e5', borderRadius: 7, fontSize: 12, background: '#fff', color: '#71717a' }}>
              <option value="all">كل الخطط</option>
              {['trial', 'basic', 'professional', 'enterprise'].map(p => <option key={p} value={p}>{PLAN_AR[p]}</option>)}
            </select>
          </div>

          {/* Kanban Board */}
          <div className="grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {STAGES.map(stage => {
              const stageCompanies = filtered.filter(c => lcOf(c) === stage.key);
              return (
                <div key={stage.key}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = 'var(--lv-bg)'; }}
                  onDragLeave={e => { e.currentTarget.style.background = '#fff'; }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.style.background = '#fff'; const id = e.dataTransfer.getData('companyId'); if (id) handleDrop(id, stage.key); }}
                  style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 10, padding: 12, minHeight: 200, transition: 'background .15s' }}>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: stage.color }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#3f3f46' }}>{stage.label}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#a1a1aa' }}>
                      {stageCompanies.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {stageCompanies.map(c => (
                      <CompanyCard key={c.id} company={c} isSelected={selected?.id === c.id}
                        onSelect={() => { const next = selected?.id === c.id ? null : c; setSelected(next); if (next) loadDetail(next.id); else setDetailData(null); }}
                        onAction={handleAction} />
                    ))}
                    {stageCompanies.length === 0 && <p style={{ fontSize: 11, color: '#d4d4d8', textAlign: 'center', padding: 20 }}>فارغ</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Inline Detail Panel */}
          {selected && detailData && (
            <DetailPanel company={detailData.company || selected} usage={detailData.usage} flags={detailData.flags} audit={detailData.audit}
              plans={plans} registry={registry} onAction={handleAction} onToggleFlag={handleToggleFlag}
              onReload={() => loadDetail(selected!.id)}
              onClose={() => { setSelected(null); setDetailData(null); }} />
          )}
        </div>
      )}

      {tab === 'matrix' && (
        <MatrixTab companies={companies} matrix={matrix} registry={registry} onToggle={handleToggleFlag}
          reload={() => { adminApi.sa.featureMatrix().then(r => setMatrix(r?.data || [])).catch(() => {}); }} />
      )}

      {tab === 'accounts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* KPI strip */}
          <KpiStrip />
          {/* Accounts table with real company data */}
          <AccountsTable companies={companies} lang="ar" />
        </div>
      )}

      {/* Suspend Confirm Dialog */}
      <ConfirmDialog open={confirmOpen} title="إيقاف الشركة" message="هل أنت متأكد؟ سيتم تعطيل جميع الميزات لهذه الشركة."
        confirmLabel="إيقاف" danger requireReason reason={suspendReason} onReasonChange={setSuspendReason}
        onConfirm={confirmSuspend} onCancel={() => setConfirmOpen(false)} />
    </div>
  );
}

// ─── Company Card ────────────────────────────────────────────────────────────
function CompanyCard({ company: c, isSelected, onSelect, onAction }: { company: Company; isSelected: boolean; onSelect: () => void; onAction: (id: string, action: string, extra?: any) => void }) {
  const trialDays = c.trial_ends_at ? daysUntil(c.trial_ends_at) : null;
  const unitPct = c.max_units > 0 ? Math.min(100, Math.round(((c as any).unit_count || 0) / c.max_units * 100)) : 0;
  const status = lcOf(c);

  return (
    <div draggable onDragStart={e => e.dataTransfer.setData('companyId', c.id)} onClick={onSelect}
      style={{
        background: '#fff', border: isSelected ? '1.5px solid #18181b' : '1px solid #f0f0f0',
        borderRadius: 8, padding: '10px 12px', cursor: 'pointer', transition: 'all .12s',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#18181b' }}>{c.name_ar || c.name}</span>
        <span style={{ fontSize: 10, color: '#a1a1aa', fontWeight: 500 }}>
          {PLAN_AR[c.plan] || c.plan}
        </span>
      </div>
      <p style={{ fontSize: 11, color: '#a1a1aa', margin: '0 0 6px' }}>{c.slug || '—'} · {daysSince(c.created_at)}d</p>

      <div style={{ height: 3, background: '#f4f4f5', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', width: `${unitPct}%`, background: unitPct > 90 ? '#ef4444' : unitPct > 70 ? '#f59e0b' : '#18181b', borderRadius: 2, transition: 'width .3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#a1a1aa' }}>
        <span>{(c as any).unit_count || 0}/{c.max_units || '∞'}</span>
        {trialDays !== null && trialDays <= 7 && (
          <span style={{ color: trialDays <= 3 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
            {trialDays > 0 ? `${trialDays}d` : 'expired'}
          </span>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 4, marginTop: 8 }} onClick={e => e.stopPropagation()}>
        {status === 'trial' && <MiniBtn label="تفعيل" variant="default" onClick={() => onAction(c.id, 'activate')} />}
        {status === 'trial' && <MiniBtn label="+7" variant="default" onClick={() => onAction(c.id, 'extend', 7)} />}
        {(status === 'trial' || status === 'active') && <MiniBtn label="إيقاف" variant="danger" onClick={() => onAction(c.id, 'suspend')} />}
        {status === 'suspended' && <MiniBtn label="تفعيل" variant="default" onClick={() => onAction(c.id, 'activate')} />}
        {status === 'overdue' && <MiniBtn label="تفعيل" variant="default" onClick={() => onAction(c.id, 'activate')} />}
      </div>
    </div>
  );
}

function MiniBtn({ label, variant, onClick }: { label: string; variant: 'default' | 'danger'; onClick: () => void }) {
  const isDanger = variant === 'danger';
  return (
    <button onClick={onClick} style={{
      fontSize: 10, padding: '3px 8px', borderRadius: 5,
      border: `1px solid ${isDanger ? '#fecaca' : '#e5e5e5'}`,
      background: isDanger ? '#fef2f2' : '#fff',
      color: isDanger ? '#dc2626' : '#3f3f46',
      fontWeight: 500, cursor: 'pointer', transition: 'all .1s',
    }}>{label}</button>
  );
}

// ─── Detail Panel ────────────────────────────────────────────────────────────
function DetailPanel({ company: c, usage, flags, audit, plans, registry, onAction, onToggleFlag, onReload, onClose }: any) {
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
    <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 10, padding: 20, marginTop: 10, position: 'relative' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 14, left: 14, background: '#f4f4f5', border: 'none', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 12, color: '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }}>{(c.name_ar || c.name || '?').charAt(0)}</div>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#18181b' }}>{c.name_ar || c.name}</h2>
          <p style={{ fontSize: 11, color: '#a1a1aa', margin: 0 }}>{c.slug} · {PLAN_AR[c.plan] || c.plan} · {lcOf(c)}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid #f0f0f0', paddingBottom: 0 }}>
        {DTABS.map(t => (
          <button key={t.key} onClick={() => setDtab(t.key)} style={{
            padding: '8px 14px', borderRadius: 0, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            background: 'transparent', color: dtab === t.key ? '#18181b' : '#a1a1aa',
            borderBottom: dtab === t.key ? '2px solid #18181b' : '2px solid transparent',
            transition: 'all .12s',
          }}>{t.label}</button>
        ))}
      </div>

      {dtab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <StatCard label="الوحدات" value={`${usage?.units?.used ?? (c as any).unit_count ?? 0} / ${c.max_units || '∞'}`} />
          <StatCard label="الموظفين" value={`${usage?.staff?.used ?? 0} / ${c.max_staff || '∞'}`} color="#8b5cf6" />
          <StatCard label="العقارات" value={`${usage?.properties?.used ?? 0} / ${c.max_properties || '∞'}`} color="#f59e0b" />
          <StatCard label="العقود" value={`${usage?.contracts?.used ?? 0} / ${c.max_contracts || '∞'}`} color="#22c55e" />
          <StatCard label="البريد" value={c.contact_email || '—'} color="#64748b" />
          <StatCard label="الهاتف" value={c.contact_phone || '—'} color="#64748b" />
        </div>
      )}

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
                {p.name_ar || PLAN_AR[p.name] || p.name} {p.price_monthly ? `(${p.price_monthly} ر.س/شهر)` : ''}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {lcOf(c) === 'trial' && <MiniBtn label="تمديد 7 أيام" variant="default" onClick={() => onAction(c.id, 'extend', 7)} />}
            {lcOf(c) === 'trial' && <MiniBtn label="تمديد 30 يوم" variant="default" onClick={() => onAction(c.id, 'extend', 30)} />}
          </div>

          {/* ── Hatif.io Integration ── */}
          <HatifInlineForm companyId={c.id} hatifEnabled={c.hatif_enabled} hatifPortalUrl={c.hatif_portal_url} onSaved={onReload} />
        </div>
      )}

      {dtab === 'features' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {Object.entries(registry).map(([key, meta]: [string, any]) => {
            const flag = (flags || []).find((f: any) => f.feature_key === key);
            const enabled = flag?.is_enabled || false;
            const planIncludes = flag?.plan_includes || false;
            return (
              <div key={key} onClick={() => onToggleFlag(c.id, key, !enabled)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, border: `1px solid ${enabled ? '#86efac' : '#e2e8f0'}`, background: enabled ? '#f0fdf4' : 'var(--lv-bg)', cursor: 'pointer', transition: 'all .15s' }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: enabled ? '#16a34a' : '#94a3b8' }}>{meta.name_ar || key}</span>
                  <span style={{ fontSize: 9, color: '#94a3b8', marginRight: 6 }}>({meta.tier_min})</span>
                  {planIncludes && <span style={{ fontSize: 8, color: '#16a34a', marginRight: 4 }}>مُضمّن</span>}
                </div>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: enabled ? '#22c55e' : '#d1d5db', position: 'relative', transition: 'background .2s' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, transition: 'all .2s', ...(enabled ? { left: 2 } : { right: 2 }) }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dtab === 'usage' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'الوحدات', used: usage?.units?.used || 0, max: c.max_units },
            { label: 'الموظفين', used: usage?.staff?.used || 0, max: c.max_staff },
            { label: 'العقارات', used: usage?.properties?.used || 0, max: c.max_properties },
            { label: 'العقود', used: usage?.contracts?.used || 0, max: c.max_contracts },
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

      {dtab === 'audit' && (
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          {(audit || []).length === 0 ? <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 20 }}>لا توجد أنشطة</p> :
            (audit || []).map((a: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--lv-line)', fontSize: 11 }}>
                <span style={{ color: '#475569' }}>{a.action}</span>
                <span style={{ color: '#94a3b8' }}>{a.actor_email || '—'} · {fmtDate(a.created_at)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--lv-bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid #f0f0f0' }}>
      <div style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 3, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color || '#18181b' }}>{value}</div>
    </div>
  );
}

// ─── Feature Matrix Tab ──────────────────────────────────────────────────────
function MatrixTab({ companies, matrix, registry, onToggle, reload }: any) {
  const [filterPlan, setFilterPlan] = useState('all');
  const featureKeys = Object.keys(registry);
  const filtered = filterPlan === 'all' ? companies : companies.filter((c: any) => c.plan === filterPlan);

  const flagMap: Record<string, Record<string, boolean>> = {};
  (matrix || []).forEach((row: any) => {
    if (!flagMap[row.company_id]) flagMap[row.company_id] = {};
    flagMap[row.company_id][row.feature_key] = row.is_enabled;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>مصفوفة الميزات — {filtered.length} شركة × {featureKeys.length} ميزة</p>
        <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} style={{ padding: '6px 12px', border: '1px solid #e5e5e5', borderRadius: 7, fontSize: 12, background: '#fff', color: '#71717a' }}>
          <option value="all">كل الخطط</option>
          {['trial', 'basic', 'professional', 'enterprise'].map(p => <option key={p} value={p}>{PLAN_AR[p]}</option>)}
        </select>
      </div>

      <div style={{ overflow: 'auto', maxHeight: 600, border: '1px solid #e5e5e5', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', top: 0, right: 0, background: 'var(--lv-bg)', color: '#3f3f46', padding: '10px 12px', textAlign: 'right', zIndex: 2, minWidth: 150, borderBottom: '1px solid #e5e5e5', fontWeight: 600, fontSize: 11 }}>الشركة</th>
              {featureKeys.map(key => (
                <th key={key} style={{ position: 'sticky', top: 0, background: 'var(--lv-bg)', color: '#71717a', padding: '10px 6px', textAlign: 'center', fontSize: 9, minWidth: 70, zIndex: 1, borderBottom: '1px solid #e5e5e5', fontWeight: 500 }}>
                  {registry[key]?.name_ar || key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c: any, idx: number) => {
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f4f4f5', background: idx % 2 === 0 ? '#fff' : 'var(--lv-bg)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500, position: 'sticky', right: 0, background: idx % 2 === 0 ? '#fff' : 'var(--lv-bg)', zIndex: 1, fontSize: 12, color: '#18181b' }}>
                    <span>{c.name_ar || c.name}</span>
                    <span style={{ fontSize: 10, marginRight: 6, color: '#a1a1aa' }}>{PLAN_AR[c.plan]}</span>
                  </td>
                  {featureKeys.map(key => {
                    const enabled = flagMap[c.id]?.[key] || false;
                    return (
                      <td key={key} style={{ textAlign: 'center', padding: 4 }}>
                        <button onClick={() => { onToggle(c.id, key, !enabled); setTimeout(reload, 500); }}
                          style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid ' + (enabled ? '#d1fae5' : '#f0f0f0'), cursor: 'pointer', fontSize: 11,
                            background: enabled ? '#ecfdf5' : '#fff', color: enabled ? '#059669' : '#d4d4d8', fontWeight: 500, transition: 'all .1s' }}>
                          {enabled ? 'نعم' : '—'}
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

// ─── Hatif Inline Form (used inside DetailPanel subscription tab) ─────────────
function HatifInlineForm({ companyId, hatifEnabled, hatifPortalUrl, onSaved }: {
  companyId: string;
  hatifEnabled?: boolean;
  hatifPortalUrl?: string;
  onSaved: () => void;
}) {
  const [enabled,   setEnabled]   = useState<boolean>(hatifEnabled ?? false);
  const [portalUrl, setPortalUrl] = useState<string>(hatifPortalUrl ?? '');
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState('');

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateCompany(companyId, { hatif_enabled: enabled, hatif_portal_url: portalUrl || null });
      setMsg('تم الحفظ');
      setTimeout(() => setMsg(''), 2500);
      onSaved();
    } catch (e: any) { setMsg(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lv-accent)' }}>هاتف</span>
        <p style={{ fontSize: 12, fontWeight: 700, margin: 0, color: '#18181b' }}>تكامل هاتف</p>
        {msg && <span style={{ fontSize: 11, color: msg.startsWith('خطأ') ? '#ef4444' : '#22c55e', marginRight: 'auto' }}>{msg}</span>}
      </div>
      <div style={{ background: 'rgba(5,150,105,.04)', border: '1px solid rgba(5,150,105,.15)', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: 'var(--lv-fg)', margin: 0 }}>تفعيل هاتف لهذه الشركة</p>
          <button onClick={() => setEnabled(v => !v)}
            style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: enabled ? '#22c55e' : '#d1d5db', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 2, left: enabled ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
          </button>
        </div>
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 10, color: 'var(--lv-muted)', margin: '0 0 4px' }}>رابط بوابة هاتف (اختياري)</p>
          <input
            value={portalUrl}
            onChange={e => setPortalUrl(e.target.value)}
            dir="ltr"
            placeholder="https://app.hatif.io/org/XXXXX"
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--lv-line)', fontSize: 11, width: '100%', background: 'var(--lv-panel)', color: '#18181b', boxSizing: 'border-box' }}
          />
        </div>
        <button onClick={save} disabled={saving}
          style={{ padding: '6px 16px', borderRadius: 8, background: '#059669', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
          {saving ? '...' : 'حفظ'}
        </button>
      </div>
    </div>
  );
}
