'use client';
import AgentChat from '../AgentChat';

export default function CollectionsAgentPage() {
  return (
    <AgentChat
      agentType="collections"
      agentName="بدر — مدير التحصيل"
      agentIcon="dollar"
      accentColor="#f97316"
      quickActions={[
        'من المتأخرون؟',
        'تقرير التحص��ل',
        'خطط الدفع',
        'المتأخرون +30 يوم',
        'معدل التحصيل هذا ��لشهر',
      ]}
    />
  );
}
