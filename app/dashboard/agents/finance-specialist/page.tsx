'use client';
import AgentChat from '../AgentChat';
export default function FinanceSpecialistPage() {
  return <AgentChat agentType="finance_specialist" agentName="ماجد — متخصص مالي" agentIcon="📋" accentColor="#f59e0b" quickActions={['وش مهامي؟','تقرير الفواتير','المتأخرات','المصروفات']} />;
}
