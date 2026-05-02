'use client';
import AgentChat from '../AgentChat';

export default function TenantExpAgentPage() {
  return (
    <AgentChat
      agentType="tenant_exp"
      agentName="لينا — مديرة تجربة المستأجرين"
      agentIcon="users"
      accentColor="#ec4899"
      quickActions={[
        'تجديدات قادمة',
        'شكاوى مفتوحة',
        'إرسال إعلان',
        'المستأجرون المنتهية عقودهم',
        'مؤشرات رضا المستأجرين',
      ]}
    />
  );
}
