'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BASE } from '@/lib/api';

const API = BASE || process.env.NEXT_PUBLIC_API_URL || 'https://liv-entra-api-production.up.railway.app/api/v1';

export default function SubscribeSuccessWrapper() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#05081a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#94a3b8' }}>جاري التحميل...</p></div>}><SubscribeSuccessPage /></Suspense>;
}

function SubscribeSuccessPage() {
  const searchParams = useSearchParams();
  const chargeId = searchParams?.get('charge_id') || searchParams?.get('tap_id') || searchParams?.get('invoice_id') || searchParams?.get('id') || '';

  const [status, setStatus]   = useState<'loading' | 'provisioned' | 'pending' | 'failed'>('loading');
  const [data, setData]       = useState<any>(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!chargeId) { setStatus('failed'); return; }

    const poll = async () => {
      try {
        const res = await fetch(`${API}/public/subscribe/verify?charge_id=${chargeId}`);
        const json = await res.json();
        if (!json.success) { setStatus('failed'); return; }

        const result = json.data;
        setData(result);

        if (result.provisioned || result.status === 'provisioned') {
          setStatus('provisioned');
        } else if (result.status === 'payment_failed') {
          setStatus('failed');
        } else {
          // Still pending — poll again
          setPollCount(c => c + 1);
        }
      } catch {
        setStatus('failed');
      }
    };

    poll();
  }, [chargeId]);

  // Poll every 3 seconds while pending (max 20 attempts = 60 seconds)
  useEffect(() => {
    if (status !== 'loading' || pollCount >= 20) {
      if (pollCount >= 20 && status === 'loading') setStatus('pending');
      return;
    }

    const timer = setTimeout(() => {
      const poll = async () => {
        try {
          const res = await fetch(`${API}/public/subscribe/verify?charge_id=${chargeId}`);
          const json = await res.json();
          if (json.success) {
            setData(json.data);
            if (json.data.provisioned || json.data.status === 'provisioned') {
              setStatus('provisioned');
              return;
            }
            if (json.data.status === 'payment_failed') {
              setStatus('failed');
              return;
            }
          }
          setPollCount(c => c + 1);
        } catch {
          setPollCount(c => c + 1);
        }
      };
      poll();
    }, 3000);

    return () => clearTimeout(timer);
  }, [pollCount, status, chargeId]);

  return (
    <div style={{ minHeight: '100vh', background: '#05081a', direction: 'rtl', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
        {status === 'loading' && (
          <div style={{ background: '#0c1535', borderRadius: 20, padding: '48px 32px', border: '1px solid rgba(255,255,255,.08)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>جاري إعداد حسابك...</h2>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>يتم الآن إنشاء شركتك وإعداد لوحة التحكم. لا تغلق هذه الصفحة.</p>
            <div style={{ marginTop: 24, height: 4, borderRadius: 2, background: '#1e293b', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#3b82f6', borderRadius: 2, width: `${Math.min(pollCount * 5, 95)}%`, transition: 'width 1s' }} />
            </div>
          </div>
        )}

        {status === 'provisioned' && data && (
          <div style={{ background: '#0c1535', borderRadius: 20, padding: '48px 32px', border: '1px solid #15803d' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#15803d22', border: '2px solid #15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, margin: '0 auto 16px', fontSize: 18, fontWeight: 700, color: '#15803d' }}>تم</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>تم إنشاء حسابك بنجاح!</h2>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 32px' }}>
              {data.admin_email ? `تم إرسال بيانات الدخول إلى ${data.admin_email}` : 'يمكنك تسجيل الدخول الآن'}
            </p>

            <div style={{ background: '#05081a', borderRadius: 14, padding: '20px 24px', textAlign: 'right', marginBottom: 24 }}>
              {[
                { l: 'الشركة', v: data.company_name },
                { l: 'المعرّف', v: data.company_slug },
                { l: 'رقم الدخول', v: data.admin_phone },
                { l: 'رابط لوحة التحكم', v: data.login_url || `app.liv-entra.com/${data.company_slug}` },
              ].map(item => (
                <div key={item.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>{item.l}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', direction: 'ltr' }}>{item.v}</span>
                </div>
              ))}
            </div>

            <a href={data.login_url || `https://app.liv-entra.com/${data.company_slug}`}
              style={{
                display: 'inline-block', padding: '14px 40px', borderRadius: 12,
                background: '#3b82f6', color: '#fff', fontSize: 16, fontWeight: 700,
                textDecoration: 'none',
              }}>
              دخول لوحة التحكم
            </a>
          </div>
        )}

        {status === 'pending' && (
          <div style={{ background: '#0c1535', borderRadius: 20, padding: '48px 32px', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>الدفع قيد المعالجة</h2>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 16px' }}>
              تم استلام الدفع وجاري إعداد حسابك. ستصلك رسالة بريد إلكتروني ببيانات الدخول خلال دقائق.
            </p>
            <p style={{ fontSize: 12, color: '#64748b' }}>
              إذا لم تصلك الرسالة خلال 10 دقائق، تواصل مع الدعم.
            </p>
          </div>
        )}

        {status === 'failed' && (
          <div style={{ background: '#0c1535', borderRadius: 20, padding: '48px 32px', border: '1px solid #fecaca' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dc262622', border: '2px solid #dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, margin: '0 auto 16px', fontSize: 18, fontWeight: 700, color: '#dc2626' }}>×</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>فشل عملية الدفع</h2>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 24px' }}>
              لم تتم عملية الدفع. يمكنك المحاولة مرة أخرى أو التواصل مع الدعم.
            </p>
            <a href="/pricing" style={{
              display: 'inline-block', padding: '14px 32px', borderRadius: 12,
              background: '#3b82f6', color: '#fff', fontSize: 15, fontWeight: 700,
              textDecoration: 'none',
            }}>
              حاول مرة أخرى
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
