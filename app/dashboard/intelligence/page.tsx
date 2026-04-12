'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { colors, fontSize, fontWeight, radius, shadow, spacing, styles, transition } from '@/lib/design-tokens';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | string | undefined | null): string {
  return Number(n || 0).toLocaleString('en-US');
}
function fmtSAR(n: number | string | undefined | null): string {
  return Number(n || 0).toLocaleString('en-US') + ' SAR';
}
function pct(n: number | string | undefined | null): string {
  return Number(n || 0) + '%';
}

const TABS = [
  { key: 'overview',    label: 'نظرة عامة' },
  { key: 'financial',   label: 'المالية' },
  { key: 'performance', label: 'الأداء' },
  { key: 'compliance',  label: 'الامتثال' },
  { key: 'risk',        label: 'المخاطر' },
  { key: 'vacancy',     label: 'الشغور' },
  { key: 'alerts',      label: 'التنبيهات' },
  { key: 'quality',     label: 'جودة البيانات' },
] as const;

type TabKey = typeof TABS[number]['key'];

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, any>>({});

  const loadTab = useCallback(async (t: TabKey) => {
    setLoading(true);
    try {
      const api = adminApi.sa.intel;
      let result: any;
      switch (t) {
        case 'overview':    result = await api.overview(); break;
        case 'financial':   result = await api.financial(); break;
        case 'performance': result = await api.performance(); break;
        case 'compliance':  result = await api.compliance(); break;
        case 'risk':        result = await api.risk(); break;
        case 'vacancy':     result = await api.vacancy(); break;
        case 'alerts':      result = await api.alerts(); break;
        case 'quality':     result = await api.dataQuality(); break;
      }
      setData(prev => ({ ...prev, [t]: result?.data }));
    } catch (err) {
      console.error(`[Intel] Failed to load ${t}`, err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

  const Spinner = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid #DBEAFE', borderTopColor: '#2563EB', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.text.primary, margin: 0 }}>
          الذكاء العقاري
        </h1>
        <p style={{ fontSize: fontSize.md, color: colors.text.secondary, margin: '4px 0 0' }}>
          تحليلات المنصة الشاملة عبر جميع الشركات
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: `2px solid ${colors.border.default}`, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px',
              fontSize: fontSize.md,
              fontWeight: tab === t.key ? fontWeight.semi : fontWeight.medium,
              color: tab === t.key ? colors.accent.primary : colors.text.secondary,
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.key ? `2px solid ${colors.accent.primary}` : '2px solid transparent',
              cursor: 'pointer',
              transition: transition.fast,
              whiteSpace: 'nowrap',
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? <Spinner /> : (
        <>
          {tab === 'overview'    && <OverviewTab data={data.overview} />}
          {tab === 'financial'   && <FinancialTab data={data.financial} />}
          {tab === 'performance' && <PerformanceTab data={data.performance} />}
          {tab === 'compliance'  && <ComplianceTab data={data.compliance} />}
          {tab === 'risk'        && <RiskTab data={data.risk} />}
          {tab === 'vacancy'     && <VacancyTab data={data.vacancy} />}
          {tab === 'alerts'      && <AlertsTab data={data.alerts} />}
          {tab === 'quality'     && <QualityTab data={data.quality} />}
        </>
      )}
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...styles.card, padding: '18px 20px', flex: '1 1 200px', minWidth: 180 }}>
      <div style={{ fontSize: fontSize.sm, color: colors.text.secondary, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: color || colors.text.primary }}>{value}</div>
      {sub && <div style={{ fontSize: fontSize.xs, color: colors.text.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ScoreBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const bg = score >= 80 ? colors.status.successBg : score >= 60 ? colors.status.warningBg : colors.status.errorBg;
  const fg = score >= 80 ? colors.status.success : score >= 60 ? colors.status.warning : colors.status.error;
  const sz = size === 'sm' ? { fontSize: fontSize.xs, padding: '2px 8px' } : { fontSize: fontSize.sm, padding: '4px 12px' };
  return (
    <span style={{ ...sz, borderRadius: radius.sm, background: bg, color: fg, fontWeight: fontWeight.semi }}>
      {score}%
    </span>
  );
}

function SeverityDot({ level }: { level: string }) {
  const c = level === 'critical' ? '#DC2626' : level === 'high' ? '#F97316' : level === 'medium' ? '#D97706' : '#16A34A';
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />;
}

function DataTable({ columns, rows }: { columns: { key: string; label: string; render?: (v: any, row: any) => React.ReactNode }[]; rows: any[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fontSize.md }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${colors.border.default}` }}>
            {columns.map(c => (
              <th key={c.key} style={{ textAlign: 'right', padding: '10px 12px', color: colors.text.secondary, fontWeight: fontWeight.semi, fontSize: fontSize.sm, whiteSpace: 'nowrap' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${colors.border.subtle}`, transition: transition.fast }}
                onMouseEnter={e => (e.currentTarget.style.background = colors.bg.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {columns.map(c => (
                <td key={c.key} style={{ padding: '10px 12px', color: colors.text.primary }}>
                  {c.render ? c.render(row[c.key], row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab 1: Overview ────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: any }) {
  if (!data) return <EmptyMsg />;
  const { financial, occupancy, operations, risk, lifecycle } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Financial KPIs */}
      <Section title="المالية">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <KPICard label="الإيرادات (هذا الشهر)" value={fmtSAR(financial?.total_revenue)} color={colors.status.success} />
          <KPICard label="المصاريف (هذا الشهر)" value={fmtSAR(financial?.total_expenses)} color={colors.status.error} />
          <KPICard label="صافي الدخل" value={fmtSAR(financial?.net_income)} color={Number(financial?.net_income) >= 0 ? colors.status.success : colors.status.error} />
          <KPICard label="المتأخرات" value={fmtSAR(financial?.total_overdue)} color={colors.status.warning} />
          <KPICard label="معدل التحصيل" value={pct(financial?.collection_rate)} color={colors.accent.primary} />
        </div>
      </Section>

      {/* Occupancy */}
      <Section title="الإشغال">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <KPICard label="إجمالي الوحدات" value={fmt(occupancy?.total_units)} />
          <KPICard label="مشغولة" value={fmt(occupancy?.occupied_units)} color={colors.status.success} />
          <KPICard label="شاغرة" value={fmt(occupancy?.vacant_units)} color={colors.status.warning} />
          <KPICard label="نسبة الإشغال" value={pct(occupancy?.occupancy_rate)} color={colors.accent.primary} />
        </div>
      </Section>

      {/* Operations */}
      <Section title="العمليات">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <KPICard label="الشركات" value={fmt(operations?.total_companies)} />
          <KPICard label="العقود النشطة" value={fmt(operations?.active_contracts)} />
          <KPICard label="طلبات الصيانة المفتوحة" value={fmt(operations?.open_tickets)} color={operations?.open_tickets > 10 ? colors.status.warning : undefined} />
          <KPICard label="المستأجرون" value={fmt(operations?.total_tenants)} />
        </div>
      </Section>

      {/* Risk + Lifecycle */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...styles.card, padding: 20, flex: '1 1 300px' }}>
          <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semi, color: colors.text.primary, margin: '0 0 12px' }}>المخاطر</h3>
          <div style={{ display: 'flex', gap: 16 }}>
            <RiskPill label="حرج" count={risk?.critical || 0} color="#DC2626" bg="#FEF2F2" />
            <RiskPill label="عالي" count={risk?.high || 0} color="#F97316" bg="#FFF7ED" />
          </div>
        </div>
        <div style={{ ...styles.card, padding: 20, flex: '1 1 300px' }}>
          <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semi, color: colors.text.primary, margin: '0 0 12px' }}>دورة الحياة</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(lifecycle || {}).map(([k, v]) => (
              <span key={k} style={{ fontSize: fontSize.sm, padding: '4px 12px', borderRadius: radius.sm, background: k === 'active' ? '#F0FDF4' : k === 'trial' ? '#FFFBEB' : k === 'suspended' ? '#FEF2F2' : '#F1F5F9', color: k === 'active' ? '#16A34A' : k === 'trial' ? '#D97706' : k === 'suspended' ? '#DC2626' : '#64748B', fontWeight: fontWeight.semi }}>
                {k === 'active' ? 'نشط' : k === 'trial' ? 'تجريبي' : k === 'overdue' ? 'متأخر' : k === 'suspended' ? 'موقوف' : k}: {String(v)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskPill({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: fontSize.md, fontWeight: fontWeight.semi, color }}>{count}</span>
      <span style={{ fontSize: fontSize.sm, color: colors.text.secondary }}>{label}</span>
    </div>
  );
}

// ─── Tab 2: Financial ───────────────────────────────────────────────────────

function FinancialTab({ data }: { data: any }) {
  if (!data) return <EmptyMsg />;
  const { companies, totals } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Totals */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <KPICard label="إجمالي الإيرادات" value={fmtSAR(totals?.total_revenue)} color={colors.status.success} />
        <KPICard label="إجمالي المصاريف" value={fmtSAR(totals?.total_expenses)} />
        <KPICard label="صافي الدخل" value={fmtSAR(totals?.net_income)} color={Number(totals?.net_income) >= 0 ? colors.status.success : colors.status.error} />
        <KPICard label="المتأخرات" value={fmtSAR(totals?.total_overdue)} color={colors.status.warning} />
        <KPICard label="نسبة الإشغال" value={pct(totals?.occupancy_rate)} />
      </div>

      {/* Company breakdown */}
      <Section title="تفاصيل الشركات">
        <DataTable
          columns={[
            { key: 'name', label: 'الشركة' },
            { key: 'plan', label: 'الخطة', render: v => <PlanBadge plan={v} /> },
            { key: 'revenue_this_month', label: 'الإيرادات', render: v => fmtSAR(v) },
            { key: 'expenses_this_month', label: 'المصاريف', render: v => fmtSAR(v) },
            { key: 'overdue_amount', label: 'المتأخرات', render: v => Number(v) > 0 ? <span style={{ color: colors.status.error }}>{fmtSAR(v)}</span> : '-' },
            { key: 'total_units', label: 'الوحدات', render: (v, r) => `${Number(v) - Number(r.vacant_units)}/${v}` },
            { key: 'active_contracts', label: 'العقود' },
            { key: 'open_tickets', label: 'الصيانة' },
          ]}
          rows={companies || []}
        />
      </Section>
    </div>
  );
}

// ─── Tab 3: Performance ─────────────────────────────────────────────────────

function PerformanceTab({ data }: { data: any }) {
  if (!data) return <EmptyMsg />;
  const { rankings, top_5, bottom_5 } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top / Bottom */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...styles.card, padding: 20, flex: '1 1 350px' }}>
          <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semi, color: colors.status.success, margin: '0 0 12px' }}>
            الأفضل أداءً
          </h3>
          {(top_5 || []).map((c: any, i: number) => (
            <div key={c.company_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 4 ? `1px solid ${colors.border.subtle}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: colors.status.successBg, color: colors.status.success, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
                  {c.rank}
                </span>
                <span style={{ fontWeight: fontWeight.medium }}>{c.name}</span>
              </div>
              <ScoreBadge score={c.performance_score} size="sm" />
            </div>
          ))}
        </div>
        <div style={{ ...styles.card, padding: 20, flex: '1 1 350px' }}>
          <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semi, color: colors.status.error, margin: '0 0 12px' }}>
            يحتاج اهتمام
          </h3>
          {(bottom_5 || []).map((c: any, i: number) => (
            <div key={c.company_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 4 ? `1px solid ${colors.border.subtle}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: colors.status.errorBg, color: colors.status.error, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
                  {c.rank}
                </span>
                <span style={{ fontWeight: fontWeight.medium }}>{c.name}</span>
              </div>
              <ScoreBadge score={c.performance_score} size="sm" />
            </div>
          ))}
        </div>
      </div>

      {/* Full ranking */}
      <Section title="ترتيب الشركات">
        <DataTable
          columns={[
            { key: 'rank', label: '#' },
            { key: 'name', label: 'الشركة' },
            { key: 'plan', label: 'الخطة', render: v => <PlanBadge plan={v} /> },
            { key: 'occupancy_rate', label: 'الإشغال', render: v => pct(v) },
            { key: 'collection_rate', label: 'التحصيل', render: v => pct(v) },
            { key: 'revenue_per_unit', label: 'الإيراد/وحدة', render: v => fmtSAR(v) },
            { key: 'open_tickets', label: 'الصيانة' },
            { key: 'performance_score', label: 'الأداء', render: v => <ScoreBadge score={v} size="sm" /> },
          ]}
          rows={rankings || []}
        />
      </Section>
    </div>
  );
}

