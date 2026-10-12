# Kamanga AI — Rumusan Proyek (PRD ringkas)

Status: draf v0.1, 10 Oktober 2026. Menggantikan `KAMANGA_CONTEXT.md` sebagai acuan utama.
Penanda: **[DIPUTUSKAN]** sudah disepakati bersama. **[USULAN]** rekomendasi, belum dikonfirmasi pemilik. **[TERBUKA]** butuh jawaban.

## 1. Apa itu Kamanga AI

Asisten AI lokal untuk warga Sumatra Barat. Warga bertanya dengan bahasa sehari-hari (Minang, Indonesia, campuran), Kamanga mencarikan jasa, tempat, wisata, freelancer, atau UMKM yang cocok dari direktori yang dikurasi sendiri. Nama dari "ka manga" (mau apa / mau mencari apa).

Cakupannya **seluas kebutuhan warga**, bukan satu bidang. Servis AC, pindahan rumah, wisata akhir pekan, dan cari desainer logo diperlakukan dengan mesin yang sama. **[DIPUTUSKAN]**

## 2. Masalah dan pengguna

- Informasi jasa dan tempat lokal tersebar di Instagram, WhatsApp, dan mulut ke mulut. Google Maps lemah untuk vendor kecil dan istilah lokal.
- Pengguna utama v1: warga yang mencari sesuatu. Vendor adalah sumber data, belum pengguna aktif. **[USULAN]**

## 3. Model inti: tiga lapis **[DIPUTUSKAN]**

```
KEBUTUHAN (situasi warga)  →  KATEGORI (jenis listing)  →  LISTING (data nyata)
"Pindahan rumah"              Angkut barang, Tukang,        "Pak Joni Pickup, Lubeg"
                              Sewa pickup
"AC rusak"                    Servis AC                     "Dedi AC Panggilan"
"Wisata weekend"              Wisata, Kuliner               "Pantai Air Manis"
```

- **Listing**: satu entitas generik untuk jasa, tempat, wisata, freelancer, produk UMKM. Atribut khusus per kategori disimpan fleksibel (kolom JSONB; definisi per kategori). Tipe isian: teks, angka, ya/tidak, pilihan, dan pilihan ganda. Baru angka yang dipakai chatbot untuk menyaring (kapasitas); tipe lain tersimpan dan tampil. Wisata dan tempat umum boleh tanpa kontak, sifatnya informasi.
- **Kategori**: dikelompokkan ke dalam **kelompok** yang daftarnya dibuat sendiri oleh admin lewat modal "Tambah kelompok" (tombol di halaman daftar kategori, dan muncul lagi dari form kategori), bukan daftar tetap di kode. Form kategori hanya memilih dari kelompok yang ada. Satu kategori punya satu kelompok utama dan boleh punya kelompok tambahan (mis. Fotografer: Acara dan Kreatif & Digital). Aturan chatbot (tanyakan lokasi, hanya informasi) menempel pada kategori, bukan kelompok. Satu listing bisa punya beberapa kategori.
- **Kebutuhan**: lapisan tipis berisi nama situasi, kategori yang relevan, dan slot yang perlu ditanyakan. Menambah "Pindahan rumah" cukup menambah data, tanpa koding.

Keluasan Kamanga datang dari **data**, bukan fitur baru. Yang dibatasi hanya urutan pengisian data (bagian 9).

## 4. Dua sistem

1. **Direktori (fondasi, dibangun duluan)**: database listing, kategori, kebutuhan, lokasi; panel admin untuk input dan verifikasi; pencarian gabungan filter terstruktur, kemiripan makna (pgvector), dan jarak. Tidak butuh AI selain pembuatan embedding.
2. **Chatbot (lapisan kecerdasan)**: membaca direktori lewat tools. Direktori tidak bergantung pada chatbot.

### Pencarian dan ranking (sudah dibangun)

Kode ada di `src/lib/directory` (sistem 1) dan tidak bergantung pada chatbot. Alurnya: kata warga dipahami **oleh kode** (gazetteer, kamus, nama kategori dan kebutuhan), kandidat disaring di database (hanya listing Terbit), lalu diberi skor dan diurutkan. Skor adalah rata-rata berbobot dari sinyal yang berlaku:

| Sinyal | Bobot | Arti |
|---|---|---|
| Relevansi | 40% | kategori utama/tambahan cocok, kata cocok dengan nama, kata kunci, atau ringkasan |
| Lokasi | 30% | satu tempat (1,0), melayani area itu (0,8), satu kota induk (0,7), daring (0,5), atau berdasar jarak |
| Verifikasi | 15% | belum 0, kontak dicek 0,6, dicek langsung 1 |
| Kelengkapan | 10% | kontak, ringkasan, deskripsi, lokasi, koordinat, harga, tautan |
| Harga | 5% | hanya bila ada anggaran; yang melebihi anggaran dikeluarkan |

Bila hasil sedikit atau kosong, pencarian memberi saran jujur beserta jumlahnya (perluas radius, cari di seluruh Sumbar, abaikan anggaran, dst). Semua bobot ada di satu berkas (`ranking.ts`) dan bisa disetel. Pencarian semantik (pgvector) menunggu pemilihan model embedding. Halaman admin **Uji Pencarian** menampilkan bagaimana skor tiap hasil terbentuk.

### Chatbot (sudah dibangun, v1)

Kode di `src/lib/kamanga-ai`, tampilan warga di `/chat`, rute `/api/chat`. Prinsipnya: **model AI hanya dipanggil bila perlu**. Setiap pesan melewati tiga jalur:

| Jalur | Kapan | Biaya |
|---|---|---|
| Template | sapaan, terima kasih, menu, tanya balik lokasi, lokasi di luar Sumbar, lokasi ambigu, batas pemakaian | gratis |
| Kode (`rules`) | kalimat yang jelas: kategori (lewat kamus dan nama kategori/kebutuhan) + lokasi (lewat gazetteer), termasuk anggaran dan kapasitas; lokasi dan kategori terbawa antar pesan dalam satu sesi | gratis |
| Model AI (`llm`) | kalimat rumit, lanjutan ("yang lebih murah"), pertanyaan penjelasan, di luar layanan, upaya jahil | berbayar, ada rem harian |

Model AI memakai persona tetap (di depan, agar bisa di-cache vendor) dan dua tool: `search_listings` dan `listing_detail`. Kartu usaha, harga, dan tombol WhatsApp ditulis **oleh kode** dari hasil pencarian, bukan oleh model, sehingga tidak mungkin dikarang. Nomor kontak tidak dikirim ke model. Pembatas: pesan per sesi dan per IP per hari, rem harian token (dan biaya, bila harga diisi), pesan dipotong 500 karakter, permintaan lintas situs ditolak. Percakapan, panggilan model, dan klik WhatsApp dicatat tanpa akun (hanya ID sesi acak dan hash IP).

Vendor model ditentukan lewat pengaturan (`LLM_PROVIDER`: anthropic, openai, google; lihat `env.example.txt`). Tanpa pengaturan itu chatbot tetap jalan lewat jalur template dan kode. Set uji pertanyaan: `bun run eval:chat`.

Aturan kode: `kamanga-ai` boleh memanggil `direktori`, tidak sebaliknya. Inti chatbot channel-agnostic: web chat dulu, WhatsApp nanti tinggal disambungkan.

### Peran pengguna dan alur data **[DIPUTUSKAN: dua peran; rinciannya USULAN]**

| Peran | Bisa apa |
|---|---|
| Admin (tim Kamanga) | Input listing langsung, setujui atau tolak listing vendor, verifikasi, kelola kategori, kebutuhan, kamus |
| Vendor | Daftar sendiri lewat formulir, login, isi dan ubah listing miliknya saja |
| Warga | Tanpa akun, hanya memakai chat dan direktori |

Dua jalur masuk data, satu tabel listing:
1. **Tim mengisi** (untuk data awal, supaya direktori tidak kosong saat vendor pertama datang).
2. **Vendor mengisi sendiri**, atau **mengklaim** listing yang dibuat tim lewat verifikasi nomor WhatsApp.

