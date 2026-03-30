'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

function lcOf(c: any): string {
  if (c.lifecycle_status) return c.lifecycle_status;
  if (!c.is_active) return 'suspended';
  if (c.plan === 'trial') return 'trial';
  return 'active';
}
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }
function daysSince(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }

const PLAN_AR: Record<string,string> = { trial:'تجريبي', basic:'أساسي', professional:'احترافي', enterprise:'مؤسسي' };
const PLAN_C:  Record<string,{bg:string;color:string}> = {
  trial:        { bg:'#f0fdf4', color:'#15803d' },
  basic:        { bg:'#f8fafc', color:'#475569' },
  professional: { bg:'#eff6ff', color:'#1d4070' },
  enterprise:   { bg:'#fef3c7', color:'#92400e' },
};

const STAGES = [
  { key:'trial',     label:'تجريبي',    color:'#f59e0b', bg:'#fefce8', border:'#fde68a', icon:'⏳' },
  { key:'active',    label:'نشط',        color:'#22c55e', bg:'#f0fdf4', border:'#bbf7d0', icon:'✅' },
  { key:'overdue',   label:'متأخر',      color:'#f97316', bg:'#fff7ed', border:'#fed7aa', icon:'⚠️' },
  { key:'suspended', label:'موقوف',      color:'#ef4444', bg:'#fef2f2', border:'#fecaca', icon:'🔴' },
];

// Onboarding checklist per company
function getOnboardingSteps(c: any) {
  return [
    { label: 'الحساب مُنشأ',        done: true },
    { label: 'البريد مُعيَّن',        done: !!(c.contact_email || c.admin_email) },
    { label: 'الخطة مختارة',         done: c.plan && c.plan !== 'trial' },
    { label: 'الحدود مُهيَّأة',       done: c.max_units && c.max_units > 5 },
    { label: 'نشط ومُشغَّل',         done: c.is_active && daysSince(c.created_at) > 2 },
  ];
}

