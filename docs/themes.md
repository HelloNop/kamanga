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

- `/chat` memakai token sendiri di bawah kelas `.kmg` (`src/features/chat/chat.css`) dan huruf Poppins (`--font-kmg`, dipasang di `src/app/chat/layout.tsx`).
- `/jelajah` dan `/listing/[slug]` memakai token `.kmg` yang sama (`src/features/jelajah/jelajah.css`).
- Halaman warga baru boleh memakai token sendiri dengan pola yang sama: semua selektor dibatasi di bawah satu kelas pembungkus agar tidak bocor ke panel.
- Prototipe tampilan ada di `docs/design/`.