Siklus status listing: `draft` → `menunggu_review` → `terbit` (atau `ditolak`). **Tidak ada listing vendor yang tampil ke warga atau chatbot sebelum disetujui admin.** Tanda `terverifikasi` terpisah dari `terbit`: terbit artinya lolos pemeriksaan dasar, terverifikasi artinya tim sudah memastikan lebih jauh (telepon, kunjungan, atau cek sumber).
Formulir input vendor dan formulir admin adalah satu komponen yang sama, bedanya hanya izin. Skema sudah ditulis di `src/db/schema.ts` (migrasi di `src/db/migrations`). Penamaan tabel, kolom, dan enum memakai **bahasa Inggris**; teks untuk pengguna tetap Bahasa Indonesia. Status listing: `draft`, `pending_review`, `published`, `rejected`, `archived`. Tingkat verifikasi: `unverified`, `contact_checked` (nomor sudah dicek aktif), `visited` (dicek langsung). Perubahan vendor pada listing terbit disimpan di `listing_revisions`, versi terbit tetap tampil sampai admin menyetujui.

## 5. Dari mana kepintaran datang (tanpa melatih model)

| Lapis | Isi | Pemegang |
|---|---|---|
| Persona dan contoh | Gaya Minang kasual, 10-15 contoh percakapan terbaik, batasan topik | Prompt |
| Kamus Minang | Istilah → arti Indonesia → kategori/kebutuhan | Data + kode |
| Gazetteer lokasi | Kecamatan, nagari, ejaan alternatif, koordinat | Data + kode |
| Tools | `cari_listing`, `detail_listing`, dan sejenisnya | Kode direktori |
| Evaluasi | Set uji 200-300 pertanyaan nyata, diperbaiki berkala | Proses |

Aturan wajib anti-halusinasi: chatbot hanya boleh menyebut vendor, harga, dan kontak yang berasal dari hasil tool. Kalau kosong, jujur dan tawarkan alternatif. Slot ditanya natural, maksimal 1-2 pertanyaan; untuk kasus mendesak beri opsi terdekat dulu.

## 6. Hemat biaya tapi tetap pintar

Chatbot v1 gratis untuk warga, jadi biaya per percakapan harus kecil.

1. **Tampilan, bukan model, yang menyajikan vendor**: hasil pencarian jadi kartu dari database; model hanya menulis 1-2 kalimat pengantar. **[USULAN]**
2. **Tombol dan formulir** untuk slot (kalender, pilihan jumlah, kategori) agar chat lebih pendek dan tanpa panggilan model. **[USULAN]**
3. **Template dan kode dulu**: sapaan, menu, ekstraksi kamus/lokasi, cache jawaban. Panggil model hanya jika perlu.
4. **Dua tingkat model**: model termurah memahami maksud (hasil terstruktur), model sedikit lebih kuat menulis atau menangani kasus rumit. **[USULAN]**
5. **Prompt caching**: bagian statis di depan, dinamis di belakang. Persona dijaga ringkas.
6. **Konteks ramping**: riwayat pendek plus ringkasan, hasil pencarian top 5 dengan field penting, output dibatasi.
7. **Proteksi**: batas pesan per user per hari, rem darurat biaya harian, batas pengeluaran di dashboard vendor sejak hari pertama.
8. **Gateway LLM**: semua panggilan lewat satu lapisan agar vendor mudah diganti dan token tercatat. Kandidat termasuk model terbuka lewat API murah; semua diuji di set evaluasi. Cek kebijakan data vendor (UU PDP). Harga dicek ulang dari halaman resmi saat memilih.

Vendor LLM **belum dipilih** **[DIPUTUSKAN]**: ditentukan oleh hasil set uji (akurasi Minang dan slot, keandalan tool calling, biaya per percakapan, latensi).

## 7. Teknologi

| Kebutuhan | Pilihan |
|---|---|
| Bahasa / framework | TypeScript, Next.js |
| Database | PostgreSQL 18 + pgvector. Jarak pakai `earthdistance` (bawaan). PostGIS ditunda sampai perlu poligon wilayah. |
| ORM / validasi | Drizzle, Zod |
| AI | Vercel AI SDK + lapisan tipis (batas pemakaian, pencatatan biaya) |
| UI / auth | Tailwind + shadcn/ui. Better Auth dengan plugin admin: peran `admin` dan `vendor`, daftar sendiri otomatis menjadi vendor. Login v1 email + kata sandi. TODO: verifikasi email dan reset kata sandi (butuh layanan email), login Google. |
| Lingkungan sekarang | **Lokal di Mac**, Postgres Homebrew, tanpa Docker (disk terbatas). Perlu `brew install pgvector`. |
| Lingkungan launching | VPS (Docker Compose + Caddy), backup harian eksternal, SSH key-only, firewall, monitoring |