// ─── Tab 4: Compliance ──────────────────────────────────────────────────────

function ComplianceTab({ data }: { data: any }) {
  if (!data) return <EmptyMsg />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <KPICard label="تقييم المنصة" value={pct(data.platform_score)} color={data.platform_score >= 80 ? colors.status.success : colors.status.warning} />
        <KPICard label="شركات بها مخالفات" value={fmt(data.companies_with_issues)} color={colors.status.error} />
        <KPICard label="إجمالي الشركات" value={fmt(data.total_companies)} />
      </div>

      <Section title="تفاصيل الامتثال">
        <DataTable
          columns={[
            { key: 'name', label: 'الشركة' },
            { key: 'plan', label: 'الخطة', render: v => <PlanBadge plan={v} /> },
            { key: 'compliance_score', label: 'التقييم', render: v => <ScoreBadge score={v} size="sm" /> },
            { key: 'issues', label: 'بدون إيجار', render: (_, r) => r.issues?.contracts_without_ejar || 0 },
            { key: 'issues2', label: 'بدون هوية', render: (_, r) => r.issues?.tenants_without_id || 0 },
            { key: 'issues3', label: 'منتهية نشطة', render: (_, r) => r.issues?.expired_not_terminated || 0 },
            { key: 'issues4', label: 'بدون تأمين', render: (_, r) => r.issues?.contracts_without_deposit || 0 },
            { key: 'total_issues', label: 'الإجمالي', render: v => v > 0 ? <span style={{ color: colors.status.error, fontWeight: fontWeight.semi }}>{v}</span> : <span style={{ color: colors.status.success }}>0</span> },
          ]}
          rows={data.companies || []}
        />
      </Section>
    </div>
  );
}

