# Kamanga — Rumusan Proyek (PRD v2)

Status: v2, 12 Oktober 2026. **Satu-satunya dokumen acuan produk di repo ini.** Menggabungkan PRD v0.1, `KAMANGA_CONTEXT.md`, dan hasil diskusi konsep v2 (`KAMANGA_V2.md`, 11–12 Oktober 2026). Ketiganya sudah dihapus dari repo; isinya masih bisa dilihat di riwayat git (commit pertama).

Penanda: **[DIPUTUSKAN]** sudah disepakati pemilik. **[USULAN]** rekomendasi, belum dikonfirmasi. **[TERBUKA]** butuh jawaban. **(nanti)** sengaja ditunda, bukan bagian tahap sekarang.

## 1. Apa itu Kamanga

Asisten lokal untuk warga Sumatra Barat. Nama dari "ka manga" (mau apa / mau mencari apa). Tagline: **"Ka manga? Sabuik se, Kamanga carikan."**

| | v1 (repo `kamanga-ai`) | v2 (repo ini) |
|---|---|---|
| Rasa | direktori yang bisa diajak ngobrol; terasa seperti ChatGPT (teman yang mencoba langsung bertanya "bisa input gambar?") | asisten yang **membereskan urusan dulu**, baru menyambungkan ke penyedia terverifikasi |
| Alur | mengetik → ditanya lokasi → daftar usaha → klik WhatsApp | pilih pintu "Ka-" (atau chat bebas) → pahami kebutuhan → (bila perlu) panduan/diagnosis → estimasi biaya dari data nyata → penyedia terverifikasi / slot kosong → pesan lewat WhatsApp penyedia |

Cakupannya seluas kebutuhan warga, tetapi masuk lewat **pintu** (§3). Keluasan datang dari **data**, bukan fitur baru per bidang. **[DIPUTUSKAN]**

Repo dan data **[DIPUTUSKAN]**: v2 dikerjakan di repo `kamanga` (salinan kamanga-ai tanpa riwayat git, mulai 12 Oktober 2026). `kamanga-ai` tetap menjadi v1 dan tidak diubah. Database lokal v2 bernama `kamanga_v2`; database `kamanga` milik v1. Konsep (bukan kode) boleh diambil dari `~/Code/projek/kamanga.id`.

## 2. Posisi: jangan jual AI, jual urusan yang beres **[DIPUTUSKAN]**

- Beranda **bukan kolom chat kosong**. Beranda bertanya "Kamanga hari ko?" dengan teks berganti (ka servis… ka main… ka uda anta…) + tombol pintu yang sudah siap. Kolom ketik bebas tetap ada.
- **Uji setiap fitur:** kalau ChatGPT bisa melakukannya sama baiknya, jangan dibangun.
- Nilai yang tidak dimiliki ChatGPT: data penyedia lokal yang dicek, harga pasar setempat, tersambung ke penyedia nyata, slot/jadwal nyata, bahasa Minang dan wilayah sampai nagari, permintaan pesan yang tercatat.
- Pertanyaan di luar layanan ditolak sopan lewat template (tanpa memanggil AI).

## 3. Struktur: pintu dan mesin **[DIPUTUSKAN]**

Dua pertanyaan pembagi:
1. **Warga sedang ingin apa?** → menentukan **pintu**.
2. **Bagaimana transaksinya?** → menentukan **mesin**.

Aturan:
- Kategori baru masuk ke pintu yang sudah ada berdasarkan "mau apa" (laundry → Ka servis, sewa tenda → Ka manyewa, rental PS → Ka main). Pintu baru hanya bila niatnya benar-benar berbeda.
- Satu penyedia boleh muncul di beberapa pintu (MUA: Ka rancak + Kabaralek; fotografer: Ka mambuek + Kabaralek). Datanya tetap satu.
- Beranda maksimal ±6 pintu; pintu yang datanya belum cukup disembunyikan (tetap bisa ditemukan lewat chat bebas).

