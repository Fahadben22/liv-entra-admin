'use client';
import AgentChat from '../AgentChat';

export default function MarketingAgentPage() {
  return (
    <AgentChat
      agentType="marketing"
      agentName="مساعد التسويق"
      agentIcon="📊"
      accentColor="#9333ea"
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
