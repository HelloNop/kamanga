# Kamanga v2

"Ka manga? Sabuik se, Kamanga carikan." Asisten lokal warga Sumatra Barat: pilih pintu "Ka-" atau ketik bebas, Kamanga mencarikan penyedia terverifikasi dan slot kosong, lalu warga memesan lewat WhatsApp penyedia.

- Rumusan produk: [KAMANGA_PRD.md](./KAMANGA_PRD.md)
- Panduan kode (juga untuk agen AI): [AGENTS.md](./AGENTS.md)
- Data acuan (lokasi Sumbar): [data/README.md](./data/README.md)

## Menjalankan di komputer lokal

Butuh [Bun](https://bun.sh) dan PostgreSQL 18 dengan pgvector (Homebrew: `brew install postgresql@18 pgvector`).

```bash
createdb kamanga_v2
cp env.example.txt .env.local   # isi DATABASE_URL, BETTER_AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
bun install
bun run db:migrate              # buat tabel
bun run db:seed-reference       # lokasi, kategori, kebutuhan, kamus
bun run auth:create-admin       # akun admin dari .env.local
bun run dev
```

Lalu buka http://localhost:3000 (chat warga) atau http://localhost:3000/dashboard (panel).

## Lisensi

Dibangun di atas template [next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) (MIT). Lihat [LICENSE](./LICENSE).
