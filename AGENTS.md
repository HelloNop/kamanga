# AGENTS.md — Panduan agen AI untuk Kamanga

Berlaku untuk semua agen (Claude Code, Codex, Cursor, dll.). `CLAUDE.md` hanya memuat berkas ini.

## Proyek

Kamanga ("ka manga?" = mau apa?) adalah asisten urusan sehari-hari warga Sumatra Barat, dimulai dari Kota Padang. Warga memilih **pintu "Ka-"** (Ka main, Ka rawat diri, Ka uda anta, Ka servis, ...) atau bercerita bebas. Kamanga memahami kebutuhannya, menampilkan penyedia lokal terverifikasi beserta slot kosong, meneruskan **pesanan** ke penyedia lewat WhatsApp, lalu menutupnya dengan ulasan. Pintu adalah tampilan untuk warga; **mesin** (Jadwal, Pesanan, Lokasi, Notifikasi) adalah kemampuan di belakangnya yang dipakai banyak pintu. Pintu baru sebisa mungkin hanya data, bukan kode baru.

- **Acuan produk satu-satunya: [KAMANGA_PRD.md](./KAMANGA_PRD.md).** Baca sebelum merancang fitur. Jangan membuat dokumen PRD/konsep baru; perbarui berkas itu. Dokumen lama di `docs/arsip/` bukan acuan.
- Rencana kerja tahap 1 (gelombang dan sub-agent): [docs/prompt-tahap1.md](./docs/prompt-tahap1.md). Lead mencatat kemajuan di `docs/PROGRESS.md` dan peta perubahan kode di `docs/rencana-tahap1.md`.
- Repo ini v2. v1 ada di repo `kamanga-ai` dan tidak diubah.
- Panduan teknis: [docs/forms.md](./docs/forms.md) (formulir), [docs/themes.md](./docs/themes.md) (tema).

## Pemilik proyek

- Masih belajar, terutama AI/ML. Pakai **Bahasa Indonesia** yang sederhana, jelaskan alasan di balik keputusan teknis, dan jelaskan istilah teknis saat pertama dipakai.
- Untuk perubahan besar, jelaskan rencana dulu sebelum mengubah kode.
- Biaya harus hemat: masa perintisan gratis penuh untuk warga dan penyedia.

## Aturan keras

1. **Database:** hanya `kamanga_v2` (`DATABASE_URL` di `.env.local`). Jangan pernah menyentuh database `kamanga` milik v1.
2. **Rahasia:** jangan menulis kunci API atau rahasia ke kode, log, atau commit. `.env.local` tidak di-commit.
3. **WhatsApp:** semua pengiriman lewat **satu adapter**. Bawaan adalah **mode cadangan**: tautan `wa.me` berisi pesan terisi yang diklik warga/penyedia, dan kode OTP dicetak ke log server saat pengembangan. WhatsApp Business API resmi hanya aktif bila variabel env-nya diisi. Jangan memakai jalur WhatsApp tidak resmi.
4. **AI tidak boleh mengarang** penyedia, harga, jadwal, atau kontak. Kartu hasil, harga, slot, dan tombol dibuat kode dari database. Nomor kontak dan identitas warga tidak pernah dikirim ke model.
5. **Privasi (UU PDP):** nomor dan alamat lengkap warga hanya bisa dibaca penyedia **setelah** pesanan diterima; sebelumnya hanya kecamatan. Koordinat perangkat tidak disimpan kecuali warga menjadikannya alamat. Aturan ini wajib punya uji.
6. **Kepemilikan file saat kerja paralel:** sub-agent hanya mengubah folder miliknya. File bersama (`src/db/schema.ts`, migrasi, `package.json`, `src/lib/engines/contracts.ts`, konfigurasi) dan folder yang tidak dimiliki sub-agent mana pun hanya diubah lead; sub-agent menulis permintaannya di laporan.
7. **Tanpa layanan berbayar baru**, dan tanpa dependensi besar baru kecuali alasannya ditulis.
8. **Bahasa:** nama tabel, kolom, enum, dan kode bahasa Inggris; semua teks untuk pengguna Bahasa Indonesia.
9. Jangan menghapus data atau file pengguna di luar rencana. Bila ragu, tanya.

## Kerja paralel (sub-agent)

- Sub-agent tahap 1 didefinisikan di `.claude/agents/` (`agent-jadwal`, `agent-pesanan`, `agent-lokasi`, `agent-wa`, `agent-ui-warga`, `agent-ui-mitra`, `agent-ui-admin`, `agent-chat`, `agent-penguji`). Lead menjalankannya sesuai `docs/prompt-tahap1.md`.
- Sebelum mulai, sub-agent membaca berkas ini, `KAMANGA_PRD.md` (bagian yang disebut di brief), `docs/rencana-tahap1.md`, dan `src/lib/engines/contracts.ts`.
- Uji logika ditulis sebagai `*.check.ts` di folder sendiri; lead yang mendaftarkannya sebagai script `check:*`.
- Sebelum melapor: jalankan `bun run typecheck` dan uji sendiri.
- **Laporan akhir wajib:** file yang diubah, cara menguji, hasil uji, permintaan perubahan file bersama, dan hal yang belum selesai.

