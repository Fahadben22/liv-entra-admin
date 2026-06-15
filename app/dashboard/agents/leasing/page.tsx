'use client';
import OpsAgentPage from '../OpsAgentPage';

export default function LeasingPage() {
  return (
    <OpsAgentPage
      agentType="leasing"
      agentName="سارة — مديرة التأجير"
      agentIcon="home"
      accentColor="#10b981"
      quickActions={['عقود تنتهي قريباً', 'وحدات شاغرة', 'حالة التأجير', 'تسجيلات إيجار معلقة', 'أنبوب العملاء المحتملين']}
    />
  );
}
