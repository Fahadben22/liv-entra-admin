'use client';
import OpsAgentPage from '../OpsAgentPage';

export default function CollectionsAgentPage() {
  return (
    <OpsAgentPage
      agentType="collections"
      agentName="بدر — مدير التحصيل"
      agentIcon="dollar"
      accentColor="#f97316"
      quickActions={['من المتأخرون؟', 'تقرير التحصيل', 'خطط الدفع', 'المتأخرون +30 يوم', 'معدل التحصيل هذا الشهر']}
    />
  );
}
