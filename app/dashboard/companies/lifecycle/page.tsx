'use client';
import { useState, useEffect } from 'react';
import { request } from '@/lib/api';
import Link from 'next/link';
import { AlertTriangle, CheckCircle, Clock, TrendingDown, RefreshCcw, Search } from 'lucide-react';

type PipelineCard = {
  id: string;
  name_ar: string;
  name_en: string;
  plan: string;
  sub_status: string;
  trial_ends_at: string | null;
  period_end: string | null;
  overdue_invoices: number;
  days_remaining: number | null;
  days_overdue: number | null;
};

const STAGE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  trial_active:        { label: 'تجريبي نشط',          color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  trial_expiring_soon: { label: 'ينتهي خلال 3 أيام',   color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  trial_expired:       { label: 'انتهت الفترة التجريبية', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  active:              { label: 'نشط',                  color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
  overdue:             { label: 'متأخر في السداد',       color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  suspended:           { label: 'موقوف',                color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  cancelled:           { label: 'ملغي',                 color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  other:               { label: 'أخرى',                 color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
};

const PLAN_LABEL: Record<string, string> = {
  trial: 'تجريبي', basic: 'أساسي', professional: 'احترافي', enterprise: 'متقدم',
};

function formatDays(n: number | null, suffix: string) {
  if (n === null) return '—';
  return `${Math.abs(n)} ${suffix}`;
}

function CompanyCard({ card, stage }: { card: PipelineCard; stage: string }) {
  const [busy, setBusy] = useState('');
  const meta = STAGE_META[stage] || STAGE_META.other;

  async function extendTrial() {
    setBusy('extend');
    try {
      await request('PATCH', `/admin/companies/${card.id}/extend-trial`, { days: 7 });
      window.location.reload();
    } catch { setBusy(''); }
  }

  return (
    <div style={{ background: 'white', border: `1px solid ${meta.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/dashboard/companies/${card.id}`} style={{ fontSize: 13, fontWeight: 700, color: '#1d4070', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {card.name_ar}
          </Link>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>
            {PLAN_LABEL[card.plan] || card.plan}
            {card.days_remaining !== null && stage === 'active' && ` · ${formatDays(card.days_remaining, 'يوم متبقي')}`}
            {card.days_remaining !== null && stage === 'trial_active' && ` · ${formatDays(card.days_remaining, 'يوم متبقي')}`}
            {card.days_overdue !== null && ` · متأخر ${card.days_overdue} يوم`}
            {card.overdue_invoices > 0 && ` · ${card.overdue_invoices} فاتورة متأخرة`}
          </p>
        </div>
        <div>
          {(stage === 'trial_active' || stage === 'trial_expiring_soon' || stage === 'trial_expired') && (
            <button onClick={extendTrial} disabled={busy === 'extend'} style={{ fontSize: 10, padding: '4px 10px', background: '#1d4070', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap' }}>
              {busy === 'extend' ? '...' : '+7 أيام'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineColumn({ stage, cards }: { stage: string; cards: PipelineCard[] }) {
  const meta = STAGE_META[stage] || STAGE_META.other;
  return (
    <div style={{ minWidth: 240, flex: '0 0 240px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
          {meta.label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>({cards.length})</span>
      </div>
      {cards.length === 0 ? (
        <div style={{ padding: '20px 12px', textAlign: 'center', color: '#9ca3af', fontSize: 12, border: '1px dashed #e5e7eb', borderRadius: 12 }}>
          لا توجد شركات
        </div>
      ) : (
        cards.map(c => <CompanyCard key={c.id} card={c} stage={stage} />)
      )}
    </div>
  );
}

function KpiTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
      <p style={{ fontSize: 24, fontWeight: 700, color, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4, margin: 0 }}>{label}</p>
    </div>
  );
}

export default function LifecycleDashboardPage() {
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [plan,    setPlan]    = useState('');

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (plan)   params.set('plan', plan);
      const res = await request<any>('GET', `/admin/companies/lifecycle?${params}`);
      setData(res.data || res);
    } catch { setData(null); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const pipeline = data?.pipeline || {};
  const counts   = data?.counts   || {};
  const stages   = Object.keys(STAGE_META);

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>دورة حياة الشركات</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, margin: 0 }}>نظرة شاملة على جميع الشركات المشتركة</p>
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
          <RefreshCcw style={{ width: 13, height: 13 }} />
          تحديث
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 24 }}>
        <KpiTile label="تجريبي نشط"    value={counts.trial_active || 0}        color="#3b82f6" />
        <KpiTile label="ينتهي قريباً"  value={counts.trial_expiring_soon || 0} color="#f59e0b" />
        <KpiTile label="نشط"           value={counts.active || 0}              color="#22c55e" />
        <KpiTile label="متأخر"         value={counts.overdue || 0}             color="#f97316" />
        <KpiTile label="موقوف"         value={counts.suspended || 0}           color="#dc2626" />
        <KpiTile label="ملغي"          value={counts.cancelled || 0}           color="#6b7280" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '7px 12px', flex: 1, minWidth: 200 }}>
          <Search style={{ width: 13, height: 13, color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث باسم الشركة..." style={{ border: 'none', outline: 'none', fontSize: 13, flex: 1, background: 'transparent' }} onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
        <select value={plan} onChange={e => { setPlan(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, background: 'white', cursor: 'pointer' }}>
          <option value="">جميع الخطط</option>
          <option value="trial">تجريبي</option>
          <option value="basic">أساسي</option>
          <option value="professional">احترافي</option>
          <option value="enterprise">متقدم</option>
        </select>
        <button onClick={load} style={{ padding: '8px 18px', background: '#1d4070', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          بحث
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>جاري التحميل...</div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>فشل تحميل البيانات</div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 20 }}>
          <div style={{ display: 'flex', gap: 16, minWidth: 'max-content', alignItems: 'flex-start' }}>
            {stages.map(stage => (
              <PipelineColumn key={stage} stage={stage} cards={pipeline[stage] || []} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