## Ruang lingkup tahap 1 (PRD §7, §14, §17)

- **Dikerjakan:** pintu Ka main, Ka rawat diri, Ka uda anta, Ka servis (tanpa diagnosis), data Tempat (informasi saja); mesin Jadwal, Pesanan, Lokasi (PostGIS), Notifikasi WA (dengan cadangan); beranda "Kamanga hari ko?"; akun warga lewat OTP WA; dashboard mitra; perubahan dashboard admin; chat bebas yang diteruskan ke mesin.
- **Tidak dikerjakan** (cukup jangan menghalangi di masa depan): pembayaran, saldo, tagihan, langganan; Panduan, Estimasi, Rekomendasi; Ka manyewa, Ka jalan-jalan, Kabatanyo, Kabaralek, Ka balanjo, Ka baubek; pintu freelancer; asisten AI untuk admin; chatbot di nomor penyedia; aplikasi native.

## Istilah PRD → kode

| PRD | Kode |
|---|---|
| Pintu | `doors` (baru) |
| Kategori, kelompok | `categories`, `category_groups`; isian aturan di `categories.attribute_schema`, nilainya di `listings.attributes` |
| Kebutuhan | `needs` |
| Kamus | `glossary_terms` |
| Wilayah (gazetteer) | `locations`, `location_aliases` |
| Penyedia / Tempat | `listings` dengan jenis `provider` / `place` (baru) |
| Mitra | peran Better Auth `vendor` |
| Warga | peran `citizen` (baru, login nomor WA + OTP) |
| Unit, aturan jadwal, pengecualian, blokir | `units`, `schedule_rules`, `schedule_exceptions`, `slot_blocks` (baru) |
| Pesanan, riwayat status | `bookings`, `booking_events` (baru) |
| Ulasan, tanya jawab penyedia | `reviews`, `listing_qa` (baru) |

Status listing: `draft` → `pending_review` → `published` / `rejected` → `archived`. Tingkat verifikasi terpisah: `unverified`, `contact_checked`, `visited`.

## Database

- Lokal: PostgreSQL 18 (Homebrew) dengan **PostGIS**, pgvector, pg_trgm, btree_gist. Database proyek: **`kamanga_v2`**.
- Skema di `src/db/schema.ts` (tabel login di `auth-schema.ts`). Alur mengubah skema: edit `schema.ts` → `bun run db:generate` → periksa SQL di `src/db/migrations` → `bun run db:migrate`.
- Nama tabel, kolom, dan enum bahasa Inggris (snake_case di database, camelCase di TypeScript).
- Semua waktu disimpan `timestamptz` dan dihitung dalam zona Asia/Jakarta.
- Slot dan pesanan untuk unit yang sama tidak boleh tumpang tindih: dijamin constraint database, bukan hanya kode.
- `db:fresh` **menghapus seluruh isi database** lalu membangun ulang (menolak jalan di luar localhost). Pastikan `DATABASE_URL` menunjuk `kamanga_v2` sebelum menjalankannya.

## Perintah

```bash
bun install
bun run dev                # http://localhost:3000
bun run typecheck
bun run lint               # oxlint
bun run format             # oxfmt
bun run build

bun run db:migrate         # terapkan migrasi
bun run db:seed-reference  # data acuan: lokasi, kategori, kebutuhan, kamus (aman diulang)
bun run auth:create-admin  # akun admin dari ADMIN_EMAIL / ADMIN_PASSWORD
bun run db:fresh           # kosongkan + migrasi + data acuan + admin
bun run db:fresh:dummy     # ditambah data dummy
bun run db:seed-dummy      # listing dummy dari data/dummy-listings.csv (hapus: db:clear-dummy)

bun run check:search       # pemeriksaan logika; daftar lengkap check:* ada di package.json
bun run eval:chat          # set uji chatbot
```

Tidak ada framework test. Logika penting diperiksa lewat berkas `*.check.ts` (assert biasa, dijalankan dengan bun) yang didaftarkan sebagai script `check:*`. `check:search` dan `check:chat` membaca database sungguhan dan butuh data acuan + listing dummy. Satu-satunya data contoh adalah listing dummy (slug `dummy-`, nama `[DUMMY]`) yang memakai kategori acuan; jangan membuat kategori atau kebutuhan contoh tersendiri.

