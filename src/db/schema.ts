import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
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

// Pintu "Ka-" di beranda. active: tampil; soon: tampil dengan tanda "Segera"; hidden: tidak tampil.
export const doorStatus = pgEnum('door_status', ['active', 'soon', 'hidden']);
// single: satu kebutuhan; plan: rencana gabungan (Kabaralek); guide: panduan (Kabatanyo).
export const doorKind = pgEnum('door_kind', ['single', 'plan', 'guide']);

// Cara Mesin Jadwal menghitung ketersediaan kategori. none = tanpa jadwal (formulir permintaan / informasi).
export const scheduleKind = pgEnum('schedule_kind', [
  'slot',
  'seat',
  'date_stock',
  'survey',
  'none'
]);

// provider: bisa dipesan lewat Kamanga. place: informasi saja (kafe, wisata, apotek 24 jam, IGD).
export const listingKind = pgEnum('listing_kind', ['provider', 'place']);

// sent → accepted → in_progress → completed; sent → rejected | expired; accepted/in_progress → cancelled.
// Status sent juga berarti slot sedang ditahan.
export const bookingStatus = pgEnum('booking_status', [
  'sent',
  'accepted',
  'in_progress',
  'completed',
  'rejected',
  'expired',
  'cancelled'
]);
export const bookingActor = pgEnum('booking_actor', ['citizen', 'provider', 'admin', 'system']);

export const slotBlockReason = pgEnum('slot_block_reason', ['walk_in', 'whatsapp', 'other']);

// Asal tanya jawab penyedia: ditulis penyedia sendiri, atau berasal dari pertanyaan warga.
export const qaSource = pgEnum('qa_source', ['provider', 'citizen']);

export const waDirection = pgEnum('wa_direction', ['outbound', 'inbound']);
// link = mode cadangan: pesan dibuat sebagai tautan wa.me dan dikirim oleh orang yang menekannya.
export const waStatus = pgEnum('wa_status', [
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
  'link'
]);

// Titik dan poligon PostGIS (geography, SRID 4326). Nilai dibaca lewat SQL (ST_X, ST_Distance, ST_Covers),
// bukan di TypeScript.
const geoPoint = customType<{ data: string }>({ dataType: () => 'geography(Point, 4326)' });
const geoMultiPolygon = customType<{ data: string }>({
  dataType: () => 'geography(MultiPolygon, 4326)'
});
// Titik dihitung database dari kolom lat/lng (formulir dan CSV tetap menulis lat/lng).
const pointFromLatLng = sql`case when lat is not null and lng is not null then st_setsrid(st_makepoint(lng, lat), 4326)::geography end`;

// ───────────────────── Taksonomi: kategori & kebutuhan ─────────────────────

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
};

