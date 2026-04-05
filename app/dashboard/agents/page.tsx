'use client';
import Link from 'next/link';

const AGENTS = [
  {
    type: 'it',
    name: 'مساعد تقنية المعلومات',
    nameEn: 'IT Agent',
    desc: 'مراقبة صحة النظام، تشخيص الأخطاء، تحليل الأمان',
    icon: '🛡️',
    color: '#1d4070',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    type: 'sales',
    name: 'مساعد المبيعات',
    nameEn: 'Sales Agent',
    desc: 'تتبع العملاء المحتملين، الاشتراكات، التحويلات',
    icon: '💼',
    color: '#15803d',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  {
    type: 'marketing',
    name: 'مساعد التسويق',
    nameEn: 'Marketing Agent',
    desc: 'تحليل قمع التحويل، مصادر العملاء، أداء الديمو',
    icon: '📊',
    color: '#9333ea',
    bg: '#faf5ff',
    border: '#d8b4fe',
  },
];

export default function AgentsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#05081a', direction: 'rtl', padding: '40px 24px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>وكلاء الذكاء الاصطناعي</h1>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>ثلاثة وكلاء متخصصين يعملون على بيانات Liventra الحية</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {AGENTS.map(agent => (
            <Link key={agent.type} href={`/dashboard/agents/${agent.type}`}
              style={{
                background: '#0c1535', borderRadius: 20, padding: '32px 24px',
                border: `1px solid rgba(255,255,255,.08)`, textDecoration: 'none',
                transition: 'all .15s',
              }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, background: agent.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, marginBottom: 20, border: `1px solid ${agent.border}`,
              }}>
                {agent.icon}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>{agent.name}</h3>
              <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 12px' }}>{agent.nameEn}</p>
              <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>{agent.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
