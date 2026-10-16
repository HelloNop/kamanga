'use client';

import { useEffect, useState } from 'react';

/** Teks berganti di bawah judul beranda ("ka main…", "ka servis…"). Diam bila warga memilih kurangi gerak. */
export function RotatingText({ items }: { items: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), 2200);
    return () => clearInterval(t);
  }, [items.length]);
  if (!items.length) return null;
  return (
    <span className='w-rotate' aria-hidden='true'>
      <span key={i}>{items[i]}</span>
    </span>
  );
}