// Pintu "Ka-" yang dilihat warga di beranda (Ka main, Ka servis, ...). Nama, ikon, urutan, dan status diatur admin.
export const doors = pgTable('doors', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  // Kunci ikon dari `Icons` (src/components/icons.tsx).
  icon: text(),
  description: text(),
  // Teks berganti di bawah judul beranda, mis. "ka main…".
  rotatingText: text(),
  // Sebutan lain yang mengarah ke pintu ini (mis. "sewa lapangan" → Ka main). Disimpan sudah diseragamkan.
  aliases: text().array().notNull().default([]),
  sortOrder: integer().notNull().default(0),
  status: doorStatus().notNull().default('hidden'),
  kind: doorKind().notNull().default('single'),
  ...timestamps
});

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
  // Pintu utama (kosong = kategori tanpa pintu, tetap ditemukan lewat chat).
  doorId: integer().references(() => doors.id, { onDelete: 'set null' }),
  scheduleKind: scheduleKind().notNull().default('none'),
  // Batas waktu penyedia menjawab pesanan. Kosong = bawaan di pengaturan (30 menit).
  responseMinutes: integer(),
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
    // Kode wilayah resmi Kemendagri, mis. "13.71.06" (Kuranji). Kosong untuk landmark.
    officialCode: text().unique(),
    lat: doublePrecision(),
    lng: doublePrecision(),
    center: geoPoint().generatedAlwaysAs(pointFromLatLng),
    // Poligon batas wilayah dari data resmi (diimpor skrip scripts/wilayah).
    boundary: geoMultiPolygon(),
    ...timestamps
  },
  (t) => [
    index('locations_parent_idx').on(t.parentId),
    index('locations_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
    index('locations_center_idx').using('gist', t.center),
    index('locations_boundary_idx').using('gist', t.boundary),
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
    kind: listingKind().notNull().default('provider'),
    slug: text().notNull().unique(),
    name: text().notNull(),
    summary: text(), // satu-dua kalimat untuk kartu
    description: text(),

    // Titik lokasi (usaha atau markas). Area layanan: daftar wilayah di `listing_areas` dan/atau radius.
    address: text(),
    locationId: integer().references(() => locations.id, { onDelete: 'set null' }),
    lat: doublePrecision(),
    lng: doublePrecision(),
    point: geoPoint().generatedAlwaysAs(pointFromLatLng),
    // false = usaha rumahan/perorangan: publik hanya melihat kecamatan; titik dipakai untuk jarak saja.
    pointIsPublic: boolean().notNull().default(true),
    serviceRadiusKm: doublePrecision(),
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
    index('listings_point_idx').using('gist', t.point),
    check('listings_lat_lng_pair', sql`(${t.lat} is null) = (${t.lng} is null)`),
    check('listings_service_radius', sql`${t.serviceRadiusKm} is null or ${t.serviceRadiusKm} > 0`),
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

// Tanya jawab bebas per penyedia (PRD 8.8 lapis 2). answer kosong = pertanyaan warga yang menunggu dijawab.
export const listingQa = pgTable(
  'listing_qa',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    listingId: integer()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    question: text().notNull(),
    answer: text(),
    source: qaSource().notNull().default('provider'),
    // Penanya (warga berakun atau sesi chat tamu), agar jawaban bisa diteruskan kepadanya.
    askedBy: text().references(() => user.id, { onDelete: 'set null' }),
    chatSessionId: uuid().references((): AnyPgColumn => chatSessions.id, { onDelete: 'set null' }),
    answeredAt: timestamp({ withTimezone: true }),
    sortOrder: integer().notNull().default(0),
    ...timestamps
  },
  (t) => [index('listing_qa_listing_idx').on(t.listingId, t.sortOrder)]
);

// ───────────────────────────── Mesin Jadwal ─────────────────────────────
// Semua jam dinding di tabel ini (time, date) dalam zona Asia/Jakarta.

// Sesuatu yang dijadwalkan di dalam satu penyedia: Lapangan 1, Kursi barber A, rute travel Padang → Bukittinggi.
export const units = pgTable(
  'units',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    listingId: integer()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    // Jumlah kursi per keberangkatan (jadwal seat). Untuk jadwal slot selalu 1.
    capacity: integer().notNull().default(1),
    // Rute travel (jadwal seat).
    originLocationId: integer().references(() => locations.id, { onDelete: 'set null' }),
    destinationLocationId: integer().references(() => locations.id, { onDelete: 'set null' }),
    isActive: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    ...timestamps
  },
  (t) => [
    index('units_listing_idx').on(t.listingId),
    check('units_capacity', sql`${t.capacity} >= 1`)
  ]
);

// Jam buka mingguan per unit. Boleh beberapa baris per hari. end_time <= start_time berarti lewat tengah malam.
// Jadwal seat: satu baris = satu keberangkatan pada start_time, slot_minutes = lama perjalanan.
export const scheduleRules = pgTable(
  'schedule_rules',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    unitId: integer()
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    weekday: smallint().notNull(), // 0 = Minggu … 6 = Sabtu
    startTime: time().notNull(),
    endTime: time().notNull(),
    slotMinutes: integer().notNull().default(60),
    gapMinutes: integer().notNull().default(0), // jeda antarslot
    minMinutes: integer(), // durasi minimal satu pesanan; kosong = satu slot
    price: integer(), // rupiah per slot (seat: per kursi)
    peakPrice: integer(), // harga jam ramai
    peakStart: time(),
    peakEnd: time(),
    ...timestamps
  },
  (t) => [
    index('schedule_rules_unit_idx').on(t.unitId, t.weekday),
    check('schedule_rules_weekday', sql`${t.weekday} between 0 and 6`),
    check('schedule_rules_slot', sql`${t.slotMinutes} > 0 and ${t.gapMinutes} >= 0`),
    check('schedule_rules_peak_pair', sql`(${t.peakStart} is null) = (${t.peakEnd} is null)`)
  ]
);

