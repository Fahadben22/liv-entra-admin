'use client';
import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api';
import { Clock, Shield, ToggleLeft, ToggleRight, Save, RefreshCw } from 'lucide-react';

interface AgentSchedule {
  id: string;
  agent_type: string;
  display_name: string;
  work_start: number;
  work_end: number;
  max_daily_cycles: number;
  emergency_override: boolean;
  is_active: boolean;
  updated_at: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function fmt(h: number) {
  return `${String(h).padStart(2, '0')}:00`;
}

function ScheduleRow({ sched, onSave }: { sched: AgentSchedule; onSave: (s: AgentSchedule) => Promise<void> }) {
  const [local, setLocal] = useState(sched);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function set(key: keyof AgentSchedule, val: any) {
    setLocal(p => ({ ...p, [key]: val }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    await onSave(local);
    setDirty(false);
    setSaving(false);
  }

  const workHours = local.work_end - local.work_start;

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${local.is_active ? 'var(--border)' : '#fecaca'}`,
      borderRadius: 14,
      padding: '16px 20px',
      opacity: local.is_active ? 1 : 0.6,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => set('is_active', !local.is_active)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: local.is_active ? '#10b981' : '#9ca3af', display: 'flex' }}
          >
            {local.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </button>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{local.display_name}</p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{local.agent_type}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Emergency override badge */}
          <button
            onClick={() => set('emergency_override', !local.emergency_override)}
            title="تجاوز الجدول عند تنبيه حرج"
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20,
              border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
              background: local.emergency_override ? '#fef3c7' : 'var(--bg)',
              color: local.emergency_override ? '#d97706' : 'var(--text-muted)',
            }}
          >
            <Shield size={11} />
            طوارئ {local.emergency_override ? 'مفعّل' : 'معطّل'}
          </button>

          {/* Save button */}
          {dirty && (
            <button
              onClick={save}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 14px', borderRadius: 8,
                border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: '#6366f1', color: '#fff', opacity: saving ? .6 : 1,
              }}
            >
              {saving ? <RefreshCw size={11} /> : <Save size={11} />}
              {saving ? 'حفظ...' : 'حفظ'}
            </button>
          )}
        </div>
      </div>

      {/* Timeline bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ position: 'relative', height: 28, background: 'var(--bg)', borderRadius: 8, overflow: 'hidden' }}>
          {/* Inactive zones */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 0,
            width: `${(local.work_start / 24) * 100}%`,
            background: '#f1f5f9',
          }} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0, right: 0,
            width: `${((24 - local.work_end) / 24) * 100}%`,
            background: '#f1f5f9',
          }} />
          {/* Active zone */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${(local.work_start / 24) * 100}%`,
            width: `${(workHours / 24) * 100}%`,
            background: local.is_active ? 'linear-gradient(90deg, #6366f1, #8b5cf6)' : '#9ca3af',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>
              {fmt(local.work_start)} – {fmt(local.work_end)} ({workHours}h)
            </span>
          </div>
          {/* Hour markers */}
          {[6, 12, 18].map(h => (
            <div key={h} style={{
              position: 'absolute', top: 0, bottom: 0, left: `${(h / 24) * 100}%`,
              width: 1, background: 'rgba(0,0,0,.1)',
            }} />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>بداية الوردية</p>
          <select
            value={local.work_start}
            onChange={e => set('work_start', Number(e.target.value))}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--bg)', color: 'var(--text-1)' }}
          >
            {HOURS.filter(h => h < local.work_end).map(h => (
              <option key={h} value={h}>{fmt(h)}</option>
            ))}
          </select>
        </div>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>نهاية الوردية</p>
          <select
            value={local.work_end}
            onChange={e => set('work_end', Number(e.target.value))}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--bg)', color: 'var(--text-1)' }}
          >
            {HOURS.filter(h => h > local.work_start).map(h => (
              <option key={h} value={h}>{fmt(h)}</option>
            ))}
          </select>
        </div>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>أقصى دورات يومية</p>
          <input
            type="number"
            min={1}
            max={200}
            value={local.max_daily_cycles}
            onChange={e => set('max_daily_cycles', Number(e.target.value))}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--bg)', color: 'var(--text-1)', boxSizing: 'border-box' }}
          />
        </div>
      </div>
    </div>
  );
}

export default function AgentSchedulesPage() {
  const [schedules, setSchedules] = useState<AgentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getSchedules()
      .then((r: any) => setSchedules(r?.data || []))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(updated: AgentSchedule) {
    const res: any = await adminApi.updateSchedule(updated.agent_type, {
      work_start: updated.work_start,
      work_end: updated.work_end,
      max_daily_cycles: updated.max_daily_cycles,
      emergency_override: updated.emergency_override,
      is_active: updated.is_active,
    });
    if (res?.data) {
      setSchedules(prev => prev.map(s => s.agent_type === updated.agent_type ? res.data : s));
    }
  }

  const activeCount = schedules.filter(s => s.is_active).length;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px', direction: 'rtl' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>ورديات الوكلاء</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
            حدّد ساعات عمل كل وكيل وعدد الدورات اليومية — الوكلاء لا يعملون خارج الوردية
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ textAlign: 'center', padding: '8px 16px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#10b981' }}>{activeCount}</p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>نشط</p>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 16px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#9ca3af' }}>{schedules.length - activeCount}</p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>موقوف</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, padding: '10px 16px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>ساعات العمل</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: '#f1f5f9', border: '1px solid var(--border)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>خارج الوردية (لا يعمل)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={12} color="#d97706" />
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>طوارئ = يعمل عند تنبيه حرج حتى خارج الوقت</span>
        </div>
      </div>

      {error && (
        <div style={{ padding: 16, borderRadius: 10, marginBottom: 16, background: '#fef2f2', color: '#dc2626', fontSize: 12 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>جاري التحميل...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {schedules.map(s => (
            <ScheduleRow key={s.agent_type} sched={s} onSave={handleSave} />
          ))}
        </div>
      )}
    </div>
  );
}