### 3a. Pintu dan tahap

**Pintu tunggal** (satu kebutuhan, satu jenis penyedia) dibangun dulu. **Pintu rencana** (gabungan banyak pintu tunggal) dibangun belakangan di atas data pintu tunggal.

| Tahap | Pintu | Mau apa | Contoh kategori | Mesin |
|---|---|---|---|---|
| 1 | **Ka main** | olahraga & hiburan | futsal, padel, badminton, billiard, karaoke, gym | Jadwal (slot jam) |
| 1 | **Ka rancak** | merawat diri | barber, salon, spa, pijat, refleksi, perawatan kecantikan | Jadwal (slot jam) |
| 1 | **Ka uda anta** | memindahkan orang/barang | travel antarkota (hanya berizin), titip paket, pindahan | Jadwal (kursi per keberangkatan) |
| 1 | **Ka servis** | memperbaiki | AC, motor, mobil, elektronik, tukang, kebersihan | Pesanan (diagnosis menyusul tahap 2) |
| 1 | *Database Tempat* (belum jadi pintu) | informasi | kafe, resto, wisata, hotel, apotek 24 jam, IGD | — (info saja) |
| 2 | Ka servis (lanjutan) | | diagnosis + estimasi biaya bersama bengkel/teknisi mitra | Panduan + Estimasi |
| 2 | **Ka manyewa** | memakai barang/tempat sementara | motor, mobil, kamera, alat, tenda, baju adat; kos & kontrakan | Jadwal (per tanggal + stok unit; kos = jadwal survei) |
| 2 | **Ka mambuek** | membuat sesuatu | website, aplikasi, desain, foto produk, video, studio foto | Pesanan + penyusun brief (Panduan) |
| 2 | **Ka jalan-jalan** | ide main & wisata | rekomendasi dari database Tempat + slot pintu lain | Rekomendasi |
| 2 | **Kabatanyo** | urusan publik | KTP, Samsat, NIB, BPJS | Panduan (kartu bersumber) |
| 3 | **Kabaralek** (rencana) | menggelar acara | pernikahan, aqiqah, sunatan; menarik vendor dari pintu tunggal | Acara |
| 3 | **Ka balanjo** | membeli barang | produk UMKM, oleh-oleh, kue, katering harian | Produk |
| 3 | **Ka baubek** (booking) | berobat | klinik, praktik mandiri, bidan, gigi, fisioterapi, klinik hewan | Jadwal + verifikasi izin praktik |

Ditunda (bukan pintu beranda warga): Kakarajo (kerja), Kabaraja (belajar), Kabausaho (alat usaha UMKM di dashboard mitra, mis. pencatatan keuangan lewat voice note dan AI Marketing Kit).

Catatan Ka jalan-jalan: **tidak menggarap booking hotel** (Traveloka/tiket.com sudah kuat). Hotel cukup ditampilkan sebagai informasi + tautan keluar. Fokusnya ide kegiatan ("main sore di Padang ke mana?") yang tersambung ke slot Ka main, kafe/resto, wisata.

### 3b. Mesin

