'use client';
import AgentChat from '../AgentChat';
export default function MeetingRoomPage() {
  return <AgentChat agentType="meeting_room" agentName="غرفة الاجتماعات" agentIcon="🏛️" accentColor="#7c5cfc" quickActions={['أعطيني نظرة شاملة على كل الأقسام','وش KPIs اليوم؟','أنشئ تقرير تنفيذي','وش الخطط النشطة؟','فيه مشاكل تحتاج انتباهي؟']} />;
}
