'use client';
import AgentChat from '../AgentChat';

export default function MarketingAgentPage() {
  return (
    <AgentChat
      agentType="marketing"
      agentName="نورة — محللة التسويق"
      agentIcon="📊"
      accentColor="#8b5cf6"
      quickActions={[
        'كيف أداء هذا الأسبوع؟',
        'ما نسبة التحويل؟',
        'ما أفضل مصدر للعملاء؟',
        'هل يوجد انخفاض في الطلبات؟',
        'اقترح تحسينات تسويقية',
      ]}
    />
  );
}
