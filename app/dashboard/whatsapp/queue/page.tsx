'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';

interface QueueJob {
  id: string;
  company_id: string;
  notification_type: string;
  recipient_phone: string;
  template_name: string | null;
  body: string | null;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface Stats {
  sentToday: number;
  failedToday: number;
  pending: number;
  deliveryRate: number;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#fef9c3', color: '#d97706', label: 'معلق' },
  sent:    { bg: '#dcfce7', color: '#16a34a', label: 'أُرسل' },
  failed:  { bg: '#fee2e2', color: '#dc2626', label: 'فشل' },
};

const TYPE_ICONS: Record<string, string> = {
  payment_reminder: '💳',
  maintenance_update: '🔧',
  contract_reminder: '📄',
  monthly_report: '📊',
  sla_breach_alert: '⚠️',
  default: '📨',
};

export default function QueuePage() {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [stats, setStats] = useState<Stats>({ sentToday: 0, failedToday: 0, pending: 0, deliveryRate: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadQueue() {
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res: any = await adminApi.wa.queue(params);
      setJobs(res?.data || []);
      if (res?.stats) setStats(res.stats);
    } catch { /* swallow */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
    clearInterval(pollRef.current);
    pollRef.current = setInterval(loadQueue, 30000);
    return () => clearInterval(pollRef.current);
  }, [statusFilter]);

  async function retry(id: string) {
    setRetrying(id);
    try {
      await adminApi.wa.retryNotification(id);
      await loadQueue();
    } catch { /* swallow */ } finally { setRetrying(null); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', direction: 'rtl' }}>
      {/* Header */}
      <div style={{ background: '#1d4070', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/dashboard" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📤</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>قائمة الإرسال</div>
            <div style={{ fontSize: 11, color: '#93c5fd' }}>إشعارات واتساب — جميع الشركات</div>
          </div>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 8 }}>
          <Link href="/dashboard/conversations" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 12 }}>💬 المحادثات</Link>
          <Link href="/dashboard/whatsapp/analytics" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 12 }}>📊 التحليلات</Link>
          <Link href="/dashboard/whatsapp/settings" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 12 }}>⚙️ الإعدادات</Link>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'أُرسل اليوم', value: stats.sentToday, color: '#16a34a', icon: '✅' },
            { label: 'نسبة التسليم', value: `${stats.deliveryRate}%`, color: '#1d4070', icon: '📬' },
            { label: 'فشل', value: stats.failedToday, color: '#dc2626', icon: '❌' },
            { label: 'معلق', value: stats.pending, color: '#d97706', icon: '⏳' },
          ].map(card => (
            <div key={card.label} style={{ background: 'white', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px #0001' }}>
              <div style={{ fontSize: 22 }}>{card.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: card.color, marginTop: 6 }}>{card.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ background: 'white', borderRadius: 10, padding: '12px 20px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 1px 3px #0001' }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>الحالة:</span>
          {(['', 'pending', 'sent', 'failed'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid', fontSize: 12, cursor: 'pointer',
                background: statusFilter === s ? '#1d4070' : 'white',
                color: statusFilter === s ? 'white' : '#64748b',
                borderColor: statusFilter === s ? '#1d4070' : '#e2e8f0' }}>
              {s === '' ? 'الكل' : STATUS_COLORS[s]?.label}
            </button>
          ))}
          <button onClick={loadQueue} style={{ marginRight: 'auto', padding: '4px 14px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, cursor: 'pointer', background: '#f8fafc', color: '#64748b' }}>
            🔄 تحديث
          </button>
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px #0001', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>جاري التحميل...</div>
          ) : jobs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>لا توجد سجلات</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['النوع', 'المستلم', 'القالب', 'موعد الإرسال', 'الحالة', 'المحاولات', 'الخطأ', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 11, color: '#64748b', fontWeight: 600, textAlign: 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => {
                  const sc = STATUS_COLORS[job.status] || STATUS_COLORS.pending;
                  const icon = TYPE_ICONS[job.notification_type] || TYPE_ICONS.default;
                  return (
                    <tr key={job.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}>
                        {icon} {job.notification_type.replace(/_/g, ' ')}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace' }}>{job.recipient_phone}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>{job.template_name || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748b' }}>
                        {new Date(job.scheduled_for).toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: sc.bg, color: sc.color, fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{sc.label}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center' }}>{job.attempts}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#dc2626', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job.error_message || '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {job.status === 'failed' && (
                          <button onClick={() => retry(job.id)} disabled={retrying === job.id}
                            style={{ background: '#fef9c3', border: '1px solid #fbbf24', color: '#d97706', fontSize: 11, padding: '3px 10px', borderRadius: 5, cursor: 'pointer' }}>
                            {retrying === job.id ? '...' : '🔄 إعادة'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