// Libur atau jam khusus pada tanggal tertentu. unit_id kosong = berlaku untuk semua unit penyedia.
export const scheduleExceptions = pgTable(
  'schedule_exceptions',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    listingId: integer()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    unitId: integer().references(() => units.id, { onDelete: 'cascade' }),
    date: date().notNull(),
    isClosed: boolean().notNull().default(true),
    // Jam khusus bila tidak tutup (menggantikan jam buka mingguan hari itu).
    startTime: time(),
    endTime: time(),
    note: text(),
    ...timestamps
  },
  (t) => [
    index('schedule_exceptions_listing_date_idx').on(t.listingId, t.date),
    check(
      'schedule_exceptions_hours',
      sql`${t.isClosed} or (${t.startTime} is not null and ${t.endTime} is not null)`
    )
  ]
);

// Blokir manual: slot terisi dari luar Kamanga (walk-in, pesanan lewat WA). Constraint anti-tumpang-tindih
// antar-blokir ada di migrasi (exclusion constraint).
export const slotBlocks = pgTable(
  'slot_blocks',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    unitId: integer()
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    reason: slotBlockReason().notNull().default('other'),
    note: text(),
    createdBy: text().references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('slot_blocks_unit_idx').on(t.unitId, t.startsAt),
    check('slot_blocks_range', sql`${t.startsAt} < ${t.endsAt}`)
  ]
);

// ───────────────────────────── Mesin Pesanan ─────────────────────────────

// Pesanan. Slot tertahan selama status sent. Anti-tumpang-tindih per unit (exclusive = true) dijamin
// exclusion constraint `bookings_no_overlap` di migrasi. Kontak warga ada di booking_contacts.
export const bookings = pgTable(
  'bookings',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    code: text().notNull().unique(), // nomor pesanan untuk warga dan penyedia, mis. "K7F3QX"
    citizenId: text().references(() => user.id, { onDelete: 'set null' }), // kosong bila akun warga dihapus
    listingId: integer()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    categoryId: integer()
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    unitId: integer().references(() => units.id), // kosong untuk permintaan tanpa jadwal (Ka servis)
    status: bookingStatus().notNull().default('sent'),
    startsAt: timestamp({ withTimezone: true }),
    endsAt: timestamp({ withTimezone: true }),
    seats: integer().notNull().default(1), // jumlah orang / kursi
    // false untuk kursi travel: banyak pesanan berbagi satu keberangkatan sampai kapasitas habis.
    exclusive: boolean().notNull().default(true),
    // Kecamatan lokasi layanan: satu-satunya data lokasi warga yang terlihat penyedia sebelum menerima.
    districtId: integer().references(() => locations.id, { onDelete: 'set null' }),
    // Rincian sesuai jenis: { problem, preferredDate, period } untuk servis, { people, racket } untuk lapangan, ...
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    // Aturan penting yang disetujui warga saat memesan (durasi minimal, pembatalan, DP).
    rulesSnapshot: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    price: integer(), // harga tertera (rupiah) saat memesan
    respondBy: timestamp({ withTimezone: true }),
    respondedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    remindedAt: timestamp({ withTimezone: true }), // pengingat ke warga sebelum jadwal
    providerRemindedAt: timestamp({ withTimezone: true }), // pengingat ke penyedia yang belum menjawab
    reviewRequestedAt: timestamp({ withTimezone: true }), // "Puas?" sudah dikirim
    adminNote: text(),
    // Hash token tautan Terima/Tolak untuk penyedia tanpa akun. Token aslinya hanya ada di pesan WA.
    providerTokenHash: text().unique(),
    ...timestamps
  },
  (t) => [
    index('bookings_listing_status_idx').on(t.listingId, t.status),
    index('bookings_citizen_idx').on(t.citizenId, t.createdAt),
    index('bookings_status_respond_idx').on(t.status, t.respondBy),
    index('bookings_unit_time_idx').on(t.unitId, t.startsAt),
    check('bookings_time_pair', sql`(${t.startsAt} is null) = (${t.endsAt} is null)`),
    check('bookings_time_range', sql`${t.startsAt} is null or ${t.startsAt} < ${t.endsAt}`),
    check('bookings_seats', sql`${t.seats} >= 1`),
    check('bookings_unit_has_time', sql`${t.unitId} is null or ${t.startsAt} is not null`)
  ]
);

