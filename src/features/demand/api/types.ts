export type DemandPeriod = 7 | 30 | 90;

export type DemandRow = {
  key: string;
  label: string;
  /** Berapa kali dicari tanpa hasil, dan oleh berapa sesi berbeda. */
  searches: number;
  people: number;
  lastAt: string; // ISO
  places: string[];
  examples: string[];
  /** Selalu ada hasil bila lokasinya dilonggarkan (ada di daerah lain di Sumbar). */
  elsewhere: boolean;
};

export type DemandReport = {
  days: DemandPeriod;
  totalSearches: number;
  unmetSearches: number;
  rows: DemandRow[];
};

/** Pertanyaan warga ke penyedia yang belum dijawab (listing_qa tanpa jawaban). */
export type QuestionRow = {
  id: number;
  question: string;
  createdAt: string; // ISO
  listing: { id: number; name: string; whatsapp: string | null };
  category: string | null;
  place: string | null;
};
