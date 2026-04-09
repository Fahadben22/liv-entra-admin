'use client';
import AgentChat from '../AgentChat';
export default function ITSpecialistPage() {
  return <AgentChat agentType="it_specialist" agentName="طارق — متخصص IT" agentIcon="🔧" accentColor="#3b82f6" quickActions={['وش مهامي؟','تقرير صحة النظام','أنماط الأخطاء','فحص شركة']} />;
}