// Kontak dan alamat lengkap warga untuk satu pesanan. Hanya dibaca mesin Pesanan, dan baru dibuka ke
// penyedia setelah pesanan diterima (UU PDP, PRD 8.5).
export const bookingContacts = pgTable('booking_contacts', {
  bookingId: integer()
    .primaryKey()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  phone: text().notNull(), // 62xxx
  address: text(),
  lat: doublePrecision(),
  lng: doublePrecision(),
  note: text() // patokan, mis. "pagar hijau dekat musala"
});

// Riwayat status pesanan: siapa, kapan, alasan.
export const bookingEvents = pgTable(
  'booking_events',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    bookingId: integer()
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    fromStatus: bookingStatus(),
    toStatus: bookingStatus().notNull(),
    actor: bookingActor().notNull(),
    actorUserId: text().references(() => user.id, { onDelete: 'set null' }),
    reason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('booking_events_booking_idx').on(t.bookingId, t.createdAt)]
);

// Ulasan dari pesanan selesai. Bentuk akhir (puas/kurang puas atau bintang) masih terbuka (PRD 18 no. 3).
export const reviews = pgTable(
  'reviews',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    bookingId: integer()
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    listingId: integer()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    citizenId: text().references(() => user.id, { onDelete: 'set null' }),
    satisfied: boolean().notNull(),
    stars: smallint(),
    comment: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('reviews_listing_idx').on(t.listingId, t.createdAt),
    check('reviews_stars', sql`${t.stars} is null or ${t.stars} between 1 and 5`)
  ]
);

// ───────────────────────────── Warga ─────────────────────────────

// Alamat tersimpan warga (Rumah, Kantor). Satu-satunya tempat koordinat perangkat warga boleh disimpan.
export const savedAddresses = pgTable(
  'saved_addresses',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    label: text().notNull(),
    address: text().notNull(),
    lat: doublePrecision(),
    lng: doublePrecision(),
    locationId: integer().references(() => locations.id, { onDelete: 'set null' }), // wilayah hasil pencocokan
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('saved_addresses_user_idx').on(t.userId),
    check('saved_addresses_lat_lng_pair', sql`(${t.lat} is null) = (${t.lng} is null)`)
  ]
);

// ───────────────────────────── Notifikasi WhatsApp ─────────────────────────────

// Semua pesan WA, keluar dan masuk. `params` tidak pernah memuat kode OTP.
export const waMessages = pgTable(
  'wa_messages',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    direction: waDirection().notNull(),
    template: text(),
    phone: text().notNull(),
    status: waStatus().notNull().default('queued'),
    mode: text().notNull(), // 'api' | 'fallback'
    bookingId: integer().references(() => bookings.id, { onDelete: 'set null' }),
    providerMessageId: text().unique(), // id pesan dari WhatsApp Cloud API
    params: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    error: text(),
    ...timestamps
  },
  (t) => [
    index('wa_messages_booking_idx').on(t.bookingId),
    index('wa_messages_phone_idx').on(t.phone, t.createdAt)
  ]
);

// Kode OTP masuk warga. Hanya hash kode yang disimpan.
export const waOtps = pgTable(
  'wa_otps',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    phone: text().notNull(),
    codeHash: text().notNull(),
    attempts: integer().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('wa_otps_phone_idx').on(t.phone, t.createdAt)]
);

// ───────────────────────────── Pengaturan & statistik ─────────────────────────────

// Pengaturan yang diubah admin tanpa koding: template WA, batas waktu menjawab bawaan, ...
export const appSettings = pgTable('app_settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedBy: text().references(() => user.id, { onDelete: 'set null' }),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
});

// Hitungan harian per listing untuk statistik mitra (dilihat, klik WA). Tanpa data pribadi.
export const listingDailyStats = pgTable(
  'listing_daily_stats',
  {
    listingId: integer()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    day: date().notNull(),
    views: integer().notNull().default(0),
    waClicks: integer().notNull().default(0)
  },
  (t) => [primaryKey({ columns: [t.listingId, t.day] })]
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
