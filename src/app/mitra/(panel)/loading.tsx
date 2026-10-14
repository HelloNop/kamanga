export default function Loading() {
  return (
    <div className='space-y-3 px-1' aria-busy='true' aria-label='Memuat'>
      {[0, 1, 2].map((i) => (
        <div key={i} className='bg-card h-28 animate-pulse rounded-xl shadow-sm' />
      ))}
    </div>
  );
}
