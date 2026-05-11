'use client';
import { useState, useEffect, useCallback } from 'react';
import { request } from '@/lib/api';

interface AgentHealth {
  type: string;
  name: string;
  group: 'saas' | 'ops';
  status: 'healthy' | 'idle' | 'overloaded';
  last_observation_at: string | null;
  observations_24h: number;
  decisions_7d: number;
  pending_escalations: number;
  active_goals: number;
}

const STATUS_CONFIG = {
  healthy:    { label: 'نشط',      color: '#16a34a', bg: '#f0fdf4', dot: '#22c55e' },
  idle:       { label: 'خامل',     color: '#ca8a04', bg: '#fefce8', dot: '#eab308' },
  overloaded: { label: 'مثقل',     color: '#dc2626', bg: '#fef2f2', dot: '#ef4444' },
};

function timeAgo(ts: string | null) {
  if (!ts) return 'لم يعمل بعد';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (diff < 60)   return `منذ ${diff} دقيقة`;
  if (diff < 1440) return `منذ ${Math.floor(diff / 60)} ساعة`;
  return `منذ ${Math.floor(diff / 1440)} يوم`;
}

function ActivityBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: 4, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: '#6366f1', borderRadius: 4, transition: 'width .3s' }} />
    </div>
  );
}

function AgentCard({ agent, maxObs }: { agent: AgentHealth; maxObs: number }) {
  const st = STATUS_CONFIG[agent.status];
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e8ecf0',
      borderRadius: 14,
      padding: '18px 20px',
      position: 'relative',
    }}>
      {/* Status dot */}
      <div style={{
        position: 'absolute', top: 14, left: 14,
        width: 8, height: 8, borderRadius: '50%', background: st.dot,
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>{agent.name}</p>
          <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '.5px' }}>{agent.type}</p>
        </div>
        <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 700 }}>
          {st.label}
        </span>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {[
          { label: 'آخر مراقبة',   value: timeAgo(agent.last_observation_at) },
          { label: 'قرارات (7أيام)', value: String(agent.decisions_7d) },
          { label: 'تصعيدات معلقة', value: String(agent.pending_escalations), alert: agent.pending_escalations > 3 },
          { label: 'أهداف نشطة',   value: String(agent.active_goals) },
        ].map(s => (
          <div key={s.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
            <p style={{ fontSize: 9, color: '#94a3b8', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: (s as any).alert ? '#dc2626' : '#1e293b', margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Activity bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>ملاحظات آخر 24 ساعة</p>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#475569', margin: 0 }}>{agent.observations_24h}</p>
        </div>
        <ActivityBar value={agent.observations_24h} max={maxObs} />
      </div>
    </div>
  );
}

export default function AgentHealthPage() {
  const [agents, setAgents]   = useState<AgentHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup]     = useState<'all' | 'saas' | 'ops'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request('GET', '/admin/agents/health');
      setAgents((res as any)?.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = agents.filter(a => group === 'all' || a.group === group);
  const maxObs   = Math.max(...filtered.map(a => a.observations_24h), 1);

  const counts = {
    healthy:    agents.filter(a => a.status === 'healthy').length,
    idle:       agents.filter(a => a.status === 'idle').length,
    overloaded: agents.filter(a => a.status === 'overloaded').length,
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px', direction: 'rtl' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>صحة الوكلاء</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>مراقبة أداء جميع الوكلاء الـ 11 في الوقت الفعلي</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#475569', opacity: loading ? .5 : 1 }}
        >
          {loading ? 'جاري التحديث...' : 'تحديث'}
        </button>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'نشط',   value: counts.healthy,    color: '#16a34a' },
          { label: 'خامل',  value: counts.idle,       color: '#ca8a04' },
          { label: 'مثقل',  value: counts.overloaded, color: '#dc2626' },
        ].map(t => (
          <div key={t.label} style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 14, padding: '16px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: t.color, margin: '0 0 4px' }}>{loading ? '—' : t.value}</p>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{t.label}</p>
          </div>
        ))}
      </div>

      {/* Group filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['all', 'الكل'], ['saas', 'وكلاء SaaS'], ['ops', 'وكلاء العمليات']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setGroup(key)}
            style={{
              padding: '5px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: group === key ? '#0f172a' : '#f1f5f9',
              color:      group === key ? '#fff'    : '#475569',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Agent grid */}
      {loading && agents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>جاري التحميل...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map(agent => (
            <AgentCard key={agent.type} agent={agent} maxObs={maxObs} />
          ))}
        </div>
      )}
    </div>
  );
}
