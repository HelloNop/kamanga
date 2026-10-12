'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

type BreadcrumbItem = {
  title: string;
  link: string;
};

// Nama tampilan tiap segmen alamat; segmen angka (id) ditampilkan sebagai nomor.
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  overview: 'Ringkasan',
  listings: 'Listing',
  categories: 'Kategori',
  locations: 'Lokasi',
  search: 'Uji Pencarian',
  import: 'Impor CSV',
  new: 'Baru'
};

const labelOf = (segment: string) =>
  SEGMENT_LABELS[segment] ??
  (/^\d+$/.test(segment) ? `#${segment}` : segment.charAt(0).toUpperCase() + segment.slice(1));

export function useBreadcrumbs() {
  const pathname = usePathname();

  return useMemo<BreadcrumbItem[]>(() => {
    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => ({
      title: labelOf(segment),
      link: `/${segments.slice(0, index + 1).join('/')}`
    }));
  }, [pathname]);
}
