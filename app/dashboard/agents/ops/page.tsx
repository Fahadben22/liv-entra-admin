'use client';
import AgentChat from '../AgentChat';

export default function OpsAgentPage() {
  return (
    <AgentChat
      agentType="ops"
      agentName="فارس — مدير العمليات"
      agentIcon="wrench"
      accentColor="#6366f1"
      quickActions={[
        'تذاكر مفتوحة',
        'انتهاك SLA',
        'طلبات الشراء المعلقة',
        'تقرير تكاليف الصيانة',
        'الحالات الطارئة',
      ]}
    />
  );
}
