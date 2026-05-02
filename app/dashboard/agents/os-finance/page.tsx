'use client';
import AgentChat from '../AgentChat';

export default function OSFinanceAgentPage() {
  return (
    <AgentChat
      agentType="os_finance"
      agentName="رضا — المراقب المالي"
      agentIcon="receipt"
      accentColor="#a855f7"
      quickActions={[
        'صافي الدخل التشغيلي',
        'الميزانية مقابل الفعلي',
        'التدفق النقدي',
        'تقرير رسوم الإدارة',
        'إنشاء تقرير شهري',
      ]}
    />
  );
}