Git hook (Husky): pre-commit merapikan format berkas yang di-stage, pre-push menjalankan `bun run build`.

## Struktur

```
src/
├── app/
│   ├── (publik)/            # halaman warga: /jelajah, /listing/[slug]
│   ├── chat/                # /chat
│   ├── dashboard/           # panel admin dan penyedia (mitra: /dashboard/my-listings)
│   ├── auth/                # masuk / daftar
│   └── api/                 # /api/chat, /api/auth, /api/photos
├── db/                      # skema, migrasi, seed, data acuan (data/)
├── lib/
│   ├── directory/           # memahami kata warga, pencarian, ranking (tanpa AI)
│   ├── kamanga-ai/          # router template → kode → AI, gateway model, agent, batas pemakaian, eval
│   ├── engines/             # (tahap 1) mesin jadwal, pesanan, lokasi, notifikasi; kontrak di contracts.ts
│   └── auth.ts, session.ts  # Better Auth; requireSession / requireAdmin / requireVendor
├── features/<nama>/         # modul per fitur: api/, components/, schemas/, lib/
├── components/              # ui/ (shadcn), layout/, forms/fields/, icons.tsx
└── config/nav-config.ts     # menu sidebar; `access: { role }` menyaring per peran
data/                        # CSV lokasi Sumbar dan listing dummy
```

Arah ketergantungan: `lib/kamanga-ai` boleh memanggil `lib/directory` dan `lib/engines`, tidak sebaliknya. Halaman dan fitur memanggil mesin lewat `contracts.ts`.

## Pola kode

**Lapisan data per fitur** (`src/features/<nama>/api/`):
- `repository.ts`: query Drizzle, tanpa cek login.
- `service.ts`: `'use server'`. **Setiap fungsi wajib memanggil `requireAdmin()` atau `requireVendor()` (atau pengecek warga) lebih dulu**, karena Server Action adalah endpoint publik.
- `types.ts`: bentuk data. `queries.ts`: key factory (`entityKeys.all/list/detail`) + `queryOptions`. `mutations.ts`: `mutationOptions` + invalidasi cache.
- Komponen mengimpor dari `service`, `queries`, dan `mutations`; tidak memanggil `repository` langsung.
- `src/proxy.ts` hanya mengecek ada tidaknya cookie sesi; pengaman sebenarnya adalah `require*()` di layout, halaman, dan service.

**React Query**: di server `void queryClient.prefetchQuery(...)` + `HydrationBoundary`/`dehydrate`; di klien `useSuspenseQuery` di dalam `<Suspense fallback>`; `useMutation` untuk formulir.

**URL state**: `nuqs`, yaitu `searchParamsCache` di server dan `useQueryStates` di klien; urutan tabel memakai `getSortingStateParser` (sama dengan `useDataTable`).

**Formulir**: `useAppForm` dari `@/lib/form` + `form.AppField` dengan komponen di `@/components/forms/fields` (`field.TextField`, `field.SelectField`, …); `form.Field` mentah untuk isian khusus; validasi Zod di level formulir. Jangan memakai `useState` di dalam render prop. Detail di `docs/forms.md`.

**UI**:
- Ikon hanya dari `@/components/icons` (`Icons.nama`), jangan impor `@tabler/icons-react` langsung. Ikon baru didaftarkan dulu di `icons.tsx`.
- Judul halaman panel lewat props `PageContainer` (`pageTitle`, `pageDescription`, `pageHeaderAction`), jangan `<Heading>` manual.
- `cn()` untuk menggabung kelas. Server component secara bawaan; `'use client'` hanya bila perlu.
- Komponen shadcn baru: `bunx shadcn add <nama>`.
- Satu tema `kamanga` (terang/gelap). Halaman warga memakai token sendiri yang dibatasi satu kelas pembungkus (contoh `.kmg` di `src/features/chat/chat.css`). Detail di `docs/themes.md`.
- Halaman warga mobile-first mulai lebar 360 px, target sentuh 44 px, kontras teks 4.5:1, label pada semua kontrol.

**Gaya**: oxfmt dengan kutip tunggal (juga di JSX), titik koma, tanpa koma di akhir, indentasi 2 spasi. Komentar kode Bahasa Indonesia, secukupnya. Alias impor `@/*` untuk `src/`.

## Lingkungan

- Salin `env.example.txt` ke `.env.local`. Tanpa `LLM_PROVIDER`, chatbot tetap jalan lewat template dan kode. Tanpa variabel WhatsApp, notifikasi berjalan dalam mode cadangan.
- Akun AI gratisan / 9router hanya untuk uji coba lokal, bukan layanan warga.
- Produksi nanti di VPS (Docker Compose + Caddy); build untuk VPS memakai `BUILD_STANDALONE=true`.
