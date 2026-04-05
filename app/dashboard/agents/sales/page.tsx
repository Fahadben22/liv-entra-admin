'use client';
import AgentChat from '../AgentChat';

export default function SalesAgentPage() {
  return (
    <AgentChat
      agentType="sales"
      agentName="مساعد المبيعات"
      agentIcon="💼"
      accentColor="#15803d"
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
