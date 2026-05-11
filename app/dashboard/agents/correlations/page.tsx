'use client';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';

interface Correlation {
  type: string;
  severity: string;
  agent_type: string;
  agent_family?: string;
  description: string;
  recommendation?: string;
  from_agent?: string;
  to_agent?: string;
  cycle_id?: string;
  delay_hours?: number;
  today_calls?: number;
  weekly_daily_avg?: number;
  spike_ratio?: number;
  cost_per_call?: number;
  total_spent?: number;
  total_calls?: number;
  corpus_id?: string;
  agents_involved?: string[];
  conflict_count?: number;
  unresolved?: number;
}

interface CorrelationsData {
  anomalies: Correlation[];
  handoff_delays: Correlation[];
  budget_efficiency: Correlation[];
  conflict_cascades: Correlation[];
  summary: {
    total_anomalies: number;
    critical_count: number;
    recommendation_count: number;
    generated_at: string;
  };
}

const SEVERITY_COLORS: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#fef2f2', color: '#dc2626' },
  warning: { bg: '#fffbeb', color: '#d97706' },
};

const TYPE_ICONS: Record<string, string> = {
  activity_spike: '⚡',
  inactivity: '💤',
  mass_correlation: '🔗',
  handoff_delay: '⏳',
  high_cost_per_action: '💰',
  conflict_cascade: '⚔️',
};

