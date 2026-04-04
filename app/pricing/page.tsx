'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BASE } from '@/lib/api';

const API = BASE || process.env.NEXT_PUBLIC_API_URL || 'https://liv-entra-api-production.up.railway.app/api/v1';

interface Plan {
  id: string; name: string; name_ar: string;
  price_monthly: number; price_yearly: number;
  max_users: number; max_properties: number; max_units: number; max_contracts: number;
  features: string[];
}

const PLAN_COLORS: Record<string, string> = {
  trial: '#15803d', basic: '#475569', professional: '#1d4070', enterprise: '#92400e',
};

export default function PricingPage() {
  const router = useRouter();
  const [plans, setPlans]     = useState<Plan[]>([]);
  const [yearly, setYearly]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/public/plans`)
      .then(r => r.json())
      .then(r => { if (r.success) setPlans(r.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (plan: Plan) => {
    if (plan.name === 'trial') {
      // Trial: direct to contact or demo request
      router.push('/subscribe?plan_id=' + plan.id + '&cycle=monthly&trial=1');
      return;
    }
    router.push(`/subscribe?plan_id=${plan.id}&cycle=${yearly ? 'yearly' : 'monthly'}`);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#05081a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#94a3b8', fontSize: 14 }}>جاري التحميل...</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#05081a', direction: 'rtl', padding: '60px 24px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 48px' }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: '0 0 12px' }}>خطط الاشتراك</h1>
        <p style={{ fontSize: 16, color: '#94a3b8', margin: '0 0 32px', lineHeight: 1.6 }}>
          اختر الخطة المناسبة لعملك — يمكنك الترقية أو التخفيض في أي وقت
        </p>

        {/* Monthly / Yearly toggle */}
        <div style={{ display: 'inline-flex', background: '#0c1535', borderRadius: 12, padding: 4, border: '1px solid rgba(255,255,255,.1)' }}>
          <button onClick={() => setYearly(false)}
            style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              background: !yearly ? '#1d4070' : 'transparent', color: !yearly ? '#fff' : '#94a3b8' }}>
            شهري
          </button>
          <button onClick={() => setYearly(true)}
            style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              background: yearly ? '#1d4070' : 'transparent', color: yearly ? '#fff' : '#94a3b8' }}>
            سنوي <span style={{ fontSize: 11, background: '#15803d', color: '#fff', padding: '2px 6px', borderRadius: 6, marginRight: 6 }}>خصم 17%</span>
          </button>
        </div>
      </div>

      {/* Plans grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 1200, margin: '0 auto' }}>
        {plans.filter(p => p.name !== 'trial').map(plan => {
          const price = yearly ? plan.price_yearly : plan.price_monthly;
          const monthlyEquiv = yearly ? Math.round(plan.price_yearly / 12) : plan.price_monthly;
          const isPro = plan.name === 'professional';
          const accentColor = PLAN_COLORS[plan.name] || '#1d4070';

          return (
            <div key={plan.id} style={{
              background: '#0c1535', borderRadius: 20, padding: '32px 28px',
              border: isPro ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,.08)',
              position: 'relative',
            }}>
              {isPro && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: '#3b82f6', color: '#fff', padding: '4px 16px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                  الأكثر شيوعاً
                </div>
              )}

              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>{plan.name_ar}</h3>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 20px' }}>{plan.name}</p>

              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: 40, fontWeight: 800, color: '#fff' }}>{monthlyEquiv.toLocaleString()}</span>
                <span style={{ fontSize: 14, color: '#94a3b8', marginRight: 4 }}>ر.س/شهر</span>
                {yearly && (
                  <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
                    {price.toLocaleString()} ر.س/سنة
                  </p>
                )}
              </div>

              <button onClick={() => handleSelect(plan)}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: 700,
                  background: isPro ? '#3b82f6' : '#1e293b', color: '#fff',
                  marginBottom: 24,
                }}>
                ابدأ الاشتراك
              </button>

              <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 20 }}>
                {[
                  { label: 'مستخدمين', value: plan.max_users >= 999 ? 'غير محدود' : plan.max_users },
                  { label: 'عقارات', value: plan.max_properties >= 999 ? 'غير محدود' : plan.max_properties },
                  { label: 'وحدات', value: plan.max_units >= 9999 ? 'غير محدود' : plan.max_units },
                  { label: 'عقود', value: plan.max_contracts >= 9999 ? 'غير محدود' : plan.max_contracts },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Trial CTA */}
      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 12 }}>لست مستعداً بعد؟</p>
        <button onClick={() => {
          const trialPlan = plans.find(p => p.name === 'trial');
          if (trialPlan) router.push(`/subscribe?plan_id=${trialPlan.id}&cycle=monthly&trial=1`);
        }}
          style={{ padding: '12px 32px', borderRadius: 12, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          ابدأ تجربة مجانية (30 يوم)
        </button>
      </div>
    </div>
  );
}