// ─── Tab 5: Risk ────────────────────────────────────────────────────────────

function RiskTab({ data }: { data: any }) {
  if (!data) return <EmptyMsg msg="لم يتم حساب المخاطر بعد. سيتم التحديث تلقائياً يومياً." />;

  const { scores, summary } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <KPICard label="حرج" value={fmt(summary?.critical)} color="#DC2626" />
        <KPICard label="عالي" value={fmt(summary?.high)} color="#F97316" />
        <KPICard label="متوسط" value={fmt(summary?.medium)} color="#D97706" />
        <KPICard label="منخفض" value={fmt(summary?.low)} color="#16A34A" />
      </div>

      <Section title="تفاصيل المخاطر">
        {(scores || []).length === 0 ? (
          <p style={{ color: colors.text.muted, fontSize: fontSize.md, textAlign: 'center', padding: 30 }}>
            سيتم حساب المخاطر تلقائياً عند الساعة 4 صباحاً. يمكنك أيضاً تشغيل الحساب يدوياً.
          </p>
        ) : (
          <DataTable
            columns={[
              { key: 'companies', label: 'الشركة', render: v => v?.name || '-' },
              { key: 'risk_type', label: 'النوع', render: v => v === 'churn' ? 'مغادرة' : v === 'financial_stress' ? 'مالي' : 'تشغيلي' },
              { key: 'score', label: 'الدرجة', render: (v, r) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <SeverityDot level={r.risk_level} /> {v}/100
                </span>
              )},
              { key: 'risk_level', label: 'المستوى', render: v => (
                <span style={{ fontSize: fontSize.xs, padding: '2px 8px', borderRadius: radius.sm, fontWeight: fontWeight.semi,
                  background: v === 'critical' ? '#FEF2F2' : v === 'high' ? '#FFF7ED' : v === 'medium' ? '#FFFBEB' : '#F0FDF4',
                  color: v === 'critical' ? '#DC2626' : v === 'high' ? '#F97316' : v === 'medium' ? '#D97706' : '#16A34A' }}>
                  {v === 'critical' ? 'حرج' : v === 'high' ? 'عالي' : v === 'medium' ? 'متوسط' : 'منخفض'}
                </span>
              )},
              { key: 'factors', label: 'العوامل', render: v => (
                <div style={{ fontSize: fontSize.xs, color: colors.text.secondary }}>
                  {(v || []).slice(0, 2).join(' / ')}
                </div>
              )},
            ]}
            rows={scores || []}
          />
        )}
      </Section>
    </div>
  );
}

