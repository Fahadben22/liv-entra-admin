'use client';
import AgentChat from '../AgentChat';
export default function FinancePage() {
  return <AgentChat agentType="finance" agentName="ريم — مديرة المالية" agentIcon="💰" accentColor="#f59e0b" quickActions={['كم MRR الحالي؟','أعطيني تقرير الفواتير','وش المتأخرات؟','حالة بوابات الدفع','توقعات الإيرادات']} />;
}
