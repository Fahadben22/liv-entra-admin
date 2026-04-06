export function SkeletonCard() {
  return (
    <div style={{
      background: '#f8fafc', borderRadius: 12, padding: 20, marginBottom: 10,
      animation: 'shimmer 1.5s ease infinite',
    }}>
      <div style={{ height: 14, width: '60%', background: '#e2e8f0', borderRadius: 4, marginBottom: 10 }} />
      <div style={{ height: 10, width: '40%', background: '#e2e8f0', borderRadius: 4, marginBottom: 8 }} />
      <div style={{ height: 8, width: '80%', background: '#f1f5f9', borderRadius: 4 }} />
    </div>
  );
}

export function SkeletonRow({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          height: 48, background: '#f8fafc', borderRadius: 8, marginBottom: 6,
          animation: `shimmer 1.5s ease ${i * 0.1}s infinite`,
        }} />
      ))}
      <style>{`@keyframes shimmer { 0%,100% { opacity:1 } 50% { opacity:.5 } }`}</style>
    </>
  );
}

export function KanbanSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {[0, 1, 2, 3].map(col => (
        <div key={col}>
          <div style={{ height: 32, background: '#e2e8f0', borderRadius: 8, marginBottom: 12 }} />
          <SkeletonCard />
          <SkeletonCard />
          {col < 2 && <SkeletonCard />}
        </div>
      ))}
      <style>{`@keyframes shimmer { 0%,100% { opacity:1 } 50% { opacity:.5 } }`}</style>
    </div>
  );
}
