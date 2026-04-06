import { LC_MAP } from '@/lib/constants';

export default function StatusBadge({ status }: { status: string }) {
  const s = LC_MAP[status] || LC_MAP.deleted;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, color: s.color, padding: '3px 10px',
      borderRadius: 6, fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  );
}
