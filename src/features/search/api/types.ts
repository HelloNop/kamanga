import type { ProviderResult } from '@/lib/directory/providers';
import type { SearchResult } from '@/lib/directory/search';
import type { Region } from '@/lib/engines/contracts';
import type { CategoryMatch, LocationCandidate } from '@/lib/directory/understand';

export type { SearchResult };

export type SearchInput = {
  q?: string;
  locationText?: string;
  locationId?: number; // dipilih admin saat nama lokasi ambigu
  categoryId?: number;
  budget?: number;
  budgetUnit?: string;
  radiusKm?: number;
  serviceMode?: string;
  minVerification?: string;
  minCapacity?: number;
  limit?: number;
};

export type SearchResponse = {
  /** Bagaimana kata dipahami oleh kode. */
  understood: {
    categories: CategoryMatch[]; // semua yang ditemukan
    usedCategoryIds: number[]; // yang benar-benar dipakai sebagai saring
    location: {
      text: string;
      best: LocationCandidate | null;
      candidates: LocationCandidate[];
      ambiguous: boolean;
    } | null;
  };
  result: SearchResult | null;
  /** Penjelasan bila pencarian tidak dijalankan. */
  note: string | null;
};

/** Uji mode Pintu: findProviders seperti halaman pintu dan chat (PRD 8.3). */
export type ProviderSearchInput = {
  categoryId: number;
  /** Nama wilayah yang diketik (diselesaikan Mesin Lokasi). */
  place?: string;
  /** Dipilih admin saat nama wilayah ambigu. */
  regionId?: number;
  /** "YYYY-MM-DD" dan jam "HH:MM" WIB; tanpa tanggal = tanpa syarat waktu. */
  date?: string;
  from?: string;
  to?: string;
  seats?: number;
  prefer?: 'visit' | 'call';
  radiusKm?: number;
  budgetMax?: number;
  sort?: 'score' | 'distance';
  includePlaces?: boolean;
};

export type ProviderSearchResponse = {
  region: Region | null;
  /** Pilihan bila nama wilayah ambigu. */
  options: Region[];
  result: ProviderResult | null;
  note: string | null;
};
