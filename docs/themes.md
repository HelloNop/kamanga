# Tema dan tampilan

Kamanga hanya punya **satu tema**, `kamanga`, dengan mode terang dan gelap. Tidak ada pemilih tema.

## Panel (dashboard, masuk/daftar)

| Apa | Di mana |
|---|---|
| Token warna, radius, bayangan (terang dan gelap) | `src/styles/themes/kamanga.css` (`[data-theme='kamanga']` dan `[data-theme='kamanga'].dark`) |
| Tema dipasang | `src/app/layout.tsx`: `<html data-theme='kamanga'>` |
| Terang/gelap | `next-themes` menambah kelas `.dark` di `<html>`; tombolnya `src/components/themes/theme-mode-toggle.tsx` |
| Huruf Plus Jakarta Sans | `src/components/themes/font.config.ts` (variabel `--font-plus-jakarta`) |

Aturan:
- Di komponen pakai kelas token Tailwind (`bg-primary`, `text-muted-foreground`, `border-border`), bukan kode warna langsung. Mengganti warna cukup di `kamanga.css`, dua blok (terang dan `.dark`).
- Komponen shadcn baru: `bunx shadcn add <nama>` (gaya `base-nova`, ikon lewat `Icons` di `src/components/icons.tsx`).
- Kontras teks minimal 4.5:1 dan target sentuh minimal 44 px (PRD §11).

## Halaman warga

- Semua halaman warga memakai satu tampilan: token `.kmg` (`src/features/chat/chat.css`, terang dan gelap) dan huruf Poppins (`--font-kmg`, dari `src/app/chat/layout.tsx`).
  - Beranda (chat), `/jelajah`, `/listing/[slug]`: pembungkus `kmg` (+ `pub-page` untuk jelajah/profil).
  - Pintu, pesan, masuk, pesanan, akun: pembungkus `kmg warga`. `warga.css` berisi komponennya (`w-btn`, `w-box`, `w-chip`, ...), dan token lamanya (`--ink`, `--red`, `--paper`, ...) hanyalah alias ke token `.kmg`.
  - Masuk/daftar mitra (`/auth`): pembungkus `kmg auth-page`; formulir shadcn memakai warna chat lewat pemetaan token di `.auth-main`.
- Header semua halaman ini sama: `PublicHeader` (`src/features/jelajah/components/public-header.tsx`); beranda punya salinan di `ChatView` karena ada tombol percakapan baru.
- Aksen merah hanya untuk teks berganti di beranda (`--rot`) dan aksi berbahaya (`--err`, `w-btn danger`).
- Halaman warga baru: bungkus dengan `kmg warga` dan pakai komponen `warga.css`; semua selektor tetap di bawah kelas pembungkus agar tidak bocor ke panel.
- Prototipe tampilan ada di `docs/design/`.