// ─── Tab 6: Vacancy ─────────────────────────────────────────────────────────

function VacancyTab({ data }: { data: any }) {
  if (!data) return <EmptyMsg />;
  const { platform, companies } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <KPICard label="إجمالي الوحدات الشاغرة" value={fmt(platform?.total_vacant)} color={colors.status.warning} />
        <KPICard label="من أصل" value={fmt(platform?.total_units)} />
        <KPICard label="نسبة الشغور" value={pct(platform?.vacancy_rate)} color={colors.status.error} />
        <KPICard label="الخسارة الشهرية المقدرة" value={fmtSAR(platform?.estimated_monthly_loss)} color={colors.status.error} sub="إيرادات مفقودة" />
      </div>

      <Section title="الشركات حسب تأثير الشغور">
        <DataTable
          columns={[
            { key: 'name', label: 'الشركة' },
            { key: 'vacant_units', label: 'الشاغرة', render: (v, r) => `${v} / ${r.total_units}` },
            { key: 'vacancy_rate', label: 'نسبة الشغور', render: v => (
              <span style={{ color: Number(v) > 50 ? colors.status.error : Number(v) > 20 ? colors.status.warning : colors.status.success }}>
                {pct(v)}
              </span>
            )},
            { key: 'estimated_lost_income', label: 'الخسارة المقدرة', render: v => fmtSAR(v) },
          ]}
          rows={companies || []}
        />
      </Section>
    </div>
  );
}

