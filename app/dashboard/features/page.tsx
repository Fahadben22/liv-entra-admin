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
  trial:        { bg: 'rgba(34,197,94,.08)', color: '#22c55e', border: 'rgba(34,197,94,.2)' },
  basic:        { bg: 'var(--lv-bg)', color: 'var(--lv-muted)', border: 'var(--lv-line)' },
  professional: { bg: 'rgba(124,92,252,.08)', color: 'var(--lv-accent)', border: 'rgba(124,92,252,.2)' },
  enterprise:   { bg: 'rgba(245,158,11,.08)', color: '#f59e0b', border: 'rgba(245,158,11,.2)' },
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
      style={{ width: 44, height: 24, borderRadius: 12, background: on ? '#22c55e' : '#d1d5db', position: 'relative', flexShrink: 0, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
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
      // Update stats in background — do NOT reload flags (would overwrite optimistic state)
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
    <div className="fade-in" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--lv-accent)', color: '#fff', padding: '7px 20px', borderRadius: 7, fontSize: 12, zIndex: 9999, boxShadow: '0 2px 8px rgba(124,92,252,.2)' }}>
          {toast}
        </div>
      )}

      {/* Note modal */}
      {noteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--lv-panel)', borderRadius: 16, padding: 24, width: 400, boxShadow: 'var(--lv-shadow-panel)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, color: 'var(--lv-fg)' }}>ملاحظة على الميزة</div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={4}
              placeholder="سبب التفعيل، اتفاقية مع العميل، وغيرها..."
              style={{ width: '100%', border: '1px solid var(--lv-line)', borderRadius: 10, padding: '7px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', background: 'var(--lv-bg)', color: 'var(--lv-fg)' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button onClick={() => setNoteModal(null)} style={{ padding: '7px 16px', borderRadius: 10, border: '1px solid var(--lv-line)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--lv-muted)' }}>إلغاء</button>
              <button onClick={async () => {
                const f = companyFlags.find(fl => fl.feature_key === noteModal.featureKey);
                await toggle(noteModal.companyId, noteModal.featureKey, !(f?.is_enabled ?? false), f?.rollout_pct, noteText);
                setNoteModal(null);
              }} style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'var(--lv-accent)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500, boxShadow: '0 2px 8px rgba(124,92,252,.2)' }}>حفظ وتفعيل</button>
            </div>
          </div>
        </div>
      )}

      {/* Rollout modal */}
      {rolloutModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--lv-panel)', borderRadius: 16, padding: 24, width: 380, boxShadow: 'var(--lv-shadow-panel)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: 'var(--lv-fg)' }}>نسبة الطرح التدريجي</div>
            <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginBottom: 16, fontWeight: 500 }}>تحديد نسبة المستخدمين الذين يرون هذه الميزة</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <input type="range" min={0} max={100} value={rolloutValue} onChange={e => setRolloutValue(Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontWeight: 600, fontSize: 18, color: 'var(--lv-fg)', width: 50, textAlign: 'center' }}>{rolloutValue}%</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[25, 50, 75, 100].map(v => (
                <button key={v} onClick={() => setRolloutValue(v)}
                  style={{ flex: 1, padding: '5px 0', borderRadius: 10, border: `1px solid ${rolloutValue === v ? 'var(--lv-accent)' : 'var(--lv-line)'}`, background: rolloutValue === v ? 'rgba(124,92,252,.1)' : 'var(--lv-panel)', color: rolloutValue === v ? 'var(--lv-accent)' : 'var(--lv-muted)', fontSize: 12, cursor: 'pointer' }}>
                  {v}%
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setRolloutModal(null)} style={{ padding: '7px 16px', borderRadius: 10, border: '1px solid var(--lv-line)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--lv-muted)' }}>إلغاء</button>
              <button onClick={async () => {
                const f = companyFlags.find(fl => fl.feature_key === rolloutModal.featureKey);
                await toggle(rolloutModal.companyId, rolloutModal.featureKey, f?.is_enabled ?? false, rolloutValue);
                setRolloutModal(null);
              }} style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'var(--lv-accent)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500, boxShadow: '0 2px 8px rgba(124,92,252,.2)' }}>تطبيق النسبة</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--lv-line)', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--lv-fg)', letterSpacing: '-0.02em' }}>مدير الميزات</span>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 0, borderBottom: '1px solid var(--lv-line)' }}>
          {([['company', 'شركة'], ['feature', 'ميزة'], ['matrix', 'مصفوفة']] as [View, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: 'none',
                color: view === v ? 'var(--lv-fg)' : 'var(--lv-muted)',
                borderBottom: view === v ? '2px solid var(--lv-accent)' : '2px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ borderBottom: '1px solid var(--lv-line)', padding: '8px 28px', display: 'flex', gap: 24, overflowX: 'auto', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--lv-muted)', whiteSpace: 'nowrap', fontWeight: 500 }}>{totalCompanies} شركة · {featureKeys.length} ميزة</div>
        {featureKeys.slice(0, 8).map(k => {
          const s = stats[k];
          if (!s) return null;
          return (
            <div key={k} onClick={() => { setView('feature'); setSelectedFeature(k); loadFeatureCompanies(k); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <div style={{ width: 32, height: 4, borderRadius: 2, background: 'rgba(0,0,0,.06)' }}>
                <div style={{ height: 4, borderRadius: 2, background: s.adoption_pct > 60 ? '#22c55e' : s.adoption_pct > 30 ? '#f59e0b' : 'var(--lv-muted)', width: `${s.adoption_pct}%` }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500 }}>{s.name_ar}</span>
              <span style={{ fontSize: 11, color: s.adoption_pct > 60 ? '#22c55e' : 'var(--lv-muted)', fontWeight: 600 }}>{s.adoption_pct}%</span>
            </div>
          );
        })}
        {recentChanges.length > 0 && (
          <div style={{ marginRight: 'auto', fontSize: 11, color: 'var(--lv-muted)', whiteSpace: 'nowrap', fontWeight: 500 }}>
            آخر تغيير: <span style={{ color: 'var(--lv-muted)' }}>{recentChanges[0]?.feature_key}</span> · {timeAgo(recentChanges[0]?.set_at)}
          </div>
        )}
      </div>

      {/* ─── VIEW: COMPANY ─────────────────────────────────────────────────────── */}
      {view === 'company' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', height: 'calc(100vh - 95px)' }}>
          {/* Company sidebar */}
          <div style={{ background: 'var(--lv-panel)', borderInlineStart: '1px solid var(--lv-line)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--lv-line)' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن شركة..."
                style={{ width: '100%', padding: '7px 12px', borderRadius: 10, border: '1px solid var(--lv-line)', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'var(--lv-bg)', color: 'var(--lv-fg)' }} />
              <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                {['all', ...TIER_ORDER].map(t => (
                  <button key={t} onClick={() => setTierFilter(t)}
                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 7, border: '1px solid', cursor: 'pointer', fontWeight: 500,
                      background: tierFilter === t ? 'var(--lv-accent)' : 'var(--lv-panel)', color: tierFilter === t ? '#fff' : 'var(--lv-muted)',
                      borderColor: tierFilter === t ? 'var(--lv-accent)' : 'var(--lv-line)' }}>
                    {t === 'all' ? 'الكل' : t}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredCompanies.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--lv-muted)', fontSize: 13 }}>لا توجد شركات</div>
              ) : filteredCompanies.map(c => {
                const tc = TIER_COLOR[c.plan] || TIER_COLOR.trial;
                const enabledCount = companyFlags.filter(f => f.is_enabled).length;
                return (
                  <button key={c.id} onClick={() => { setSelectedCompany(c.id); loadCompanyFlags(c.id); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none',
                      background: selectedCompany === c.id ? 'rgba(124,92,252,.08)' : 'transparent', cursor: 'pointer',
                      borderBottom: '1px solid var(--lv-line)', textAlign: 'right' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: tc.bg, border: `1px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: tc.color, flexShrink: 0 }}>
                      {c.name?.charAt(0)}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--lv-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                        <span style={{ fontSize: 11, padding: '1px 5px', borderRadius: 7, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, fontWeight: 500 }}>{c.plan}</span>
                        {selectedCompany === c.id && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 500 }}>{enabledCount} مُفعَّل</span>}
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--lv-muted)' }}>
                <p style={{ fontSize: 13 }}>اختر شركة من القائمة لإدارة ميزاتها</p>
              </div>
            ) : flagsLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--lv-muted)', fontSize: 13 }}>جاري التحميل...</div>
            ) : (
              <>
                {/* Company header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--lv-fg)', letterSpacing: '-0.02em' }}>{selectedCo?.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginTop: 2, fontWeight: 500 }}>
                      {companyFlags.filter(f => f.is_enabled).length} / {companyFlags.length} ميزة مفعّلة
                      {selectedCo?.plan && <span style={{ marginRight: 8, ...TIER_COLOR[selectedCo.plan] && { color: TIER_COLOR[selectedCo.plan].color } }}>خطة {selectedCo.plan}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500 }}>تطبيق سريع:</span>
                    {(['basic', 'professional', 'enterprise'] as Tier[]).map(t => {
                      const tc = TIER_COLOR[t];
                      return (
                        <button key={t} onClick={() => bulkApplyTier(t)} disabled={saving}
                          style={{ fontSize: 12, padding: '7px 16px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(0,0,0,.08)', color: 'var(--lv-muted)', cursor: 'pointer', fontWeight: 500 }}>
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
                        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,.04)' }} />
                        <span style={{ fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500 }}>
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
                            <div key={key} className="card" style={{
                              padding: '14px 16px', borderRadius: 14, border: '1px solid',
                              borderColor: enabled ? 'rgba(34,197,94,.25)' : 'var(--lv-line)',
                              background: enabled ? '#ecfdf5' : 'var(--lv-panel)',
                              transition: 'all .15s',
                              boxShadow: 'var(--lv-shadow-sm)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)' }}>{stat?.name_ar || key}</span>
                                    {stat?.beta && <span style={{ fontSize: 11, padding: '1px 5px', borderRadius: 4, background: 'rgba(245,158,11,.1)', color: '#f59e0b', fontWeight: 500 }}>BETA</span>}
                                    {flag?.plan_includes === false && enabled && (
                                      <span style={{ fontSize: 11, padding: '1px 5px', borderRadius: 4, background: '#fffbeb', color: '#f59e0b', border: '1px solid rgba(245,158,11,.2)', fontWeight: 500 }}>خارج الخطة</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--lv-muted)', fontFamily: 'monospace', fontWeight: 500 }}>{key}</div>
                                  {flag?.set_at && (
                                    <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginTop: 3, fontWeight: 500 }}>آخر تعديل: {timeAgo(flag.set_at)}</div>
                                  )}
                                  {flag?.notes && (
                                    <div style={{ fontSize: 11, color: 'var(--lv-muted)', marginTop: 3, background: 'var(--lv-bg)', padding: '3px 6px', borderRadius: 4 }}>{flag.notes}</div>
                                  )}
                                </div>
                                <Toggle on={enabled} disabled={saving} onClick={() => toggle(selectedCompany!, key, enabled, rollout)} />
                              </div>

                              {/* Rollout + platform adoption */}
                              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                                {enabled && (
                                  <button onClick={() => { setRolloutModal({ companyId: selectedCompany!, featureKey: key, current: rollout }); setRolloutValue(rollout); }}
                                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 7, border: '1px solid rgba(34,197,94,.25)', background: '#ecfdf5', color: '#10b981', cursor: 'pointer', fontWeight: 500 }}>
                                    {rollout}% طرح
                                  </button>
                                )}
                                <button onClick={() => { setNoteModal({ companyId: selectedCompany!, featureKey: key, currentNote: flag?.notes || '' }); setNoteText(flag?.notes || ''); }}
                                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 7, border: '1px solid var(--lv-line)', background: 'transparent', color: 'var(--lv-muted)', cursor: 'pointer', fontWeight: 500 }}>
                                  ملاحظة
                                </button>
                                <div style={{ marginRight: 'auto', fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500 }}>
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
          <div style={{ background: 'var(--lv-panel)', borderInlineStart: '1px solid var(--lv-line)', overflowY: 'auto' }}>
            {featuresByTier.map(({ tier, features }) => {
              if (features.length === 0) return null;
              const tc = TIER_COLOR[tier];
              return (
                <div key={tier}>
                  <div style={{ padding: '8px 14px', background: 'var(--lv-bg)', borderBottom: '1px solid var(--lv-line)', fontSize: 11, fontWeight: 600, color: tc.color }}>
                    {tier.toUpperCase()}
                  </div>
                  {features.map(key => {
                    const s = stats[key];
                    const active = selectedFeature === key;
                    return (
                      <button key={key} onClick={() => { setSelectedFeature(key); loadFeatureCompanies(key); }}
                        style={{ width: '100%', padding: '10px 14px', border: 'none', background: active ? 'rgba(124,92,252,.08)' : 'transparent', cursor: 'pointer', textAlign: 'right', borderBottom: '1px solid var(--lv-line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: 'var(--lv-fg)' }}>{s?.name_ar || key}</div>
                          <div style={{ fontSize: 11, color: 'var(--lv-muted)', fontFamily: 'monospace', marginTop: 1, fontWeight: 500 }}>{key}</div>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: (s?.adoption_pct ?? 0) > 60 ? '#22c55e' : 'var(--lv-muted)' }}>{s?.adoption_pct ?? 0}%</div>
                          <div style={{ fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500 }}>{s?.enabled_count ?? 0} شركة</div>
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--lv-muted)' }}>
                <p style={{ fontSize: 13 }}>اختر ميزة لرؤية حالتها في جميع الشركات</p>
              </div>
            ) : featureLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--lv-muted)', fontSize: 13 }}>جاري التحميل...</div>
            ) : (
              <>
                {/* Feature header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--lv-fg)', letterSpacing: '-0.02em' }}>{stats[selectedFeature]?.name_ar}</div>
                    <div style={{ fontSize: 11, color: 'var(--lv-muted)', fontFamily: 'monospace', fontWeight: 500 }}>{selectedFeature}</div>
                    <div style={{ fontSize: 13, color: 'var(--lv-muted)', marginTop: 4 }}>
                      {featureRows.filter(r => r.is_enabled).length} / {featureRows.length} شركة مُفعَّلة
                      · انتشار {stats[selectedFeature]?.adoption_pct ?? 0}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => bulkFeatureTier('basic', true)} disabled={saving}
                      style={{ fontSize: 12, padding: '7px 16px', borderRadius: 10, border: '1px solid var(--lv-line)', background: 'transparent', color: 'var(--lv-muted)', cursor: 'pointer', fontWeight: 500 }}>
                      تفعيل basic+
                    </button>
                    <button onClick={() => bulkFeatureTier('professional', true)} disabled={saving}
                      style={{ fontSize: 12, padding: '7px 16px', borderRadius: 10, border: '1px solid var(--lv-line)', background: 'transparent', color: 'var(--lv-muted)', cursor: 'pointer', fontWeight: 500 }}>
                      تفعيل pro+
                    </button>
                    <button onClick={() => bulkFeatureTier('basic', false)} disabled={saving}
                      style={{ fontSize: 12, padding: '7px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444', cursor: 'pointer', fontWeight: 500 }}>
                      تعطيل الكل
                    </button>
                  </div>
                </div>

                {/* Adoption bar */}
                <div style={{ background: 'rgba(0,0,0,.06)', borderRadius: 6, height: 6, marginBottom: 20 }}>
                  <div style={{ height: 6, borderRadius: 6, background: '#22c55e', width: `${stats[selectedFeature]?.adoption_pct ?? 0}%`, transition: 'width .4s' }} />
                </div>

                {/* Companies table */}
                <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--lv-panel)', boxShadow: 'var(--lv-shadow-sm)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--lv-bg)', borderBottom: '1px solid var(--lv-line)' }}>
                        {['الشركة', 'الخطة', 'الحالة', 'نسبة الطرح', 'آخر تعديل', 'ملاحظات', ''].map(h => (
                          <th key={h} style={{ padding: '9px 14px', fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500, textAlign: 'right' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {featureRows.map((row, i) => {
                        const tc = TIER_COLOR[row.plan] || TIER_COLOR.trial;
                        return (
                          <tr key={row.company_id} style={{ borderBottom: '1px solid var(--lv-line)', background: i % 2 === 0 ? 'var(--lv-panel)' : 'var(--lv-bg)' }}>
                            <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'var(--lv-fg)' }}>{row.name}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 7, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, fontWeight: 500 }}>{row.plan}</span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <Toggle on={row.is_enabled} disabled={saving} onClick={() => toggle(row.company_id, selectedFeature, row.is_enabled, row.rollout_pct)} />
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--lv-muted)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 50, height: 4, background: 'rgba(0,0,0,.06)', borderRadius: 2 }}>
                                  <div style={{ width: `${row.rollout_pct}%`, height: 4, background: 'var(--lv-accent)', borderRadius: 2 }} />
                                </div>
                                <span>{row.rollout_pct}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500 }}>{timeAgo(row.set_at)}</td>
                            <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--lv-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                              {row.notes || '—'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {!row.plan_includes && row.is_enabled && (
                                <span title="الميزة مُفعَّلة خارج نطاق الخطة" style={{ fontSize: 11, color: '#ef4444' }}>!</span>
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
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--lv-muted)', fontSize: 13 }}>جاري تحميل المصفوفة...</div>
          ) : !matrixData ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--lv-muted)', fontSize: 13 }}>لا توجد بيانات</div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--lv-muted)', marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center' }}>
                <span>{matrixData.companies.length} شركة x {Object.keys(matrixData.features).length} ميزة</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px rgba(34,197,94,.4)' }} /> <span style={{ fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500 }}>مُفعَّل</span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d1d5db', display: 'inline-block' }} /> <span style={{ fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500 }}>مُعطَّل</span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', boxShadow: '0 0 6px rgba(245,158,11,.4)' }} /> <span style={{ fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500 }}>طرح جزئي</span>
                </span>
              </div>
              <div style={{ borderRadius: 14, overflow: 'auto', background: 'var(--lv-panel)', boxShadow: 'var(--lv-shadow-sm)' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: 'max-content' }}>
                  <thead>
                    <tr style={{ background: 'var(--lv-bg)' }}>
                      <th style={{ padding: '10px 16px', fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500, textAlign: 'right', borderBottom: '1px solid var(--lv-line)', borderInlineStart: '1px solid var(--lv-line)', position: 'sticky', right: 0, background: 'var(--lv-bg)', zIndex: 2, minWidth: 160 }}>الشركة / الخطة</th>
                      {Object.entries(matrixData.features).map(([key, meta]: [string, any]) => (
                        <th key={key} style={{ padding: '6px 8px', fontSize: 11, color: 'var(--lv-muted)', fontWeight: 500, textAlign: 'center', borderBottom: '1px solid var(--lv-line)', borderInlineStart: '1px solid var(--lv-line)', maxWidth: 80, minWidth: 70 }}>
                          <div style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', whiteSpace: 'nowrap', color: TIER_COLOR[meta.tier_min]?.color }}>
                            {meta.name_ar}
                          </div>
                        </th>
                      ))}
                      <th style={{ padding: '8px', fontSize: 11, color: 'var(--lv-muted)', textAlign: 'center', borderBottom: '1px solid var(--lv-line)', fontWeight: 500 }}>مجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.companies.map((company, i) => {
                      const companyMatrix = matrixData.matrix[company.id] || {};
                      const enabledCount = Object.values(companyMatrix).filter(f => f.is_enabled).length;
                      const tc = TIER_COLOR[company.plan] || TIER_COLOR.trial;
                      return (
                        <tr key={company.id} style={{ borderBottom: '1px solid var(--lv-line)', background: i % 2 === 0 ? 'var(--lv-panel)' : 'var(--lv-bg)' }}>
                          <td style={{ padding: '8px 14px', borderInlineStart: '1px solid var(--lv-line)', position: 'sticky', right: 0, background: i % 2 === 0 ? 'var(--lv-panel)' : 'var(--lv-bg)', zIndex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--lv-fg)' }}>{company.name}</div>
                            <span style={{ fontSize: 11, padding: '1px 5px', borderRadius: 7, background: tc.bg, color: tc.color, fontWeight: 500 }}>{company.plan}</span>
                          </td>
                          {Object.keys(matrixData.features).map(key => {
                            const flag = companyMatrix[key];
                            const enabled = flag?.is_enabled ?? false;
                            const partial = enabled && (flag?.rollout_pct ?? 100) < 100;
                            return (
                              <td key={key} style={{ padding: '6px 8px', textAlign: 'center', borderInlineStart: '1px solid var(--lv-line)', cursor: saving ? 'default' : 'pointer' }}
                                onClick={() => toggle(company.id, key, enabled)}>
                                <div style={{
                                  width: 22, height: 22, borderRadius: 6, margin: '0 auto',
                                  background: enabled ? (partial ? '#f59e0b' : '#22c55e') : '#e5e7eb',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                                  transition: 'background .15s',
                                  color: enabled ? '#fff' : 'var(--lv-muted)',
                                  boxShadow: enabled ? `0 0 6px ${partial ? 'rgba(245,158,11,.3)' : 'rgba(34,197,94,.3)'}` : 'none',
                                }}>
                                  {enabled ? (partial ? '~' : '') : ''}
                                </div>
                              </td>
                            );
                          })}
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: enabledCount > 8 ? '#22c55e' : enabledCount > 4 ? '#f59e0b' : 'var(--lv-muted)' }}>
                              {enabledCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Column totals */}
                    <tr style={{ background: 'var(--lv-bg)', borderTop: '2px solid var(--lv-line)' }}>
                      <td style={{ padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--lv-fg)', position: 'sticky', right: 0, background: 'var(--lv-bg)' }}>مجموع الانتشار</td>
                      {Object.keys(matrixData.features).map(key => {
                        const s = stats[key];
                        return (
                          <td key={key} style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: (s?.adoption_pct ?? 0) > 60 ? '#22c55e' : 'var(--lv-muted)' }}>
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
