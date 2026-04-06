'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi, request } from '@/lib/api';

const SEV: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#fef2f2', color: '#dc2626' },
  warning:  { bg: '#fff7ed', color: '#c2410c' },
  info:     { bg: '#eff6ff', color: '#1d4070' },
};

const ANOMALY_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  open:           { bg: '#fef2f2', color: '#dc2626', label: 'مفتوح'       },
  acknowledged:   { bg: '#fff7ed', color: '#c2410c', label: 'مُعترف به'   },
  resolved:       { bg: '#f0fdf4', color: '#15803d', label: 'محلول'       },
  false_positive: { bg: '#fafafa', color: '#71717a', label: 'إيجابي كاذب' },
};

export default function AuditPage() {
  const router = useRouter();
  const [audit,     setAudit]     = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [tab,       setTab]       = useState<'audit' | 'anomalies'>('anomalies');
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [sevFilter, setSevFilter] = useState('all');
  const [page,      setPage]      = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);
  const [toast,     setToast]     = useState('');
  const PAGE_SIZE = 30;

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    setLoading(true);
    const results = await Promise.allSettled([
      request<any>('GET', '/admin/audit-logs?limit=200'),
      adminApi.sa.listAnomalies({ limit: '100' }),
    ]);
    if (results[0].status === 'fulfilled') setAudit((results[0].value as any)?.data || []);
    if (results[1].status === 'fulfilled') setAnomalies((results[1].value as any)?.data || []);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleUpdateAnomaly = async (id: string, status: string) => {
    const note = status === 'resolved' ? (prompt('ملاحظة الحل:') ?? '') : undefined;
    setActioning(id);
    try {
      await adminApi.sa.updateAnomaly(id, status, note);
      showToast('تم التحديث');
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setActioning(null);
  };

  const filteredAudit = audit.filter(a => {
    const matchSearch = !search || a.action?.includes(search) || a.actor_email?.includes(search) || a.target_type?.includes(search);
    return matchSearch;
  });

  const filteredAnomalies = anomalies.filter(a => {
    const matchSev = sevFilter === 'all' || a.severity === sevFilter;
    const matchSearch = !search || a.description?.includes(search) || a.anomaly_type?.includes(search);
    return matchSev && matchSearch;
  });

  const paginated = filteredAudit.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredAudit.length / PAGE_SIZE);

  // Anomaly counts
  const anomalyCounts = anomalies.reduce((acc, a) => { acc[a.severity] = (acc[a.severity]||0)+1; return acc; }, {} as Record<string,number>);
  const openCount = anomalies.filter(a => a.status === 'open').length;

  return (
    <div style={{ background: '#fafafa' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#18181b', color: '#fff', padding: '7px 20px', borderRadius: 7, fontSize: 12, zIndex: 9999, boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e5e5', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#18181b', letterSpacing: '-0.02em' }}>التدقيق والأمان</span>
        {openCount > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>{openCount} تنبيه</span>
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e5e5', padding: '0 32px', display: 'flex', gap: 0 }}>
        {[
          { k: 'anomalies', l: `التنبيهات الذكية (${anomalies.length})` },
          { k: 'audit',     l: `سجل التدقيق (${audit.length})` },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            style={{ fontSize: 13, padding: '12px 18px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t.k ? 600 : 400, color: tab === t.k ? '#18181b' : '#a1a1aa', borderBottom: tab === t.k ? '2px solid #18181b' : '2px solid transparent', transition: 'all .15s' }}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Search bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'anomalies' ? 'بحث في التنبيهات...' : 'بحث في السجل...'}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e5e5e5', fontSize: 13, outline: 'none', width: 280, background: '#fff' }} />

          {tab === 'anomalies' && (
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { k: 'all',      l: `الكل (${anomalies.length})` },
                { k: 'critical', l: `حرج (${anomalyCounts.critical||0})` },
                { k: 'warning',  l: `تحذير (${anomalyCounts.warning||0})` },
                { k: 'info',     l: `معلومة (${anomalyCounts.info||0})` },
              ].map(f => (
                <button key={f.k} onClick={() => setSevFilter(f.k)}
                  style={{ fontSize: 12, padding: '7px 16px', borderRadius: 7, border: '1px solid', cursor: 'pointer', fontWeight: 500,
                    background: sevFilter === f.k ? '#18181b' : '#fff',
                    color:      sevFilter === f.k ? '#fff'    : '#71717a',
                    borderColor: sevFilter === f.k ? '#18181b' : '#e5e5e5' }}>
                  {f.l}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#a1a1aa', fontSize: 13 }}>جاري التحميل...</div>
        ) : (
          <>
            {/* ── التنبيهات ── */}
            {tab === 'anomalies' && (
              <div>
                {filteredAnomalies.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '80px 0', color: '#a1a1aa', fontSize: 13 }}>
                    لا توجد تنبيهات
                  </div>
                ) : (
                  filteredAnomalies.map(a => {
                    const sc = SEV[a.severity] || SEV.info;
                    const st = ANOMALY_STATUS[a.status] || ANOMALY_STATUS.open;
                    const isActing = actioning === a.id;
                    return (
                      <div key={a.id} style={{ background: '#fff', borderRadius: 8, border: `1px solid ${a.status === 'open' ? sc.color + '33' : '#e5e5e5'}`, padding: '16px 20px', marginBottom: 10, boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, display: 'inline-block' }} />
                              <span style={{ fontSize: 11, color: sc.color, fontWeight: 500 }}>{a.severity}</span>
                            </div>
                            <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#18181b' }}>
                              {a.anomaly_type?.replace(/_/g, ' ')}
                            </h4>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color, display: 'inline-block' }} />
                              <span style={{ fontSize: 11, color: st.color, fontWeight: 500 }}>{st.label}</span>
                            </div>
                            <span style={{ fontSize: 11, color: '#a1a1aa', direction: 'ltr', fontWeight: 500 }}>{new Date(a.created_at).toLocaleString('ar-SA')}</span>
                          </div>
                        </div>

                        <p style={{ fontSize: 13, color: '#3f3f46', margin: '0 0 6px', lineHeight: 1.6 }}>{a.description}</p>

                        {a.ai_suggestion && (
                          <p style={{ fontSize: 13, color: '#1d4070', margin: '0 0 10px', padding: '8px 12px', background: '#eff6ff', borderRadius: 7 }}>
                            {a.ai_suggestion}
                          </p>
                        )}

                        {a.company && (
                          <p style={{ fontSize: 11, color: '#a1a1aa', margin: '0 0 10px', fontWeight: 500 }}>
                            الشركة: <Link href={`/dashboard/companies/${a.company_id}`} style={{ color: '#18181b', fontWeight: 500 }}>{a.company.name}</Link>
                          </p>
                        )}

                        {a.status === 'open' && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleUpdateAnomaly(a.id, 'acknowledged')} disabled={isActing}
                              style={{ fontSize: 12, padding: '7px 16px', borderRadius: 7, background: '#fff', border: '1px solid #e5e5e5', color: '#71717a', cursor: 'pointer', fontWeight: 500 }}>
                              {isActing ? '...' : 'اعتراف'}
                            </button>
                            <button onClick={() => handleUpdateAnomaly(a.id, 'resolved')} disabled={isActing}
                              style={{ fontSize: 12, padding: '7px 16px', borderRadius: 7, background: '#18181b', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
                              حلّ
                            </button>
                            <button onClick={() => handleUpdateAnomaly(a.id, 'false_positive')} disabled={isActing}
                              style={{ fontSize: 12, padding: '7px 16px', borderRadius: 7, background: '#fff', border: '1px solid #e5e5e5', color: '#71717a', cursor: 'pointer', fontWeight: 500 }}>
                              إيجابي كاذب
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── سجل التدقيق ── */}
            {tab === 'audit' && (
              <>
                <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#3f3f46' }}>{filteredAudit.length} حدث</span>
                    <span style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 500 }}>صفحة {page+1} من {Math.max(1,totalPages)}</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#fafafa' }}>
                        {['الإجراء', 'المشغّل', 'الدور', 'النوع', 'IP', 'التاريخ'].map(h => (
                          <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#a1a1aa', borderBottom: '1px solid #e5e5e5' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((a, i) => (
                        <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '11px 18px' }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#18181b' }}>{a.action?.replace(/_/g,' ')}</span>
                          </td>
                          <td style={{ padding: '11px 18px', fontSize: 13, color: '#3f3f46' }}>{a.actor_email}</td>
                          <td style={{ padding: '11px 18px' }}>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 7, background: '#fafafa', color: '#71717a', fontWeight: 500, border: '1px solid #e5e5e5' }}>
                              {a.actor_role}
                            </span>
                          </td>
                          <td style={{ padding: '11px 18px', fontSize: 11, color: '#71717a', fontWeight: 500 }}>{a.target_type}</td>
                          <td style={{ padding: '11px 18px', fontSize: 11, color: '#a1a1aa', direction: 'ltr', fontWeight: 500 }}>{a.ip_address}</td>
                          <td style={{ padding: '11px 18px', fontSize: 11, color: '#a1a1aa', direction: 'ltr', whiteSpace: 'nowrap', fontWeight: 500 }}>
                            {new Date(a.created_at).toLocaleString('ar-SA')}
                          </td>
                        </tr>
                      ))}
                      {paginated.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: '#a1a1aa', fontSize: 13 }}>لا توجد سجلات</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
                    <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
                      style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #e5e5e5', background: '#fff', cursor: page > 0 ? 'pointer' : 'not-allowed', color: page > 0 ? '#18181b' : '#a1a1aa', fontSize: 12, fontWeight: 500 }}>
                      السابق
                    </button>
                    <span style={{ padding: '7px 14px', fontSize: 13, color: '#3f3f46' }}>{page+1} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page >= totalPages-1}
                      style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #e5e5e5', background: '#fff', cursor: page < totalPages-1 ? 'pointer' : 'not-allowed', color: page < totalPages-1 ? '#18181b' : '#a1a1aa', fontSize: 12, fontWeight: 500 }}>
                      التالي
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
