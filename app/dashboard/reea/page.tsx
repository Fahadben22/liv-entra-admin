'use client';
import { useState, useEffect, useCallback } from 'react';
import { BASE } from '@/lib/api';
import Icon from '@/components/Icon';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AOMTask {
  id: string;
  goal: string;
  owner_agent: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'submitted' | 'working' | 'done' | 'failed' | 'blocked' | 'skipped';
  retry_count: number;
  company_id: string | null;
  notes: string | null;
  result: string | null;
  created_at: string;
  completed_at: string | null;
}

interface AOMInsight {
  id: string;
  category: string;
  subject: string;
  insight: string;
  confidence: number;
  times_confirmed: number;
  score_boost: number;
  action_triggered: boolean;
  last_seen: string;
}

interface Briefing {
  id: string;
  agent_type: string;
  summary: string;
  rounds_used?: number;
  created_at: string;
}

interface Metrics {
  resolution_rate: number;
  outcome_success_rate: number;
  avg_hours_to_close: number | null;
  tasks_today: number;
  by_agent: { agent: string; total: number; done: number }[];
}

interface AOMStatus {
  tasks: AOMTask[];
  summary: { total: number; done: number; failed: number; blocked: number; pending: number; working: number };
  insights: AOMInsight[];
  briefings: Briefing[];
  metrics: Metrics;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_COLORS: Record<string, string> = {
  done:      'bg-green-100 text-green-700',
  working:   'bg-blue-100 text-blue-700',
  submitted: 'bg-purple-100 text-purple-700',
  pending:   'bg-gray-100 text-gray-600',
  failed:    'bg-red-100 text-red-600',
  blocked:   'bg-orange-100 text-orange-600',
  skipped:   'bg-gray-100 text-gray-400',
};

const AGENT_LABELS: Record<string, string> = {
  leasing: 'التأجير', collections: 'التحصيل', ops: 'العمليات',
  'tenant-exp': 'تجربة المستأجر', 'owner-rel': 'علاقات الملاك',
  'os-finance': 'المالية', it: 'تقنية', sales: 'مبيعات',
  marketing: 'تسويق', finance: 'مالية SaaS', product: 'منتج',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)} د`;
  if (h < 24) return `${h} س`;
  return `${Math.floor(h / 24)} ي`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function REEADashboard() {
  const [data, setData] = useState<AOMStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [expandedBriefing, setExpandedBriefing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('reea_api_key') || '';
      const res = await fetch(`${BASE}/reea/aom/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل التحميل');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  if (error) return (
    <div className="p-6 text-red-600 bg-red-50 rounded-lg m-6">
      خطأ: {error} — تحقق من أن REEA_API_KEY مضبوط في Railway.
    </div>
  );

  if (!data) return null;

  const { tasks, summary, insights, briefings, metrics } = data;

  const filteredTasks = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (agentFilter !== 'all' && t.owner_agent !== agentFilter) return false;
    return true;
  });

  const activeTasks = tasks.filter(t => ['pending','submitted','working'].includes(t.status));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">REEA — مدير العمليات المستقل</h1>
          <p className="text-sm text-gray-500 mt-1">AOM · دورة كل 10 دقائق · تتبع كل 5 دقائق</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Icon name="refresh" size={14} />
          تحديث
        </button>
      </div>

      {/* Metrics bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="معدل الإنجاز" value={`${metrics.resolution_rate}%`} color="green" />
        <MetricCard label="نجاح النتائج" value={`${metrics.outcome_success_rate}%`} color="blue" />
        <MetricCard label="متوسط الإغلاق" value={metrics.avg_hours_to_close ? `${metrics.avg_hours_to_close}س` : '—'} color="purple" />
        <MetricCard label="مهام اليوم" value={String(metrics.tasks_today)} color="orange" />
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all',       label: `الكل (${summary.total})` },
          { key: 'pending',   label: `انتظار (${summary.pending})` },
          { key: 'working',   label: `جاري (${summary.working})` },
          { key: 'done',      label: `منجز (${summary.done})` },
          { key: 'failed',    label: `فشل (${summary.failed})` },
          { key: 'blocked',   label: `محجوب (${summary.blocked})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              statusFilter === f.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="mr-auto">
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1"
          >
            <option value="all">كل الوكلاء</option>
            {Object.entries(AGENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Active tasks banner */}
      {activeTasks.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-sm text-blue-700">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          {activeTasks.length} مهام نشطة الآن
        </div>
      )}

      {/* Main split: tasks + insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Task table — 2/3 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-800">المهام ({filteredTasks.length})</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
            {filteredTasks.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">لا توجد مهام بهذا الفلتر</div>
            )}
            {filteredTasks.map(task => (
              <div key={task.id} className="px-4 py-3">
                <div
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                >
                  <span className={`shrink-0 mt-0.5 text-xs px-2 py-0.5 rounded border font-medium ${PRIORITY_COLORS[task.priority]}`}>
                    {task.priority === 'critical' ? 'حرج' : task.priority === 'high' ? 'عالي' : task.priority === 'medium' ? 'متوسط' : 'منخفض'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-snug line-clamp-2">{task.goal}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}>
                        {task.status}
                      </span>
                      <span className="text-xs text-gray-400">{AGENT_LABELS[task.owner_agent] || task.owner_agent}</span>
                      {task.retry_count > 0 && (
                        <span className="text-xs text-orange-500">{task.retry_count} محاولة</span>
                      )}
                      <span className="text-xs text-gray-300 mr-auto">{timeAgo(task.created_at)}</span>
                    </div>
                  </div>
                </div>
                {expandedTask === task.id && (
                  <div className="mt-2 mr-16 text-xs text-gray-500 space-y-1 bg-gray-50 rounded-lg p-3">
                    <p><span className="font-medium">ID:</span> {task.id}</p>
                    {task.notes && <p><span className="font-medium">ملاحظات:</span> {task.notes}</p>}
                    {task.result && <p><span className="font-medium">النتيجة:</span> {task.result}</p>}
                    {task.company_id && <p><span className="font-medium">الشركة:</span> {task.company_id}</p>}
                    {task.completed_at && <p><span className="font-medium">أنجز في:</span> {new Date(task.completed_at).toLocaleString('ar-SA')}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Insights panel — 1/3 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800">الرؤى الاستراتيجية ({insights.length})</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
            {insights.length === 0 && (
              <div className="p-6 text-center text-gray-400 text-sm">لا توجد رؤى بعد — ستظهر بعد دورات AOM الأولى</div>
            )}
            {insights.map(ins => (
              <div key={ins.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                    {ins.category}
                  </span>
                  <div className="flex items-center gap-1">
                    {ins.score_boost > 0 && (
                      <span className="text-xs text-green-600 font-medium">+{ins.score_boost}</span>
                    )}
                    {ins.action_triggered && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">فعّل</span>
                    )}
                  </div>
                </div>
                <p className="text-xs font-medium text-gray-700">{ins.subject}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{ins.insight}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>تأكيد: {ins.times_confirmed}×</span>
                  <span>ثقة: {Math.round(ins.confidence * 100)}%</span>
                  <span className="mr-auto">{timeAgo(ins.last_seen)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Agent performance */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm">أداء الوكلاء</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {metrics.by_agent.filter(a => a.total > 0).map(a => {
            const rate = a.total > 0 ? Math.round(a.done / a.total * 100) : 0;
            return (
              <div key={a.agent} className="text-center p-2 rounded-lg bg-gray-50">
                <div className="text-sm font-semibold text-gray-800">{rate}%</div>
                <div className="text-xs text-gray-500 mt-0.5">{AGENT_LABELS[a.agent] || a.agent}</div>
                <div className="text-xs text-gray-400">{a.done}/{a.total}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cycle log */}
      {briefings.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800">سجل الدورات (آخر {briefings.length})</span>
          </div>
          <div className="divide-y divide-gray-50">
            {briefings.map(b => (
              <div key={b.id} className="px-4 py-3">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedBriefing(expandedBriefing === b.id ? null : b.id)}
                >
                  <div className="flex items-center gap-2">
                    <Icon name="robot" size={14} className="text-blue-500" />
                    <span className="text-xs text-gray-600">{new Date(b.created_at).toLocaleString('ar-SA')}</span>
                    {b.rounds_used && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{b.rounds_used} جولات</span>
                    )}
                  </div>
                  <Icon name={expandedBriefing === b.id ? 'chevron-up' : 'chevron-down'} size={12} className="text-gray-400" />
                </div>
                {expandedBriefing === b.id && b.summary && (
                  <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                    {b.summary}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    green:  'bg-green-50  border-green-200  text-green-700',
    blue:   'bg-blue-50   border-blue-200   text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  );
}
