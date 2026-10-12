# AGENTS.md — Panduan agen AI untuk Kamanga v2

Berlaku untuk semua agen (Claude Code, Codex, Cursor, dll.). `CLAUDE.md` hanya memuat berkas ini.

## Proyek

Kamanga adalah asisten lokal untuk warga Sumatra Barat. Warga memilih pintu "Ka-" (Ka main, Ka rancak, Ka uda anta, Ka servis, ...) atau mengetik bebas. Kamanga mencarikan penyedia terverifikasi dan slot kosong, lalu warga memesan lewat WhatsApp penyedia.

- **Acuan produk satu-satunya: [KAMANGA_PRD.md](./KAMANGA_PRD.md).** Baca sebelum merancang fitur. Jangan membuat dokumen PRD/konsep baru; perbarui berkas itu.
- Repo ini v2. v1 ada di repo `kamanga-ai` dan tidak diubah.
- Panduan teknis: [docs/forms.md](./docs/forms.md) (formulir), [docs/themes.md](./docs/themes.md) (tema).

## Pemilik proyek

- Masih belajar, terutama AI/ML. Pakai **Bahasa Indonesia** yang sederhana, jelaskan alasan di balik keputusan teknis, dan jelaskan istilah teknis saat pertama dipakai.
- Untuk perubahan besar, jelaskan rencana dulu sebelum mengubah kode.
- Biaya harus hemat: layanan masih gratis untuk warga dan penyedia.

## Batasan tahap ini (PRD §4)

- WhatsApp **hanya tautan `wa.me`** yang diklik warga, dengan pesan terisi otomatis. Jangan membangun WhatsApp Business API, OTP, notifikasi, atau bot WhatsApp.
- Login tetap Better Auth **email + kata sandi** untuk admin dan penyedia. Warga tanpa akun.
- AI tidak boleh mengarang usaha, harga, jadwal, kontak. Kartu, harga, dan tombol WhatsApp dibuat kode dari database; nomor kontak tidak dikirim ke model.

## Database

- Lokal: PostgreSQL 18 (Homebrew) dengan pgvector. Database proyek ini **`kamanga_v2`** (`DATABASE_URL` di `.env.local`). **Jangan menyentuh database `kamanga`** (milik v1).
- Skema di `src/db/schema.ts` (tabel login di `auth-schema.ts`). Alur mengubah skema: edit `schema.ts` → `bun run db:generate` → periksa SQL di `src/db/migrations` → `bun run db:migrate`.
- Nama tabel, kolom, dan enum bahasa Inggris (snake_case di database, camelCase di TypeScript). Teks untuk pengguna Bahasa Indonesia.
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
│   ├── dashboard/           # panel admin dan penyedia
│   ├── auth/                # masuk / daftar
│   └── api/                 # /api/chat, /api/auth, /api/photos
├── db/                      # skema, migrasi, seed, data acuan (data/)
├── lib/
│   ├── directory/           # SISTEM 1: memahami kata warga, pencarian, ranking (tanpa AI)
│   ├── kamanga-ai/          # SISTEM 2: router, gateway model, agent, batas pemakaian, eval
│   └── auth.ts, session.ts  # Better Auth; requireSession / requireAdmin / requireVendor
├── features/<nama>/         # modul per fitur: api/, components/, schemas/, lib/
├── components/              # ui/ (shadcn), layout/, forms/fields/, icons.tsx
└── config/nav-config.ts     # menu sidebar; `access: { role }` menyaring per peran
data/                        # CSV lokasi Sumbar dan contoh listing
```

Arah ketergantungan: `lib/kamanga-ai` boleh memanggil `lib/directory`, tidak sebaliknya.

## Pola kode

**Lapisan data per fitur** (`src/features/<nama>/api/`):
- `repository.ts`: query Drizzle, tanpa cek login.
- `service.ts`: `'use server'`. **Setiap fungsi wajib memanggil `requireAdmin()` atau `requireVendor()` lebih dulu**, karena Server Action adalah endpoint publik.
- `types.ts`: bentuk data. `queries.ts`: key factory (`entityKeys.all/list/detail`) + `queryOptions`. `mutations.ts`: `mutationOptions` + invalidasi cache.
- Komponen mengimpor dari `service`, `queries`, dan `mutations`; tidak memanggil `repository` langsung.
- `src/proxy.ts` hanya mengecek ada tidaknya cookie sesi; pengaman sebenarnya adalah `require*()` di layout, halaman, dan service.

**React Query**: di server `void queryClient.prefetchQuery(...)` + `HydrationBoundary`/`dehydrate`; di klien `useSuspenseQuery` di dalam `<Suspense fallback>`; `useMutation` untuk formulir.

**URL state**: `nuqs`, yaitu `searchParamsCache` di server dan `useQueryStates` di klien; urutan tabel memakai `getSortingStateParser` (sama dengan `useDataTable`).

**Formulir**: `useAppForm` dari `@/lib/form` + `form.AppField` dengan komponen di `@/components/forms/fields` (`field.TextField`, `field.SelectField`, …); `form.Field` mentah untuk isian khusus; validasi Zod di level formulir. Jangan memakai `useState` di dalam render prop. Detail di `docs/forms.md`.

**UI**:
- Ikon hanya dari `@/components/icons` (`Icons.nama`), jangan impor `@tabler/icons-react` langsung. Ikon baru didaftarkan dulu di `icons.tsx`.
- Judul halaman lewat props `PageContainer` (`pageTitle`, `pageDescription`, `pageHeaderAction`), jangan `<Heading>` manual.
- `cn()` untuk menggabung kelas. Server component secara bawaan; `'use client'` hanya bila perlu.
- Komponen shadcn baru: `bunx shadcn add <nama>`.
- Satu tema `kamanga` (terang/gelap), font Plus Jakarta Sans. Halaman `/chat` memakai token sendiri (`.kmg` di `src/features/chat/chat.css`). Detail di `docs/themes.md`.

**Gaya**: oxfmt dengan kutip tunggal (juga di JSX), titik koma, tanpa koma di akhir, indentasi 2 spasi. Komentar kode Bahasa Indonesia, secukupnya. Alias impor `@/*` untuk `src/`.

## Lingkungan

- Salin `env.example.txt` ke `.env.local`. Tanpa `LLM_PROVIDER`, chatbot tetap jalan lewat template dan kode.
- Akun AI gratisan / 9router hanya untuk uji coba lokal, bukan layanan warga.
- Launching nanti di VPS (Docker Compose + Caddy); build untuk VPS memakai `BUILD_STANDALONE=true`.
