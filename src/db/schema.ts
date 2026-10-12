import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

export * from './auth-schema';

// Skema direktori Kamanga. Nama tabel dan kolom bahasa Inggris (snake_case di database,
// camelCase di TypeScript lewat opsi `casing`). Teks untuk pengguna tetap Bahasa Indonesia.
//
// Tabel pengguna (user, session, account, verification) dibuat oleh Better Auth di `auth-schema.ts`.
// Buat ulang dengan `bunx auth@1.7.7 generate --config src/lib/auth.ts --output src/db/auth-schema.ts -y`
// bila plugin auth berubah.

// ───────────────────────────── Enums ─────────────────────────────

export const listingStatus = pgEnum('listing_status', [
  'draft',
  'pending_review',
  'published',
  'rejected',
  'archived'
]);

// 0 belum, 1 nomor kontak sudah dicek aktif, 2 dicek langsung (kunjungan / video call)
export const verificationLevel = pgEnum('verification_level', [
  'unverified',
  'contact_checked',
  'visited'
]);

// on_site: pelanggan datang ke tempat. on_call: penyedia datang ke pelanggan. online: daring.
export const serviceMode = pgEnum('service_mode', ['on_site', 'on_call', 'online']);

export const locationLevel = pgEnum('location_level', [
  'province',
  'city', // kota / kabupaten
  'district', // kecamatan
  'village', // nagari / kelurahan
  'landmark' // tempat dikenal, mis. pasar, terminal
]);

export const priceUnit = pgEnum('price_unit', [
  'per_event',
  'per_hour',
  'per_day',
  'per_visit',
  'per_person',
  'per_item',
  'per_project',
  'other'
]);

export const listingSource = pgEnum('listing_source', ['team', 'vendor', 'import']);

export const reviewStatus = pgEnum('review_status', ['pending', 'approved', 'rejected']);

// ───────────────────── Taksonomi: kategori & kebutuhan ─────────────────────

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
};

// Kelompok kategori (Jasa, Kesehatan, Acara & Pernikahan, ...). Daftarnya ditambah sendiri oleh admin
// langsung dari formulir kategori; kelompok yang tidak lagi dipakai kategori mana pun dibersihkan otomatis.
export const categoryGroups = pgTable('category_groups', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  slug: text().notNull().unique(),
  name: text().notNull().unique(),
  sortOrder: integer().notNull().default(0),
  ...timestamps
});

// Jenis listing (Katering, Servis AC, Wisata Alam, ...).
export const categories = pgTable('categories', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  // Kelompok utama. Kelompok tambahan ada di category_extra_groups.
  groupId: integer()
    .notNull()
    .references(() => categoryGroups.id, { onDelete: 'restrict' }),
  // Aturan chatbot: wajib menanyakan lokasi (matikan untuk usaha daring), dan listing yang
  // hanya berupa informasi tanpa tombol kontak (objek wisata umum).
  needsLocation: boolean().notNull().default(true),
  infoOnly: boolean().notNull().default(false),
  description: text(),
  // Sebutan lain yang dikenali chatbot (mis. "onda" untuk Servis Motor). Disimpan sudah diseragamkan.
  aliases: text().array().notNull().default([]),
  // Definisi atribut khusus kategori (mis. kapasitas gedung). Dipakai membuat formulir
  // dan memvalidasi `listings.attributes`.
  attributeSchema: jsonb().$type<unknown[]>(),
  // Slot yang perlu ditanyakan chatbot untuk kategori ini. Diisi saat tahap chatbot.
  slots: jsonb().$type<unknown[]>(),
  isActive: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  ...timestamps
});

// Kelompok tambahan sebuah kategori (mis. Fotografer: utama Acara, tambahan Kreatif & Digital).
export const categoryExtraGroups = pgTable(
  'category_extra_groups',
  {
    categoryId: integer()
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    groupId: integer()
      .notNull()
      .references(() => categoryGroups.id, { onDelete: 'cascade' })
  },
  (t) => [
    primaryKey({ columns: [t.categoryId, t.groupId] }),
    index('category_extra_groups_group_idx').on(t.groupId)
  ]
);

