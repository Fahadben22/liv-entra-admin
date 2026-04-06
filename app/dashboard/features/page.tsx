'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type View = 'company' | 'feature' | 'matrix';
type Tier = 'trial' | 'basic' | 'professional' | 'enterprise';

interface Company { id: string; name: string; plan: string; lifecycle_status: string; subscription?: any; }
interface Flag { feature_key: string; name_ar: string; tier_min: string; beta: boolean; is_enabled: boolean; rollout_pct: number; set_at: string | null; plan_includes: boolean; notes?: string; }
interface FeatureStat { enabled_count: number; total_companies: number; adoption_pct: number; avg_rollout: number; name_ar: string; tier_min: string; beta: boolean; }
interface FeatureCompanyRow { company_id: string; name: string; plan: string; is_enabled: boolean; rollout_pct: number; set_at: string | null; notes: string | null; plan_includes: boolean; }
interface MatrixData { companies: Company[]; features: Record<string, any>; matrix: Record<string, Record<string, { is_enabled: boolean; rollout_pct: number }>>; }

// ─── Constants ────────────────────────────────────────────────────────────────
const TIER_ORDER: Tier[] = ['trial', 'basic', 'professional', 'enterprise'];
const TIER_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  trial:        { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  basic:        { bg: '#fafafa', color: '#71717a', border: '#e5e5e5' },
  professional: { bg: '#eff6ff', color: '#1d4070', border: '#bfdbfe' },
  enterprise:   { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
};

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}س`;
  return `${Math.floor(h / 24)}ي`;
}

// ─── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <div onClick={disabled ? undefined : onClick}
      style={{ width: 44, height: 24, borderRadius: 12, background: on ? '#15803d' : '#cbd5e1', position: 'relative', flexShrink: 0, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FeaturesPage() {
  const router = useRouter();
  const [view,           setView]           = useState<View>('company');
  const [companies,      setCompanies]      = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [companyFlags,   setCompanyFlags]   = useState<Flag[]>([]);
  const [flagsLoading,   setFlagsLoading]   = useState(false);
  const [stats,          setStats]          = useState<Record<string, FeatureStat>>({});
  const [recentChanges,  setRecentChanges]  = useState<any[]>([]);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [featureRows,    setFeatureRows]    = useState<FeatureCompanyRow[]>([]);
  const [featureLoading, setFeatureLoading] = useState(false);
  const [matrixData,     setMatrixData]     = useState<MatrixData | null>(null);
  const [matrixLoading,  setMatrixLoading]  = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [toast,          setToast]          = useState('');
  const [search,         setSearch]         = useState('');
  const [tierFilter,     setTierFilter]     = useState('all');
  const [noteModal,      setNoteModal]      = useState<{ companyId: string; featureKey: string; currentNote: string } | null>(null);
  const [noteText,       setNoteText]       = useState('');
  const [rolloutModal,   setRolloutModal]   = useState<{ companyId: string; featureKey: string; current: number } | null>(null);
  const [rolloutValue,   setRolloutValue]   = useState(100);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // ─── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    const [companiesRes, statsRes] = await Promise.allSettled([
      adminApi.sa.listCompanies({ limit: '200' }),
      adminApi.sa.featureStats(),
    ]);
    if (companiesRes.status === 'fulfilled') {
      const raw = (companiesRes.value as any)?.data;
      setCompanies(Array.isArray(raw) ? raw : []);
    }
    if (statsRes.status === 'fulfilled') {
      const d = (statsRes.value as any)?.data;
      if (d && typeof d === 'object') {
        setStats(d.stats && typeof d.stats === 'object' && !Array.isArray(d.stats) ? d.stats : {});
        setRecentChanges(Array.isArray(d.recent) ? d.recent : []);
        setTotalCompanies(Number(d.totalCompanies) || 0);
      }
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const loadCompanyFlags = async (id: string) => {
    setFlagsLoading(true);
    try {
      const r = await adminApi.sa.companyFlags(id);
      const raw = (r as any)?.data;
      setCompanyFlags(Array.isArray(raw) ? raw : []);
    } catch { setCompanyFlags([]); } finally { setFlagsLoading(false); }
  };

  const loadFeatureCompanies = async (key: string) => {
    setFeatureLoading(true);
    try {
      const r = await adminApi.sa.featureCompanies(key);
      const raw = (r as any)?.data;
      setFeatureRows(Array.isArray(raw) ? raw : []);
    } catch { setFeatureRows([]); } finally { setFeatureLoading(false); }
  };

  const loadMatrix = async () => {
    setMatrixLoading(true);
    try {
      const r = await adminApi.sa.featureMatrix();
      const raw = (r as any)?.data;
      if (raw && typeof raw === 'object' && Array.isArray(raw.companies)) {
        setMatrixData(raw);
      } else {
        setMatrixData(null);
      }
    } catch { setMatrixData(null); } finally { setMatrixLoading(false); }
  };

  useEffect(() => { if (view === 'matrix' && !matrixData) loadMatrix(); }, [view]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const toggle = async (companyId: string, featureKey: string, current: boolean, rollout_pct?: number, notes?: string) => {
    const newVal = !current;

    // Optimistic update — flip immediately so the toggle slides right away
    setCompanyFlags(prev => prev.map(f =>
      f.feature_key === featureKey ? { ...f, is_enabled: newVal } : f
    ));
    setFeatureRows(prev => prev.map(r =>
      r.company_id === companyId ? { ...r, is_enabled: newVal } : r
    ));

    setSaving(true);
    try {
      await adminApi.sa.setFlag(companyId, featureKey, newVal, rollout_pct, notes);
      showToast(`${featureKey} ${newVal ? 'مُفعَّل' : 'مُعطَّل'}`);
      // Sync server state in background (no await — UI already updated)
      if (selectedCompany === companyId) loadCompanyFlags(companyId).catch(() => {});
      if (selectedFeature === featureKey) loadFeatureCompanies(featureKey).catch(() => {});
      if (view === 'matrix') loadMatrix().catch(() => {});
      adminApi.sa.featureStats().then(r => {
        if (r) { setStats((r as any)?.data?.stats || {}); setRecentChanges((r as any)?.data?.recent || []); }
      }).catch(() => {});
    } catch (e: any) {
      // Roll back on failure
      setCompanyFlags(prev => prev.map(f =>
        f.feature_key === featureKey ? { ...f, is_enabled: current } : f
      ));
      setFeatureRows(prev => prev.map(r =>
        r.company_id === companyId ? { ...r, is_enabled: current } : r
      ));
      showToast(`خطأ: ${(e as any).message}`);
    } finally { setSaving(false); }
  };

  const bulkApplyTier = async (tier: Tier) => {
    if (!selectedCompany) return;
    const keys = Object.entries(stats).filter(([, s]) => TIER_ORDER.indexOf(s.tier_min as Tier) <= TIER_ORDER.indexOf(tier)).map(([k]) => k);
    if (!confirm(`تفعيل ${keys.length} ميزة لخطة ${tier}؟`)) return;
    setSaving(true);
    try {
      await adminApi.sa.bulkSetFlags(selectedCompany, keys.map(k => ({ feature_key: k, is_enabled: true })));
      showToast(`تم تفعيل ${keys.length} ميزة`);
      await loadCompanyFlags(selectedCompany);
    } catch (e: any) { showToast(`خطأ: ${e.message}`); } finally { setSaving(false); }
  };

  const bulkFeatureTier = async (tier: Tier, enable: boolean) => {
    if (!selectedFeature) return;
    const targets = featureRows.filter(r => r.plan === tier || (enable && TIER_ORDER.indexOf(r.plan as Tier) >= TIER_ORDER.indexOf(tier)));
    if (!targets.length) return showToast('لا توجد شركات مطابقة');
    if (!confirm(`${enable ? 'تفعيل' : 'تعطيل'} هذه الميزة لـ ${targets.length} شركة؟`)) return;
    setSaving(true);
    try {
      for (const t of targets) await adminApi.sa.setFlag(t.company_id, selectedFeature, enable);
      showToast(`تم تحديث ${targets.length} شركة`);
      await loadFeatureCompanies(selectedFeature);
    } catch (e: any) { showToast(`خطأ: ${e.message}`); } finally { setSaving(false); }
  };

  // ─── Filtered companies ───────────────────────────────────────────────────
  const filteredCompanies = companies.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase());
    const matchTier = tierFilter === 'all' || c.plan === tierFilter;
    return matchSearch && matchTier;
  });

  const selectedCo = companies.find(c => c.id === selectedCompany);
  const featureKeys = Object.keys(stats).length > 0 ? Object.keys(stats) : [];
  const featuresByTier = TIER_ORDER.slice(1).map(tier => ({
    tier,
    features: featureKeys.filter(k => stats[k]?.tier_min === tier),
  }));

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#fafafa', fontFamily: 'system-ui, sans-serif' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#18181b', color: '#fff', padding: '7px 20px', borderRadius: 7, fontSize: 12, zIndex: 9999, boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
          {toast}
        </div>
      )}

      {/* Note modal */}
      {noteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 400, border: '1px solid #e5e5e5', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, color: '#18181b' }}>ملاحظة على الميزة</div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={4}
              placeholder="سبب التفعيل، اتفاقية مع العميل، وغيرها..."
              style={{ width: '100%', border: '1px solid #e5e5e5', borderRadius: 7, padding: '7px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', background: '#fff' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button onClick={() => setNoteModal(null)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #e5e5e5', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#71717a' }}>إلغاء</button>
              <button onClick={async () => {
                const f = companyFlags.find(fl => fl.feature_key === noteModal.featureKey);
                await toggle(noteModal.companyId, noteModal.featureKey, !(f?.is_enabled ?? false), f?.rollout_pct, noteText);
                setNoteModal(null);
              }} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#18181b', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>حفظ وتفعيل</button>
            </div>
          </div>
        </div>
      )}

      {/* Rollout modal */}
      {rolloutModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 380, border: '1px solid #e5e5e5', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#18181b' }}>نسبة الطرح التدريجي</div>
            <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 16, fontWeight: 500 }}>تحديد نسبة المستخدمين الذين يرون هذه الميزة</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <input type="range" min={0} max={100} value={rolloutValue} onChange={e => setRolloutValue(Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontWeight: 600, fontSize: 18, color: '#18181b', width: 50, textAlign: 'center' }}>{rolloutValue}%</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[25, 50, 75, 100].map(v => (
                <button key={v} onClick={() => setRolloutValue(v)}
                  style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: `1px solid ${rolloutValue === v ? '#18181b' : '#e5e5e5'}`, background: rolloutValue === v ? '#f4f4f5' : '#fff', color: rolloutValue === v ? '#18181b' : '#71717a', fontSize: 12, cursor: 'pointer' }}>
                  {v}%
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setRolloutModal(null)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #e5e5e5', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#71717a' }}>إلغاء</button>
              <button onClick={async () => {
                const f = companyFlags.find(fl => fl.feature_key === rolloutModal.featureKey);
                await toggle(rolloutModal.companyId, rolloutModal.featureKey, f?.is_enabled ?? false, rolloutValue);
                setRolloutModal(null);
              }} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#18181b', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>تطبيق النسبة</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e5e5', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#18181b', letterSpacing: '-0.02em' }}>مدير الميزات</span>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 0, borderBottom: '1px solid #e5e5e5' }}>
          {([['company', 'شركة'], ['feature', 'ميزة'], ['matrix', 'مصفوفة']] as [View, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: 'none',
                color: view === v ? '#18181b' : '#a1a1aa',
                borderBottom: view === v ? '2px solid #18181b' : '2px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '8px 28px', display: 'flex', gap: 24, overflowX: 'auto', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#a1a1aa', whiteSpace: 'nowrap', fontWeight: 500 }}>{totalCompanies} شركة · {featureKeys.length} ميزة</div>
        {featureKeys.slice(0, 8).map(k => {
          const s = stats[k];
          if (!s) return null;
          return (
            <div key={k} onClick={() => { setView('feature'); setSelectedFeature(k); loadFeatureCompanies(k); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <div style={{ width: 32, height: 4, borderRadius: 2, background: '#e5e5e5' }}>
                <div style={{ height: 4, borderRadius: 2, background: s.adoption_pct > 60 ? '#16a34a' : s.adoption_pct > 30 ? '#d97706' : '#a1a1aa', width: `${s.adoption_pct}%` }} />
              </div>
              <span style={{ fontSize: 11, color: '#71717a', fontWeight: 500 }}>{s.name_ar}</span>
              <span style={{ fontSize: 11, color: s.adoption_pct > 60 ? '#16a34a' : '#a1a1aa', fontWeight: 600 }}>{s.adoption_pct}%</span>
            </div>
          );
        })}
        {recentChanges.length > 0 && (
          <div style={{ marginRight: 'auto', fontSize: 11, color: '#a1a1aa', whiteSpace: 'nowrap', fontWeight: 500 }}>
            آخر تغيير: <span style={{ color: '#71717a' }}>{recentChanges[0]?.feature_key}</span> · {timeAgo(recentChanges[0]?.set_at)}
          </div>
        )}
      </div>

      {/* ─── VIEW: COMPANY ─────────────────────────────────────────────────────── */}
      {view === 'company' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', height: 'calc(100vh - 95px)' }}>
          {/* Company sidebar */}
          <div style={{ background: '#fff', borderLeft: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #f0f0f0' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن شركة..."
                style={{ width: '100%', padding: '7px 12px', borderRadius: 7, border: '1px solid #e5e5e5', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
              <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                {['all', ...TIER_ORDER].map(t => (
                  <button key={t} onClick={() => setTierFilter(t)}
                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 7, border: '1px solid', cursor: 'pointer', fontWeight: 500,
                      background: tierFilter === t ? '#18181b' : '#fff', color: tierFilter === t ? '#fff' : '#71717a',
                      borderColor: tierFilter === t ? '#18181b' : '#e5e5e5' }}>
                    {t === 'all' ? 'الكل' : t}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredCompanies.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#a1a1aa', fontSize: 13 }}>لا توجد شركات</div>
              ) : filteredCompanies.map(c => {
                const tc = TIER_COLOR[c.plan] || TIER_COLOR.trial;
                const enabledCount = companyFlags.filter(f => f.is_enabled).length;
                return (
                  <button key={c.id} onClick={() => { setSelectedCompany(c.id); loadCompanyFlags(c.id); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none',
                      background: selectedCompany === c.id ? '#f4f4f5' : 'transparent', cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: tc.bg, border: `1px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: tc.color, flexShrink: 0 }}>
                      {c.name?.charAt(0)}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                        <span style={{ fontSize: 11, padding: '1px 5px', borderRadius: 7, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, fontWeight: 500 }}>{c.plan}</span>
                        {selectedCompany === c.id && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 500 }}>{enabledCount} مُفعَّل</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feature panel */}
          <div style={{ overflowY: 'auto', padding: '20px 24px' }}>
            {!selectedCompany ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#a1a1aa' }}>
                <p style={{ fontSize: 13 }}>اختر شركة من القائمة لإدارة ميزاتها</p>
              </div>
            ) : flagsLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#a1a1aa', fontSize: 13 }}>جاري التحميل...</div>
            ) : (
              <>
                {/* Company header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#18181b', letterSpacing: '-0.02em' }}>{selectedCo?.name}</div>
                    <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2, fontWeight: 500 }}>
                      {companyFlags.filter(f => f.is_enabled).length} / {companyFlags.length} ميزة مفعّلة
                      {selectedCo?.plan && <span style={{ marginRight: 8, ...TIER_COLOR[selectedCo.plan] && { color: TIER_COLOR[selectedCo.plan].color } }}>خطة {selectedCo.plan}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 500 }}>تطبيق سريع:</span>
                    {(['basic', 'professional', 'enterprise'] as Tier[]).map(t => {
                      const tc = TIER_COLOR[t];
                      return (
                        <button key={t} onClick={() => bulkApplyTier(t)} disabled={saving}
                          style={{ fontSize: 12, padding: '7px 16px', borderRadius: 7, background: '#fff', border: `1px solid #e5e5e5`, color: '#71717a', cursor: 'pointer', fontWeight: 500 }}>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Feature groups */}
                {featuresByTier.map(({ tier, features }) => {
                  if (features.length === 0) return null;
                  const tc = TIER_COLOR[tier];
                  return (
                    <div key={tier} style={{ marginBottom: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 7, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, fontWeight: 500 }}>
                          {tier}
                        </span>
                        <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
                        <span style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 500 }}>
                          {companyFlags.filter(f => features.includes(f.feature_key) && f.is_enabled).length}/{features.length} مُفعَّل
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                        {features.map(key => {
                          const flag = companyFlags.find(f => f.feature_key === key);
                          const enabled = flag?.is_enabled ?? false;
                          const stat = stats[key];
                          const rollout = flag?.rollout_pct ?? 100;
                          return (
                            <div key={key} style={{
                              padding: '14px 16px', borderRadius: 8, border: '1px solid',
                              borderColor: enabled ? '#bbf7d0' : '#e5e5e5',
                              background: enabled ? '#f0fdf4' : '#fff',
                              transition: 'all .15s',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{stat?.name_ar || key}</span>
                                    {stat?.beta && <span style={{ fontSize: 11, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 500 }}>BETA</span>}
                                    {flag?.plan_includes === false && enabled && (
                                      <span style={{ fontSize: 11, padding: '1px 5px', borderRadius: 4, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 500 }}>خارج الخطة</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace', fontWeight: 500 }}>{key}</div>
                                  {flag?.set_at && (
                                    <div style={{ fontSize: 11, color: '#71717a', marginTop: 3, fontWeight: 500 }}>آخر تعديل: {timeAgo(flag.set_at)}</div>
                                  )}
                                  {flag?.notes && (
                                    <div style={{ fontSize: 11, color: '#3f3f46', marginTop: 3, background: '#fafafa', padding: '3px 6px', borderRadius: 4 }}>{flag.notes}</div>
                                  )}
                                </div>
                                <Toggle on={enabled} disabled={saving} onClick={() => toggle(selectedCompany!, key, enabled, rollout)} />
                              </div>

                              {/* Rollout + platform adoption */}
                              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                                {enabled && (
                                  <button onClick={() => { setRolloutModal({ companyId: selectedCompany!, featureKey: key, current: rollout }); setRolloutValue(rollout); }}
                                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 7, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', cursor: 'pointer', fontWeight: 500 }}>
                                    {rollout}% طرح
                                  </button>
                                )}
                                <button onClick={() => { setNoteModal({ companyId: selectedCompany!, featureKey: key, currentNote: flag?.notes || '' }); setNoteText(flag?.notes || ''); }}
                                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 7, border: '1px solid #e5e5e5', background: '#fff', color: '#71717a', cursor: 'pointer', fontWeight: 500 }}>
                                  ملاحظة
                                </button>
                                <div style={{ marginRight: 'auto', fontSize: 11, color: '#a1a1aa', fontWeight: 500 }}>
                                  انتشار: {stat?.adoption_pct ?? 0}%
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── VIEW: FEATURE ─────────────────────────────────────────────────────── */}
      {view === 'feature' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', height: 'calc(100vh - 95px)' }}>
          {/* Feature list */}
          <div style={{ background: '#fff', borderLeft: '1px solid #e5e5e5', overflowY: 'auto' }}>
            {featuresByTier.map(({ tier, features }) => {
              if (features.length === 0) return null;
              const tc = TIER_COLOR[tier];
              return (
                <div key={tier}>
                  <div style={{ padding: '8px 14px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', fontSize: 11, fontWeight: 600, color: tc.color }}>
                    {tier.toUpperCase()}
                  </div>
                  {features.map(key => {
                    const s = stats[key];
                    const active = selectedFeature === key;
                    return (
                      <button key={key} onClick={() => { setSelectedFeature(key); loadFeatureCompanies(key); }}
                        style={{ width: '100%', padding: '10px 14px', border: 'none', background: active ? '#f4f4f5' : '#fff', cursor: 'pointer', textAlign: 'right', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: '#18181b' }}>{s?.name_ar || key}</div>
                          <div style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace', marginTop: 1, fontWeight: 500 }}>{key}</div>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: (s?.adoption_pct ?? 0) > 60 ? '#16a34a' : '#71717a' }}>{s?.adoption_pct ?? 0}%</div>
                          <div style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 500 }}>{s?.enabled_count ?? 0} شركة</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Companies for feature */}
          <div style={{ overflowY: 'auto', padding: '20px 24px' }}>
            {!selectedFeature ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#a1a1aa' }}>
                <p style={{ fontSize: 13 }}>اختر ميزة لرؤية حالتها في جميع الشركات</p>
              </div>
            ) : featureLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#a1a1aa', fontSize: 13 }}>جاري التحميل...</div>
            ) : (
              <>
                {/* Feature header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#18181b', letterSpacing: '-0.02em' }}>{stats[selectedFeature]?.name_ar}</div>
                    <div style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace', fontWeight: 500 }}>{selectedFeature}</div>
                    <div style={{ fontSize: 13, color: '#3f3f46', marginTop: 4 }}>
                      {featureRows.filter(r => r.is_enabled).length} / {featureRows.length} شركة مُفعَّلة
                      · انتشار {stats[selectedFeature]?.adoption_pct ?? 0}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => bulkFeatureTier('basic', true)} disabled={saving}
                      style={{ fontSize: 12, padding: '7px 16px', borderRadius: 7, border: '1px solid #e5e5e5', background: '#fff', color: '#71717a', cursor: 'pointer', fontWeight: 500 }}>
                      تفعيل basic+
                    </button>
                    <button onClick={() => bulkFeatureTier('professional', true)} disabled={saving}
                      style={{ fontSize: 12, padding: '7px 16px', borderRadius: 7, border: '1px solid #e5e5e5', background: '#fff', color: '#71717a', cursor: 'pointer', fontWeight: 500 }}>
                      تفعيل pro+
                    </button>
                    <button onClick={() => bulkFeatureTier('basic', false)} disabled={saving}
                      style={{ fontSize: 12, padding: '7px 16px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', fontWeight: 500 }}>
                      تعطيل الكل
                    </button>
                  </div>
                </div>

                {/* Adoption bar */}
                <div style={{ background: '#e5e5e5', borderRadius: 6, height: 6, marginBottom: 20 }}>
                  <div style={{ height: 6, borderRadius: 6, background: '#16a34a', width: `${stats[selectedFeature]?.adoption_pct ?? 0}%`, transition: 'width .4s' }} />
                </div>

                {/* Companies table */}
                <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e5e5' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e5e5' }}>
                        {['الشركة', 'الخطة', 'الحالة', 'نسبة الطرح', 'آخر تعديل', 'ملاحظات', ''].map(h => (
                          <th key={h} style={{ padding: '9px 14px', fontSize: 11, color: '#a1a1aa', fontWeight: 500, textAlign: 'right' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {featureRows.map((row, i) => {
                        const tc = TIER_COLOR[row.plan] || TIER_COLOR.trial;
                        return (
                          <tr key={row.company_id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#18181b' }}>{row.name}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 7, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, fontWeight: 500 }}>{row.plan}</span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <Toggle on={row.is_enabled} disabled={saving} onClick={() => toggle(row.company_id, selectedFeature, row.is_enabled, row.rollout_pct)} />
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 13, color: '#3f3f46' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 50, height: 4, background: '#e5e5e5', borderRadius: 2 }}>
                                  <div style={{ width: `${row.rollout_pct}%`, height: 4, background: '#18181b', borderRadius: 2 }} />
                                </div>
                                <span>{row.rollout_pct}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 11, color: '#a1a1aa', fontWeight: 500 }}>{timeAgo(row.set_at)}</td>
                            <td style={{ padding: '10px 14px', fontSize: 11, color: '#71717a', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                              {row.notes || '—'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {!row.plan_includes && row.is_enabled && (
                                <span title="الميزة مُفعَّلة خارج نطاق الخطة" style={{ fontSize: 11, color: '#dc2626' }}>!</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── VIEW: MATRIX ──────────────────────────────────────────────────────── */}
      {view === 'matrix' && (
        <div style={{ padding: 24, overflowX: 'auto' }}>
          {matrixLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#a1a1aa', fontSize: 13 }}>جاري تحميل المصفوفة...</div>
          ) : !matrixData ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#a1a1aa', fontSize: 13 }}>لا توجد بيانات</div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#3f3f46', marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center' }}>
                <span>{matrixData.companies.length} شركة x {Object.keys(matrixData.features).length} ميزة</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /> <span style={{ fontSize: 11, color: '#71717a', fontWeight: 500 }}>مُفعَّل</span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e5e5e5', display: 'inline-block' }} /> <span style={{ fontSize: 11, color: '#71717a', fontWeight: 500 }}>مُعطَّل</span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} /> <span style={{ fontSize: 11, color: '#71717a', fontWeight: 500 }}>طرح جزئي</span>
                </span>
              </div>
              <div style={{ background: '#fff', borderRadius: 8, overflow: 'auto', border: '1px solid #e5e5e5' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: 'max-content' }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ padding: '10px 16px', fontSize: 11, color: '#a1a1aa', fontWeight: 500, textAlign: 'right', borderBottom: '1px solid #e5e5e5', borderLeft: '1px solid #e5e5e5', position: 'sticky', right: 0, background: '#fafafa', zIndex: 2, minWidth: 160 }}>الشركة / الخطة</th>
                      {Object.entries(matrixData.features).map(([key, meta]: [string, any]) => (
                        <th key={key} style={{ padding: '6px 8px', fontSize: 11, color: '#71717a', fontWeight: 500, textAlign: 'center', borderBottom: '1px solid #e5e5e5', borderLeft: '1px solid #f0f0f0', maxWidth: 80, minWidth: 70 }}>
                          <div style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', whiteSpace: 'nowrap', color: TIER_COLOR[meta.tier_min]?.color }}>
                            {meta.name_ar}
                          </div>
                        </th>
                      ))}
                      <th style={{ padding: '8px', fontSize: 11, color: '#a1a1aa', textAlign: 'center', borderBottom: '1px solid #e5e5e5', fontWeight: 500 }}>مجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.companies.map((company, i) => {
                      const companyMatrix = matrixData.matrix[company.id] || {};
                      const enabledCount = Object.values(companyMatrix).filter(f => f.is_enabled).length;
                      const tc = TIER_COLOR[company.plan] || TIER_COLOR.trial;
                      return (
                        <tr key={company.id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '8px 14px', borderLeft: '1px solid #e5e5e5', position: 'sticky', right: 0, background: i % 2 === 0 ? '#fff' : '#fafafa', zIndex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#18181b' }}>{company.name}</div>
                            <span style={{ fontSize: 11, padding: '1px 5px', borderRadius: 7, background: tc.bg, color: tc.color, fontWeight: 500 }}>{company.plan}</span>
                          </td>
                          {Object.keys(matrixData.features).map(key => {
                            const flag = companyMatrix[key];
                            const enabled = flag?.is_enabled ?? false;
                            const partial = enabled && (flag?.rollout_pct ?? 100) < 100;
                            return (
                              <td key={key} style={{ padding: '6px 8px', textAlign: 'center', borderLeft: '1px solid #f0f0f0', cursor: saving ? 'default' : 'pointer' }}
                                onClick={() => toggle(company.id, key, enabled)}>
                                <div style={{
                                  width: 22, height: 22, borderRadius: 6, margin: '0 auto',
                                  background: enabled ? (partial ? '#fbbf24' : '#16a34a') : '#e5e5e5',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                                  transition: 'background .15s',
                                  color: enabled ? '#fff' : '#a1a1aa',
                                }}>
                                  {enabled ? (partial ? '~' : '') : ''}
                                </div>
                              </td>
                            );
                          })}
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: enabledCount > 8 ? '#16a34a' : enabledCount > 4 ? '#d97706' : '#a1a1aa' }}>
                              {enabledCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Column totals */}
                    <tr style={{ background: '#fafafa', borderTop: '2px solid #e5e5e5' }}>
                      <td style={{ padding: '8px 14px', fontSize: 11, fontWeight: 600, color: '#18181b', position: 'sticky', right: 0, background: '#fafafa' }}>مجموع الانتشار</td>
                      {Object.keys(matrixData.features).map(key => {
                        const s = stats[key];
                        return (
                          <td key={key} style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: (s?.adoption_pct ?? 0) > 60 ? '#16a34a' : '#a1a1aa' }}>
                              {s?.adoption_pct ?? 0}%
                            </span>
                          </td>
                        );
                      })}
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