Sengaja tidak dilakukan: melatih model, self-host LLM, vector DB terpisah, microservices, router ML, WhatsApp.

## 8. Ruang lingkup v1

**Masuk**: direktori (skema, panel admin, pencarian), registrasi dan login vendor dengan antrean persetujuan admin, web chat anonim tanpa login (memori hanya per sesi **[USULAN]**), hasil akhir berupa 3-5 listing plus link WhatsApp ke vendor **[USULAN]**, kamus dan gazetteer awal, logging dengan izin, set uji.

**Tidak masuk**: booking, pembayaran, ulasan warga, dasbor statistik untuk vendor, WhatsApp, fitur bisnis berbayar (Tahap 2), kerja sama Pemda (Tahap 3).

## 9. Data dan peluncuran

- Mulai dari satu kota (Padang) dan beberapa kategori yang paling sering dicari warga (dipilih setelah survei kecil, mis. servis rumah tangga dan jasa harian), target 100-200 listing sebelum dibuka ke warga. Ini keputusan operasional, bisa digeser. **[USULAN]**
- Aset yang dikerjakan pemilik sebagai penutur asli: kamus Minang awal (100-200 entri) dan daftar penamaan lokasi.
- UU PDP (UU 27/2022): consent jelas, kebijakan privasi, data ke pihak lain hanya agregat dan anonim.

## 10. Ukuran sukses v1 **[USULAN]**

Satu angka utama: persentase percakapan yang berakhir dengan klik kontak vendor. Pendamping: akurasi maksud dan slot di set uji, biaya per percakapan.

## 11. Urutan kerja

0. Tutup pertanyaan terbuka, finalkan PRD ini
1. Setup proyek lokal: Next.js, Postgres + pgvector, Drizzle
2. Skema direktori: listing, kategori, kebutuhan, lokasi, kamus
3. Panel admin, portal vendor (formulir yang sama, izin berbeda), antrean persetujuan, mulai isi data
4. Pencarian dan ranking (relevansi, jarak, verifikasi, kelengkapan profil)
5. Paralel sejak awal: kamus Minang, gazetteer, set uji pertanyaan
6. Chatbot: gateway, tools, prompt, web chat
7. Evaluasi, pilih vendor LLM, atur model bertingkat
8. Deploy ke VPS, backup, peluncuran terbatas

## 12. Pertanyaan terbuka **[TERBUKA]**

1. Penginput sudah diputuskan: tim dan vendor sendiri. Masih terbuka: data awal tim dari mana, apa standar "terverifikasi", dan cara login vendor (email atau kode lewat WhatsApp; usulan v1: email/Google, nomor WhatsApp hanya sebagai data kontak).
2. Apakah direktori jadi website publik (halaman vendor bisa diindeks Google dan dibagikan chatbot) atau hanya di balik layar? Saran: publik, cukup tambah slug di skema.
3. Pengalaman coding pemilik (Next.js, SQL, Docker)?
4. VPS sudah dibeli? OS?

## 13. Risiko utama

- **Data vendor sedikit atau basi**: chatbot sepintar apa pun jadi tidak berguna. Mitigasi: fokus kualitas dan fokus kategori awal.
- **Model murah lemah di Minang kental**: mitigasi lewat kamus, contoh, eskalasi, dan pengujian sebelum memilih vendor.
- **Biaya membengkak di layanan gratis**: batas pesan, rem darurat, dan pencatatan biaya sejak hari pertama.
- **Vendor tidak mau daftar ke platform yang masih sepi**: tim mengisi data awal dulu, lalu vendor diundang mengklaim listingnya.
- **Spam dan data asal-asalan dari pendaftaran terbuka**: semua listing lewat antrean admin; batasi jumlah pendaftaran per hari.
- **Lingkup melebar karena "semua kebutuhan warga"**: dijaga dengan model generik plus pengisian data bertahap.
