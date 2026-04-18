'use client';
import AgentChat from '../AgentChat';
export default function ProductSpecialistPage() {
  return <AgentChat agentType="product_specialist" agentName="لينا — متخصصة منتج" agentIcon="search" accentColor="#06b6d4" quickActions={['وش مهامي؟','تذاكر الدعم','تبني الميزات','تفاعل الصفحات']} />;
}
