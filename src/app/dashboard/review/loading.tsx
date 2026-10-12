export default function Loading() {
  return (
    <div className='flex flex-1 flex-col gap-3.5 px-4 pt-2 pb-4 md:px-6 md:pt-4'>
      {[0, 1, 2].map((i) => (
        <div key={i} className='bg-card h-44 animate-pulse rounded-xl shadow-sm' />
      ))}
    </div>
  );
}
