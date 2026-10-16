import type { UIMessage } from 'ai';
import type { Budget, When } from './extract';

/** Satu kartu usaha di layar (jalur lama: kategori tanpa pintu aktif). Disusun dari hasil pencarian, bukan ditulis model. */
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

/** Kartu penyedia pintu tahap 1 (dari findProviders). Semua isi dari database; tautan dibuat lewat `paths`. */
export type ProviderItem = {
  id: number;
  slug: string;
  name: string;
  category: string;
  place: string | null;
  distance: string | null;
  /** Label verifikasi; null bila belum terverifikasi. */
  verification: string | null;
  rating: string | null;
  price: string | null;
  photo: string | null;
  profileHref: string;
  /** Kategori tanpa jadwal (Ka servis): tombol Pesan. */
  bookHref: string | null;
  /** Tempat (informasi saja): arahkan ke peta. */
  mapsUrl: string | null;
  /** Hari slot bila semuanya di hari yang sama, mis. "Kamis, 16 Okt". */
  slotDay: string | null;
  slots: { time: string; price: string | null; href: string; title: string }[];
  /** Catatan kecil: "Belum bisa dipesan lewat Kamanga", data yang belum lengkap, dst. */
  note: string | null;
};
export type ProvidersData = { items: ProviderItem[]; uncertain: ProviderItem[]; total: number };

/** Aksi dari tombol. Dikirim di body permintaan bersama teks tombol. */
export type ChatAction =
  | { kind: 'category'; id: number }
  | { kind: 'region'; id: number }
  | { kind: 'relax'; key: 'radius' | 'time' | 'budget' | 'attributes' }
  | { kind: 'focus'; slug: string }
  | { kind: 'forward'; yes: boolean }
  /** Pakai lokasi perangkat: titiknya dikirim terpisah di body (`point`), tidak pernah disimpan. */
  | { kind: 'location' };

/** Tombol pilihan. Tanpa `action`, `label` dikirim sebagai teks biasa.
 *  kind 'location': minta izin lokasi browser dulu; 'type': fokus ke kolom tulis tanpa mengirim. */
export type Chip = { label: string; action?: ChatAction; kind?: 'location' | 'type' };
/** Percakapan lama menyimpan tombol sebagai teks biasa. */
export type ChipsData = { options: (string | Chip)[] };

export type KamangaMessage = UIMessage<
  never,
  { listings: ListingsData; providers: ProvidersData; chips: ChipsData }
>;

export type Reply = {
  text: string;
  chips?: (string | Chip)[];
  listings?: ListingsData;
  providers?: ProvidersData;
};

/**
 * Niat terstruktur yang sedang berjalan dalam satu sesi (PRD 8.2), disimpan di chat_sessions.state.
 * TIDAK PERNAH memuat koordinat perangkat, nomor, alamat, atau identitas warga: lokasi hanya id + nama wilayah.
 */
export type ChatState = {
  door?: { slug: string; name: string } | null;
  categories?: { id: number; name: string }[];
  region?: { id: number; label: string; source: 'device' | 'typed' } | null;
  when?: When | null;
  people?: number | null;
  budget?: Budget | null;
  /** Kapasitas tempat (gedung, aula) untuk jalur lama. */
  capacity?: number | null;
  /** Isian aturan yang wajib cocok, mis. { racket_included: true }. */
  attributes?: Record<string, string | number | boolean>;
  /** visit: warga datang; call: penyedia datang. */
  prefer?: 'visit' | 'call' | null;
  route?: { fromId: number; fromName: string; toId: number; toName: string } | null;
  radiusKm?: number | null;
  /** Penyedia yang terakhir ditampilkan, dan yang sedang ditanyakan. */
  shown?: { id: number; slug: string; name: string }[];
  focus?: { id: number; slug: string; name: string } | null;
  /** Pertanyaan yang menunggu jawaban warga. */
  pending?:
    | { kind: 'forward'; listingId: number; question: string }
    | { kind: 'which'; question: string }
    | null;
  /** Hal yang terakhir ditanyakan Kamanga. */
  asked?: 'category' | 'when' | 'location' | 'people' | 'destination' | null;
  /** Pesan sebelumnya menyebut kebutuhan yang tidak dikenal kode (diserahkan ke model AI). */
  needUnknown?: boolean;
};
