'use client';
import OpsAgentPage from '../OpsAgentPage';

export default function OpsPage() {
  return (
    <OpsAgentPage
      agentType="ops"
      agentName="فارس — مدير العمليات"
      agentIcon="wrench"
      accentColor="#6366f1"
      quickActions={['تذاكر مفتوحة', 'انتهاك SLA', 'طلبات الشراء المعلقة', 'تقرير تكاليف الصيانة', 'الحالات الطارئة']}
    />
  );
}
