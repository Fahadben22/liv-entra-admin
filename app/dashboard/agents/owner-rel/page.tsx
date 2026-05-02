'use client';
import AgentChat from '../AgentChat';

export default function OwnerRelAgentPage() {
  return (
    <AgentChat
      agentType="owner_rel"
      agentName="نادية — مديرة علاقات الملاك"
      agentIcon="key"
      accentColor="#0ea5e9"
      quickActions={[
        'تسويات معلقة',
        'تقارير الملاك',
        'أداء العقارات',
        'كشف حساب مالك',
        'قلق مالك جديد',
      ]}
    />
  );
}
