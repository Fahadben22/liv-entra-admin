'use client';
import AgentChat from '../AgentChat';

export default function ITAgentPage() {
  return (
    <AgentChat
      agentType="it"
      agentName="سالم — المهندس الأول"
      agentIcon="shield"
      accentColor="#3b82f6"
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