function CorrelationCard({ corr }: { corr: Correlation }) {
  const colors = SEVERITY_COLORS[corr.severity] || { bg: '#f8fafc', color: '#475569' };
  const icon = TYPE_ICONS[corr.type] || '🔍';

  return (
    <div style={{
      background: '#fff',
      border: '1px solid ' + (corr.severity === 'critical' ? '#fecaca' : '#e8ecf0'),
      borderRadius: 12,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 9, padding: '2px 8px', borderRadius: 10,
              background: colors.bg, color: colors.color, fontWeight: 700, textTransform: 'uppercase',
            }}>
              {corr.severity === 'critical' ? 'حرج' : 'تحذير'}
            </span>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
              {corr.agent_type}
              {corr.agent_family && corr.agent_family !== 'cross' && (
                <span style={{ marginRight: 4, color: '#64748b' }}>
                  ({corr.agent_family === 'ops' ? 'عمليات' : 'SaaS'})
                </span>
              )}
            </span>
            {corr.from_agent && corr.to_agent && (
              <span style={{ fontSize: 10, color: '#64748b' }}>
                {corr.from_agent} ← {corr.to_agent}
              </span>
            )}
          </div>

          <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: '0 0 4px' }}>
            {corr.description}
          </p>

          {/* Details */}
          {corr.spike_ratio && (
            <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 2px' }}>
              النشاط: {corr.today_calls} اليوم مقابل {corr.weekly_daily_avg} في المتوسط ({corr.spike_ratio}x)
            </p>
          )}
          {corr.delay_hours && (
            <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 2px' }}>
              التأخير: {corr.delay_hours} ساعة
            </p>
          )}
          {corr.cost_per_call && (
            <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 2px' }}>
              التكلفة: {corr.cost_per_call} ر.س/عملية
            </p>
          )}
          {corr.agents_involved && (
            <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 2px' }}>
              الوكلاء: {corr.agents_involved.join('، ')}
            </p>
          )}

          {/* Recommendation */}
          {corr.recommendation && (
            <div style={{
              marginTop: 8, padding: '6px 10px', borderRadius: 8,
              background: '#f0f9ff', fontSize: 11, color: '#0369a1',
            }}>
              توصية: {corr.recommendation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentCorrelationsPage() {
  const [data, setData] = useState<CorrelationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getCorrelations();
      setData((res as any)?.data || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load correlations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const allCorrelations = [
    ...(data?.anomalies || []),
    ...(data?.handoff_delays || []),
    ...(data?.budget_efficiency || []),
    ...(data?.conflict_cascades || []),
  ];

  const filteredCorrelations = allCorrelations.filter(c => {
    if (filterSeverity !== 'all' && c.severity !== filterSeverity) return false;
    if (tab === 'all') return true;
    if (tab === 'activity') return ['activity_spike', 'inactivity', 'mass_correlation'].includes(c.type);
    if (tab === 'handoff') return c.type === 'handoff_delay';
    if (tab === 'budget') return c.type === 'high_cost_per_action';
    if (tab === 'conflict') return c.type === 'conflict_cascade';
    return true;
  }).sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return 0;
  });

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px', direction: 'rtl' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>ارتباطات الوكلاء</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            كشف الأنماط غير الطبيعية عبر جميع الوكلاء — نشاط، تأخير، ميزانية، وتضارب
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#475569', opacity: loading ? .5 : 1 }}
        >
          {loading ? '...' : 'تحديث'}
        </button>
      </div>

      {/* Summary */}
      {data?.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'إجمالي الحالات', value: String(data.summary.total_anomalies), color: '#6366f1' },
            { label: 'حالات حرجة', value: String(data.summary.critical_count), color: '#ef4444' },
            { label: 'توصيات', value: String(data.summary.recommendation_count), color: '#10b981' },
            { label: 'آخر تحديث', value: new Date(data.summary.generated_at).toLocaleTimeString('ar-SA'), color: '#64748b' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: s.color, margin: '0 0 3px' }}>{loading ? '...' : s.value}</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Category breakdown */}
      {data && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20,
        }}>
          {[
            { type: 'activity', label: 'النشاط', count: data.anomalies.length, emoji: '⚡' },
            { type: 'handoff', label: 'التأخير في التسليم', count: data.handoff_delays.length, emoji: '⏳' },
            { type: 'budget', label: 'كفاءة الميزانية', count: data.budget_efficiency.length, emoji: '💰' },
            { type: 'conflict', label: 'تضارب المعرفة', count: data.conflict_cascades.length, emoji: '⚔️' },
          ].map(cat => (
            <button
              key={cat.type}
              onClick={() => setTab(tab === cat.type ? 'all' : cat.type)}
              style={{
                padding: '12px 16px', borderRadius: 12, border: '1px solid ' + (tab === cat.type || (tab === 'all' && cat.count > 0) ? '#6366f1' : '#e8ecf0'),
                background: tab === cat.type ? '#eef2ff' : '#fff',
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 20, display: 'block', marginBottom: 4 }}>{cat.emoji}</span>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>{cat.label}</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: cat.count > 0 ? '#6366f1' : '#94a3b8', margin: 0 }}>{cat.count}</p>
            </button>
          ))}
        </div>
      )}

      {/* Severity filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([
          ['all', 'الكل'],
          ['critical', 'حرج'],
          ['warning', 'تحذير'],
        ] as const).map(([key, label]: any) => (
          <button
            key={key}
            onClick={() => setFilterSeverity(key)}
            style={{
              padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: filterSeverity === key ? '#0f172a' : '#f1f5f9',
              color: filterSeverity === key ? '#fff' : '#475569',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: 16, borderRadius: 10, marginBottom: 16, background: '#fef2f2', color: '#dc2626', fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>جاري التحميل...</div>
      )}

      {/* Correlations grid */}
      {filteredCorrelations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredCorrelations.map((corr, idx) => (
            <CorrelationCard key={idx} corr={corr} />
          ))}
        </div>
      )}

      {!loading && filteredCorrelations.length === 0 && data && (
        <div style={{
          textAlign: 'center', padding: 60, color: '#94a3b8',
          background: '#f8fafc', borderRadius: 16,
        }}>
          <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>✅</span>
          <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>لا توجد مشاكل غير طبيعية</p>
          <p style={{ fontSize: 12, margin: 0 }}>جميع الوكلاء يعملون بكفاءة طبيعية</p>
        </div>
      )}
    </div>
  );
}
