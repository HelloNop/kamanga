# Kamanga v2 — Hasil diskusi konsep (serah terima ke sesi berikutnya)

Status: hasil diskusi pemilik proyek dengan Claude, 11–12 Oktober 2026.
Dokumen ini adalah **acuan arah terbaru**. Bila bertentangan dengan `KAMANGA_PRD.md` (v0.1) atau `KAMANGA_CONTEXT.md`, ikuti dokumen ini. Langkah pertama sesi berikutnya adalah memperbarui `KAMANGA_PRD.md` menjadi v2 berdasarkan dokumen ini.

Pemilik proyek masih belajar AI/ML: jelaskan langkah dengan bahasa sederhana, Bahasa Indonesia.

---

## 1. Perubahan besar dari v1

- **v1:** direktori yang bisa diajak ngobrol. Warga mengetik → ditanya lokasi → daftar vendor → klik WA. Terasa seperti ChatGPT (teman yang dicoba langsung bertanya "bisa input gambar?").
- **v2:** asisten yang **membereskan urusan dulu**, baru menyambungkan ke penyedia terverifikasi, lalu **pesanan tercatat** dan ditutup ulasan.
- Alur v2: pilih pintu "Ka-" (atau chat bebas) → pahami kebutuhan → (bila perlu) panduan/diagnosis → estimasi biaya dari data nyata → penyedia terverifikasi / slot kosong → pesan → status → ulasan.
- Tagline: **"Ka manga? Sabuik se, Kamanga carikan."**

## 2. Posisi: jangan jual AI, jual urusan yang beres

- Beranda **bukan kolom chat kosong**. Beranda bertanya "Kamanga hari ko?" dengan teks berganti (ka servis… ka main… ka uda anta…) + tombol pintu yang sudah siap. Kolom ketik bebas tetap ada.
- **Uji setiap fitur:** kalau ChatGPT bisa melakukannya sama baiknya, jangan dibangun.
- Nilai yang tidak dimiliki ChatGPT: data penyedia lokal yang dicek, harga pasar setempat, tersambung ke penyedia nyata, slot/jadwal nyata, bahasa Minang & wilayah sampai nagari, pesanan tercatat + ulasan.
- Pertanyaan di luar layanan ditolak sopan lewat template (tanpa memanggil AI).

## 3. Struktur: pintu dan mesin

Dua pertanyaan pembagi:
1. **Warga sedang ingin apa?** → menentukan **pintu**.
2. **Bagaimana transaksinya?** → menentukan **mesin**.

Aturan:
- Kategori baru masuk ke pintu yang sudah ada berdasarkan "mau apa" (laundry → Ka servis, sewa tenda → Ka manyewa, rental PS → Ka main). Pintu baru hanya bila niatnya benar-benar berbeda.
- Satu penyedia boleh muncul di beberapa pintu (MUA: Ka rancak + Kabaralek; fotografer: Ka mambuek + Kabaralek). Datanya tetap satu.
- Beranda maksimal ±6 pintu; pintu yang datanya belum cukup disembunyikan (tetap bisa ditemukan lewat chat bebas).

### 3a. Daftar pintu dan tahap

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

Ditunda (bukan pintu beranda warga): Kakarajo (kerja), Kabaraja (belajar), Kabausaho (alat usaha UMKM, di dashboard mitra).

Catatan Ka jalan-jalan: **tidak menggarap booking hotel** (Traveloka/tiket.com sudah kuat). Hotel cukup ditampilkan sebagai informasi + tautan keluar. Fokusnya ide kegiatan ("main sore di Padang ke mana?") yang tersambung ke slot Ka main, kafe/resto, wisata.

### 3b. Mesin

