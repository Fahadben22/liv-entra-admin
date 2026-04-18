'use client';
import AgentChat from '../AgentChat';

export default function SalesAgentPage() {
  return (
    <AgentChat
      agentType="sales"
      agentName="خالد — مستشار المبيعات"
      agentIcon="briefcase"
      accentColor="#22c55e"
      quickActions={[
        'اعرض خط أنابيب المبيعات',
        'من يحتاج متابعة عاجلة؟',
        'كم MRR الحالي؟',
        'ما التجارب المنتهية قريباً؟',
        'ما أفضل عميل للتحويل؟',
      ]}
    />
  );
}
