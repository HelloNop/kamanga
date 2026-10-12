import type { UIMessage } from 'ai';

/** Satu kartu usaha di layar. Disusun dari hasil pencarian, bukan ditulis model. */
export type CardItem = {
  id: number;
  /** Alamat profil /listing/[slug]. Kosong pada percakapan lama yang tersimpan sebelum ada profil. */
  slug?: string;
  photo?: string | null;
  name: string;
  category: string | null;
  categorySlug: string | null;
  location: string | null;
  distanceKm: number | null;
  price: string | null;
  verification: string;
  summary: string | null;
  whatsapp: string | null;
  modes: string[];
};
export type ListingsData = { items: CardItem[]; total: number };
export type ChipsData = { options: string[] };

export type KamangaMessage = UIMessage<never, { listings: ListingsData; chips: ChipsData }>;

export type Reply = { text: string; chips?: string[]; listings?: ListingsData };