| Mesin | Isi | Dipakai pintu |
|---|---|---|
| **Fondasi** | akun & peran, data penyedia + verifikasi, **jenis listing: penyedia (bisa dipesan) vs tempat (info saja)**, wilayah Sumbar, kamus Minang, router AI hemat, log permintaan | semua |
| **Pesanan** | permintaan → penyedia terima/tolak via WA → status → selesai → ulasan | semua yang bisa dipesan |
| **Jadwal** | unit yang dijadwalkan (lapangan 1, kursi travel, kamera #2), jam buka, durasi slot, harga per slot (jam ramai beda), slot terisi manual (walk-in/WA), per tanggal + stok, jadwal survei, pengingat | Ka main, Ka rancak, Ka uda anta, Ka manyewa, Ka mambuek (studio), Kabaralek (tanggal vendor), Ka baubek |
| **Mitra** | dashboard penyedia (web enak di HP / PWA): pesanan masuk, kalender, profil & harga, aturan, tanya jawab, ulasan, statistik | semua |
| **Panduan** | pohon keputusan + kartu panduan (lihat §6) | Ka servis, Kabatanyo, Ka mambuek, Kabaralek, Ka uda anta, Ka manyewa, Ka baubek (hanya pengarah + darurat) |
| **Estimasi** | kisaran harga dari data harga nyata mitra | Ka servis, Ka mambuek, Kabaralek |
| Rekomendasi | menyusun ide dari konteks (waktu, budget, rombongan, lokasi) + data Tempat + slot | Ka jalan-jalan |
| Acara, Produk, Kerja | nanti | Kabaralek, Ka balanjo, Kakarajo |

**Urutan bangun:** Fondasi (rapikan) → **Pesanan → Jadwal → Mitra**. Empat mesin ini cukup untuk Ka main, Ka rancak, Ka uda anta, dan Ka servis dasar, hampir tanpa AI. **Mesin Jadwal adalah jantung Kamanga.**

## 4. Alur pesanan dan akun

- Melihat & bertanya **tanpa akun**. Akun diminta saat memesan: **verifikasi nomor WhatsApp (OTP)**.
- Backend Kamanga mengirim pesanan ke penyedia dari **nomor WA resmi Kamanga** (WhatsApp Business API resmi; pesan pertama pakai template yang disetujui Meta; ada biaya per pesan). Tombol **Terima / Tolak** → webhook → status berubah.
- **Nomor/alamat warga baru dibuka ke penyedia setelah penyedia menekan Terima.**
- Tidak dibalas dalam batas waktu (mis. 30 menit) atau ditolak → tawarkan penyedia lain ke warga.
- Setelah selesai → Kamanga bertanya "Puas?" lewat WA → ulasan → memengaruhi verifikasi & urutan.
- Penyedia **tidak perlu memasang aplikasi**; urusan harian lewat WA, dashboard dibuka sesekali.
- Sementara verifikasi WA API belum selesai: fallback tombol yang membuka WA penyedia dengan pesan terisi.
- Jangan pakai jalur WA tidak resmi (risiko nomor diblokir).
- Ada dua "nomor WA": nomor resmi Kamanga (notifikasi pesanan, dibangun dulu) dan chatbot di nomor penyedia sendiri (Mitra Pro, nanti).

## 5. Chat bebas + aturan per penyedia

- Warga boleh mengetik bebas kapan saja, juga di tengah alur ("bisa jam 5?", "yang lebih dekat?"). AI menangkap pintu + parameter (jenis, waktu, lokasi lewat gazetteer, jumlah orang, anggaran) lalu meneruskan ke Jadwal/Pesanan; bila kurang, tanya **satu hal** dengan tombol. Pola router template → kode → AI di `src/lib/kamanga-ai` sudah ada; tinggal diteruskan ke mesin baru.
- **Aturan per penyedia** dua lapis:
  1. **Isian terstruktur per kategori** (didefinisikan admin, diisi pemilik; memakai atribut JSONB yang sudah ada). Contoh padel: durasi minimal, termasuk raket?, harga sewa raket, batas pembatalan, DP?, harga jam ramai. Pertanyaan perbandingan ("padel mana yang termasuk raket?") dijawab **lewat filter mesin**, bukan AI.
  2. **Tanya jawab bebas per penyedia** yang ditulis pemilik.
- Saat membahas satu tempat, AI **hanya diberi data tempat itu**. Tidak ada jawaban → "belum ada info, mau ditanyakan ke pengelola?" → pertanyaan dikirim ke pemilik via WA → jawaban otomatis disimpan sebagai tanya jawab baru.
- Sebelum menekan Pesan, aturan penting tempat itu ditampilkan ringkas dan disetujui warga.

## 6. Panduan: cara mengisi (bukan RAG dokumen mentah)

- **Pohon keputusan (data terstruktur)** untuk diagnosis Ka servis, penyusun brief Ka mambuek, pengarah Ka baubek. Simpul pertanyaan (pilihan → simpul berikut) dan simpul akhir (kemungkinan penyebab, saran keamanan, kategori penyedia, tautan estimasi). Disusun bersama ahli (bengkel mitra, 1–2 jam, 10 keluhan tersering) lewat editor di panel admin. AI hanya menerjemahkan cerita bebas ke pilihan pohon. Harus konsisten dan bisa diuji.
- **Kartu panduan + RAG ringan** untuk Kabatanyo, adat, aturan titip paket/sewa: judul, langkah, syarat, **sumber resmi + tanggal dicek**, wilayah berlaku. Pencocokan pertanyaan → 1–3 kartu lewat kategori + embedding (pgvector). AI merangkai **hanya dari kartu itu** dan menyebut sumber. Tidak ada kartu → bilang belum tahu + catat.
- Hindari RAG dari tumpukan PDF/scraping web mentah.
- Set uji untuk Panduan (seperti `eval:chat`) dan jadwal cek ulang kartu (mis. 3 bulan).

## 7. Aturan kepercayaan (wajib)

- AI tidak boleh mengarang usaha, harga, jadwal, kontak. Kartu hasil dibuat kode dari database.
- Diagnosis Ka servis = "kemungkinan penyebab", bukan vonis; untuk rem/listrik/gas/kebakaran: hentikan pemakaian & hubungi teknisi.
- Estimasi hanya dari data harga nyata; tanpa data → jujur belum tahu.
- Tingkat verifikasi: terbit / kontak dicek / dicek langsung; mitra perantara lebih ketat. Verifikasi berjalan terus lewat ulasan.
- Ka uda anta hanya travel berizin.
- Ka baubek: **tidak ada diagnosis penyakit / saran obat**; kata darurat (sesak napas, pingsan, pendarahan) → arahkan ke IGD & nomor darurat; verifikasi izin praktik; data kesehatan disimpan seminimal mungkin (UU PDP).
- Tidak ada urutan berbayar yang mengalahkan relevansi; sponsor/afiliasi (nanti) wajib berlabel.
- Konsep dari kamanga.id yang dipindahkan: syarat wajib vs preferensi, data kosong ≠ memenuhi syarat, pelonggaran ditawarkan bukan diam-diam, harga dengan tipe & satuan, jadwal multi-interval per hari.

## 8. Bisnis (untuk sekarang: TANPA BIAYA)

- Tahap awal **gratis penuh** untuk warga dan penyedia; diumumkan sebagai "masa perintisan / Mitra Perintis", bukan "gratis selamanya".
- **Semua pesanan tetap dicatat** (bukti nilai). Kirim ringkasan bulanan ke penyedia ("bulan ini 9 pelanggan baru dari Kamanga").
- Nanti (bukan sekarang): bayar per pesanan diterima (saldo prabayar) dengan kuota gratis, Mitra Pro (langganan), komisi transaksi lewat payment gateway (jangan menampung uang sendiri), afiliasi (hotel, produk UMKM), Promo Lokal UMKM, kerja sama Pemda/hibah (data agregat anonim).
- Mulai menagih bila 2 bulan berturut-turut: penyedia aktif rutin dapat pesanan, penyedia mengakui manfaatnya, pesanan sebagian besar diterima, ada warga yang kembali.
- Batas pengeluaran bulanan untuk WA API, AI, server sejak awal.
- Siapkan sejak sekarang: catat setiap klik keluar (WA, situs hotel, marketplace).

## 9. Teknis & langkah kerja berikutnya

Keputusan: **lanjut di repo kamanga-ai**, bukan proyek baru. Ambil konsep (bukan kode) dari `~/Code/projek/kamanga.id`.

1. Amankan versi sekarang (tag v1), kerjakan v2 di branch terpisah.
2. Bersihkan sisa template starter: nama paket `next-shadcn-dashboard-starter`, `CLAUDE.md` yang masih menjelaskan starter, komponen tak terpakai (kbar, dll).
3. Perbarui `KAMANGA_PRD.md` ke v2 dari dokumen ini.
4. Skema baru (Drizzle, migrasi): jenis listing penyedia/tempat; unit terjadwal + jam buka + durasi + harga per slot + slot terisi manual; pesanan + riwayat status; tanya jawab per penyedia; isian aturan per kategori.
5. Bangun **Mesin Jadwal + Pesanan dengan Ka main sebagai pintu pertama**: kalender di dashboard pemilik, slot kosong untuk warga, pesan, status.
6. Sambungkan WhatsApp Business API resmi (Terima/Tolak, pengingat, "Puas?"), dengan fallback tautan WA selama menunggu.
7. Beranda baru "Kamanga hari ko?" (lihat mockup).

Catatan lain: akun AI gratisan / 9router hanya untuk uji coba, bukan layanan warga (tidak stabil, risiko melanggar aturan penyedia, data warga). Ukur biaya AI dengan `eval:chat`; cari program kredit startup yang sah.

## 10. Validasi lapangan (paralel, tanpa koding)

- 5 warga: terakhir butuh servis/travel/lapangan cari ke mana? apa yang bikin pusing?
- 5 pemilik lapangan (padel/futsal) & barber: cara booking sekarang? pernah bentrok? jam sepi?
- 3–5 pemilik travel: berapa chat WA/hari? titip paket? izin resmi?
- 5–10 teknisi/bengkel: dari mana pelanggan? pertanyaan tersering?
- Cek apakah aplikasi booking lapangan nasional sudah masuk Padang.

## 11. Artefak terkait

- `docs/kamanga-v2/Kamanga-v2-Konsep-Pengembangan.pdf` — konsep 11 Okt (sebagian sudah usang: pembagian pintu & urutan tahap di dokumen ini yang berlaku).
- `docs/kamanga-v2/Kamanga-Pitch-Deck.pdf` — pitch untuk investor/tim (versi 11 Okt; bagian berwarna kuning masih placeholder).
- Mockup layar (kanvas desain di claude.ai milik pemilik): beranda "Kamanga hari ko?", alur Ka servis (masalah → diagnosis → estimasi & bengkel → status), Ka uda anta (rute → pilih travel), dan notifikasi WA penyedia (Terima/Tolak). Belum ada layar Ka main & Ka rancak.
