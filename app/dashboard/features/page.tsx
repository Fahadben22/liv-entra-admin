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
  basic:        { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
  professional: { bg: '#eff6ff', color: '#1d4070', border: '#bfdbfe' },
  enterprise:   { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
};
const TIER_ICON: Record<string, string> = { trial: '🆓', basic: '🔵', professional: '⭐', enterprise: '👑' };

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
      <span style={{ position: 'absolute', top: 3, left: on ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
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
    if (companiesRes.status === 'fulfilled') setCompanies((companiesRes.value as any)?.data || []);
    if (statsRes.status === 'fulfilled') {
      const d = (statsRes.value as any)?.data;
      if (d) {
        setStats(d.stats || {});
        setRecentChanges(d.recent || []);
        setTotalCompanies(d.totalCompanies || 0);
      }
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const loadCompanyFlags = async (id: string) => {
    setFlagsLoading(true);
    try {
      const r = await adminApi.sa.companyFlags(id);
      setCompanyFlags((r as any)?.data || []);
    } catch { setCompanyFlags([]); } finally { setFlagsLoading(false); }
  };

  const loadFeatureCompanies = async (key: string) => {
    setFeatureLoading(true);
    try {
      const r = await adminApi.sa.featureCompanies(key);
      setFeatureRows((r as any)?.data || []);
    } catch { setFeatureRows([]); } finally { setFeatureLoading(false); }
  };

  const loadMatrix = async () => {
    setMatrixLoading(true);
    try {
      const r = await adminApi.sa.featureMatrix();
      setMatrixData((r as any)?.data || null);
    } catch { setMatrixData(null); } finally { setMatrixLoading(false); }
  };

  useEffect(() => { if (view === 'matrix' && !matrixData) loadMatrix(); }, [view]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const toggle = async (companyId: string, featureKey: string, current: boolean, rollout_pct?: number, notes?: string) => {
    setSaving(true);
    try {
      await adminApi.sa.setFlag(companyId, featureKey, !current, rollout_pct, notes);
      showToast(`${featureKey} ${!current ? 'مُفعَّل ✓' : 'مُعطَّل ✓'}`);
      if (selectedCompany === companyId) await loadCompanyFlags(companyId);
      if (selectedFeature === featureKey) await loadFeatureCompanies(featureKey);
      if (view === 'matrix') await loadMatrix();
      // Refresh stats
      const r = await adminApi.sa.featureStats().catch(() => null);
      if (r) { setStats((r as any)?.data?.stats || {}); setRecentChanges((r as any)?.data?.recent || []); }
    } catch (e: any) { showToast(`خطأ: ${e.message}`); } finally { setSaving(false); }
  };

  const bulkApplyTier = async (tier: Tier) => {
    if (!selectedCompany) return;
    const keys = Object.entries(stats).filter(([, s]) => TIER_ORDER.indexOf(s.tier_min as Tier) <= TIER_ORDER.indexOf(tier)).map(([k]) => k);
    if (!confirm(`تفعيل ${keys.length} ميزة لخطة ${tier}؟`)) return;
    setSaving(true);
    try {
      await adminApi.sa.bulkSetFlags(selectedCompany, keys.map(k => ({ feature_key: k, is_enabled: true })));
      showToast(`تم تفعيل ${keys.length} ميزة ✓`);
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
      showToast(`تم تحديث ${targets.length} شركة ✓`);
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
    <div style={{ minHeight: '100vh', background: '#f8fafc', direction: 'rtl', fontFamily: 'system-ui, sans-serif' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: 'white', padding: '10px 24px', borderRadius: 10, fontSize: 13, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
          {toast}
        </div>
      )}

      {/* Note modal */}
      {noteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>ملاحظة على الميزة</div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={4}
              placeholder="سبب التفعيل، اتفاقية مع العميل، وغيرها..."
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button onClick={() => setNoteModal(null)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 13 }}>إلغاء</button>
              <button onClick={async () => {
                const f = companyFlags.find(fl => fl.feature_key === noteModal.featureKey);
                await toggle(noteModal.companyId, noteModal.featureKey, !(f?.is_enabled ?? false), f?.rollout_pct, noteText);
                setNoteModal(null);
              }} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#0f172a', color: 'white', cursor: 'pointer', fontSize: 13 }}>حفظ وتفعيل</button>
            </div>
          </div>
        </div>
      )}

      {/* Rollout modal */}
      {rolloutModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>نسبة الطرح التدريجي</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>تحديد نسبة المستخدمين الذين يرون هذه الميزة</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <input type="range" min={0} max={100} value={rolloutValue} onChange={e => setRolloutValue(Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontWeight: 700, fontSize: 18, color: '#1d4070', width: 50, textAlign: 'center' }}>{rolloutValue}%</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[25, 50, 75, 100].map(v => (
                <button key={v} onClick={() => setRolloutValue(v)}
                  style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: `1px solid ${rolloutValue === v ? '#1d4070' : '#e2e8f0'}`, background: rolloutValue === v ? '#eff6ff' : 'white', color: rolloutValue === v ? '#1d4070' : '#64748b', fontSize: 12, cursor: 'pointer' }}>
                  {v}%
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setRolloutModal(null)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 13 }}>إلغاء</button>
              <button onClick={async () => {
                const f = companyFlags.find(fl => fl.feature_key === rolloutModal.featureKey);
                await toggle(rolloutModal.companyId, rolloutModal.featureKey, f?.is_enabled ?? false, rolloutValue);
                setRolloutModal(null);
              }} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#1d4070', color: 'white', cursor: 'pointer', fontSize: 13 }}>تطبيق النسبة</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#0f172a', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
        <Link href="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>🎛 مدير الميزات</span>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 4 }}>
          {([['company', '🏢 شركة'], ['feature', '🔧 ميزة'], ['matrix', '📊 مصفوفة']] as [View, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: view === v ? '#1d4070' : 'transparent',
                color: view === v ? 'white' : '#94a3b8' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: '#1e293b', padding: '10px 28px', display: 'flex', gap: 24, overflowX: 'auto', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{totalCompanies} شركة · {featureKeys.length} ميزة</div>
        {featureKeys.slice(0, 8).map(k => {
          const s = stats[k];
          if (!s) return null;
          return (
            <div key={k} onClick={() => { setView('feature'); setSelectedFeature(k); loadFeatureCompanies(k); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <div style={{ width: 32, height: 4, borderRadius: 2, background: '#334155' }}>
                <div style={{ height: 4, borderRadius: 2, background: s.adoption_pct > 60 ? '#16a34a' : s.adoption_pct > 30 ? '#d97706' : '#64748b', width: `${s.adoption_pct}%` }} />
              </div>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{s.name_ar}</span>
              <span style={{ fontSize: 10, color: s.adoption_pct > 60 ? '#4ade80' : '#94a3b8', fontWeight: 600 }}>{s.adoption_pct}%</span>
            </div>
          );
        })}
        {recentChanges.length > 0 && (
          <div style={{ marginRight: 'auto', fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>
            آخر تغيير: <span style={{ color: '#94a3b8' }}>{recentChanges[0]?.feature_key}</span> · {timeAgo(recentChanges[0]?.set_at)}
          </div>
        )}
      </div>

      {/* ─── VIEW: COMPANY ─────────────────────────────────────────────────────── */}
      {view === 'company' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', height: 'calc(100vh - 95px)' }}>
          {/* Company sidebar */}
          <div style={{ background: 'white', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن شركة..."
                style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                {['all', ...TIER_ORDER].map(t => (
                  <button key={t} onClick={() => setTierFilter(t)}
                    style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: '1px solid', cursor: 'pointer',
                      background: tierFilter === t ? '#0f172a' : 'white', color: tierFilter === t ? 'white' : '#64748b',
                      borderColor: tierFilter === t ? '#0f172a' : '#e2e8f0' }}>
                    {t === 'all' ? 'الكل' : `${TIER_ICON[t]} ${t}`}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredCompanies.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>لا توجد شركات</div>
              ) : filteredCompanies.map(c => {
                const tc = TIER_COLOR[c.plan] || TIER_COLOR.trial;
                const enabledCount = companyFlags.filter(f => f.is_enabled).length;
                return (
                  <button key={c.id} onClick={() => { setSelectedCompany(c.id); loadCompanyFlags(c.id); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none',
                      background: selectedCompany === c.id ? '#eff6ff' : 'transparent', cursor: 'pointer',
                      borderBottom: '1px solid #f8fafc', textAlign: 'right' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: tc.bg, border: `1px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: tc.color, flexShrink: 0 }}>
                      {c.name?.charAt(0)}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{TIER_ICON[c.plan]} {c.plan}</span>
                        {selectedCompany === c.id && <span style={{ fontSize: 9, color: '#16a34a' }}>{enabledCount} مُفعَّل</span>}
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#94a3b8' }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>🎛</div>
                <p style={{ fontSize: 14 }}>اختر شركة من القائمة لإدارة ميزاتها</p>
              </div>
            ) : flagsLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>جاري التحميل...</div>
            ) : (
              <>
                {/* Company header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{selectedCo?.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {companyFlags.filter(f => f.is_enabled).length} / {companyFlags.length} ميزة مفعّلة
                      {selectedCo?.plan && <span style={{ marginRight: 8, ...TIER_COLOR[selectedCo.plan] && { color: TIER_COLOR[selectedCo.plan].color } }}>{TIER_ICON[selectedCo.plan]} خطة {selectedCo.plan}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>تطبيق سريع:</span>
                    {(['basic', 'professional', 'enterprise'] as Tier[]).map(t => {
                      const tc = TIER_COLOR[t];
                      return (
                        <button key={t} onClick={() => bulkApplyTier(t)} disabled={saving}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color, cursor: 'pointer', fontWeight: 600 }}>
                          {TIER_ICON[t]} {t}
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
                        <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, fontWeight: 700 }}>
                          {TIER_ICON[tier]} {tier}
                        </span>
                        <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>
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
                              padding: '14px 16px', borderRadius: 12, border: '1px solid',
                              borderColor: enabled ? '#bbf7d0' : '#e2e8f0',
                              background: enabled ? '#f0fdf4' : 'white',
                              transition: 'all .15s',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{stat?.name_ar || key}</span>
                                    {stat?.beta && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>BETA</span>}
                                    {flag?.plan_includes === false && enabled && (
                                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>خارج الخطة</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{key}</div>
                                  {flag?.set_at && (
                                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>آخر تعديل: {timeAgo(flag.set_at)}</div>
                                  )}
                                  {flag?.notes && (
                                    <div style={{ fontSize: 10, color: '#475569', marginTop: 3, background: '#f8fafc', padding: '3px 6px', borderRadius: 4 }}>📝 {flag.notes}</div>
                                  )}
                                </div>
                                <Toggle on={enabled} disabled={saving} onClick={() => toggle(selectedCompany!, key, enabled, rollout)} />
                              </div>

                              {/* Rollout + platform adoption */}
                              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                                {enabled && (
                                  <button onClick={() => { setRolloutModal({ companyId: selectedCompany!, featureKey: key, current: rollout }); setRolloutValue(rollout); }}
                                    style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', cursor: 'pointer' }}>
                                    🎚 {rollout}% طرح
                                  </button>
                                )}
                                <button onClick={() => { setNoteModal({ companyId: selectedCompany!, featureKey: key, currentNote: flag?.notes || '' }); setNoteText(flag?.notes || ''); }}
                                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer' }}>
                                  📝 ملاحظة
                                </button>
                                <div style={{ marginRight: 'auto', fontSize: 10, color: '#94a3b8' }}>
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
          <div style={{ background: 'white', borderLeft: '1px solid #e2e8f0', overflowY: 'auto' }}>
            {featuresByTier.map(({ tier, features }) => {
              if (features.length === 0) return null;
              const tc = TIER_COLOR[tier];
              return (
                <div key={tier}>
                  <div style={{ padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: 10, fontWeight: 700, color: tc.color }}>
                    {TIER_ICON[tier]} {tier.toUpperCase()}
                  </div>
                  {features.map(key => {
                    const s = stats[key];
                    const active = selectedFeature === key;
                    return (
                      <button key={key} onClick={() => { setSelectedFeature(key); loadFeatureCompanies(key); }}
                        style={{ width: '100%', padding: '10px 14px', border: 'none', background: active ? '#eff6ff' : 'white', cursor: 'pointer', textAlign: 'right', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: '#0f172a' }}>{s?.name_ar || key}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', marginTop: 1 }}>{key}</div>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: (s?.adoption_pct ?? 0) > 60 ? '#16a34a' : '#64748b' }}>{s?.adoption_pct ?? 0}%</div>
                          <div style={{ fontSize: 9, color: '#94a3b8' }}>{s?.enabled_count ?? 0} شركة</div>
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#94a3b8' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
                <p style={{ fontSize: 14 }}>اختر ميزة لرؤية حالتها في جميع الشركات</p>
              </div>
            ) : featureLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>جاري التحميل...</div>
            ) : (
              <>
                {/* Feature header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{stats[selectedFeature]?.name_ar}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{selectedFeature}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      {featureRows.filter(r => r.is_enabled).length} / {featureRows.length} شركة مُفعَّلة
                      · انتشار {stats[selectedFeature]?.adoption_pct ?? 0}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => bulkFeatureTier('basic', true)} disabled={saving}
                      style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}>
                      🔵 تفعيل basic+
                    </button>
                    <button onClick={() => bulkFeatureTier('professional', true)} disabled={saving}
                      style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4070', cursor: 'pointer' }}>
                      ⭐ تفعيل pro+
                    </button>
                    <button onClick={() => bulkFeatureTier('basic', false)} disabled={saving}
                      style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>
                      ⛔ تعطيل الكل
                    </button>
                  </div>
                </div>

                {/* Adoption bar */}
                <div style={{ background: '#f1f5f9', borderRadius: 6, height: 8, marginBottom: 20 }}>
                  <div style={{ height: 8, borderRadius: 6, background: '#16a34a', width: `${stats[selectedFeature]?.adoption_pct ?? 0}%`, transition: 'width .4s' }} />
                </div>

                {/* Companies table */}
                <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {['الشركة', 'الخطة', 'الحالة', 'نسبة الطرح', 'آخر تعديل', 'ملاحظات', ''].map(h => (
                          <th key={h} style={{ padding: '9px 14px', fontSize: 11, color: '#64748b', fontWeight: 600, textAlign: 'right' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {featureRows.map(row => {
                        const tc = TIER_COLOR[row.plan] || TIER_COLOR.trial;
                        return (
                          <tr key={row.company_id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{row.name}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{TIER_ICON[row.plan]} {row.plan}</span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <Toggle on={row.is_enabled} disabled={saving} onClick={() => toggle(row.company_id, selectedFeature, row.is_enabled, row.rollout_pct)} />
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: '#475569' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 50, height: 4, background: '#f1f5f9', borderRadius: 2 }}>
                                  <div style={{ width: `${row.rollout_pct}%`, height: 4, background: '#1d4070', borderRadius: 2 }} />
                                </div>
                                <span>{row.rollout_pct}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 11, color: '#94a3b8' }}>{timeAgo(row.set_at)}</td>
                            <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.notes || '—'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {!row.plan_includes && row.is_enabled && (
                                <span title="الميزة مُفعَّلة خارج نطاق الخطة" style={{ fontSize: 12 }}>⚠️</span>
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
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>جاري تحميل المصفوفة...</div>
          ) : !matrixData ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>لا توجد بيانات</div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center' }}>
                <span>📊 {matrixData.companies.length} شركة × {Object.keys(matrixData.features).length} ميزة</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#16a34a', display: 'inline-block' }} /> مُفعَّل
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#e2e8f0', display: 'inline-block' }} /> مُعطَّل
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#fbbf24', display: 'inline-block' }} /> طرح جزئي
                </span>
              </div>
              <div style={{ background: 'white', borderRadius: 12, overflow: 'auto', border: '1px solid #e2e8f0' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: 'max-content' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '10px 16px', fontSize: 11, color: '#64748b', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', position: 'sticky', right: 0, background: '#f8fafc', zIndex: 2, minWidth: 160 }}>الشركة / الخطة</th>
                      {Object.entries(matrixData.features).map(([key, meta]: [string, any]) => (
                        <th key={key} style={{ padding: '6px 8px', fontSize: 9, color: '#64748b', fontWeight: 600, textAlign: 'center', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #f1f5f9', maxWidth: 80, minWidth: 70 }}>
                          <div style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', whiteSpace: 'nowrap', color: TIER_COLOR[meta.tier_min]?.color }}>
                            {meta.name_ar}
                          </div>
                        </th>
                      ))}
                      <th style={{ padding: '8px', fontSize: 10, color: '#64748b', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>مجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.companies.map(company => {
                      const companyMatrix = matrixData.matrix[company.id] || {};
                      const enabledCount = Object.values(companyMatrix).filter(f => f.is_enabled).length;
                      const tc = TIER_COLOR[company.plan] || TIER_COLOR.trial;
                      return (
                        <tr key={company.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '8px 14px', borderLeft: '1px solid #e2e8f0', position: 'sticky', right: 0, background: 'white', zIndex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{company.name}</div>
                            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: tc.bg, color: tc.color }}>{TIER_ICON[company.plan]} {company.plan}</span>
                          </td>
                          {Object.keys(matrixData.features).map(key => {
                            const flag = companyMatrix[key];
                            const enabled = flag?.is_enabled ?? false;
                            const partial = enabled && (flag?.rollout_pct ?? 100) < 100;
                            return (
                              <td key={key} style={{ padding: '6px 8px', textAlign: 'center', borderLeft: '1px solid #f8fafc', cursor: saving ? 'default' : 'pointer' }}
                                onClick={() => toggle(company.id, key, enabled)}>
                                <div style={{
                                  width: 22, height: 22, borderRadius: 6, margin: '0 auto',
                                  background: enabled ? (partial ? '#fbbf24' : '#16a34a') : '#e2e8f0',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                                  transition: 'background .15s',
                                  boxShadow: enabled ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                                }}>
                                  {enabled ? (partial ? '~' : '✓') : ''}
                                </div>
                              </td>
                            );
                          })}
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: enabledCount > 8 ? '#16a34a' : enabledCount > 4 ? '#d97706' : '#94a3b8' }}>
                              {enabledCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Column totals */}
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#475569', position: 'sticky', right: 0, background: '#f8fafc' }}>مجموع الانتشار</td>
                      {Object.keys(matrixData.features).map(key => {
                        const s = stats[key];
                        return (
                          <td key={key} style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: (s?.adoption_pct ?? 0) > 60 ? '#16a34a' : '#94a3b8' }}>
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
