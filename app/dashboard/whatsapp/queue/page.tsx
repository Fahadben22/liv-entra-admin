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

const STATUS_COLORS: Record<string, { color: string; label: string }> = {
  pending: { color: '#d97706', label: 'معلق' },
  sent:    { color: '#16a34a', label: 'أُرسل' },
  failed:  { color: '#dc2626', label: 'فشل' },
};

export default function QueuePage() {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [stats, setStats] = useState<Stats>({ sentToday: 0, failedToday: 0, pending: 0, deliveryRate: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

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
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#fff', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid rgba(0,0,0,.06)' }}>
        <Link href="/dashboard" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 13 }}>← الرئيسية</Link>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>قائمة الإرسال</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>إشعارات واتساب — جميع الشركات</div>
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 12 }}>
          <Link href="/dashboard/conversations" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 12 }}>المحادثات</Link>
          <Link href="/dashboard/whatsapp/analytics" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 12 }}>التحليلات</Link>
          <Link href="/dashboard/whatsapp/settings" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 12 }}>الإعدادات</Link>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'أُرسل اليوم', value: stats.sentToday, color: '#16a34a' },
            { label: 'نسبة التسليم', value: `${stats.deliveryRate}%`, color: '#1a1a2e' },
            { label: 'فشل', value: stats.failedToday, color: '#dc2626' },
            { label: 'معلق', value: stats.pending, color: '#d97706' },
          ].map(card => (
            <div key={card.label} className="card" style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: card.color, marginBottom: 4 }}>{card.value}</div>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card" style={{ background: '#fff', borderRadius: 14, padding: '12px 20px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>الحالة:</span>
          {(['', 'pending', 'sent', 'failed'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '4px 12px', borderRadius: 7, border: '1px solid rgba(0,0,0,.08)', fontSize: 12, cursor: 'pointer',
                background: statusFilter === s ? '#7c5cfc' : '#f8f7fc',
                color: statusFilter === s ? '#fff' : '#6b7280' }}>
              {s === '' ? 'الكل' : STATUS_COLORS[s]?.label}
            </button>
          ))}
          <button onClick={loadQueue} style={{ marginRight: 'auto', padding: '4px 14px', borderRadius: 7, border: '1px solid rgba(0,0,0,.08)', fontSize: 12, cursor: 'pointer', background: '#f8f7fc', color: '#6b7280' }}>
            تحديث
          </button>
        </div>

        {/* Table */}
        <div className="card" style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>جاري التحميل...</div>
          ) : jobs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>لا توجد سجلات</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f7fc', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
                  {['النوع', 'المستلم', 'القالب', 'موعد الإرسال', 'الحالة', 'المحاولات', 'الخطأ', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 11, color: '#6b7280', fontWeight: 500, textAlign: 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => {
                  const sc = STATUS_COLORS[job.status] || STATUS_COLORS.pending;
                  return (
                    <tr key={job.id} style={{ borderBottom: '1px solid rgba(0,0,0,.04)', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#1a1a2e' }}>
                        {job.notification_type.replace(/_/g, ' ')}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: '#1a1a2e' }}>{job.recipient_phone}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>{job.template_name || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#9ca3af' }}>
                        {new Date(job.scheduled_for).toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, color: sc.color, fontWeight: 500 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, display: 'inline-block' }} />
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'center', color: '#9ca3af' }}>{job.attempts}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#dc2626', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job.error_message || '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {job.status === 'failed' && (
                          <button onClick={() => retry(job.id)} disabled={retrying === job.id}
                            style={{ background: '#f8f7fc', border: '1px solid rgba(0,0,0,.08)', color: '#d97706', fontSize: 11, padding: '3px 10px', borderRadius: 7, cursor: 'pointer' }}>
                            {retrying === job.id ? '...' : 'إعادة'}
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
