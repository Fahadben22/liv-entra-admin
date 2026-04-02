'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

interface Analytics {
  totalMessages: number;
  aiHandledPct: number;
  humanHandledPct: number;
  avgResponseMs: number;
  leadConversion: { company_id: string; whatsapp_leads: number; converted: number; conversion_rate: number }[];
  handledByRatio: { company_id: string; handled_by: string; total: number; pct: number }[];
  intentDistribution: { intent: string; count: number }[];
}

const INTENT_LABELS: Record<string, string> = {
  PAYMENT: 'دفع',
  MAINTENANCE: 'صيانة',
  LEAD_INQUIRY: 'استفسار عن وحدة',
  CONTRACT: 'عقد',
  OTP_REQUEST: 'رمز تحقق',
  EMERGENCY: 'طوارئ',
  OPT_OUT: 'إلغاء اشتراك',
  HUMAN_HANDOFF: 'طلب موظف',
  BALANCE_QUERY: 'رصيد',
  REPORT_REQUEST: 'تقرير',
  UNKNOWN: 'غير محدد',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      adminApi.wa.analytics(),
      adminApi.sa.listCompanies(),
    ]).then(([analyticsRes, companiesRes]) => {
      if (analyticsRes.status === 'fulfilled') setData((analyticsRes.value as any)?.data || null);
      if (companiesRes.status === 'fulfilled') {
        const list = (companiesRes.value as any)?.data || (companiesRes.value as any) || [];
        setCompanies(list);
      }
    }).finally(() => setLoading(false));
  }, []);

  function companyName(id: string) {
    return companies.find((c: any) => c.id === id)?.name || id.slice(0, 8);
  }

  const maxIntentCount = data ? Math.max(...data.intentDistribution.map(i => i.count), 1) : 1;

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', direction: 'rtl' }}>
      {/* Header */}
      <div style={{ background: '#1d4070', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/dashboard" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📊</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>تحليلات واتساب</div>
            <div style={{ fontSize: 11, color: '#93c5fd' }}>إحصائيات المنصة الكاملة</div>
          </div>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 8 }}>
          <Link href="/dashboard/conversations" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 12 }}>💬 المحادثات</Link>
          <Link href="/dashboard/whatsapp/queue" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 12 }}>📤 قائمة الإرسال</Link>
          <Link href="/dashboard/whatsapp/settings" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 12 }}>⚙️ الإعدادات</Link>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>جاري تحميل التحليلات...</div>
        ) : !data ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>لا توجد بيانات بعد</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'إجمالي الرسائل هذا الشهر', value: data.totalMessages.toLocaleString(), color: '#1d4070', icon: '💬' },
                { label: 'معالجة بالذكاء الاصطناعي', value: `${data.aiHandledPct}%`, color: '#16a34a', icon: '🤖' },
                { label: 'معالجة بشرياً', value: `${data.humanHandledPct}%`, color: '#7c3aed', icon: '👤' },
                { label: 'متوسط وقت الرد', value: data.avgResponseMs > 1000 ? `${(data.avgResponseMs / 1000).toFixed(1)}ث` : `${data.avgResponseMs}ms`, color: '#d97706', icon: '⚡' },
              ].map(card => (
                <div key={card.label} style={{ background: 'white', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px #0001' }}>
                  <div style={{ fontSize: 24 }}>{card.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: card.color, marginTop: 8 }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{card.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              {/* Intent Distribution */}
              <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px #0001' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>توزيع النوايا</div>
                {data.intentDistribution.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 13, padding: 20, textAlign: 'center' }}>لا توجد بيانات بعد</div>
                ) : data.intentDistribution.sort((a, b) => b.count - a.count).map(item => (
                  <div key={item.intent} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: '#475569' }}>{INTENT_LABELS[item.intent] || item.intent}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{item.count}</span>
                    </div>
                    <div style={{ background: '#f1f5f9', borderRadius: 4, height: 6 }}>
                      <div style={{ height: 6, borderRadius: 4, background: '#1d4070', width: `${(item.count / maxIntentCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* AI vs Human ratio */}
              <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px #0001' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>بوت مقابل موظف — حسب الشركة</div>
                {data.handledByRatio.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 13, padding: 20, textAlign: 'center' }}>لا توجد بيانات بعد</div>
                ) : Object.entries(
                    data.handledByRatio.reduce((acc, r) => {
                      if (!acc[r.company_id]) acc[r.company_id] = {};
                      acc[r.company_id][r.handled_by] = r.pct;
                      return acc;
                    }, {} as Record<string, Record<string, number>>)
                  ).map(([compId, ratio]) => (
                    <div key={compId} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>{companyName(compId)}</div>
                      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${ratio.bot || 0}%`, background: '#16a34a' }} title={`بوت ${ratio.bot || 0}%`} />
                        <div style={{ width: `${ratio.human || 0}%`, background: '#7c3aed' }} title={`موظف ${ratio.human || 0}%`} />
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 3, fontSize: 10, color: '#64748b' }}>
                        <span>🤖 {ratio.bot || 0}%</span>
                        <span>👤 {ratio.human || 0}%</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Lead conversion table */}
            <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px #0001' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>معدل تحويل العملاء المحتملين — واتساب</div>
              {data.leadConversion.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 }}>لا توجد بيانات بعد</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['الشركة', 'عملاء واتساب', 'تحولوا لعقد', 'معدل التحويل'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', fontSize: 12, color: '#64748b', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.leadConversion.map(row => (
                      <tr key={row.company_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>{companyName(row.company_id)}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>{row.whatsapp_leads}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>{row.converted}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>
                          <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                            {row.conversion_rate || 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