function CompanyCard({ c, onAction, actioning }: { c:any; onAction:(id:string, action:string)=>void; actioning:string|null }) {
  const stage = lcOf(c);
  const st = STAGES.find(s => s.key === stage) || STAGES[0];
  const pc = PLAN_C[c.plan] || PLAN_C.basic;
  const steps = getOnboardingSteps(c);
  const doneCount = steps.filter(s => s.done).length;
  const isActing = actioning === c.id;
  const trialDays = c.trial_ends_at ? daysUntil(c.trial_ends_at) : null;

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${st.border}`, padding: '16px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,.05)', transition: 'box-shadow .15s' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#1d4070', flexShrink: 0 }}>
          {c.name?.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
          <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: pc.bg, color: pc.color, fontWeight: 500 }}>{PLAN_AR[c.plan] || c.plan}</span>
            {c.city && <span style={{ fontSize: 10, color: '#94a3b8' }}>{c.city}</span>}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        <div style={{ padding: '8px 10px', borderRadius: 8, background: '#f8fafc', textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>{c.max_units || 0}</p>
          <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>حد الوحدات</p>
        </div>
        <div style={{ padding: '8px 10px', borderRadius: 8, background: '#f8fafc', textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>{daysSince(c.created_at)}</p>
          <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>يوم منذ التسجيل</p>
        </div>
      </div>

      {/* Onboarding progress */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>إعداد الحساب</span>
          <span style={{ fontSize: 10, color: doneCount >= 4 ? '#15803d' : '#f59e0b', fontWeight: 600 }}>{doneCount}/{steps.length}</span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: '#f1f5f9' }}>
          <div style={{ height: '100%', width: `${(doneCount/steps.length)*100}%`, background: doneCount >= 4 ? '#22c55e' : '#f59e0b', borderRadius: 3, transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
          {steps.map((st2, i) => (
            <span key={i} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: st2.done ? '#f0fdf4' : '#f8fafc', color: st2.done ? '#15803d' : '#94a3b8', border: `1px solid ${st2.done ? '#bbf7d0' : '#e2e8f0'}` }}>
              {st2.done ? '✓' : '○'} {st2.label}
            </span>
          ))}
        </div>
      </div>

      {/* Trial countdown */}
      {stage === 'trial' && trialDays !== null && (
        <div style={{ padding: '6px 10px', borderRadius: 8, background: trialDays <= 3 ? '#fef2f2' : '#fefce8', border: `1px solid ${trialDays <= 3 ? '#fecaca' : '#fde68a'}`, marginBottom: 10, textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: trialDays <= 3 ? '#dc2626' : '#854d0e', margin: 0 }}>
            {trialDays > 0 ? `تنتهي التجربة خلال ${trialDays} يوم` : 'انتهت التجربة'}
          </p>
        </div>
      )}

      {/* Suspended reason */}
      {stage === 'suspended' && c.suspended_reason && (
        <div style={{ padding: '6px 10px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 10 }}>
          <p style={{ fontSize: 10, color: '#dc2626', margin: 0 }}>سبب الإيقاف: {c.suspended_reason}</p>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        <Link href={`/dashboard/companies/${c.id}`}
          style={{ flex: 1, textAlign: 'center', fontSize: 11, padding: '7px', borderRadius: 8, border: '1px solid #e2e8f0', color: '#1d4070', textDecoration: 'none', fontWeight: 600, background: '#fafafa' }}>
          تفاصيل ↗
        </Link>
        {stage !== 'active' && stage !== 'deleted' && (
          <button onClick={() => onAction(c.id, 'activate')} disabled={isActing}
            style={{ flex: 1, fontSize: 11, padding: '7px', borderRadius: 8, border: '1px solid #bbf7d0', color: '#15803d', cursor: 'pointer', background: '#f0fdf4', fontWeight: 600 }}>
            {isActing ? '...' : 'تفعيل ✓'}
          </button>
        )}
        {stage === 'active' && (
          <button onClick={() => onAction(c.id, 'suspend')} disabled={isActing}
            style={{ flex: 1, fontSize: 11, padding: '7px', borderRadius: 8, border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', background: '#fef2f2', fontWeight: 600 }}>
            {isActing ? '...' : 'إيقاف'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CompaniesPage() {
  const router = useRouter();
const [companies,  setCompanies]  = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [view,       setView]       = useState<'kanban'|'list'>('kanban');
  const [actioning,  setActioning]  = useState<string|null>(null);
  const [toast,      setToast]      = useState('');

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    if (!localStorage.getItem('admin_token')) { router.push('/login'); return; }
    setLoading(true);
    try {
      // Use old reliable endpoint — always has data
      const r = await adminApi.listCompanies();
      setCompanies((r as any)?.data || []);
    } catch { router.push('/login'); }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: string) => {
    const c = companies.find(x => x.id === id);
    if (action === 'suspend' && !confirm(`إيقاف "${c?.name}"؟`)) return;
    setActioning(id);
    try {
      if (action === 'activate') {
        // Try new sa endpoint first, fallback to old
        const r = await adminApi.activateCompany(id).catch(() => null);
        if (!r) await adminApi.sa.activateCompany(id);
      } else {
        await adminApi.suspendCompany(id);
      }
      showToast('تم بنجاح ✓');
      await load();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setActioning(null);
  };

  const filtered = companies.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.slug?.includes(search));

  const byStage: Record<string, any[]> = {};
  for (const st of STAGES) byStage[st.key] = filtered.filter(c => lcOf(c) === st.key);

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', direction: 'rtl' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: 'white', padding: '10px 24px', borderRadius: 10, fontSize: 13, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
          {toast}
        </div>
      )}

      {/* Nav */}
      <div style={{ background: '#0f172a', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>
            إدارة الشركات
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginRight: 8 }}>({filtered.length})</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,.15)' }}>
            {(['kanban','list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ fontSize: 11, padding: '5px 12px', border: 'none', cursor: 'pointer', background: view === v ? 'rgba(255,255,255,.2)' : 'transparent', color: 'white' }}>
                {v === 'kanban' ? '⊞ بوردات' : '☰ قائمة'}
              </button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث..."
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.1)', color: 'white', fontSize: 12, outline: 'none', width: 180 }} />
          <Link href="/dashboard/companies/new"
            style={{ fontSize: 12, padding: '7px 16px', borderRadius: 8, background: '#1d4070', color: 'white', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
            + إضافة
          </Link>
        </div>
      </div>

      {/* Lifecycle header bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 32px' }}>
        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', maxWidth: 800 }}>
          {STAGES.map((st, i, arr) => (
            <div key={st.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ flex: 1, padding: '10px 16px', background: st.bg, border: `1px solid ${st.border}`, borderRadius: i === 0 ? '10px 0 0 10px' : i === arr.length-1 ? '0 10px 10px 0' : 0, textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{st.icon} {st.label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: st.color, margin: '2px 0 0' }}>{byStage[st.key]?.length || 0}</p>
              </div>
              {i < arr.length - 1 && <div style={{ color: '#cbd5e1', fontSize: 14, padding: '0 2px' }}>›</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>جاري تحميل بيانات الشركات...</div>
        ) : view === 'kanban' ? (
          /* ── Kanban board ── */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, alignItems: 'start' }}>
            {STAGES.map(st => (
              <div key={st.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: st.color }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{st.label}</span>
                  <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 700, border: `1px solid ${st.border}` }}>
                    {byStage[st.key]?.length || 0}
                  </span>
                </div>
                {byStage[st.key]?.length === 0 ? (
                  <div style={{ padding: '24px 16px', borderRadius: 12, border: `2px dashed ${st.border}`, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                    لا توجد شركات
                  </div>
                ) : (
                  byStage[st.key].map(c => (
                    <CompanyCard key={c.id} c={c} onAction={handleAction} actioning={actioning} />
                  ))
                )}
              </div>
            ))}
          </div>
        ) : (
          /* ── List view ── */
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['الشركة', 'المرحلة', 'الخطة', 'الإعداد', 'الوحدات', 'تاريخ الإضافة', 'إجراءات'].map(h => (
                    <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const stage = lcOf(c);
                  const st    = STAGES.find(s => s.key === stage) || STAGES[0];
                  const pc    = PLAN_C[c.plan] || PLAN_C.basic;
                  const steps = getOnboardingSteps(c);
                  const done  = steps.filter(s => s.done).length;
                  const isAct = actioning === c.id;
                  return (
                    <tr key={c.id} style={{ borderBottom: i < filtered.length-1 ? '1px solid #f1f5f9' : 'none' }}>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1d4070' }}>{c.name?.charAt(0)}</div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{c.name}</p>
                            <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>{c.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 600, border: `1px solid ${st.border}` }}>
                          {st.icon} {st.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: pc.bg, color: pc.color, fontWeight: 500 }}>
                          {PLAN_AR[c.plan] || c.plan}
                        </span>
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {steps.map((s, j) => <div key={j} style={{ width: 8, height: 8, borderRadius: '50%', background: s.done ? '#22c55e' : '#e2e8f0' }} />)}
                          </div>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{done}/5</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px', fontSize: 12, color: '#475569' }}>{c.max_units}</td>
                      <td style={{ padding: '12px 18px', fontSize: 11, color: '#94a3b8', direction: 'ltr', textAlign: 'right' }}>
                        {new Date(c.created_at).toLocaleDateString('ar-SA')}
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Link href={`/dashboard/companies/${c.id}`} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, border: '1px solid #e2e8f0', color: '#1d4070', textDecoration: 'none' }}>تحكم</Link>
                          {stage !== 'active' ? (
                            <button onClick={() => handleAction(c.id, 'activate')} disabled={isAct}
                              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', cursor: 'pointer' }}>
                              {isAct ? '...' : 'تفعيل'}
                            </button>
                          ) : (
                            <button onClick={() => handleAction(c.id, 'suspend')} disabled={isAct}
                              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer' }}>
                              {isAct ? '...' : 'إيقاف'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
