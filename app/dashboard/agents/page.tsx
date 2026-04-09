'use client';
import Link from 'next/link';

const MANAGERS = [
  { type: 'it', name: 'سالم', role: 'مدير IT', nameEn: 'Salem · IT Manager', desc: 'أمان النظام، البنية التحتية، Cloudflare، الأداء', icon: '🛡️', color: '#3b82f6', bg: 'rgba(59,130,246,.08)', border: 'rgba(59,130,246,.2)', specialist: { type: 'it-specialist', name: 'طارق', role: 'متخصص IT' }, tools: 23 },
  { type: 'sales', name: 'خالد', role: 'مدير المبيعات', nameEn: 'Khaled · Sales Manager', desc: 'العملاء المحتملين، الاشتراكات، التواصل، الصفقات', icon: '💼', color: '#22c55e', bg: 'rgba(34,197,94,.08)', border: 'rgba(34,197,94,.2)', specialist: { type: 'sales-specialist', name: 'عمر', role: 'متخصص مبيعات' }, tools: 12 },
  { type: 'marketing', name: 'نورة', role: 'مديرة التسويق', nameEn: 'Noura · Marketing Manager', desc: 'التحويل، المصادر، الحملات، الزوار', icon: '📊', color: '#8b5cf6', bg: 'rgba(139,92,246,.08)', border: 'rgba(139,92,246,.2)', specialist: { type: 'marketing-specialist', name: 'سارة', role: 'متخصصة تسويق' }, tools: 10 },
  { type: 'finance', name: 'ريم', role: 'مديرة المالية', nameEn: 'Reem · Finance Manager', desc: 'الإيرادات، الفواتير، المصروفات، التوقعات', icon: '💰', color: '#f59e0b', bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.2)', specialist: { type: 'finance-specialist', name: 'ماجد', role: 'متخصص مالي' }, tools: 17 },
  { type: 'product', name: 'يوسف', role: 'مدير المنتج', nameEn: 'Yousef · Product Manager', desc: 'الميزات، التذاكر، المغادرة، التبني، NPS', icon: '🚀', color: '#06b6d4', bg: 'rgba(6,182,212,.08)', border: 'rgba(6,182,212,.2)', specialist: { type: 'product-specialist', name: 'لينا', role: 'متخصصة منتج' }, tools: 17 },
];

export default function AgentsPage() {
  return (
    <div style={{ padding: '32px 24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '0 0 6px' }}>فريق الذكاء الاصطناعي</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>5 مدراء · 5 متخصصين · غرفة اجتماعات — يعملون على بيانات Liventra الحية</p>
        </div>

        {/* Meeting Room — full width */}
        <Link href="/dashboard/agents/meeting-room" className="card"
          style={{ display: 'block', background: 'linear-gradient(135deg, #1a1a2e, #2d1b69)', borderRadius: 16, padding: '24px 28px', marginBottom: 24, textDecoration: 'none', border: '1px solid rgba(124,92,252,.3)', transition: 'all .15s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(124,92,252,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: '1px solid rgba(124,92,252,.3)' }}>🏛️</div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>غرفة الاجتماعات</h2>
              <p style={{ fontSize: 12, color: '#a78bfa', margin: 0 }}>جميع المدراء يناقشون معاً — تقارير تنفيذية — قرارات تحتاج موافقتك</p>
            </div>
            <div style={{ fontSize: 11, color: '#7c5cfc', background: 'rgba(124,92,252,.15)', padding: '4px 12px', borderRadius: 8, fontWeight: 600 }}>5 أقسام</div>
          </div>
        </Link>

        {/* Managers Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {MANAGERS.map(m => (
            <div key={m.type} className="card" style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(0,0,0,.06)' }}>
              {/* Manager */}
              <Link href={`/dashboard/agents/${m.type}`} style={{ display: 'block', padding: '22px 20px 16px', textDecoration: 'none', transition: 'background .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: `1px solid ${m.border}` }}>{m.icon}</div>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>{m.name}</h3>
                    <p style={{ fontSize: 11, color: m.color, margin: 0, fontWeight: 600 }}>{m.role}</p>
                  </div>
                  <span style={{ marginRight: 'auto', fontSize: 10, color: '#9ca3af', background: '#f8f7fc', padding: '2px 8px', borderRadius: 6 }}>{m.tools} أداة</span>
                </div>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>{m.desc}</p>
              </Link>
              {/* Specialist link */}
              <Link href={`/dashboard/agents/${m.specialist.type}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderTop: '1px solid rgba(0,0,0,.04)', textDecoration: 'none', background: '#fafafa', transition: 'background .15s' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, opacity: .5 }} />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{m.specialist.name} — {m.specialist.role}</span>
                <span style={{ marginRight: 'auto', fontSize: 10, color: '#d1d5db' }}>←</span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
