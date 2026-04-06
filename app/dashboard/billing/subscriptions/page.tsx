'use client';
import { useEffect, useState } from 'react';
import { request } from '@/lib/api';
import { useBilling } from '../layout';
import { fmt, fmtDate, PLAN_AR, PLAN_C, lcOf } from '@/lib/billing-helpers';

export default function SubscriptionsPage() {
  const { companies, loading } = useBilling();

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: '#a1a1aa' }}>جاري التحميل...</div>;

  const safeCompanies = Array.isArray(companies) ? companies : [];

  // Group by lifecycle
  const active     = safeCompanies.filter(c => lcOf(c) === 'active');
  const trial      = safeCompanies.filter(c => lcOf(c) === 'trial');
  const overdue    = safeCompanies.filter(c => lcOf(c) === 'overdue');
  const suspended  = safeCompanies.filter(c => lcOf(c) === 'suspended');

  const STATUS_STYLES: Record<string, { label: string; color: string }> = {
    active:    { label: 'نشط',    color: '#16a34a' },
    trial:     { label: 'تجريبي', color: '#3b82f6' },
    overdue:   { label: 'متأخر',  color: '#c2410c' },
    suspended: { label: 'موقوف',  color: '#dc2626' },
  };

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 20px', color: '#18181b' }}>الاشتراكات</h2>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'نشطة', count: active.length, color: '#16a34a' },
          { label: 'تجريبية', count: trial.length, color: '#3b82f6' },
          { label: 'متأخرة', count: overdue.length, color: '#c2410c' },
          { label: 'موقوفة', count: suspended.length, color: '#dc2626' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 8, padding: '16px 24px', minWidth: 120, textAlign: 'center', border: '1px solid #e5e5e5' }}>
            <p style={{ fontSize: 24, fontWeight: 600, color: s.color, margin: 0 }}>{s.count}</p>
            <p style={{ fontSize: 11, color: '#a1a1aa', margin: '4px 0 0', fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Company list */}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
        {safeCompanies.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#a1a1aa', fontSize: 13 }}>لا توجد شركات</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {['الشركة', 'الخطة', 'الحالة', 'الفترة', 'الدورة'].map(h => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#a1a1aa', borderBottom: '1px solid #e5e5e5' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {safeCompanies.map((c, i) => {
                const status = lcOf(c);
                const ss = STATUS_STYLES[status] || STATUS_STYLES.active;
                const pc = PLAN_C[c.plan] || PLAN_C.basic;
                return (
                  <tr key={c.id} style={{ borderBottom: i < safeCompanies.length - 1 ? '1px solid #f0f0f0' : 'none', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '12px 18px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#18181b', margin: 0 }}>{c.name}</p>
                      {c.name_ar && c.name_ar !== c.name && <p style={{ fontSize: 10, color: '#a1a1aa', margin: 0 }}>{c.name_ar}</p>}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 7, background: pc.bg, color: pc.color, fontWeight: 600, border: `1px solid ${pc.border}` }}>
                        {PLAN_AR[c.plan] || c.plan}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, color: ss.color, fontWeight: 500 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.color, display: 'inline-block' }} />
                        {ss.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#71717a' }}>
                      {c.trial_ends_at && status === 'trial' ? `ينتهي ${fmtDate(c.trial_ends_at)}` : '—'}
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#71717a' }}>
                      شهري
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
