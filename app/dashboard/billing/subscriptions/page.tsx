'use client';
import { useEffect, useState } from 'react';
import { request } from '@/lib/api';
import { useBilling } from '../layout';
import { fmt, fmtDate, PLAN_AR, PLAN_C, lcOf } from '@/lib/billing-helpers';

export default function SubscriptionsPage() {
  const { companies, loading } = useBilling();

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>جاري التحميل...</div>;

  const safeCompanies = Array.isArray(companies) ? companies : [];

  // Group by lifecycle
  const active     = safeCompanies.filter(c => lcOf(c) === 'active');
  const trial      = safeCompanies.filter(c => lcOf(c) === 'trial');
  const overdue    = safeCompanies.filter(c => lcOf(c) === 'overdue');
  const suspended  = safeCompanies.filter(c => lcOf(c) === 'suspended');

  const STATUS_STYLES: Record<string, { label: string; bg: string; color: string; border: string }> = {
    active:    { label: 'نشط',    bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    trial:     { label: 'تجريبي', bg: '#eff6ff', color: '#1d4070', border: '#bfdbfe' },
    overdue:   { label: 'متأخر',  bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
    suspended: { label: 'موقوف',  bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  };

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px' }}>الاشتراكات</h2>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'نشطة', count: active.length, color: '#15803d', bg: '#f0fdf4' },
          { label: 'تجريبية', count: trial.length, color: '#1d4070', bg: '#eff6ff' },
          { label: 'متأخرة', count: overdue.length, color: '#c2410c', bg: '#fff7ed' },
          { label: 'موقوفة', count: suspended.length, color: '#dc2626', bg: '#fef2f2' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '16px 24px', minWidth: 120, textAlign: 'center' }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color, margin: 0 }}>{s.count}</p>
            <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Company list */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {safeCompanies.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>لا توجد شركات</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['الشركة', 'الخطة', 'الحالة', 'الفترة', 'الدورة'].map(h => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {safeCompanies.map((c, i) => {
                const status = lcOf(c);
                const ss = STATUS_STYLES[status] || STATUS_STYLES.active;
                const pc = PLAN_C[c.plan] || PLAN_C.basic;
                return (
                  <tr key={c.id} style={{ borderBottom: i < safeCompanies.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <td style={{ padding: '12px 18px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: 0 }}>{c.name}</p>
                      {c.name_ar && c.name_ar !== c.name && <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>{c.name_ar}</p>}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: pc.bg, color: pc.color, fontWeight: 600, border: `1px solid ${pc.border}` }}>
                        {PLAN_AR[c.plan] || c.plan}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: ss.bg, color: ss.color, fontWeight: 600, border: `1px solid ${ss.border}` }}>
                        {ss.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>
                      {c.trial_ends_at && status === 'trial' ? `ينتهي ${fmtDate(c.trial_ends_at)}` : '—'}
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>
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
