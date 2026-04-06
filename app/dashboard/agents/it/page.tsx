'use client';
import AgentChat from '../AgentChat';

export default function ITAgentPage() {
  return (
    <AgentChat
      agentType="it"
      agentName="سالم — المهندس الأول"
      agentIcon="🛡️"
      accentColor="#1d4070"
      quickActions={[
        'ما حالة النظام الآن؟',
        'هل يوجد أخطاء حرجة؟',
        'ما الأنماط المتكررة اليوم؟',
        'هل يوجد أحداث أمنية مشبوهة؟',
        'ما صحة كل شركة؟',
      ]}
    />
  );
}
