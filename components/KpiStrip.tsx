'use client';

export interface KpiItem {
  label: string;
  value: string;
  delta: string;
  up: boolean;
  sparkValues: number[];
}

interface Props {
  items?: KpiItem[];
  accent?: string;
}

// Build SVG polyline points from an array of values
function buildSparkPoints(
  values: number[],
  width: number,
  height: number,
  padding = 3,
): { x: number; y: number }[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v, i) => ({
    x: padding + (i * (width - padding * 2)) / (values.length - 1),
    y: height - padding - ((v - min) / range) * (height - padding * 2),
  }));
}

function Sparkline({ values, accent }: { values: number[]; accent: string }) {
  const W = 88;
  const H = 40;
  const pts = buildSparkPoints(values, W, H);
  const polyPoints = pts.map((p) => `${p.x},${p.y}`).join(' ');

  // Closed polygon for gradient fill: start top-left → points → end bottom-right
  const first = pts[0];
  const last = pts[pts.length - 1];
  const fillPoints = `${first.x},${H} ${polyPoints} ${last.x},${H}`;

  const gradId = `sg-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Gradient fill area */}
      <polygon points={fillPoints} fill={`url(#${gradId})`} />
      {/* Sparkline */}
      <polyline
        points={polyPoints}
        stroke={accent}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

const DEFAULT_ITEMS: KpiItem[] = [
  {
    label: 'الحسابات النشطة',
    value: '1,284',
    delta: '+4.2%',
    up: true,
    sparkValues: [48, 52, 50, 58, 62, 60, 68, 72, 70, 78, 80, 84],
  },
  {
    label: 'صافي الإيراد الشهري',
    value: '$412K',
    delta: '+2.1%',
    up: true,
    sparkValues: [310, 315, 308, 320, 335, 330, 342, 355, 360, 380, 400, 412],
  },
  {
    label: 'المقاعد المستخدمة',
    value: '38.2K',
    delta: '+7.8%',
    up: true,
    sparkValues: [28, 30, 29, 31, 32, 33, 34, 35, 36, 37, 38, 38.2],
  },
  {
    label: 'التجريبي → مدفوع',
    value: '46%',
    delta: '−1.4%',
    up: false,
    sparkValues: [50, 52, 51, 49, 48, 50, 47, 48, 46, 47, 46, 46],
  },
];

export default function KpiStrip({ items = DEFAULT_ITEMS, accent = 'var(--lv-accent, #4f46e5)' }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid var(--lv-line-strong)',
        borderRadius: 'var(--lv-r-card)',
        background: 'var(--lv-panel)',
        boxShadow: 'var(--lv-shadow-card)',
        overflow: 'hidden',
      }}
    >
      {items.map((item, idx) => (
        <div
          key={idx}
          style={{
            flex: 1,
            padding: '22px 24px',
            borderInlineEnd: idx < items.length - 1 ? '1px solid var(--lv-line)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 0,
          }}
        >
          {/* Label */}
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 500,
              color: 'var(--lv-muted)',
              fontFamily: 'var(--lv-font-ar)',
              letterSpacing: '0.01em',
            }}
          >
            {item.label}
          </div>

          {/* Value row: Fraunces numeral + sparkline */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, justifyContent: 'space-between' }}>
            {/* Value */}
            <bdi
              dir="ltr"
              style={{
                fontFamily: 'var(--lv-font-num)',
                fontSize: 44,
                fontWeight: 600,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                color: 'var(--lv-fg)',
                flexShrink: 0,
              }}
            >
              {item.value}
            </bdi>

            {/* Sparkline */}
            <Sparkline values={item.sparkValues} accent={accent} />
          </div>

          {/* Delta chip */}
          <div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                borderRadius: 99,
                padding: '2px 8px',
                fontSize: 11.5,
                fontWeight: 600,
                fontFamily: 'var(--lv-font-ui)',
                background: item.up
                  ? 'rgba(10,143,95,0.10)'
                  : 'rgba(184,50,31,0.10)',
                color: item.up ? '#0a8f5f' : '#b8321f',
              }}
            >
              <bdi dir="ltr">{item.delta}</bdi>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
