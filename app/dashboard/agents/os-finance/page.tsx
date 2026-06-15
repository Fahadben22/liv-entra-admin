'use client';
import OpsAgentPage from '../OpsAgentPage';

export default function OSFinancePage() {
  return (
    <OpsAgentPage
      agentType="os_finance"
      agentName="رضا — المراقب المالي"
      agentIcon="receipt"
      accentColor="#a855f7"
      quickActions={['صافي الدخل التشغيلي', 'الميزانية مقابل الفعلي', 'التدفق النقدي', 'تقرير رسوم الإدارة', 'إنشاء تقرير شهري']}
    />
  );
}
