interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', padding: '16px 0', direction: 'ltr' }}>
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
        style={{ ...btnStyle, opacity: page <= 1 ? 0.4 : 1 }}>‹</button>
      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
        let p: number;
        if (totalPages <= 7) { p = i + 1; }
        else if (page <= 4) { p = i + 1; }
        else if (page >= totalPages - 3) { p = totalPages - 6 + i; }
        else { p = page - 3 + i; }
        return (
          <button key={p} onClick={() => onPageChange(p)}
            style={{ ...btnStyle, background: p === page ? '#1d4070' : '#fff', color: p === page ? '#fff' : '#475569', borderColor: p === page ? '#1d4070' : '#e2e8f0' }}>
            {p}
          </button>
        );
      })}
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
        style={{ ...btnStyle, opacity: page >= totalPages ? 0.4 : 1 }}>›</button>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0',
  background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
