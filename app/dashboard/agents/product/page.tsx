'use client';
import AgentChat from '../AgentChat';
export default function ProductPage() {
  return <AgentChat agentType="product" agentName="يوسف — مدير المنتج" agentIcon="trending-up" accentColor="#06b6d4" quickActions={['تبني الميزات','تذاكر الدعم المفتوحة','تحليل المغادرة','مسار التجربة→الاشتراك','تقدير NPS']} />;
}
