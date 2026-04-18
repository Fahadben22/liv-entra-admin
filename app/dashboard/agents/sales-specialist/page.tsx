'use client';
import AgentChat from '../AgentChat';
export default function SalesSpecialistPage() {
  return <AgentChat agentType="sales_specialist" agentName="عمر — متخصص مبيعات" agentIcon="message" accentColor="#22c55e" quickActions={['وش مهامي؟','الوحدات الشاغرة','تواصل مع عميل']} />;
}