// ─── Tab 7: Alerts ──────────────────────────────────────────────────────────

function AlertsTab({ data }: { data: any }) {
  if (!data) return <EmptyMsg />;
  const { alerts, summary } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <KPICard label="إجمالي التنبيهات" value={fmt(summary?.total)} />
        <KPICard label="حرجة" value={fmt(summary?.critical)} color="#DC2626" />
        <KPICard label="عالية" value={fmt(summary?.high)} color="#F97316" />
        <KPICard label="متوسطة" value={fmt(summary?.medium)} color="#D97706" />
      </div>

      <Section title="التنبيهات">
        {(alerts || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: colors.text.muted }}>
            لا توجد تنبيهات حالياً - المنصة في حالة جيدة
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(alerts || []).map((a: any, i: number) => (
              <div key={i} style={{
                ...styles.card, padding: '14px 18px',
                borderRight: `4px solid ${a.severity === 'critical' ? '#DC2626' : a.severity === 'high' ? '#F97316' : '#D97706'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <SeverityDot level={a.severity} />
                      <span style={{ fontWeight: fontWeight.semi, fontSize: fontSize.md, color: colors.text.primary }}>{a.title}</span>
                    </div>
                    <div style={{ fontSize: fontSize.sm, color: colors.text.secondary, marginBottom: 4 }}>{a.impact}</div>
                    <div style={{ fontSize: fontSize.xs, color: colors.accent.primary }}>{a.action}</div>
                  </div>
                  <span style={{
                    fontSize: fontSize.xs, padding: '2px 8px', borderRadius: radius.sm, fontWeight: fontWeight.semi, whiteSpace: 'nowrap',
                    background: a.severity === 'critical' ? '#FEF2F2' : a.severity === 'high' ? '#FFF7ED' : '#FFFBEB',
                    color: a.severity === 'critical' ? '#DC2626' : a.severity === 'high' ? '#F97316' : '#D97706',
                  }}>
                    {a.severity === 'critical' ? 'حرج' : a.severity === 'high' ? 'عالي' : 'متوسط'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Tab 8: Data Quality ────────────────────────────────────────────────────

function QualityTab({ data }: { data: any }) {
  if (!data) return <EmptyMsg />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <KPICard label="تقييم المنصة" value={pct(data.platform_score)} color={data.platform_score >= 80 ? colors.status.success : colors.status.warning} />
        <KPICard label="شركات بها مشاكل" value={fmt(data.companies_with_issues)} color={colors.status.warning} />
        <KPICard label="إجمالي المشاكل" value={fmt(data.total_issues)} color={colors.status.error} />
        <KPICard label="إجمالي الشركات" value={fmt(data.total_companies)} />
      </div>

      <Section title="جودة البيانات حسب الشركة">
        <DataTable
          columns={[
            { key: 'name', label: 'الشركة' },
            { key: 'plan', label: 'الخطة', render: v => <PlanBadge plan={v} /> },
            { key: 'quality_score', label: 'التقييم', render: v => <ScoreBadge score={v} size="sm" /> },
            { key: 'i1', label: 'بدون هاتف', render: (_, r) => r.issues?.tenants_without_phone || 0 },
            { key: 'i2', label: 'بدون هوية', render: (_, r) => r.issues?.tenants_without_id || 0 },
            { key: 'i3', label: 'بدون تاريخ نهاية', render: (_, r) => r.issues?.contracts_without_end_date || 0 },
            { key: 'i4', label: 'بدون عنوان', render: (_, r) => r.issues?.properties_without_address || 0 },
            { key: 'total_issues', label: 'الإجمالي', render: v => v > 0 ? <span style={{ color: colors.status.error, fontWeight: fontWeight.semi }}>{v}</span> : <span style={{ color: colors.status.success }}>0</span> },
          ]}
          rows={data.companies || []}
        />
      </Section>
    </div>
  );
}

// ─── Shared Sub-components ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...styles.card, padding: 20 }}>
      <h3 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semi, color: colors.text.primary, margin: '0 0 14px' }}>{title}</h3>
      {children}
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const PLAN_AR: Record<string, string> = { trial: 'تجريبي', basic: 'أساسي', professional: 'احترافي', enterprise: 'مؤسسي' };
  const PLAN_C: Record<string, string> = { trial: '#64748B', basic: '#2563EB', professional: '#7C3AED', enterprise: '#D97706' };
  const PLAN_BG: Record<string, string> = { trial: '#F1F5F9', basic: '#EFF6FF', professional: '#F5F3FF', enterprise: '#FFFBEB' };
  return (
    <span style={{ fontSize: fontSize.xs, padding: '2px 8px', borderRadius: radius.sm, fontWeight: fontWeight.semi, background: PLAN_BG[plan] || '#F1F5F9', color: PLAN_C[plan] || '#64748B' }}>
      {PLAN_AR[plan] || plan}
    </span>
  );
}

function EmptyMsg({ msg }: { msg?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: colors.text.muted, fontSize: fontSize.md }}>
      {msg || 'لا توجد بيانات متاحة'}
    </div>
  );
}