// Situasi warga (Pindahan rumah, AC rusak, ...). Hanya data, bukan kode khusus.
export const needs = pgTable('needs', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text(),
  // Sebutan lain yang dikenali chatbot (mis. "baralek" untuk Pesta pernikahan).
  aliases: text().array().notNull().default([]),
  slots: jsonb().$type<unknown[]>(),
  isActive: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  ...timestamps
});

export const needCategories = pgTable(
  'need_categories',
  {
    needId: integer()
      .notNull()
      .references(() => needs.id, { onDelete: 'cascade' }),
    categoryId: integer()
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    sortOrder: integer().notNull().default(0)
  },
  (t) => [
    primaryKey({ columns: [t.needId, t.categoryId] }),
    index('need_categories_category_idx').on(t.categoryId)
  ]
);

// ───────────────────────── Lokasi (gazetteer Sumbar) ─────────────────────────

export const locations = pgTable(
  'locations',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    parentId: integer().references((): AnyPgColumn => locations.id, { onDelete: 'set null' }),
    slug: text().notNull().unique(),
    name: text().notNull(),
    level: locationLevel().notNull(),
    lat: doublePrecision(),
    lng: doublePrecision(),
    ...timestamps
  },
  (t) => [
    index('locations_parent_idx').on(t.parentId),
    index('locations_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
    check('locations_lat_lng_pair', sql`(${t.lat} is null) = (${t.lng} is null)`)
  ]
);

// Ejaan alternatif dan sebutan populer: "Bukiktinggi", "Aia Pacah", "Pasa Raya".
export const locationAliases = pgTable(
  'location_aliases',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    locationId: integer()
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    alias: text().notNull()
  },
  (t) => [
    uniqueIndex('location_aliases_unique').on(t.locationId, t.alias),
    index('location_aliases_alias_trgm_idx').using('gin', t.alias.op('gin_trgm_ops'))
  ]
);

// ───────────────────────────── Listing ─────────────────────────────

export const listings = pgTable(
  'listings',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    summary: text(), // satu-dua kalimat untuk kartu
    description: text(),

    // Titik lokasi (untuk yang didatangi pelanggan). Area layanan ada di `listing_areas`.
    address: text(),
    locationId: integer().references(() => locations.id, { onDelete: 'set null' }),
    lat: doublePrecision(),
    lng: doublePrecision(),
    serviceModes: serviceMode().array().notNull().default(['on_site']),

    // Kontak. Semua boleh kosong (mis. objek wisata umum). WhatsApp disimpan hanya angka, format 62xxx.
    whatsapp: text(),
    phone: text(),
    instagram: text(),
    website: text(),
    mapsUrl: text(),

    // Harga dalam rupiah. Semua boleh kosong.
    priceMin: integer(),
    priceMax: integer(),
    priceUnit: priceUnit(),
    priceNote: text(),

    openingHours: jsonb().$type<Record<string, unknown>>(),
    attributes: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    keywords: text().array().notNull().default([]), // sinonim / kata kunci tambahan dari tim

    // Foto: kunci berkas di penyimpanan. `photos` sudah disetujui dan tampil ke warga (yang pertama
    // jadi sampul). `pendingPhotos` kiriman vendor yang menunggu review tim.
    photos: text().array().notNull().default([]),
    pendingPhotos: text().array().notNull().default([]),

    // Alur persetujuan dan verifikasi
    status: listingStatus().notNull().default('draft'),
    reviewNote: text(),
    verificationLevel: verificationLevel().notNull().default('unverified'),
    verifiedAt: timestamp({ withTimezone: true }),
    verifiedBy: text().references(() => user.id, { onDelete: 'set null' }),
    publishedAt: timestamp({ withTimezone: true }),

    // Kepemilikan dan asal data
    ownerId: text().references(() => user.id, { onDelete: 'set null' }), // akun vendor pemilik; kosong bila belum diklaim
    createdBy: text().references(() => user.id, { onDelete: 'set null' }),
    source: listingSource().notNull().default('team'),
    sourceUrl: text(), // dari mana tim menemukan (Instagram, Google Maps, ...)
    ...timestamps
  },
  (t) => [
    index('listings_status_idx').on(t.status),
    index('listings_location_idx').on(t.locationId),
    index('listings_owner_idx').on(t.ownerId),
    index('listings_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
    index('listings_keywords_idx').using('gin', t.keywords),
    index('listings_attributes_idx').using('gin', t.attributes),
    index('listings_earth_idx').using('gist', sql`ll_to_earth(lat, lng)`),
    check('listings_lat_lng_pair', sql`(${t.lat} is null) = (${t.lng} is null)`),
    check(
      'listings_price_range',
      sql`${t.priceMin} is null or ${t.priceMax} is null or ${t.priceMin} <= ${t.priceMax}`
    )
  ]
);

