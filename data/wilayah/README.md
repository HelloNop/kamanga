# Poligon batas wilayah (PostGIS)

Berkas mentah untuk `scripts/wilayah/import-padang.ts`, yang mengisi `locations.boundary`, `locations.official_code`,
dan `lat`/`lng` (bila masih kosong) untuk Kota Padang.

| File | Isi | Ukuran | SHA-256 |
|---|---|---|---|
| `wilayah_boundaries_kec_13.sql` | 179 kecamatan Sumatera Barat (yang dipakai hanya 11 kecamatan Padang, kode `13.71.xx`) | 280 KB | `94ef0987604387c654eac37dea53c92c90d7c08db65cf5713346a950775454bf` |
| `wilayah_boundaries_kel_13.71.sql` | 104 kelurahan Kota Padang | 339 KB | `3ca4b2cdf1c02808fbd59f5efdc0e42defb12a5c4afbee2d935727d88c714465` |

## Asal data

- **Sumber:** repositori [`cahyadsn/wilayah_boundaries`](https://github.com/cahyadsn/wilayah_boundaries) di GitHub
  (pembuat yang sama dengan `cahyadsn/wilayah` di `data/README.md`), commit `28230eca6e787bac229db56825bd5b1843662c96`
  (13 Oktober 2026).
  - https://raw.githubusercontent.com/cahyadsn/wilayah_boundaries/28230eca6e787bac229db56825bd5b1843662c96/db/kec/wilayah_boundaries_kec_13.sql
  - https://raw.githubusercontent.com/cahyadsn/wilayah_boundaries/28230eca6e787bac229db56825bd5b1843662c96/db/kel/13/wilayah_boundaries_kel_13.71.sql
- **Lisensi:** MIT, hak cipta (c) 2024–2025 Cahya DSN. Teks lisensi ada di kepala setiap berkas dan wajib ikut
  bila berkas disebarkan.
- **Dasar kode dan nama:** Kepmendagri No. 300.2.2-2430 Tahun 2025. Asal geometrinya tidak dirinci pembuatnya;
  menurut README-nya poligon sudah **disederhanakan**. Sumber resmi beresolusi tinggi (Badan Informasi Geospasial)
  belum dipakai (PRD §18 no. 8 masih terbuka).
- **Diunduh:** 15 Oktober 2026.

## Cara dibaca

- Berkas berformat SQL MySQL tetapi **tidak pernah dijalankan**. Skrip impor hanya membacanya sebagai teks: setiap
  baris `('kode','nama',lat,lng,'path')` diambil dengan regex, lalu `path` dibaca dengan `JSON.parse`.
- `path` berurutan `[lat, lng]` (kebalikan GeoJSON), berupa poligon (3 lapis larik) atau multipoligon (4 lapis).
  Skrip menukarnya ke `[lng, lat]` dan mengirimnya ke `ST_GeomFromGeoJSON`, lalu `ST_MakeValid`.

## Catatan kualitas

- Poligon **kecamatan** di sumber sangat kasar (8–19 titik, saling tumpang tindih sekitar 6 km²). Karena itu batas
  kecamatan di database = **gabungan kelurahannya**; batas Kota Padang = gabungan kecamatannya. Luas hasilnya
  694 km², sama dengan luas resmi Kota Padang (694,96 km²).
- Antar-kelurahan ada celah tipis akibat penyederhanaan (291 celah, lebar paling besar sekitar 6 m). Celah di dalam
  kecamatan/kota diisi; Mesin Lokasi memakai toleransi 25 m saat mencocokkan titik ke poligon.
- Semua 11 kecamatan dan 104 kelurahan cocok dengan baris `locations` lewat nama (tanpa ejaan alternatif).

## Mengulang

1. Unduh dua berkas di atas (atau versi terbaru) ke folder ini. Bandingkan SHA-256 bila memakai commit yang sama.
2. `bun run scripts/wilayah/import-padang.ts` (aman diulang; butuh `db:seed-reference` lebih dulu).
3. Skrip melaporkan jumlah fitur yang cocok dan yang tidak punya pasangan di `locations`.

Kota/kabupaten lain: unduh `db/kel/13/wilayah_boundaries_kel_13.xx.sql`, lalu tambahkan berkas dan slug kotanya di
skrip (sekarang `CITY` dan `FILES` hanya untuk Padang).
