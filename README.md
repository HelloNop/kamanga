# Kamanga

"Ka manga? Sabuik se, Kamanga carikan." Asisten urusan sehari-hari warga Sumatra Barat, dimulai dari Kota Padang. Warga memilih pintu "Ka-" (Ka main, Ka rawat diri, Ka uda anta, Ka servis) atau bercerita bebas; Kamanga menampilkan penyedia lokal terverifikasi dan slot yang benar-benar kosong, meneruskan pesanan ke penyedia lewat WhatsApp, lalu menutupnya dengan ulasan.

- Rumusan produk: [KAMANGA_PRD.md](./KAMANGA_PRD.md)
- Panduan kode (juga untuk agen AI): [AGENTS.md](./AGENTS.md)
- Rencana kerja tahap 1: [docs/prompt-tahap1.md](./docs/prompt-tahap1.md)
- Data acuan (lokasi Sumbar): [data/README.md](./data/README.md)

## Menjalankan di komputer lokal

Butuh [Bun](https://bun.sh) dan PostgreSQL 18 dengan PostGIS dan pgvector (Homebrew: `brew install postgresql@18 postgis pgvector`).

```bash
createdb kamanga_v2
cp env.example.txt .env.local   # isi DATABASE_URL, BETTER_AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
bun install
bun run db:migrate              # buat tabel
bun run db:seed-reference       # lokasi, kategori, kebutuhan, kamus
bun run auth:create-admin       # akun admin dari .env.local
bun run dev
```

Lalu buka http://localhost:3000 (halaman warga) atau http://localhost:3000/dashboard (panel).

## Lisensi

Dibangun di atas template [next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) (MIT). Lihat [LICENSE](./LICENSE).
