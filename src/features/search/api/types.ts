import type { SearchResult } from '@/lib/directory/search';
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
