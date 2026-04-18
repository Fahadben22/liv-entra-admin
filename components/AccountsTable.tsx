'use client';
import { useState } from 'react';
import type { Company } from '@/lib/types';

// ── Avatar helper ──────────────────────────────────────────────────────────────
function getAvatarStyles(name: string): { background: string; color: string; initials: string } {
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
  return {
    background: `oklch(0.88 0.06 ${hue})`,
    color: `oklch(0.35 0.09 ${hue})`,
    initials,
  };
}

// ── Utilization bar ────────────────────────────────────────────────────────────
function UtilBar({ pct, accent }: { pct: number; accent: string }) {
  const color =
    pct >= 85 ? '#b4630a' : pct >= 60 ? accent : 'rgba(0,0,0,0.18)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 5,
          borderRadius: 3,
          background: 'var(--lv-line-strong)',
          overflow: 'hidden',
          minWidth: 60,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(pct, 100)}%`,
            borderRadius: 3,
            background: color,
            transition: 'width .3s ease',
          }}
        />
      </div>
      <bdi
        dir="ltr"
        style={{
          fontSize: 11.5,
          fontFamily: 'var(--lv-font-mono)',
          color: 'var(--lv-muted)',
          minWidth: 32,
          textAlign: 'end',
        }}
      >
        {pct}%
      </bdi>
    </div>
  );
}

// ── Status chip ────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  active:    { dot: '#0a8f5f', bg: 'rgba(10,143,95,0.12)',   text: '#0a8f5f',  label: 'نشط' },
  trial:     { dot: 'var(--lv-accent)', bg: 'color-mix(in srgb, var(--lv-accent) 12%, transparent)', text: 'var(--lv-accent)', label: 'تجريبي' },
  overdue:   { dot: '#b4630a', bg: 'rgba(180,99,10,0.12)',   text: '#b4630a',  label: 'متأخر' },
  suspended: { dot: '#b8321f', bg: 'rgba(184,50,31,0.12)',   text: '#b8321f',  label: 'موقوف' },
  deleted:   { dot: '#8a8a8a', bg: 'rgba(138,138,138,0.10)', text: '#8a8a8a',  label: 'محذوف' },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.deleted;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 99,
        background: cfg.bg,
        fontSize: 12,
        fontWeight: 500,
        color: cfg.text,
        fontFamily: 'var(--lv-font-ar)',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

// ── Plan badge ─────────────────────────────────────────────────────────────────
const PLAN_LABEL: Record<string, string> = {
  enterprise:    'مؤسسة',
  professional:  'نمو',
  basic:         'مبتدئ',
  trial:         'تجريبي',
};

function PlanBadge({ plan, accent }: { plan: string; accent: string }) {
  const isEnterprise = plan === 'enterprise';
  const label = PLAN_LABEL[plan] || plan;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 5,
        fontSize: 11.5,
        fontWeight: 500,
        fontFamily: 'var(--lv-font-ar)',
        background: isEnterprise ? `${accent}22` : 'var(--lv-chip)',
        color: isEnterprise ? accent : 'var(--lv-muted)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// ── Activity feed (mock) ───────────────────────────────────────────────────────
const ACTIVITY_FEED = [
  { time: '09:42', text: 'شركة الأفق العقاري ترقّت إلى Enterprise', tag: 'lifecycle', tagColor: '#6b5cff' },
  { time: '08:17', text: 'تذكير فاتورة متأخرة أُرسل لمجموعة النخبة', tag: 'billing', tagColor: '#b4630a' },
  { time: '07:55', text: 'محاولة دخول مشبوهة من IP جديد', tag: 'security', tagColor: '#b8321f' },
  { time: '06:30', text: 'الإمارات للسكن أضافت 14 مقعداً جديداً', tag: 'seats', tagColor: '#0a8f5f' },
  { time: 'أمس',  text: 'انتهاء تجربة شركة حافة للتطوير', tag: 'lifecycle', tagColor: '#6b5cff' },
  { time: 'أمس',  text: 'دفعة مكتملة بقيمة ٤٢،٠٠٠ ر.س', tag: 'billing', tagColor: '#b4630a' },
];

const QUICK_ACTIONS = [
  { label: 'دعوة مدير',         sub: 'منح صلاحيات المساحة' },
  { label: 'إنشاء حساب',        sub: 'إعداد مستأجر جديد' },
  { label: 'إصدار رصيد',        sub: 'تطبيق رصيد على حساب' },
  { label: 'تصدير سجل التدقيق', sub: 'تحميل ملف JSON جاهز' },
  { label: 'تحديث مفاتيح API',  sub: 'إبطال بيانات الاعتماد القديمة' },
];

// ── Compact mock row for when no real data is passed ──────────────────────────
const MOCK_ROWS = [
  { id: 'afc-001', name_ar: 'شركة الأفق العقاري',    subscription_plan: 'enterprise',   lifecycle_status: 'active',    mrr: 22400, seats: 120, utilPct: 78, owner: 'أحمد الشمري',   lastSeen: 'منذ يومين' },
  { id: 'nkb-042', name_ar: 'مجموعة النخبة',           subscription_plan: 'professional', lifecycle_status: 'trial',     mrr: 5800,  seats: 32,  utilPct: 42, owner: 'سارة القحطاني', lastSeen: 'اليوم' },
  { id: 'emr-017', name_ar: 'الإمارات للسكن',          subscription_plan: 'enterprise',   lifecycle_status: 'active',    mrr: 41000, seats: 210, utilPct: 91, owner: 'خالد العتيبي',  lastSeen: 'منذ ساعة' },
  { id: 'hff-008', name_ar: 'حافة للتطوير العقاري',   subscription_plan: 'basic',        lifecycle_status: 'overdue',   mrr: 1200,  seats: 8,   utilPct: 55, owner: 'منى السبيعي',   lastSeen: 'منذ 9 أيام' },
  { id: 'twr-033', name_ar: 'برج المستقبل',            subscription_plan: 'professional', lifecycle_status: 'active',    mrr: 9600,  seats: 64,  utilPct: 67, owner: 'فيصل الدوسري',  lastSeen: 'أمس' },
  { id: 'rzn-056', name_ar: 'رزن للاستثمار',           subscription_plan: 'enterprise',   lifecycle_status: 'active',    mrr: 34000, seats: 180, utilPct: 83, owner: 'نورة الحربي',   lastSeen: 'منذ 3 ساعات' },
  { id: 'wfa-019', name_ar: 'وفاء للإدارة العقارية',  subscription_plan: 'basic',        lifecycle_status: 'suspended', mrr: 800,   seats: 5,   utilPct: 20, owner: 'طارق الزهراني',  lastSeen: 'منذ شهر' },
];

// ── Column header ──────────────────────────────────────────────────────────────
function TH({ children, align = 'start' }: { children: React.ReactNode; align?: string }) {
  return (
    <th
      style={{
        padding: '10px 16px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--lv-muted)',
        fontFamily: 'var(--lv-font-ui)',
        textAlign: align as never,
        whiteSpace: 'nowrap',
        background: 'var(--lv-panel)',
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}
    >
      {children}
    </th>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  companies?: Company[];
  accent?: string;
  lang?: 'ar' | 'en';
}

const PAGE_SIZE = 7;

export default function AccountsTable({
  companies,
  accent = 'var(--lv-accent, #4f46e5)',
  lang = 'ar',
}: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Use passed companies or fall back to mock data
  const rows = companies && companies.length > 0
    ? companies.map((c) => ({
        id: c.id,
        name_ar: c.name_ar || c.name || c.id,
        subscription_plan: c.plan || 'trial',
        lifecycle_status: c.lifecycle_status || 'trial',
        mrr: (c as any).mrr ?? 0,
        seats: (c as any).staff_count ?? 0,
        utilPct: c.max_staff > 0
          ? Math.min(100, Math.round(((c as any).staff_count ?? 0) / c.max_staff * 100))
          : 0,
        owner: (c as any).admin_name || '—',
        lastSeen: (c as any).last_active_at
          ? new Date((c as any).last_active_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })
          : '—',
      }))
    : MOCK_ROWS;

  const filtered = activeFilter
    ? rows.filter((r) => r.lifecycle_status === activeFilter)
    : rows;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const FILTERS = [
    { key: null,         label: 'الكل' },
    { key: 'active',     label: 'نشط' },
    { key: 'trial',      label: 'تجريبي' },
    { key: 'overdue',    label: 'متأخر' },
    { key: 'suspended',  label: 'موقوف' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--lv-section-gap)' }}>

      {/* ── Page header ── */}
      <div>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--lv-muted)',
          marginBottom: 8,
          fontFamily: 'var(--lv-font-ui)',
        }}>
          الحسابات
        </div>
        <h1 style={{
          margin: 0,
          fontFamily: lang === 'ar' ? 'var(--lv-font-ar)' : 'var(--lv-font-num)',
          fontSize: 56,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: 0.95,
          color: 'var(--lv-fg)',
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          flexWrap: 'wrap',
        }}>
          <bdi dir="ltr" style={{ fontFamily: 'var(--lv-font-num)' }}>
            {filtered.length.toLocaleString('en-US')}
          </bdi>
          <span style={{ color: accent, fontStyle: lang === 'en' ? 'italic' : 'normal', fontSize: 46 }}>
            {lang === 'ar' ? 'حساباً' : 'accounts'}
          </span>
        </h1>
        <div style={{
          marginTop: 10,
          fontSize: 13.5,
          color: 'var(--lv-muted)',
          fontFamily: 'var(--lv-font-ar)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>آخر ٣٠ يوماً</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ color: '#b4630a' }}>
            {rows.filter(r => r.lifecycle_status === 'overdue').length} متأخرة
          </span>
        </div>
      </div>

      {/* ── KPI Strip is rendered by the parent page — slot here ── */}

      {/* ── Toolbar / filter bar ── */}
      <div style={{
        padding: '10px 12px',
        border: '1px solid var(--lv-line)',
        borderRadius: 12,
        background: 'var(--lv-panel)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      }}>
        {FILTERS.map((f) => {
          const active = activeFilter === f.key;
          return (
            <button
              key={String(f.key)}
              onClick={() => { setActiveFilter(f.key); setPage(1); }}
              style={{
                padding: '5px 10px',
                borderRadius: 7,
                border: active ? `1px solid ${accent}44` : '1px solid var(--lv-line-strong)',
                background: active ? `${accent}18` : 'transparent',
                color: active ? accent : 'var(--lv-muted)',
                fontSize: 12.5,
                fontWeight: active ? 500 : 400,
                fontFamily: 'var(--lv-font-ar)',
                cursor: 'pointer',
                transition: 'all .1s',
              }}
            >
              {f.label}
              {active && f.key && (
                <span style={{ marginInlineStart: 4, opacity: 0.6 }} onClick={(e) => { e.stopPropagation(); setActiveFilter(null); }}>×</span>
              )}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* Row count */}
        <span style={{
          fontFamily: 'var(--lv-font-mono)',
          fontSize: 12,
          color: 'var(--lv-muted)',
        }}>
          <bdi dir="ltr">{filtered.length}</bdi> حساب
        </span>

        {/* Export */}
        <button style={{
          padding: '5px 12px', borderRadius: 7,
          border: '1px solid var(--lv-line-strong)', background: 'transparent',
          cursor: 'pointer', fontSize: 12, color: 'var(--lv-muted)',
          fontFamily: 'var(--lv-font-ar)',
        }}>
          تصدير CSV
        </button>
      </div>

      {/* ── Accounts table ── */}
      <div style={{
        border: '1px solid var(--lv-line-strong)',
        borderRadius: 'var(--lv-r-card)',
        background: 'var(--lv-panel)',
        overflow: 'hidden',
        boxShadow: 'var(--lv-shadow-card)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            direction: 'rtl',
          }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--lv-line-strong)' }}>
                <TH><input type="checkbox" style={{ accentColor: accent }} /></TH>
                <TH>الحساب</TH>
                <TH>الخطة</TH>
                <TH align="end">المقاعد</TH>
                <TH align="end">الإيراد</TH>
                <TH>الاستخدام</TH>
                <TH>الحالة</TH>
                <TH>المدير</TH>
                <TH align="end">آخر نشاط</TH>
                <TH>{' '}</TH>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const av = getAvatarStyles(row.name_ar);
                return (
                  <tr
                    key={row.id}
                    className="lv-table-row"
                    style={{ borderBottom: '1px solid var(--lv-line)' }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '13px 16px', width: 40 }}>
                      <input
                        type="checkbox"
                        checked={checked.has(row.id)}
                        onChange={() => toggleCheck(row.id)}
                        style={{ accentColor: accent }}
                      />
                    </td>

                    {/* Account: avatar + name + id */}
                    <td style={{ padding: '13px 16px', minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 28, height: 28,
                          borderRadius: 8,
                          background: av.background,
                          color: av.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700,
                          flexShrink: 0,
                          fontFamily: 'var(--lv-font-ui)',
                        }}>
                          {av.initials}
                        </div>
                        <div>
                          <div style={{
                            fontSize: 13.5,
                            fontWeight: 500,
                            color: 'var(--lv-fg)',
                            fontFamily: 'var(--lv-font-ar)',
                          }}>
                            {row.name_ar}
                          </div>
                          <bdi dir="ltr" style={{
                            fontSize: 11.5,
                            fontFamily: 'var(--lv-font-mono)',
                            color: 'var(--lv-muted)',
                          }}>
                            {row.id}
                          </bdi>
                        </div>
                      </div>
                    </td>

                    {/* Plan */}
                    <td style={{ padding: '13px 16px' }}>
                      <PlanBadge plan={row.subscription_plan} accent={accent} />
                    </td>

                    {/* Seats */}
                    <td style={{ padding: '13px 16px', textAlign: 'end' }}>
                      <bdi dir="ltr" style={{
                        fontFamily: 'var(--lv-font-mono)',
                        fontSize: 13,
                        color: 'var(--lv-fg)',
                      }}>
                        {row.seats.toLocaleString('en-US')}
                      </bdi>
                    </td>

                    {/* MRR */}
                    <td style={{ padding: '13px 16px', textAlign: 'end' }}>
                      <bdi dir="ltr" style={{
                        fontFamily: 'var(--lv-font-mono)',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--lv-fg)',
                      }}>
                        ${row.mrr.toLocaleString('en-US')}
                      </bdi>
                    </td>

                    {/* Utilization bar */}
                    <td style={{ padding: '13px 16px', minWidth: 140 }}>
                      <UtilBar pct={row.utilPct} accent={accent} />
                    </td>

                    {/* Status */}
                    <td style={{ padding: '13px 16px' }}>
                      <StatusChip status={row.lifecycle_status} />
                    </td>

                    {/* Owner */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        fontSize: 13,
                        color: 'var(--lv-muted)',
                        fontFamily: 'var(--lv-font-ar)',
                      }}>
                        {row.owner}
                      </span>
                    </td>

                    {/* Last seen */}
                    <td style={{ padding: '13px 16px', textAlign: 'end' }}>
                      <span style={{
                        fontSize: 12.5,
                        color: 'var(--lv-muted)',
                        fontFamily: 'var(--lv-font-ar)',
                      }}>
                        {row.lastSeen}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '13px 12px', width: 40 }}>
                      <button style={{
                        background: 'transparent', border: 'none',
                        cursor: 'pointer', fontSize: 16, color: 'var(--lv-muted)',
                        padding: '2px 6px', borderRadius: 6,
                      }}>
                        ⋯
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--lv-line)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'var(--lv-panel)',
        }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 12.5,
              border: '1px solid var(--lv-line-strong)',
              background: 'transparent', cursor: page === 1 ? 'default' : 'pointer',
              color: page === 1 ? 'var(--lv-line-strong)' : 'var(--lv-muted)',
              fontFamily: 'var(--lv-font-ar)',
            }}
          >
            السابق
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                width: 28, height: 28, borderRadius: 6, fontSize: 12.5,
                border: p === page ? `1px solid ${accent}44` : '1px solid transparent',
                background: p === page ? `${accent}12` : 'transparent',
                color: p === page ? accent : 'var(--lv-muted)',
                fontWeight: p === page ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'var(--lv-font-mono)',
              }}
            >
              <bdi dir="ltr">{p}</bdi>
            </button>
          ))}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 12.5,
              border: '1px solid var(--lv-line-strong)',
              background: 'transparent', cursor: page === totalPages ? 'default' : 'pointer',
              color: page === totalPages ? 'var(--lv-line-strong)' : 'var(--lv-muted)',
              fontFamily: 'var(--lv-font-ar)',
            }}
          >
            التالي
          </button>

          <div style={{ flex: 1 }} />
          <span style={{
            fontSize: 12, color: 'var(--lv-muted)',
            fontFamily: 'var(--lv-font-mono)',
          }}>
            <bdi dir="ltr">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</bdi>
            {' / '}
            <bdi dir="ltr">{filtered.length}</bdi>
          </span>
        </div>
      </div>

      {/* ── Bottom row: Activity feed + Quick actions ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: 16,
        alignItems: 'start',
      }}>
        {/* Activity feed */}
        <div style={{
          border: '1px solid var(--lv-line-strong)',
          borderRadius: 'var(--lv-r-card)',
          background: 'var(--lv-panel)',
          overflow: 'hidden',
          boxShadow: 'var(--lv-shadow-card)',
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--lv-line)',
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--lv-fg)',
            fontFamily: 'var(--lv-font-ar)',
          }}>
            سجل النشاط
          </div>
          {ACTIVITY_FEED.map((ev, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 20px',
                borderBottom: i < ACTIVITY_FEED.length - 1 ? '1px solid var(--lv-line)' : 'none',
              }}
            >
              <bdi dir="ltr" style={{
                fontSize: 11.5,
                fontFamily: 'var(--lv-font-mono)',
                color: 'var(--lv-muted)',
                flexShrink: 0,
                paddingTop: 2,
              }}>
                {ev.time}
              </bdi>
              <span style={{
                flex: 1,
                fontSize: 13,
                color: 'var(--lv-fg)',
                fontFamily: 'var(--lv-font-ar)',
                lineHeight: 1.4,
              }}>
                {ev.text}
              </span>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: ev.tagColor,
                background: `${ev.tagColor}15`,
                padding: '2px 7px',
                borderRadius: 99,
                flexShrink: 0,
                fontFamily: 'var(--lv-font-ar)',
              }}>
                {ev.tag}
              </span>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div>
          <div style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--lv-fg)',
            fontFamily: 'var(--lv-font-ar)',
            marginBottom: 10,
          }}>
            إجراءات سريعة
          </div>
          {QUICK_ACTIONS.map((qa, i) => (
            <button
              key={i}
              className="lv-quick-action"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                padding: '11px 12px',
                borderRadius: 10,
                border: '1px solid var(--lv-line)',
                background: 'var(--lv-panel)',
                cursor: 'pointer',
                marginBottom: 8,
                textAlign: 'start',
                transition: 'background .1s',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: 'var(--lv-fg)',
                  fontFamily: 'var(--lv-font-ar)',
                }}>
                  {qa.label}
                </div>
                <div style={{
                  fontSize: 11.5,
                  color: 'var(--lv-muted)',
                  fontFamily: 'var(--lv-font-ar)',
                  marginTop: 2,
                }}>
                  {qa.sub}
                </div>
              </div>
              {/* Chevron — mirrored in RTL */}
              <span style={{
                color: 'var(--lv-muted)',
                fontSize: 14,
                transform: 'scaleX(-1)',
                flexShrink: 0,
                marginInlineStart: 8,
              }}>
                ›
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
