'use client';
import AgentChat from '../AgentChat';

export default function LeasingAgentPage() {
  return (
    <AgentChat
      agentType="leasing"
      agentName="سارة — مديرة التأجير"
      agentIcon="home"
      accentColor="#10b981"
      quickActions={[
        'عقود تنتهي قريباً',
        'وحدات شاغرة',
        'حالة التأجير',
        'تسجيلات إيجار معلقة',
        'أنبوب العملاء المحتملين',
      ]}
    />
  );
}
