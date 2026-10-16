# Data acuan Kamanga

| File | Isi | Asal |
|---|---|---|
| `lokasi-sumbar.csv` | Provinsi, 19 kota/kabupaten, sebutan populer ("Lubeg", "Bukiktinggi", "Pasa Raya"), tempat dikenal | Disusun tangan. Koordinat lima kota (Payakumbuh, Solok, Sawahlunto, Padang Panjang, Pariaman) hanya **perkiraan**, akurat sekitar 2 km. Perlu diisi/diperiksa lewat peta. |
| `lokasi-sumbar-wilayah.csv` | 148 kecamatan dan 1.264 nagari/kelurahan | Dihasilkan dari data resmi, lihat di bawah. Tanpa koordinat. |
| `wilayah/` | Poligon batas Kota Padang (11 kecamatan, 104 kelurahan) dengan kode Kemendagri | `cahyadsn/wilayah_boundaries` (MIT), lihat `wilayah/README.md`. Dimuat dengan `bun run wilayah:import-padang` (juga mengisi kode resmi dan titik tengah). |

Memuat keduanya (aman diulang, hanya menambah/memperbarui): `bun run db:seed-reference`.
Urutan penting: `lokasi-sumbar.csv` dulu, karena data resmi merujuk ke slug kota/kabupaten di dalamnya.

## Asal data resmi

- **Sumber:** repositori `cahyadsn/wilayah` di GitHub, file `db/wilayah.sql`. Lisensi MIT, hak cipta (c) 2025 cahya dsn.
- **Dasar:** Kepmendagri No. 300.2.2-2138 Tahun 2025 (kode dan nama wilayah). Berkas diunduh 10 Oktober 2026.
- **Isi yang dipakai:** hanya kode berawalan `13` (Sumatera Barat): 179 kecamatan dan 1.265 nagari/kelurahan. Kode wilayah belum disimpan di database.
- **Mengulang:** unduh `wilayah.sql` terbaru ke folder kosong, lalu
  `python3 -I scripts/build-sumbar-wilayah.py <wilayah.sql> data/lokasi-sumbar.csv data/lokasi-sumbar-wilayah.csv`.
  Skrip hanya membaca berkas sebagai teks, tidak menjalankannya.

## Hal yang perlu diketahui

- Nama resmi memakai ejaan Minang ("Guguak Panjang", "Lamposi Tigo Nagori", "Aie Pacah"). Ejaan umum disimpan sebagai sebutan lain agar tetap ditemukan.
- Nama kecamatan unik di seluruh Sumbar, tetapi **54 nama nagari/kelurahan kembar** (136 lokasi, mis. "Koto Baru"). Menurut PRD 8.15, nama kembar diselesaikan dulu lewat cakupan layanan (selama hanya Padang, "Koto Baru" = Koto Baru di Padang), lokasi terakhir, dan alamat tersimpan; warga baru ditanya bila tetap ambigu.
- Poligon, kode resmi, dan titik tengah baru ada untuk Kota Padang (wilayah layanan tahap 1). Wilayah lain cukup menambah berkas dari sumber yang sama.

## Perintah database (setara `artisan migrate` di Laravel)

| Perintah | Fungsi | Aman di produksi? |
|---|---|---|
| `bun run db:generate` | Membuat berkas migrasi baru dari perubahan `src/db/schema.ts` | Hanya dipakai saat pengembangan |
| `bun run db:migrate` | Menjalankan migrasi yang **belum** dijalankan. Tidak pernah menghapus data | **Ya** (dijalankan saat deploy) |
| `bun run db:seed-reference` | Memuat kategori, kebutuhan, kamus, dan lokasi. Hanya menambah | Ya |
| `bun run auth:create-admin` | Membuat/menaikkan akun admin dari `ADMIN_EMAIL` dan `ADMIN_PASSWORD` | Ya (isi variabel di server) |
| `bun run wilayah:import-padang` | Memuat poligon wilayah Kota Padang (aman diulang) | Ya |
| `bun run db:seed-dummy` | Memuat 185 listing dummy (`[DUMMY]`, slug `dummy-...`) beserta unit dan jam buka | **Tidak** |
| `bun run db:clear-dummy` | Menghapus semua listing dummy | Tidak diperlukan |
| `bun run db:fresh` | **Menghapus seluruh isi database**, migrasi ulang, data acuan, akun admin (setara `migrate:fresh --seed`) | **TIDAK. Menolak jalan** bila `NODE_ENV=production` atau host bukan lokal |
| `bun run db:fresh:dummy` | `db:fresh` lalu data dummy | **TIDAK** (pengaman sama) |
| `bun run db:make-dummy` | Membangkitkan ulang `data/dummy-listings.csv` (hasil selalu sama) | Tidak |

Alur produksi: deploy kode, `bun run db:migrate`, sekali jalan `bun run db:seed-reference` dan `bun run auth:create-admin`. Data vendor sungguhan masuk lewat impor CSV atau portal vendor.