| Mesin | Isi tahap ini | (nanti) | Dipakai pintu |
|---|---|---|---|
| **Fondasi** | akun & peran (admin, penyedia), data penyedia + verifikasi, **jenis listing: penyedia (bisa dipesan) vs tempat (info saja)**, wilayah Sumbar, kamus Minang, router AI hemat, log permintaan | login lewat WhatsApp | semua |
| **Pesanan** | warga memilih layanan/slot → tombol **"Pesan via WhatsApp"** dengan pesan terisi → klik dicatat (§4) | Terima/Tolak lewat WhatsApp Business API, status, selesai, ulasan | semua yang bisa dipesan |
| **Jadwal** | unit yang dijadwalkan (lapangan 1, kursi travel, kamera #2), jam buka, durasi slot, harga per slot (jam ramai beda), slot terisi manual (walk-in/WA), per tanggal + stok, jadwal survei | pengingat lewat WhatsApp | Ka main, Ka rancak, Ka uda anta, Ka manyewa, Ka mambuek (studio), Kabaralek (tanggal vendor), Ka baubek |
| **Mitra** | dashboard penyedia (web enak di HP / PWA): permintaan masuk, kalender, profil & harga, aturan, tanya jawab, statistik | ulasan, chatbot di nomor penyedia (Mitra Pro) | semua |
| **Panduan** | pohon keputusan + kartu panduan (§6) | | Ka servis, Kabatanyo, Ka mambuek, Kabaralek, Ka uda anta, Ka manyewa, Ka baubek (hanya pengarah + darurat) |
| **Estimasi** | kisaran harga dari data harga nyata mitra | | Ka servis, Ka mambuek, Kabaralek |
| Rekomendasi | menyusun ide dari konteks (waktu, budget, rombongan, lokasi) + data Tempat + slot | | Ka jalan-jalan |
| Acara, Produk, Kerja | — | semuanya | Kabaralek, Ka balanjo, Kakarajo |

**Urutan bangun:** Fondasi (rapikan) → **Pesanan → Jadwal → Mitra**. Empat mesin ini cukup untuk Ka main, Ka rancak, Ka uda anta, dan Ka servis dasar, hampir tanpa AI. **Mesin Jadwal adalah jantung Kamanga.**

Karena kesepakatan terjadi di chat WhatsApp (§4), Kamanga tidak tahu pasti apakah sebuah slot jadi dipesan. Slot ditandai terisi oleh pemilik di dashboard, sama seperti pelanggan walk-in.

## 4. Pesan dan akun (tahap ini) **[DIPUTUSKAN 12 Okt 2026]**

WhatsApp dipakai **sama seperti v1**: sebatas tombol yang ditekan warga untuk menghubungi penyedia. Login tetap cara yang sekarang.

- Warga melihat, bertanya, dan memesan **tanpa akun**.
- Memesan = menekan **"Pesan via WhatsApp"**. Tombol membuka WhatsApp penyedia (tautan `wa.me`) dengan pesan yang sudah terisi: layanan, tanggal/jam yang dipilih, nama tempat, dan keterangan bahwa warga datang dari Kamanga. Kesepakatan selanjutnya terjadi langsung antara warga dan penyedia.
- Setiap klik dicatat sebagai bukti nilai bagi penyedia. Pencatatan klik dari chat sudah ada (`chat_events`, tipe `whatsapp_click`); perlu diperluas ke halaman pintu dan profil.
- Sebelum tombol Pesan, aturan penting tempat itu (§5) ditampilkan ringkas.
- Login dashboard untuk admin dan penyedia tetap **email + kata sandi** (Better Auth).
- Jangan memakai jalur WhatsApp tidak resmi (bot di nomor pribadi, aplikasi pihak ketiga): risiko nomor diblokir.

### Rancangan untuk nanti (bukan tahap ini)

Disimpan agar tidak hilang. Dikerjakan setelah Pesanan, Jadwal, dan Mitra berjalan:
- **WhatsApp Business API resmi** dari nomor Kamanga: pesanan dikirim ke penyedia dengan tombol **Terima / Tolak** → webhook → status berubah. Pesan pertama memakai template yang disetujui Meta; ada biaya per pesan.
- Nomor/alamat warga baru dibuka ke penyedia setelah penyedia menekan Terima.
- Tidak dibalas dalam batas waktu (mis. 30 menit) atau ditolak → tawarkan penyedia lain ke warga.
- Setelah selesai → Kamanga bertanya "Puas?" lewat WhatsApp → ulasan → memengaruhi verifikasi dan urutan.
- Akun warga dengan verifikasi nomor WhatsApp (OTP) saat memesan; login lewat WhatsApp.
- Pengingat jadwal; pertanyaan warga diteruskan otomatis ke pemilik dan jawabannya disimpan sebagai tanya jawab.
- Chatbot di nomor WhatsApp penyedia sendiri (Mitra Pro).

## 5. Chat bebas dan aturan per penyedia

- Warga boleh mengetik bebas kapan saja, juga di tengah alur ("bisa jam 5?", "yang lebih dekat?"). AI menangkap pintu + parameter (jenis, waktu, lokasi lewat gazetteer, jumlah orang, anggaran) lalu meneruskan ke Jadwal/Pesanan; bila kurang, tanya **satu hal** dengan tombol. Pola router template → kode → AI di `src/lib/kamanga-ai` sudah ada (§8); tinggal diteruskan ke mesin baru.
- **Aturan per penyedia** dua lapis:
  1. **Isian terstruktur per kategori** (didefinisikan admin, diisi pemilik; memakai atribut JSONB yang sudah ada). Contoh padel: durasi minimal, termasuk raket?, harga sewa raket, batas pembatalan, DP?, harga jam ramai. Pertanyaan perbandingan ("padel mana yang termasuk raket?") dijawab **lewat filter mesin**, bukan AI.
  2. **Tanya jawab bebas per penyedia** yang ditulis pemilik.
- Saat membahas satu tempat, AI **hanya diberi data tempat itu**. Tidak ada jawaban → "belum ada info, tanyakan langsung ke pengelola" + tombol WhatsApp. Pertanyaannya dicatat agar pemilik bisa menambahkannya sebagai tanya jawab di dashboard. **[USULAN]**

## 6. Panduan: cara mengisi (bukan RAG dokumen mentah)

- **Pohon keputusan (data terstruktur)** untuk diagnosis Ka servis, penyusun brief Ka mambuek, pengarah Ka baubek. Simpul pertanyaan (pilihan → simpul berikut) dan simpul akhir (kemungkinan penyebab, saran keamanan, kategori penyedia, tautan estimasi). Disusun bersama ahli (bengkel mitra, 1–2 jam, 10 keluhan tersering) lewat editor di panel admin. AI hanya menerjemahkan cerita bebas ke pilihan pohon. Harus konsisten dan bisa diuji.
- **Kartu panduan + RAG ringan** untuk Kabatanyo, adat, aturan titip paket/sewa: judul, langkah, syarat, **sumber resmi + tanggal dicek**, wilayah berlaku. Pencocokan pertanyaan → 1–3 kartu lewat kategori + embedding (pgvector). AI merangkai **hanya dari kartu itu** dan menyebut sumber. Tidak ada kartu → bilang belum tahu + catat.
- Hindari RAG dari tumpukan PDF/scraping web mentah.
- Set uji untuk Panduan (seperti `eval:chat`) dan jadwal cek ulang kartu (mis. 3 bulan).

## 7. Aturan kepercayaan (wajib)

- AI tidak boleh mengarang usaha, harga, jadwal, kontak. Kartu hasil, harga, dan tombol WhatsApp dibuat **kode** dari database; nomor kontak tidak dikirim ke model. Hasil kosong → jujur dan tawarkan alternatif.
- Diagnosis Ka servis = "kemungkinan penyebab", bukan vonis; untuk rem/listrik/gas/kebakaran: hentikan pemakaian dan hubungi teknisi.
- Estimasi hanya dari data harga nyata; tanpa data → jujur belum tahu.
- Tingkat verifikasi: terbit / kontak dicek / dicek langsung; mitra perantara lebih ketat. (nanti) verifikasi juga diperbarui lewat ulasan.
- Ka uda anta hanya travel berizin.
- Ka baubek: **tidak ada diagnosis penyakit / saran obat**; kata darurat (sesak napas, pingsan, pendarahan) → arahkan ke IGD dan nomor darurat; verifikasi izin praktik; data kesehatan disimpan seminimal mungkin.
- Tidak ada urutan berbayar yang mengalahkan relevansi; sponsor/afiliasi (nanti) wajib berlabel.
- Konsep dari kamanga.id yang dipindahkan: syarat wajib vs preferensi, data kosong ≠ memenuhi syarat, pelonggaran ditawarkan bukan diam-diam, harga dengan tipe dan satuan, jadwal multi-interval per hari.
- UU PDP (UU 27/2022): consent jelas, kebijakan privasi, data ke pihak lain hanya agregat dan anonim.

## 8. Fondasi yang sudah ada (dibawa dari v1)

Semua di bawah ini sudah dibangun dan tetap dipakai. Detailnya ada di kode.

### Model data **[DIPUTUSKAN]**

```
KEBUTUHAN (situasi warga)  →  KATEGORI (jenis listing)  →  LISTING (data nyata)
"Pindahan rumah"              Angkut barang, Tukang         "Pak Joni Pickup, Lubeg"
"AC rusak"                    Servis AC                     "Dedi AC Panggilan"
```

- **Listing**: satu entitas generik untuk jasa, tempat, wisata, freelancer, produk UMKM. Atribut khusus per kategori di kolom JSONB (`attributes`), definisinya per kategori (`attribute_schema`); tipe isian: teks, angka, ya/tidak, pilihan, pilihan ganda. Wisata dan tempat umum boleh tanpa kontak (info saja). v2 menambah **jenis listing: penyedia vs tempat** (§3b).
- **Kategori**: dikelompokkan ke **kelompok** yang dibuat admin sendiri (satu kelompok utama + kelompok tambahan). Aturan chatbot (perlu lokasi, hanya informasi) menempel pada kategori. Satu listing boleh punya beberapa kategori, satu di antaranya utama.
- **Kebutuhan**: nama situasi + kategori terkait + sebutan lain. Menambah "Pindahan rumah" cukup menambah data, tanpa koding.
- **Lokasi**: gazetteer Sumbar sampai nagari/kelurahan (dari `data/*.csv`) dengan sebutan lain ("Bukiktinggi", "Aia Pacah", "Lubeg").
- **Kamus**: istilah Minang/sehari-hari → arti. Hanya istilah yang sudah dicek penutur asli dipakai chatbot.
- Penamaan tabel, kolom, dan enum **bahasa Inggris**; teks untuk pengguna Bahasa Indonesia. Skema di `src/db/schema.ts`, migrasi di `src/db/migrations`.

### Peran dan alur data listing

| Peran | Bisa apa |
|---|---|
| Admin (tim Kamanga) | input listing, setujui/tolak listing dan perubahan dari penyedia, verifikasi, kelola kategori, kebutuhan, lokasi, kamus |
| Penyedia (`vendor`) | daftar sendiri (email + kata sandi), isi dan ubah listing miliknya |
| Warga | tanpa akun |

- Dua jalur data, satu tabel: tim mengisi data awal (juga lewat impor CSV); penyedia mengisi sendiri atau **mengklaim** listing yang dibuat tim.
- Status listing: `draft` → `pending_review` → `published` (atau `rejected`, `archived`). **Tidak ada listing penyedia yang tampil ke warga sebelum disetujui admin.** Tingkat verifikasi terpisah dari status: `unverified`, `contact_checked` (nomor dicek aktif), `visited` (dicek langsung).
- Perubahan penyedia pada listing terbit masuk `listing_revisions`; versi terbit tetap tampil sampai admin menyetujui.

### Pencarian dan ranking (`src/lib/directory`)

Kata warga dipahami **kode** (gazetteer, kamus, nama kategori/kebutuhan) → kandidat disaring di database (hanya `published`) → diberi skor → diurutkan. Skor = rata-rata berbobot dari sinyal yang berlaku:

| Sinyal | Bobot | Arti |
|---|---|---|
| Relevansi | 40% | kategori utama/tambahan cocok, kata cocok dengan nama, kata kunci, atau ringkasan |
| Lokasi | 30% | satu tempat (1,0), melayani area itu (0,8), satu kota induk (0,7), daring (0,5), atau berdasar jarak |
| Verifikasi | 15% | belum 0, kontak dicek 0,6, dicek langsung 1 |
| Kelengkapan | 10% | kontak, ringkasan, deskripsi, lokasi, koordinat, harga, tautan |
| Harga | 5% | hanya bila ada anggaran; yang melebihi anggaran dikeluarkan |

Bila hasil sedikit, pencarian memberi saran pelonggaran yang jujur beserta jumlahnya (perluas radius, seluruh Sumbar, abaikan anggaran). Bobot ada di `ranking.ts`. Pencarian semantik (pgvector) menunggu pemilihan model embedding. Halaman admin **Uji Pencarian** menampilkan pembentukan skor tiap hasil.

### Chatbot (`src/lib/kamanga-ai`, halaman `/chat`, rute `/api/chat`)

- Tiga jalur: **template** (sapaan, menu, tanya balik lokasi, batas pemakaian; gratis), **kode** (kalimat jelas: kategori + lokasi + anggaran/kapasitas; gratis), **model AI** (kalimat rumit, lanjutan, penjelasan; berbayar, ada rem harian). Bawaan sekarang **AI-first**: selain sapaan/terima kasih/menu, pesan dijawab model AI bila tersedia dan kode menjadi cadangan; `CHAT_MODE=hybrid` mendahulukan kode.
- Model AI memakai persona tetap (di depan, agar bisa di-cache vendor) dan dua tool: `search_listings` dan `listing_detail`.
- Pembatas: pesan per sesi dan per IP per hari, rem harian token/biaya, antrean panggilan model, pesan dipotong 500 karakter, permintaan lintas situs ditolak. Percakapan, panggilan model, pencarian, dan klik WhatsApp dicatat tanpa akun (ID sesi acak + hash IP); teks pencarian dihapus setelah masa simpan (`db:purge-chat`).
- Vendor model diatur lewat `LLM_PROVIDER` (anthropic, openai, google, router; lihat `env.example.txt`). Tanpa itu chatbot tetap jalan lewat template dan kode. Set uji: `bun run eval:chat`.
- Aturan kode: `kamanga-ai` boleh memanggil `directory`, tidak sebaliknya. Inti chatbot tidak terikat saluran (web dulu).

### Halaman yang sudah ada

- Publik: `/` (sementara dialihkan ke `/chat`), `/chat`, `/jelajah` (telusuri), `/listing/[slug]` (profil usaha).
- Dashboard admin: Ringkasan, Listing (+ impor CSV), Antrean review, Permintaan (pencarian yang hasilnya nol), Kategori, Kebutuhan, Lokasi (+ impor), Kamus, Uji Pencarian.
- Dashboard penyedia: Ringkasan, Listing saya.

### Kepintaran tanpa melatih model, dan hemat biaya

- Kepintaran datang dari persona + contoh percakapan, kamus Minang, gazetteer, tools ke direktori, dan set uji yang diperbaiki berkala (target 200–300 pertanyaan nyata). Tidak melatih model sendiri.
- Hemat: tampilan (bukan model) yang menyajikan usaha; tombol untuk slot agar chat pendek; template dan kode dulu; model murah sebagai bawaan, model lebih kuat hanya bila perlu; prompt caching; konteks ramping; batas pemakaian dan rem biaya harian; semua panggilan lewat satu gateway agar vendor mudah diganti.
- Vendor LLM **belum dipilih** **[DIPUTUSKAN]**: ditentukan hasil set uji (akurasi Minang dan slot, keandalan tool calling, biaya per percakapan, latensi). Akun AI gratisan / 9router hanya untuk uji coba, bukan layanan warga (tidak stabil, risiko melanggar aturan penyedia, data warga). Cari program kredit startup yang sah.

## 9. Teknologi

| Kebutuhan | Pilihan |
|---|---|
| Bahasa / framework | TypeScript, Next.js 16 (App Router), React 19, Bun |
| Database | PostgreSQL 18 + pgvector, pg_trgm, unaccent; jarak pakai `earthdistance`. PostGIS ditunda sampai perlu poligon wilayah. |
| ORM / validasi | Drizzle, Zod |
| AI | Vercel AI SDK + lapisan tipis (batas pemakaian, pencatatan biaya) |
| UI | Tailwind CSS v4 + shadcn/ui; TanStack Query, Form, Table |
| Auth | Better Auth, email + kata sandi, peran `admin` dan `vendor`. TODO: verifikasi email dan reset kata sandi (butuh layanan email). (nanti) login lewat WhatsApp. |
| Foto | Cloudflare R2 (saat pengembangan: `public/uploads`) |
| Lingkungan sekarang | lokal di Mac, Postgres Homebrew, tanpa Docker (disk terbatas) |
| Lingkungan launching | VPS sendiri (2 vCPU, 8 GB RAM, 100 GB NVMe) dengan Docker Compose + Caddy; backup database harian ke penyimpanan eksternal, SSH key-only, firewall (port database tertutup), update berkala, uptime monitoring |

Sengaja tidak dilakukan: melatih model, self-host LLM, vector DB terpisah, microservices, router ML, WhatsApp Business API (tahap ini), menampung uang warga.

## 10. Bisnis (sekarang: TANPA BIAYA) **[DIPUTUSKAN]**

- Tahap awal **gratis penuh** untuk warga dan penyedia; diumumkan sebagai "masa perintisan / Mitra Perintis", bukan "gratis selamanya".
- **Setiap permintaan pesan dicatat** (klik WhatsApp, slot yang ditandai terisi) sebagai bukti nilai. Penyedia melihat ringkasan bulanan di dashboard ("bulan ini 9 warga menghubungi lewat Kamanga"). **[USULAN]**
- Nanti (bukan sekarang): bayar per pesanan diterima (saldo prabayar) dengan kuota gratis, Mitra Pro (langganan), komisi transaksi lewat payment gateway (jangan menampung uang sendiri), afiliasi (hotel, produk UMKM), Promo Lokal UMKM, kerja sama Pemda/hibah (data agregat anonim).
- Mulai menagih bila 2 bulan berturut-turut: penyedia aktif rutin mendapat permintaan, penyedia mengakui manfaatnya, ada warga yang kembali. Syarat "pesanan sebagian besar diterima" baru bisa diukur setelah WhatsApp Business API.
- Batas pengeluaran bulanan untuk AI dan server sejak awal (WhatsApp API menyusul).
- Catat setiap klik keluar (WhatsApp, situs hotel, marketplace).

## 11. Ukuran sukses **[USULAN]**

- Angka utama: jumlah warga yang menekan "Pesan via WhatsApp" per minggu dari pintu tahap 1.
- Pendamping: penyedia yang memperbarui jadwalnya tiap minggu, warga yang kembali, akurasi maksud dan slot di set uji, biaya AI per percakapan.

## 12. Urutan kerja

1. ✅ Mulai v2: repo `kamanga`, database `kamanga_v2`, migrasi dan data acuan.
2. Rapikan fondasi: bersihkan sisa template starter (nama paket, komponen dan paket tak terpakai, kbar, README), perbaiki skrip seed.
3. Skema baru (Drizzle, migrasi): jenis listing penyedia/tempat; unit terjadwal + jam buka + durasi + harga per slot + slot terisi manual; catatan permintaan pesan (dari klik WhatsApp); tanya jawab per penyedia; isian aturan per kategori.
4. Bangun **Mesin Jadwal + Pesanan dengan Ka main sebagai pintu pertama**: kalender di dashboard pemilik, slot kosong untuk warga, tombol "Pesan via WhatsApp" dengan pesan terisi.
5. Beranda baru "Kamanga hari ko?" (lihat mockup).
6. Pintu tahap 1 berikutnya: Ka rancak, Ka uda anta, Ka servis dasar; database Tempat.
7. Deploy ke VPS, backup, peluncuran terbatas.
8. (nanti) WhatsApp Business API, akun/login warga lewat WhatsApp, ulasan (§4).

Data awal: mulai dari Padang dan pintu tahap 1, target 100–200 listing sebelum dibuka ke warga **[USULAN]**. Pemilik (penutur asli) mengecek kamus Minang dan penamaan lokasi.

## 13. Validasi lapangan (paralel, tanpa koding)

- 5 warga: terakhir butuh servis/travel/lapangan cari ke mana? apa yang bikin pusing?
- 5 pemilik lapangan (padel/futsal) & barber: cara booking sekarang? pernah bentrok? jam sepi? mau memperbarui slot di dashboard?
- 3–5 pemilik travel: berapa chat WA/hari? titip paket? izin resmi?
- 5–10 teknisi/bengkel: dari mana pelanggan? pertanyaan tersering?
- Cek apakah aplikasi booking lapangan nasional sudah masuk Padang.

## 14. Pertanyaan terbuka **[TERBUKA]**

1. Apakah klik "Pesan via WhatsApp" dicatat sebagai **permintaan** yang bisa ditandai penyedia di dashboard (jadi / batal), sekaligus mengisi slot? Usulan: ya, sederhana dan memberi angka nyata untuk ringkasan bulanan.
2. Ulasan warga tanpa akun dan tanpa WhatsApp API: tunggu WA API, atau ada cara sederhana yang sulit dicurangi?
3. Data awal tim dari mana, dan standar verifikasi (kapan `contact_checked`, kapan `visited`)?
4. Kapan mulai mengurus WhatsApp Business API (verifikasi bisnis Meta, biaya per pesan)?
5. VPS sudah dibeli? OS?

## 15. Risiko utama

- **Data penyedia sedikit atau basi**: secanggih apa pun, Kamanga jadi tidak berguna. Mitigasi: fokus kualitas, pintu tahap 1 dulu, mulai dari Padang.
- **Jadwal tidak akurat** karena slot diisi manual dan kesepakatan terjadi di WhatsApp. Mitigasi: dashboard yang cepat dipakai di HP, label "konfirmasi ke pemilik lewat WhatsApp", pantau penyedia yang aktif memperbarui.
- **Penyedia enggan mengisi platform yang masih sepi**: tim mengisi data awal, penyedia diundang mengklaim listingnya.
- **Model murah lemah di Minang kental**: kamus, contoh, eskalasi, set uji sebelum memilih vendor.
- **Biaya AI membengkak di layanan gratis**: batas pesan, rem darurat, pencatatan biaya sejak hari pertama.
- **Spam dan data asal dari pendaftaran terbuka**: semua listing lewat antrean admin; batasi pendaftaran per hari.
- **Lingkup melebar**: disiplin pintu dan tahap (§3a) dan uji "ChatGPT bisa?" (§2).

## 16. Artefak terkait

- `docs/kamanga-v2/Kamanga-v2-Konsep-Pengembangan.pdf` — konsep 11 Okt (sebagian usang: pembagian pintu, urutan tahap, dan peran WhatsApp di dokumen ini yang berlaku).
- `docs/kamanga-v2/Kamanga-Pitch-Deck.pdf` — pitch untuk investor/tim (versi 11 Okt; bagian berwarna kuning masih placeholder).
- `docs/design/` — rancangan tampilan chat v1 dan panel.
- Mockup layar (kanvas desain di claude.ai milik pemilik): beranda "Kamanga hari ko?", alur Ka servis (masalah → diagnosis → estimasi & bengkel → status), Ka uda anta (rute → pilih travel), dan notifikasi WA penyedia Terima/Tolak (untuk nanti). Belum ada layar Ka main & Ka rancak.
