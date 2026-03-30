'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

const TIER_ORDER = ['trial', 'basic', 'professional', 'enterprise'];
const TIER_COLORS: Record<string, { bg: string; color: string }> = {
  trial:        { bg: '#f0fdf4', color: '#15803d' },
  basic:        { bg: '#f8fafc', color: '#475569' },
  professional: { bg: '#eff6ff', color: '#1d4070' },
  enterprise:   { bg: '#fef3c7', color: '#92400e' },
};

export default function FeaturesPage() {
  const router = useRouter();
  const [registry,   setRegistry]   = useState<any>({});
  const [companies,  setCompanies]  = useState<any[]>([]);
  const [selected,   setSelected]   = useState<string | null>(null);
  const [flags,      setFlags]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [flagsLoad,  setFlagsLoad]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState('');
  const [search,     setSearch]     = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    setLoading(true);
    const results = await Promise.allSettled([
      adminApi.sa.featureRegistry(),
      adminApi.sa.listCompanies({ limit: '200' }),
    ]);
    if (results[0].status === 'fulfilled') setRegistry((results[0].value as any)?.data || {});
    if (results[1].status === 'fulfilled') setCompanies((results[1].value as any)?.data || []);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const selectCompany = async (id: string) => {
    setSelected(id);
    setFlagsLoad(true);
    try {
      const r = await adminApi.sa.companyFlags(id);
      setFlags((r as any)?.data || []);
    } catch { setFlags([]); }
    setFlagsLoad(false);
  };

  const handleToggle = async (featureKey: string, current: boolean) => {
    if (!selected) return;
    setSaving(true);
    try {
      await adminApi.sa.setFlag(selected, featureKey, !current);
      showToast(`${featureKey} ${!current ? 'مُفعَّل' : 'مُعطَّل'} ✓`);
      const r = await adminApi.sa.companyFlags(selected);
      setFlags((r as any)?.data || []);
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const handleBulkApply = async (tier: string) => {
    if (!selected) return;
    const featureKeys = Object.entries(registry)
      .filter(([, meta]: [string, any]) => TIER_ORDER.indexOf(meta.tier_min) <= TIER_ORDER.indexOf(tier))
      .map(([k]) => k);

    if (!confirm(`تفعيل ${featureKeys.length} ميزة لخطة ${tier}؟`)) return;
    setSaving(true);
    try {
      const flagsPayload = featureKeys.map(k => ({ feature_key: k, is_enabled: true }));
      await adminApi.sa.bulkSetFlags(selected, flagsPayload);
      showToast(`تم تفعيل ميزات خطة ${tier} ✓`);
      const r = await adminApi.sa.companyFlags(selected);
      setFlags((r as any)?.data || []);
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const filteredCompanies = companies.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.slug?.includes(search);
    const plan = c.subscription?.plan?.name || c.plan || 'trial';
    const matchTier = tierFilter === 'all' || plan === tierFilter;
    return matchSearch && matchTier;
  });

  const selectedCompany = companies.find(c => c.id === selected);

  const registryEntries = Object.entries(registry);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', direction: 'rtl' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: 'white', padding: '10px 24px', borderRadius: 10, fontSize: 13, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
          {toast}
        </div>
      )}

      {/* Nav */}
      <div style={{ background: '#0f172a', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
        <Link href="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>مدير ميزات المستأجرين</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', height: 'calc(100vh - 49px)' }}>
        {/* Company list sidebar */}
        <div style={{ background: '#fff', borderLeft: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث..."
              style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
              {['all', 'trial', 'basic', 'professional', 'enterprise'].map(t => (
                <button key={t} onClick={() => setTierFilter(t)}
                  style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, border: '1px solid', cursor: 'pointer',
                    background: tierFilter === t ? '#0f172a' : 'white',
                    color:      tierFilter === t ? 'white'   : '#475569',
                    borderColor: tierFilter === t ? '#0f172a' : '#e2e8f0' }}>
                  {t === 'all' ? 'الكل' : t}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>تحميل...</div>
            ) : filteredCompanies.map(c => {
              const plan = c.subscription?.plan?.name || c.plan || 'trial';
              const pc = TIER_COLORS[plan] || TIER_COLORS.trial;
              return (
                <button key={c.id} onClick={() => selectCompany(c.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', border: 'none', background: selected === c.id ? '#eff6ff' : 'transparent', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', textAlign: 'right', transition: 'background .1s' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1d4070', flexShrink: 0 }}>
                    {c.name?.charAt(0)}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ fontSize: 13, fontWeight: selected === c.id ? 700 : 500, margin: 0, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: pc.bg, color: pc.color, fontWeight: 500 }}>{plan}</span>
                  </div>
                  {selected === c.id && <span style={{ color: '#1d4070', fontSize: 12 }}>▶</span>}
                </button>
              );
            })}
            {filteredCompanies.length === 0 && !loading && (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>لا توجد شركات</div>
            )}
          </div>
        </div>

        {/* Feature flags panel */}
        <div style={{ overflowY: 'auto', padding: '28px 32px' }}>
          {!selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#94a3b8' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎛</div>
              <p style={{ fontSize: 14 }}>اختر شركة من القائمة لإدارة ميزاتها</p>
            </div>
          ) : flagsLoad ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>تحميل الميزات...</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0f172a' }}>{selectedCompany?.name}</h2>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
                    {flags.filter(f => f.is_enabled).length} من {registryEntries.length} ميزة مفعّلة
                  </p>
                </div>
                {/* Quick apply tier buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#64748b', alignSelf: 'center' }}>تطبيق سريع:</span>
                  {['basic', 'professional', 'enterprise'].map(t => {
                    const tc = TIER_COLORS[t];
                    return (
                      <button key={t} onClick={() => handleBulkApply(t)} disabled={saving}
                        style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: tc.bg, border: `1px solid ${tc.color}33`, color: tc.color, cursor: 'pointer', fontWeight: 600 }}>
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Feature grid grouped by tier */}
              {TIER_ORDER.slice(1).map(tier => {
                const tierFeatures = registryEntries.filter(([, m]: [string, any]) => m.tier_min === tier);
                if (tierFeatures.length === 0) return null;
                const tc = TIER_COLORS[tier];
                return (
                  <div key={tier} style={{ marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: tc.bg, color: tc.color, fontWeight: 700 }}>{tier}</span>
                      <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                      {tierFeatures.map(([key, meta]: [string, any]) => {
                        const flag = flags.find(f => f.feature_key === key);
                        const enabled = flag?.is_enabled ?? false;
                        return (
                          <div key={key}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 12, border: '1px solid', borderColor: enabled ? '#bbf7d0' : '#e2e8f0', background: enabled ? '#f0fdf4' : '#fff', transition: 'all .2s', cursor: 'pointer' }}
                            onClick={() => handleToggle(key, enabled)}>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px', color: '#0f172a' }}>{meta.name_ar}</p>
                              <p style={{ fontSize: 10, color: '#94a3b8', margin: 0, direction: 'ltr' }}>{key}</p>
                              {meta.beta && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: '#fef3c7', color: '#92400e', marginTop: 3, display: 'inline-block' }}>BETA</span>}
                            </div>
                            <div style={{ width: 44, height: 24, borderRadius: 12, background: enabled ? '#15803d' : '#cbd5e1', position: 'relative', flexShrink: 0, cursor: 'pointer', opacity: saving ? 0.6 : 1, transition: 'background .2s' }}>
                              <span style={{ position: 'absolute', top: 3, left: enabled ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
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
    </div>
  );
}
