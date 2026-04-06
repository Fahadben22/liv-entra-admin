'use client';
import Link from 'next/link';

const AGENTS = [
  {
    type: 'it',
    name: 'سالم — المهندس الأول',
    nameEn: 'Salem · IT Engineer',
    desc: 'مراقبة صحة النظام، تشخيص الأخطاء، تحليل الأمان',
    motto: '"النظام السليم هو الذي لا يلاحظه أحد"',
    icon: '🛡️',
    color: '#3b82f6',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    type: 'sales',
    name: 'خالد — مستشار المبيعات',
    nameEn: 'Khaled · Sales Advisor',
    desc: 'تتبع العملاء المحتملين، الاشتراكات، إغلاق الصفقات',
    motto: '"العميل اللي ما تكلمه اليوم، منافسك يكلمه بكرة"',
    icon: '💼',
    color: '#22c55e',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  {
    type: 'marketing',
    name: 'نورة — محللة التسويق',
    nameEn: 'Noura · Marketing Analyst',
    desc: 'تحليل قمع التحويل، مصادر العملاء، الفرص التسويقية',
    motto: '"البيانات ما تكذب — بس لازم تعرف تقراها"',
    icon: '📊',
    color: '#8b5cf6',
    bg: '#faf5ff',
    border: '#d8b4fe',
  },
];

export default function AgentsPage() {
  return (
    <div style={{ background: '#fafafa', padding: '40px 24px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#18181b', margin: '0 0 8px', letterSpacing: '-0.02em' }}>وكلاء الذكاء الاصطناعي</h1>
          <p style={{ fontSize: 13, color: '#71717a', margin: 0 }}>ثلاثة وكلاء متخصصين يعملون على بيانات Liventra الحية</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {AGENTS.map(agent => (
            <Link key={agent.type} href={`/dashboard/agents/${agent.type}`}
              style={{
                background: '#fff', borderRadius: 8, padding: '32px 24px',
                border: '1px solid #e5e5e5', textDecoration: 'none',
                transition: 'all .15s',
              }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, background: agent.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, marginBottom: 20, border: `1px solid ${agent.border}`,
              }}>
                {agent.icon}
              </div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#18181b', margin: '0 0 4px' }}>{agent.name}</h3>
              <p style={{ fontSize: 11, color: '#a1a1aa', margin: '0 0 12px', fontWeight: 500 }}>{agent.nameEn}</p>
              <p style={{ fontSize: 13, color: '#3f3f46', lineHeight: 1.6, margin: '0 0 8px' }}>{agent.desc}</p>
              <p style={{ fontSize: 11, color: '#a1a1aa', fontStyle: 'italic', margin: 0 }}>{agent.motto}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