export const listingCategories = pgTable(
  'listing_categories',
  {
    listingId: integer()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    categoryId: integer()
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    isPrimary: boolean().notNull().default(false)
  },
  (t) => [
    primaryKey({ columns: [t.listingId, t.categoryId] }),
    index('listing_categories_category_idx').on(t.categoryId),
    // Satu listing hanya boleh punya satu kategori utama.
    uniqueIndex('listing_categories_one_primary')
      .on(t.listingId)
      .where(sql`${t.isPrimary}`)
  ]
);

// Area layanan untuk penyedia panggilan / daring (biasanya level kota atau kecamatan).
export const listingAreas = pgTable(
  'listing_areas',
  {
    listingId: integer()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    locationId: integer()
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' })
  },
  (t) => [
    primaryKey({ columns: [t.listingId, t.locationId] }),
    index('listing_areas_location_idx').on(t.locationId)
  ]
);

// Foto. Penyimpanan file diputuskan nanti; sekarang cukup menyimpan URL.
export const listingMedia = pgTable(
  'listing_media',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    listingId: integer()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    url: text().notNull(),
    caption: text(),
    sortOrder: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('listing_media_listing_idx').on(t.listingId)]
);

// Usulan perubahan dari vendor pada listing yang sudah terbit.
// Versi terbit tetap tampil sampai admin menyetujui; `changes` berisi {kolom: nilai baru}.
export const listingRevisions = pgTable(
  'listing_revisions',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    listingId: integer()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    changes: jsonb().$type<Record<string, unknown>>().notNull(),
    status: reviewStatus().notNull().default('pending'),
    submittedBy: text().references(() => user.id, { onDelete: 'set null' }),
    reviewedBy: text().references(() => user.id, { onDelete: 'set null' }),
    reviewNote: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp({ withTimezone: true })
  },
  (t) => [index('listing_revisions_listing_status_idx').on(t.listingId, t.status)]
);

// Vendor mengklaim listing yang dibuat tim.
export const listingClaims = pgTable(
  'listing_claims',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    listingId: integer()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    claimantId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    evidence: text(), // mis. bukti kepemilikan nomor WhatsApp
    status: reviewStatus().notNull().default('pending'),
    reviewedBy: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp({ withTimezone: true })
  },
  (t) => [index('listing_claims_listing_status_idx').on(t.listingId, t.status)]
);

// ───────────────────────────── Kamus istilah ─────────────────────────────

