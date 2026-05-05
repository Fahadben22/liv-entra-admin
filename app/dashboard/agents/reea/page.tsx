'use client';
import AgentChat from '../AgentChat';

export default function REEAAgentPage() {
  return (
    <AgentChat
      agentType="reea"
      agentName="REEA — المدير التنفيذي"
      agentIcon="robot"
      accentColor="#7c3aed"
      quickActions={[
        'ما حالة المحفظة العقارية الآن؟',
        'هل توجد مهام معلقة تحتاج قراراً؟',
        'ما آخر ردود الوكلاء؟',
        'فحص حالة الوكلاء الـ 11 الآن',
        'ما الأهداف الاستراتيجية النشطة؟',
        'هل يوجد تنبيهات حرجة تحتاج تصعيداً لفهد؟',
      ]}
    />
  );
}