// Kamus: kata Minang / sehari-hari -> arti dalam bahasa Indonesia. Dibaca chatbot sebagai
// terjemahan dan konteks. Sebutan untuk kategori, kebutuhan, dan lokasi diatur di masing-masing menu.
// `term` disimpan huruf kecil tanpa tanda baca oleh aplikasi.
export const glossaryTerms = pgTable(
  'glossary_terms',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    term: text().notNull().unique(),
    meaning: text().notNull(),
    notes: text(),
    // Sudah dicek penutur asli. Hanya istilah yang sudah dicek dipakai chatbot.
    isChecked: boolean().notNull().default(false),
    ...timestamps
  },
  (t) => [index('glossary_terms_term_trgm_idx').using('gin', t.term.op('gin_trgm_ops'))]
);

// ───────────────────────────── Chatbot ─────────────────────────────
// Percakapan dicatat tanpa akun: hanya ID sesi acak (cookie) dan hash IP untuk pembatasan. Lihat kebijakan privasi (UU PDP).

// template = balasan tetap; rules = dipahami kode lalu mencari; llm = lewat model AI; limit = ditolak batas pemakaian
export const chatRoute = pgEnum('chat_route', ['template', 'rules', 'llm', 'limit', 'error']);

export const chatSessions = pgTable(
  'chat_sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    ipHash: text(),
    messageCount: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('chat_sessions_ip_idx').on(t.ipHash, t.createdAt)]
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sessionId: uuid()
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: text().notNull(), // 'user' | 'assistant'
    content: text().notNull(), // teks polos (untuk riwayat model dan analisis)
    parts: jsonb().$type<unknown[]>().notNull().default([]), // bagian pesan untuk ditampilkan ulang (teks, kartu, tombol)
    route: chatRoute(), // diisi untuk pesan asisten
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('chat_messages_session_idx').on(t.sessionId, t.id),
    check('chat_messages_role', sql`${t.role} in ('user', 'assistant')`)
  ]
);

// Satu baris per panggilan ke model AI: dasar untuk batas biaya harian dan evaluasi vendor.
export const llmCalls = pgTable(
  'llm_calls',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sessionId: uuid().references(() => chatSessions.id, { onDelete: 'set null' }),
    model: text().notNull(),
    tier: text().notNull(),
    inputTokens: integer().notNull().default(0),
    cachedTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    costUsd: numeric({ precision: 12, scale: 6 }), // kosong bila harga belum diisi di pengaturan
    latencyMs: integer(),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('llm_calls_created_idx').on(t.createdAt)]
);

// Satu baris per pencarian direktori (dari kode maupun model AI). Sumber "kebutuhan yang belum terpenuhi":
// pencarian dengan hasil nol, dikelompokkan menurut `needKey`. `query` dikosongkan oleh db:purge-chat setelah
// masa simpan; kolom lain tidak memuat teks bebas warga.
export const searchLogs = pgTable(
  'search_logs',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sessionId: uuid().references(() => chatSessions.id, { onDelete: 'set null' }),
    source: text().notNull(), // 'rules' | 'llm'
    status: text().notNull(), // ok | need_location_choice | location_not_found | no_category
    query: text(), // kata yang dipakai mencari (maks 200 karakter)
    needKey: text().notNull(), // kunci pengelompokan: nama kategori, atau kata kunci bila kategori tak dikenal
    label: text().notNull(), // teks tampilan kunci di atas
    locationId: integer().references(() => locations.id, { onDelete: 'set null' }),
    locationName: text(),
    resultCount: integer().notNull().default(0),
    altCount: integer().notNull().default(0), // terbanyak hasil dari saran pelonggaran ("di seluruh Sumbar" dst.)
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('search_logs_created_idx').on(t.createdAt),
    index('search_logs_need_idx').on(t.needKey, t.createdAt)
  ]
);

// Klik kontak dan sejenisnya: bahan ukuran sukses v1 (persentase percakapan yang berakhir dengan klik kontak).
export const chatEvents = pgTable(
  'chat_events',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sessionId: uuid()
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    listingId: integer().references(() => listings.id, { onDelete: 'set null' }),
    type: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('chat_events_type_idx').on(t.type, t.createdAt)]
);
