# PRD Kamanga

| | |
|---|---|
| Versi | 1.0 (draf) |
| Tanggal | 12 Oktober 2026 |
| Pemilik produk | [Nama pendiri] |
| Status | Acuan kerja pengembangan |
| Bahasa produk | Bahasa Indonesia dan bahasa Minang sehari-hari |

Penanda di dokumen ini: **[DIPUTUSKAN]** sudah disepakati, **[USULAN]** rekomendasi yang masih bisa berubah, **[TERBUKA]** belum ada jawaban.

---

## 1. Ringkasan produk

Kamanga (dari bahasa Minang *"ka manga?"* = "mau apa?") adalah asisten urusan sehari-hari untuk warga Sumatra Barat, dimulai dari Kota Padang.

Warga memilih kebutuhan lewat **pintu "Ka-"** (Ka servis, Ka main, Ka rawat diri, Ka uda anta, dan seterusnya) atau langsung bercerita dengan bahasa sehari-hari. Kamanga memahami kebutuhannya, membantu memperjelas bila perlu, menampilkan penyedia lokal yang terverifikasi beserta slot atau jadwal yang tersedia, lalu meneruskan pesanan ke penyedia lewat WhatsApp. Setiap pesanan tercatat dan ditutup dengan ulasan.

Kalimat pegangan: **"Ka manga? Sabuik se, Kamanga carikan."**

Kamanga **bukan chat AI umum** dan **bukan sekadar direktori**. Nilainya ada pada data penyedia lokal yang dicek, jadwal dan harga nyata, sambungan langsung ke penyedia, serta pesanan yang tercatat.

---

## 2. Masalah

### Warga
- Informasi jasa dan tempat lokal tersebar di Instagram, grup WhatsApp, spanduk, dan mulut ke mulut.
- Yang punya kenalan aman. Yang tidak punya (pendatang, mahasiswa, perantau, wisatawan) menebak-nebak.
- Harga tidak transparan; warga takut dikenai harga tidak wajar.
- Untuk tempat yang disewa per jam (lapangan, barber), warga harus bertanya bolak-balik lewat WA hanya untuk tahu jam yang kosong.
- Chat AI umum tidak tahu penyedia mana yang jujur atau harga pasar Padang, dan bisa mengarang.

### Penyedia (UMKM, jasa, perorangan)
- Sulit ditemukan di luar lingkaran kenalan; Google Maps lemah untuk usaha rumahan dan jasa panggilan.
- Kewalahan membalas pertanyaan yang sama di WA ("besok ado kursi?", "jam 8 kosong?", "paket berapa?").
- Jadwal dicatat manual sehingga sering bentrok; jam sepi tidak terisi.
- Kehilangan pelanggan karena terlambat membalas.

---

## 3. Tujuan dan non-tujuan

### Tujuan tahap 1 **[DIPUTUSKAN]**
1. Warga Padang bisa menemukan dan memesan lapangan, perawatan diri, travel antarkota, dan jasa servis dalam beberapa ketukan, tanpa bertanya bolak-balik.
2. Penyedia menerima pesanan yang jelas lewat WhatsApp tanpa perlu memasang aplikasi.
3. Setiap pesanan tercatat sehingga nilai Kamanga bagi penyedia bisa dibuktikan dengan angka.
4. Biaya AI per percakapan tetap rendah karena sebagian besar alur berjalan tanpa AI.

### Non-tujuan (tidak dikerjakan di tahap 1)
- Menjadi chat AI serba bisa (menulis puisi, mengedit gambar, tanya jawab umum).
- Pembayaran di dalam aplikasi, saldo, komisi, atau tagihan apa pun.
- Pemesanan hotel (cukup informasi dan tautan keluar).
- Aplikasi native; produk berupa web yang nyaman di ponsel.
- Wilayah di luar Kota Padang (struktur data sudah siap untuk seluruh Sumatra Barat).

---

## 4. Pengguna dan peran

| Peran | Siapa | Bisa apa | Akun |
|---|---|---|---|
| **Tamu** | Warga yang belum masuk | Menjelajah pintu, melihat penyedia dan tempat, chat (dengan batas harian) | Tidak perlu |
| **Warga** | Warga yang sudah verifikasi nomor WA | Semua kemampuan tamu + memesan, melihat status dan riwayat pesanan, memberi ulasan | Nomor WA + OTP |
| **Mitra** | Pemilik usaha atau penyedia perorangan | Mendaftarkan usaha, mengelola profil, layanan, harga, jadwal, aturan, tanya jawab; menerima atau menolak pesanan; melihat ulasan dan statistik | Akun mitra; satu akun bisa memiliki beberapa usaha |
| **Admin** | Tim Kamanga | Mengelola pintu, kategori, aturan kategori, kamus, wilayah; meninjau dan memverifikasi penyedia; memantau dan menangani pesanan; mengelola panduan dan harga acuan | Akun admin |

Pengguna utama tahap 1 adalah **warga yang sedang membutuhkan sesuatu**. Penyedia adalah sumber data sekaligus pengguna aktif dashboard mitra.

---

## 5. Prinsip produk **[DIPUTUSKAN]**

1. **Bereskan urusannya dulu, baru sambungkan.** Nilai tambah muncul sebelum daftar penyedia: memahami kebutuhan, memperjelas, memberi gambaran biaya, menunjukkan jadwal yang benar-benar kosong.
2. **Database adalah sumber fakta.** AI tidak boleh menyebut penyedia, harga, jadwal, atau kontak yang tidak berasal dari database. Kartu hasil dibuat oleh kode, bukan oleh AI.
3. **Jangan bangun yang bisa dilakukan ChatGPT sama baiknya.** Setiap fitur harus memakai sesuatu yang hanya dimiliki Kamanga: data lokal yang dicek, jadwal nyata, sambungan ke penyedia, atau pesanan yang tercatat.
4. **AI dipanggil hanya bila perlu.** Urutan penanganan pesan: template → aturan kode → AI.
5. **Syarat wajib dipisahkan dari preferensi.** Data kosong tidak dianggap memenuhi syarat. Syarat tidak dilonggarkan diam-diam; pelonggaran ditawarkan dan dipilih warga.
6. **Kepercayaan lebih penting dari jumlah.** Lebih baik sedikit penyedia yang benar-benar baik daripada banyak yang tidak jelas. Tidak ada urutan berbayar.
7. **Penyedia tidak dipaksa berpindah kebiasaan.** Urusan harian penyedia tetap lewat WhatsApp.
8. **Jujur soal batas.** Bila data tidak ada, katakan tidak tahu dan tawarkan langkah lain.

---

## 6. Konsep inti

### 6.1 Pintu dan mesin
- **Pintu** adalah pintu masuk yang dilihat warga, dikelompokkan berdasarkan **"warga sedang ingin apa"**. Contoh: Ka main (olahraga dan hiburan).
- **Mesin** adalah kemampuan di belakang layar, dikelompokkan berdasarkan **cara transaksinya**. Contoh: Mesin Jadwal (pemesanan slot waktu).
- Satu mesin dipakai banyak pintu. Pintu baru sebisa mungkin hanya berupa **data dan pengaturan**, bukan kode baru.

Aturan pembagian **[DIPUTUSKAN]**:
- Kategori baru masuk ke pintu yang sudah ada berdasarkan "mau apa" (laundry → Ka servis; sewa tenda → Ka manyewa; rental PS → Ka main).
- Pintu dinamai menurut **niat warga**, bukan cara transaksinya. Kata "sewa" pada kategori tidak otomatis berarti Ka manyewa (lihat 6.5).
- Setiap kategori punya **satu pintu utama**. Kategori boleh tampil di pintu rencana (mis. Kabaralek), tetapi tidak ganda di dua pintu tunggal.
- Pintu baru hanya dibuat bila niatnya benar-benar berbeda dari semua pintu yang ada.
- Satu penyedia boleh muncul di beberapa pintu bila punya beberapa kategori (contoh: salon yang juga menyediakan rias acara tampil di Ka rawat diri dan, nanti, di Kabaralek). Datanya tetap satu.
- Kategori yang belum punya pintu tetap boleh diisi datanya dan tetap ditemukan lewat chat bebas (contoh: MUA/rias acara, freelancer desain dan website).
- Pintu di beranda tampil sebagai slider (lihat 8.1), jadi jumlahnya boleh bertambah tanpa membuat beranda panjang. Pintu yang datanya belum cukup disembunyikan, tetapi kategorinya tetap bisa ditemukan lewat chat.

### 6.2 Jenis pintu
- **Pintu tunggal**: satu kebutuhan, satu jenis penyedia. Dibangun lebih dulu.
- **Pintu rencana**: menggabungkan beberapa pintu tunggal ke dalam satu rencana (contoh: Kabaralek menarik vendor dari Ka manyewa, rias acara, fotografer, Ka balanjo). Dibangun belakangan, setelah data pintu tunggalnya terisi.
- **Pintu panduan**: berisi informasi terkurasi, bukan pemesanan (Kabatanyo).

### 6.3 Penyedia dan Tempat
| | Penyedia | Tempat |
|---|---|---|
| Contoh | Bengkel, travel, lapangan padel, barber, rental kamera | Kafe, resto, wisata, hotel, apotek 24 jam, IGD |
| Bisa dipesan lewat Kamanga | Ya | Tidak, informasi saja |
| Aksi utama | Pesan | Arahkan ke lokasi atau tautan keluar |

Sebuah Tempat bisa berubah menjadi Penyedia bila pemiliknya mendaftar dan mengaktifkan pemesanan.

### 6.4 Istilah data
- **Kategori**: jenis layanan (Servis AC, Lapangan Padel, Barbershop). Setiap kategori punya pintu utama, isian aturan, dan (bila memakai Mesin Jadwal) jenis jadwal.
- **Kebutuhan**: situasi warga yang dipetakan ke beberapa kategori ("pindahan rumah" → angkut barang, tukang, sewa pickup). Dipakai AI untuk memahami cerita warga.
- **Unit**: sesuatu yang dijadwalkan di dalam satu penyedia (Lapangan 1, Kursi barber A, Mobil travel jam 06.30, Kamera #2).
- **Kamus**: istilah sehari-hari dan bahasa Minang beserta artinya (onda → motor, baralek → pesta pernikahan).
- **Wilayah (gazetteer)**: provinsi → kota/kabupaten → kecamatan → nagari/kelurahan, dengan kode resmi, ejaan alternatif, titik tengah, dan **poligon batas wilayah** (PostGIS).
- **Lokasi layanan**: tempat layanan benar-benar dilakukan. Untuk penyedia yang didatangi warga, ini titik usaha. Untuk penyedia yang datang ke warga, ini alamat warga (yang bisa berbeda dari posisi warga saat memesan).

### 6.5 Pembeda pintu yang mirip **[DIPUTUSKAN]**

Pertanyaan penguji: **"Dipakai di tempat penyedia, atau dibawa pergi/ditinggali?"**

| Pintu | Niat warga | Ciri | Contoh |
|---|---|---|---|
| **Ka main** | Beraktivitas di tempat penyedia | Dipakai di lokasi itu, hitungan jam, lalu pulang | Lapangan futsal/padel/badminton, billiard, karaoke, gym, studio musik |
| **Ka rawat diri** | Merawat diri secara rutin di tempat penyedia atau dipanggil ke rumah | Layanan pada diri warga, hitungan jam/sesi | Barber, salon, spa, pijat, refleksi |
| **Ka manyewa** | Membawa pulang barang, atau menempati tempat beberapa hari ke atas | Barang dibawa keluar atau tempat ditinggali; hitungan hari/bulan/tahun | Motor, mobil, kamera, tenda, baju adat, gedung/aula, kos, kontrakan |

Kasus perbatasan:
- "Sewa lapangan futsal" → Ka main (kamus mengarahkan kata "sewa lapangan" ke Ka main).
- Gedung/aula untuk acara → Ka manyewa; nanti juga ditarik Kabaralek.
- Ruang meeting/coworking per jam → Ka manyewa (tempat) untuk sementara; ditinjau ulang bila datanya banyak.
- Rias acara (MUA) → bukan Ka rawat diri, karena niatnya acara; kategori tanpa pintu sampai Kabaralek dibuka.

---

## 7. Daftar pintu dan tahap rilis

| Tahap | Pintu | Mau apa | Contoh kategori | Mesin |
|---|---|---|---|---|
| 1 | **Ka main** | Olahraga dan hiburan | Futsal, mini soccer, padel, badminton, billiard, karaoke, gym | Jadwal (slot jam) |
| 1 | **Ka rawat diri** *(nama sementara)* | Merawat diri secara rutin | Barbershop, salon, spa, pijat, refleksi, perawatan wajah dan kulit | Jadwal (slot jam) |
| 1 | **Ka uda anta** | Memindahkan orang atau barang | Travel antarkota (hanya berizin), titip paket, pindahan | Jadwal (kursi per keberangkatan) |
| 1 | **Ka servis** | Memperbaiki | AC, motor, mobil, elektronik, tukang, kebersihan rumah, laundry | Pesanan |
| 1 | *Tempat* (belum menjadi pintu) | Informasi | Kafe, resto, wisata, hotel, apotek 24 jam, IGD | Informasi |
| 2 | Ka servis (lanjutan) | | Diagnosis dan estimasi biaya bersama mitra | Panduan + Estimasi |
| 2 | **Ka manyewa** | Membawa pulang barang atau menempati tempat untuk hari, bulan, atau tahun | Motor, mobil, kamera, alat, tenda, baju adat, gedung/aula, kos, kontrakan | Jadwal (tanggal + stok; kos = jadwal survei) |
| 2 | **Ka jalan-jalan** | Ide main dan wisata | Rekomendasi dari data Tempat dan slot pintu lain | Rekomendasi |
| 2 | **Kabatanyo** | Urusan layanan publik | KTP, KK, Samsat, izin usaha, BPJS | Panduan |
| 3 | **Kabaralek** (rencana) | Menggelar acara | Pernikahan, aqiqah, sunatan, syukuran | Acara |
| 3 | **Ka balanjo** | Membeli barang | Produk UMKM, oleh-oleh, kue, katering harian | Produk |
| 3 | **Ka baubek** | Berobat | Klinik, praktik mandiri, bidan, dokter gigi, fisioterapi, klinik hewan | Jadwal + verifikasi izin praktik |

Ditunda tanpa jadwal:
- **Pintu untuk mencari freelancer** (website, desain, video, foto produk). Nama dan konsep belum diputuskan; dibuka bila log permintaan menunjukkan banyak yang mencari. Datanya tetap boleh diisi sebagai penyedia biasa.
- **Rias acara (MUA)** sebagai pintu sendiri; untuk sementara kategori tanpa pintu, nanti ditarik Kabaralek.
- Kakarajo (mencari kerja), Kabaraja (belajar), Kabausaho (alat usaha untuk mitra).
- **Asisten AI untuk admin** (input data cepat dari teks/foto brosur, cek kualitas data, deteksi duplikat, ringkasan tinjauan revisi, moderasi ulasan, rekap permintaan warga, usulan kamus, draf panduan). **Dibahas dalam diskusi terpisah** sebelum masuk rencana; prinsip yang sudah disepakati: AI tidak pernah menerbitkan data (semua hasil masuk sebagai draf), setiap isian mencatat sumbernya, dan tidak ada scraping Google Maps atau Instagram.

Nama pintu adalah pengaturan di dashboard admin dan bisa diganti tanpa koding. Setiap nama diuji ke warga saat wawancara lapangan ("Kalau lihat tombol ini, isinya apa?") sebelum dipakai.

---

## 8. Kebutuhan fungsional

### 8.1 Beranda **[DIPUTUSKAN]**

**Tujuan:** warga bisa langsung bercerita (chat lebih dulu) dan tetap langsung paham apa yang bisa dibantu, tanpa kesan "chat AI kosong".

- Beranda adalah chat: kolom ketik ada di halaman pertama, dan jawaban muncul di halaman yang sama (tanpa pindah halaman). Alamat lama `/chat` dialihkan ke beranda.
- Judul "Kamanga hari ko?" dengan teks berganti di bawahnya yang mengikuti pintu terdepan di slider (Ka main? Ka servis? ...).
- **Slider pintu** di atas kolom ketik, bukan grid, supaya tetap rapi bila pintu bertambah. Kartu berikutnya terlihat sebagian sebagai isyarat geser. Pintu "segera" tampil di ujung dengan tanda "Segera".
  - Geser otomatis pelan (sekitar 4 detik per kartu); sampai di kartu terakhir, kembali ke kartu pertama. Digeser manual berhenti di ujung.
  - Berhenti selama disentuh atau diarahkan; jalan lagi beberapa detik setelah warga selesai menggeser.
  - Ada tombol jeda/putar (WCAG 2.2.2). Warga yang memilih "kurangi gerak" tidak melihat slider bergerak sendiri.
- Contoh pertanyaan siap ketuk di bawah kolom ketik ("Coba tanya"), agar warga tahu bentuk kalimat yang dipahami.
- Tautan masuk/akun di pojok atas.
- Warna dan gaya mengikuti tampilan chat (netral, terang/gelap).
- Tampil baik di layar 360 px ke atas, kolom ketik terlihat tanpa menggulir di ponsel; target sentuh minimal 44 px.

**Kriteria diterima**
- Urutan, nama, ikon, dan status setiap pintu diambil dari pengaturan admin, bukan ditulis di kode.
- Beranda bisa dibuka tanpa akun dan tanpa memanggil AI; AI baru mungkin dipanggil setelah warga mengirim pesan (lihat 8.2).
- `/chat` dan `/chat?q=...` dialihkan ke beranda dengan pesan yang sama.

### 8.2 Chat bebas dan pemahaman bahasa

**Tujuan:** warga boleh bercerita dengan bahasa sehari-hari kapan saja, termasuk di tengah alur.

Alur penanganan setiap pesan:
1. **Template** (gratis): sapaan, terima kasih, menu, batas pemakaian, lokasi di luar wilayah layanan, pertanyaan di luar layanan.
2. **Aturan kode** (gratis): kalimat yang jelas. Kategori dikenali lewat kamus dan nama kategori/kebutuhan; lokasi lewat lokasi perangkat atau gazetteer (lihat 8.15); waktu, jumlah orang, dan anggaran lewat pengurai.
3. **AI** (berbayar, ada batas harian): kalimat rumit, lanjutan ("yang lebih murah", "bisa jam 5?"), pertanyaan penjelasan.

Keluaran pemahaman adalah **niat terstruktur**: pintu, kategori, lokasi, waktu, jumlah, anggaran, syarat wajib, preferensi. Niat ini diteruskan ke mesin (Jadwal, Pesanan, pencarian), bukan dijawab bebas oleh AI.

Aturan:
- Bila informasi kurang, tanyakan **satu hal** dengan tombol pilihan.
- Konteks terbawa dalam satu sesi; mengubah satu parameter mempertahankan parameter lain; berganti topik mengganti kebutuhan (anggaran per porsi tidak terbawa ke pencarian lapangan).
- Pertanyaan tentang satu penyedia dijawab **hanya dari data penyedia itu** (lihat 8.8).
- Pertanyaan di luar layanan ditolak sopan lewat template, tanpa memanggil AI.
- Konten penyedia diperlakukan sebagai data, bukan instruksi.
- Pesan dipotong maksimal 500 karakter.
- Pembatas: pesan per sesi, per IP per hari, dan rem biaya AI harian.
- AI tidak pernah menerima nomor kontak, alamat rumah, atau identitas warga.

**Kriteria diterima**
- "Ado lapangan padel kosong nanti malam dakek Lubeg? Barampek kami." menghasilkan pintu Ka main, kategori padel, waktu malam ini, lokasi Lubuk Begalung, 4 orang, lalu menampilkan slot kosong yang cocok.
- Pertanyaan yang tidak berkaitan dengan layanan tidak memanggil AI.
- Set uji percakapan dijalankan otomatis dan hasilnya tercatat.

### 8.3 Pencarian dan peringkat

- Kandidat hanya dari penyedia/tempat berstatus **terbit**.
- **Syarat wajib** (kategori, wilayah layanan, waktu tersedia, kapasitas, anggaran bila diminta) menyaring kandidat. Kandidat dengan data kosong pada syarat wajib tidak dianggap lolos; boleh ditampilkan terpisah sebagai "belum pasti".
- Skor peringkat (bobot awal **[USULAN]**, disimpan di satu berkas agar bisa disetel):

| Sinyal | Bobot | Keterangan |
|---|---|---|
| Relevansi | 35% | kecocokan kategori dan kata |
| Lokasi | 25% | jarak dari lokasi layanan; untuk penyedia yang datang ke warga, lokasi warga harus berada di dalam area layanan (syarat wajib) lalu diurutkan dari markas terdekat |
| Ketersediaan | 15% | ada slot/jadwal yang cocok dengan waktu yang diminta |
| Verifikasi | 10% | belum, kontak dicek, dicek langsung |
| Ulasan | 10% | rata-rata dan jumlah ulasan pesanan selesai |
| Kelengkapan | 5% | foto, harga, aturan, jam buka |

- Hasil kosong atau sedikit: jelaskan alasannya dan tawarkan pelonggaran beserta jumlah hasilnya (perluas radius, ganti jam, abaikan anggaran). Pelonggaran hanya diterapkan setelah dipilih warga.
- Tidak ada faktor berbayar dalam peringkat.
- Halaman admin **Uji Pencarian** menampilkan rincian skor setiap hasil.

### 8.4 Mesin Jadwal

**Tujuan:** menunjukkan waktu yang benar-benar kosong dan mencegah jadwal bentrok.

Jenis jadwal per kategori:

| Jenis | Contoh | Satuan |
|---|---|---|
| Slot jam | Lapangan, barber, salon, studio musik | Durasi tetap (mis. 60 menit) per unit |
| Kursi per keberangkatan | Travel | Jam berangkat × jumlah kursi per rute |
| Rentang tanggal + stok | Sewa kamera, motor, tenda (tahap 2) | Hari, dengan jumlah unit |
| Jadwal survei | Kos, kontrakan (tahap 2) | Slot kunjungan |

Kemampuan:
- Penyedia mengatur **unit**, **jam buka per hari** (boleh beberapa interval per hari dan melewati tengah malam), **durasi slot**, **harga per slot**, dan **harga jam ramai** bila berbeda.
- **Pengecualian tanggal** (libur, acara khusus).
- **Blokir manual**: penyedia menandai slot terisi dari luar Kamanga (walk-in, pesanan lewat WA) agar tidak bentrok.
- **Tahan sementara**: saat warga memesan, slot ditahan sampai penyedia menjawab atau batas waktu habis.
- **Durasi minimal** dan **jeda antarslot** mengikuti aturan penyedia.
- Semua waktu dalam zona Asia/Jakarta.
- Pengingat ke warga sebelum jadwal (mis. 2 jam sebelumnya) **[USULAN]**.

**Kriteria diterima**
- Dua warga tidak bisa mendapatkan slot yang sama untuk unit yang sama (dijamin di tingkat database).
- Slot yang diblokir manual tidak tampil sebagai kosong.
- Perubahan jam buka tidak menghapus pesanan yang sudah dikonfirmasi; konflik ditampilkan ke penyedia.

### 8.5 Mesin Pesanan

**Tujuan:** pesanan sampai ke penyedia dengan jelas, tercatat, dan berakhir dengan ulasan.

Status pesanan:

```
dikirim → diterima → berjalan → selesai → (diulas)
   │          └──────→ dibatalkan (oleh warga/penyedia, dengan alasan)
   ├→ ditolak
   └→ kedaluwarsa (tidak dijawab dalam batas waktu)
```

Aturan:
- Pesanan dibuat dari slot (Mesin Jadwal) atau dari formulir permintaan (Ka servis: masalah, alamat/kecamatan, waktu yang diinginkan).
- Pesanan dikirim ke penyedia lewat WhatsApp dengan tombol **Terima** dan **Tolak**. Penyedia juga bisa menjawab dari dashboard mitra.
- **Nomor dan alamat lengkap warga baru dibuka ke penyedia setelah penyedia menekan Terima.** Sebelumnya penyedia hanya melihat kecamatan.
- Batas waktu menjawab dapat diatur per kategori (bawaan 30 menit **[USULAN]**; travel dan servis mendesak bisa lebih pendek). Bila ditolak atau kedaluwarsa, warga ditawari penyedia lain yang cocok.
- Pembatalan mengikuti aturan pembatalan penyedia yang sudah ditampilkan sebelum memesan.
- Setelah selesai (ditandai penyedia, atau otomatis setelah waktu slot lewat), warga ditanya "Puas?" lewat WhatsApp. Ulasan memengaruhi peringkat dan verifikasi.
- Setiap perubahan status dicatat (siapa, kapan, alasan).

**Kriteria diterima**
- Penyedia tidak pernah melihat nomor warga untuk pesanan yang tidak diterimanya.
- Pesanan yang tidak dijawab otomatis berubah menjadi kedaluwarsa dan warga diberi tahu.
- Admin bisa melihat dan menangani semua pesanan yang macet.

### 8.6 Notifikasi WhatsApp

- Memakai **WhatsApp Business API resmi** dari nomor resmi Kamanga **[DIPUTUSKAN]**. Tidak memakai jalur tidak resmi.
- Pesan yang dimulai Kamanga memakai template yang disetujui Meta; biaya mengikuti harga Meta yang berlaku.
- Selama verifikasi WhatsApp Business API belum selesai, cadangan: tombol yang membuka WhatsApp penyedia dengan pesan pesanan yang sudah terisi.

Daftar pesan tahap 1:

| Kepada | Pesan | Tombol |
|---|---|---|
| Penyedia | Pesanan baru (ringkasan, kecamatan, waktu) | Terima, Tolak |
| Penyedia | Data warga setelah diterima | — |
| Penyedia | Pengingat pesanan belum dijawab | Terima, Tolak |
| Penyedia | Pertanyaan warga yang belum ada jawabannya | Balas |
| Penyedia | Ringkasan bulanan (jumlah pesanan dan pelanggan baru) | — |
| Warga | Kode OTP | — |
| Warga | Pesanan diterima / ditolak / kedaluwarsa | Lihat pesanan |
| Warga | Pengingat sebelum jadwal | — |
| Warga | "Puas?" setelah selesai | Puas, Kurang puas |

### 8.7 Akun warga

- Menjelajah dan chat tanpa akun.
- Saat memesan pertama kali: masukkan nomor WhatsApp → kode OTP → nama panggilan. Akun terbentuk.
- Warga bisa melihat pesanan aktif, riwayat, dan ulasannya; menghapus akun dan datanya.
- Persetujuan privasi ditampilkan saat membuat akun.

### 8.8 Aturan kategori dan tanya jawab penyedia

**Lapis 1 — isian aturan per kategori.** Admin mendefinisikan isian standar untuk setiap kategori (tipe: teks, angka, ya/tidak, pilihan, pilihan ganda, rupiah, durasi). Penyedia mengisinya di dashboard. Contoh untuk Lapangan Padel:

| Isian | Tipe |
|---|---|
| Durasi minimal | durasi |
| Termasuk raket | ya/tidak |
| Harga sewa raket | rupiah |
| Batas pembatalan | durasi |
| Wajib DP | ya/tidak |
| Fasilitas | pilihan ganda (kamar mandi, tempat ganti, parkir mobil, musala, kantin) |

Isian bertipe terstruktur bisa dipakai sebagai **filter** ("padel yang termasuk raket"), sehingga dijawab oleh mesin, bukan ditebak AI.

**Lapis 2 — tanya jawab bebas per penyedia.** Penyedia menulis pasangan pertanyaan dan jawaban sendiri.

Cara AI menjawab pertanyaan tentang satu penyedia:
1. AI hanya menerima isian aturan dan tanya jawab penyedia tersebut.
2. Ada jawabannya → dirangkai dari data itu.
3. Tidak ada → "Belum ada info soal itu. Mau ditanyakan ke pengelolanya?" → pertanyaan dikirim ke penyedia lewat WA → jawaban penyedia disimpan sebagai tanya jawab baru dan dikirim ke warga.

Sebelum warga menekan Pesan, aturan penting (durasi minimal, pembatalan, DP) ditampilkan ringkas dan harus disetujui.

### 8.9 Panduan (tahap 2)

Dua bentuk isi:

1. **Pohon keputusan** (data terstruktur) untuk diagnosis Ka servis, pengarah Ka baubek, dan (nanti) penyusun brief untuk pintu freelancer.
   - Simpul pertanyaan dengan pilihan yang mengarah ke simpul berikutnya.
   - Simpul akhir berisi kemungkinan penyebab, peringatan keamanan, kategori penyedia yang cocok, dan tautan ke estimasi biaya.
   - Disusun bersama ahli (mis. bengkel mitra) lewat editor di dashboard admin, tanpa koding.
   - AI hanya menerjemahkan cerita bebas warga menjadi pilihan di pohon.
2. **Kartu panduan** untuk Kabatanyo, adat, aturan titip paket, dan aturan sewa.
   - Isi: judul, langkah, syarat, **sumber resmi**, **tanggal terakhir dicek**, wilayah berlaku.
   - Pertanyaan dicocokkan ke 1–3 kartu lewat kategori dan kemiripan makna (embedding pgvector). AI merangkai jawaban hanya dari kartu itu dan menyebut sumbernya.
   - Tidak ada kartu yang cocok → katakan belum ada informasinya dan catat pertanyaannya.

Aturan:
- Tidak memakai RAG dari kumpulan PDF atau hasil scraping web mentah.
- Diagnosis selalu disebut "kemungkinan penyebab", bukan vonis.
- Untuk rem, listrik, gas, atau risiko kebakaran: "hentikan pemakaian dan hubungi teknisi", tanpa langkah perbaikan sendiri.
- Kartu yang melewati masa cek ulang (bawaan 3 bulan **[USULAN]**) ditandai "perlu dicek" di dashboard admin.
- Ada set uji untuk Panduan yang dijalankan setiap kali isinya berubah.

### 8.10 Estimasi biaya (tahap 2)

- Kisaran harga per jenis pekerjaan, diambil dari daftar harga penyedia mitra dan harga acuan yang diisi admin.
- Ditampilkan sebagai rentang dengan rincian komponen dan catatan "harga final dari penyedia".
- Tanpa data cukup → tidak menampilkan estimasi dan mengatakannya dengan jujur.

### 8.11 Rekomendasi untuk Ka jalan-jalan (tahap 2)

- Menyusun ide kegiatan dari konteks (waktu, anggaran, rombongan, lokasi, minat) dan data Tempat, ditambah slot kosong dari pintu lain (mis. padel yang masih kosong jam 16.00).
- Atribut Tempat yang dipakai: cocok untuk siapa, suasana, jam ramai, kisaran harga per orang, tempat melihat matahari terbenam, Wi-Fi/colokan, musala, parkir.
- Hotel hanya sebagai informasi dan tautan keluar.
- Tempat dipilih oleh mesin dari database; AI hanya merangkai kalimat.

### 8.12 Dashboard mitra

Dibuat untuk ponsel (bisa dipasang ke layar utama sebagai PWA). Menu menyesuaikan kategori yang dipilih penyedia.

| Menu | Isi | Muncul untuk |
|---|---|---|
| Beranda | Pesanan hari ini, pesanan menunggu jawaban, ringkasan bulan berjalan, tugas (lengkapi aturan, jawab pertanyaan warga) | Semua |
| Pesanan | Daftar masuk / diterima / selesai / dibatalkan; terima, tolak, tandai selesai | Semua |
| Jadwal | Kalender per unit, jam buka, harga per slot, pengecualian tanggal, blokir manual | Kategori yang memakai Mesin Jadwal |
| Usaha & layanan | Profil, foto, layanan dan harga, area layanan, kontak | Semua |
| Aturan & tanya jawab | Isian aturan kategori, tanya jawab bebas, pertanyaan warga yang menunggu dijawab | Semua |
| Ulasan | Ulasan dari pesanan selesai | Semua |
| Statistik | Dilihat, dipesan, diterima, jam paling ramai | Semua |

Pendaftaran mitra:
1. Daftar akun → pilih "Daftarkan usaha" atau "Klaim usaha" (bila sudah diinput tim).
2. Isi profil, kategori, lokasi/area layanan, layanan dan harga, aturan, jadwal (bila relevan).
3. Ajukan → status menunggu tinjauan → terbit atau perlu perbaikan (dengan catatan admin).
4. Klaim usaha diverifikasi lewat nomor WhatsApp yang terdaftar pada usaha tersebut.
5. Perubahan pada usaha yang sudah terbit disimpan sebagai revisi; versi terbit tetap tampil sampai revisi disetujui.

### 8.13 Dashboard admin

| Menu | Isi |
|---|---|
| Ringkasan | Pesanan hari ini, pesanan belum dijawab, penyedia menunggu tinjauan, pertanyaan warga belum terjawab, pencarian tanpa hasil |
| Pesanan | Semua pesanan lintas pintu, filter status, penanganan pesanan macet, catatan admin |
| Penyedia & Tempat | Daftar, formulir input, antrean tinjauan dan revisi, klaim, tingkat verifikasi, impor CSV |
| Pintu | Daftar pintu, kategori di dalamnya, tampil di beranda/segera/tersembunyi, urutan, ikon, teks berganti |
| Kategori & aturan | Kategori, kelompok, sebutan lain, isian aturan, jenis jadwal, batas waktu menjawab |
| Kebutuhan | Situasi warga dan kategori terkaitnya |
| Kamus & Wilayah | Istilah dan bahasa Minang; gazetteer dan sebutan lain wilayah |
| Panduan (tahap 2) | Editor pohon keputusan dan kartu panduan, tanggal cek |
| Harga acuan (tahap 2) | Data untuk estimasi biaya |
| Permintaan warga | Pencarian tanpa hasil dan pertanyaan tak terjawab, dikelompokkan per kategori dan wilayah |
| Uji | Uji pencarian dengan rincian skor, set uji percakapan, set uji panduan |
| Pengaturan | Template pesan WA, batas waktu menjawab bawaan, batas pemakaian chat, rem biaya AI harian |

### 8.14 Kurasi dan verifikasi

Status penerbitan dan tingkat verifikasi dipisahkan.

- **Status:** draf → menunggu tinjauan → terbit / ditolak → diarsipkan.
- **Tingkat verifikasi:**

| Tingkat | Arti |
|---|---|
| Belum | Lolos pemeriksaan dasar admin saja |
| Kontak dicek | Nomor aktif dan benar milik usaha |
| Dicek langsung | Tim memastikan di lapangan (kunjungan atau panggilan video) |

- Hanya penyedia dengan tingkat minimal **kontak dicek** yang bisa menerima pesanan **[USULAN]**.
- Ulasan setelah pesanan menjadi verifikasi berkelanjutan; penyedia yang sering dikeluhkan diturunkan atau dinonaktifkan.
- Aturan khusus:
  - **Travel** hanya yang memiliki izin angkutan resmi.
  - **Kesehatan** (tahap 3): izin praktik diverifikasi sebelum bisa dipesan.
  - **Foto tempat tinggal** (kos/kontrakan): lencana "Foto dicek langsung" hanya setelah dikunjungi tim.

### 8.15 Lokasi dan wilayah

**Tujuan:** mencarikan penyedia terdekat tanpa membuat warga mengetik dan menjawab pertanyaan berulang ("daerah mana?", "Koto Baru yang di mana?").

**Cara Kamanga mengetahui lokasi warga, berurutan:**

1. **Lokasi perangkat (utama)**
   - Kamanga lebih dulu menjelaskan alasannya di dalam percakapan, misalnya *"Biar ambo carikan yang paling dekat, boleh pakai lokasi uda?"* dengan tombol **[Pakai lokasi saya]** dan **[Ketik daerah]**.
   - Izin lokasi browser baru diminta **setelah** warga menekan tombol itu. Tidak ada permintaan izin otomatis saat halaman dibuka.
   - Koordinat diubah menjadi nama wilayah (titik → kelurahan/kecamatan lewat poligon) dan ditampilkan untuk dicek: *"Lokasi: Kuranji, Padang · [Ganti]"*.
2. **Ketik nama daerah (cadangan)**: bila izin ditolak, perangkat tanpa GPS, atau lokasi layanan berbeda dari posisi warga (mis. perantau memesan tukang untuk rumah orang tua). Nama dicocokkan ke gazetteer beserta ejaan alternatif dan sebutan populer.
3. **Pilih di peta**: geser penanda untuk alamat yang tidak dikenali gazetteer **[USULAN]**.
4. **Alamat tersimpan** untuk warga yang punya akun (Rumah, Kantor, alamat lain).

**Menyelesaikan nama yang ambigu, tanpa bertanya bila bisa:**
- Batasi ke wilayah yang dilayani (selama layanan hanya di Padang, "Koto Baru" otomatis berarti Koto Baru di Padang).
- Gunakan konteks: lokasi terakhir warga, alamat tersimpan, lalu wilayah yang paling sering dicari.
- Hanya bila tetap ambigu, tanyakan sekali dengan tombol pilihan.

**Lokasi layanan per jenis penyedia:**

| Mode penyedia | Data lokasi penyedia | Lokasi warga yang dipakai | Pencocokan |
|---|---|---|---|
| Warga datang ke tempat (lapangan, barber, bengkel) | Titik koordinat usaha | Posisi warga saat ini atau titik awal yang dipilih | Urutkan dari jarak terdekat |
| Penyedia datang ke warga (teknisi AC, pijat panggilan, tukang) | Titik markas + **area layanan**: daftar wilayah (kecamatan/kelurahan/seluruh kota) atau radius (km) | **Alamat tempat layanan** ("Servisnya di mana?": lokasi saya, alamat tersimpan, atau ketik/pilih di peta) | Lokasi warga harus di dalam area layanan (syarat wajib), lalu urutkan dari markas terdekat |
| Daring | — | — | Tanpa syarat lokasi |
| Travel antarkota | Rute (kota asal → kota tujuan) + wilayah jemput | Titik jemput warga | Rute cocok dan titik jemput di dalam wilayah jemput |

**Teknis:**
- **PostGIS dipakai sejak awal [DIPUTUSKAN]** untuk: titik di dalam poligon wilayah (kelurahan/kecamatan), titik di dalam area layanan, dan pengurutan jarak.
- Poligon batas wilayah diimpor dari data batas wilayah resmi (kode Kemendagri) dan disimpan per tingkat wilayah. Perluasan ke kota/kabupaten lain cukup menambah data.
- Jarak tahap 1 memakai jarak garis lurus; jarak tempuh lewat jalan dipertimbangkan nanti.
- Jarak ditampilkan dibulatkan (mis. "1,8 km").

**Privasi:**
- Koordinat perangkat hanya dipakai untuk pencarian saat itu dan **tidak disimpan**, kecuali warga menyimpannya sebagai alamat.
- Alamat lengkap hanya disimpan pada pesanan dan baru terlihat oleh penyedia setelah pesanan diterima.
- Penyedia rumahan atau perorangan hanya menampilkan kecamatan ke publik; titik tepatnya disimpan privat untuk perhitungan jarak.

**Kriteria diterima**
- Warga yang mengizinkan lokasi tidak ditanya "daerah mana" sama sekali.
- Menolak izin lokasi tidak menghalangi pencarian; warga bisa mengetik daerah.
- "Koto Baru" tidak memicu pertanyaan tambahan selama layanan hanya mencakup Padang.
- Teknisi panggilan tidak muncul untuk alamat di luar area layanannya.
- Penyedia yang didatangi warga muncul berurutan dari yang terdekat.

---

## 9. Alur pengguna utama (tahap 1)

### 9.1 Warga memesan lapangan (Ka main)
1. Beranda → Ka main → pilih jenis (padel).
2. Pilih tanggal dan jam (atau ketik "padel nanti malam dakek Lubeg").
3. Kamanga menawarkan **[Pakai lokasi saya]**; bila diizinkan, lokasi langsung terisi (bisa diganti).
4. Daftar lapangan dengan slot kosong, harga per slot, jarak, verifikasi, ulasan, diurutkan dari yang terdekat.
5. Pilih slot → lihat ringkasan aturan (durasi minimal, pembatalan, raket) → setujui.
6. Masuk dengan nomor WA (OTP) bila belum punya akun.
7. Pesanan dikirim; slot ditahan sementara.
8. Pengelola menekan Terima di WA → warga menerima konfirmasi → pengingat sebelum jadwal → "Puas?" setelahnya.

### 9.2 Warga memesan servis (Ka servis)
1. Beranda → Ka servis → pilih jenis (AC) → ceritakan keluhan.
2. "Servisnya di mana?" → lokasi saya sekarang, alamat tersimpan, atau ketik/pilih di peta.
3. Pilih waktu yang diinginkan (tanggal + pagi/siang/sore).
4. Daftar teknisi yang area layanannya mencakup alamat itu, diurutkan dari yang terdekat (tahap 2: ditambah diagnosis dan estimasi biaya).
5. Pesan → teknisi menerima di WA → nomor dan alamat dibuka → teknisi menghubungi warga.
6. Teknisi menandai selesai → warga memberi ulasan.

### 9.3 Warga memesan travel (Ka uda anta)
1. Beranda → Ka uda anta → penumpang atau titip paket.
2. Rute (asal, tujuan), tanggal, waktu (pagi/siang/sore/malam), jumlah penumpang, titik jemput (lokasi saya, alamat tersimpan, atau pilih di peta).
3. Daftar travel berizin dengan jam keberangkatan, sisa kursi, harga per orang, jenis jemput (alamat/titik kumpul), info lokal (mis. kondisi jalur akhir pekan).
4. Pesan kursi → travel menerima → konfirmasi dan pengingat.

### 9.4 Penyedia bergabung
1. Tim mengunjungi atau menghubungi penyedia → penyedia mendaftar (atau mengklaim data yang sudah diinput tim).
2. Isi profil, jadwal, harga, aturan → diajukan → ditinjau admin → terbit.
3. Pesanan pertama datang lewat WA → Terima → layani → ulasan masuk.
4. Setiap bulan menerima ringkasan pesanan dari Kamanga.

---

## 10. Model data (garis besar)

| Entitas | Isi penting |
|---|---|
| Pengguna & peran | admin, mitra, warga; nomor WA terverifikasi untuk warga |
| Alamat tersimpan | warga, label (Rumah/Kantor), alamat teks, titik koordinat, wilayah hasil pencocokan |
| Pintu | slug, nama, ikon, urutan, status tampil (aktif/segera/tersembunyi), jenis (tunggal/rencana/panduan) |
| Kelompok kategori, Kategori | pintu utama, pintu tambahan, sebutan lain, skema isian aturan, jenis jadwal, batas waktu menjawab, perlu lokasi, hanya informasi |
| Kebutuhan | sebutan lain, kategori terkait, slot yang perlu ditanyakan |
| Wilayah & sebutan lain | tingkat, kode resmi, induk, titik tengah, poligon batas (PostGIS) |
| Listing | jenis (**penyedia** / **tempat**), nama, ringkasan, deskripsi, titik koordinat (PostGIS), titik publik atau privat, area layanan (daftar wilayah dan/atau radius km), mode layanan (datang ke tempat / dipanggil / daring), kontak, harga (min, maks, satuan), jam buka, isian aturan (JSON), foto, status, tingkat verifikasi, pemilik, sumber data |
| Kategori listing, Area listing, Revisi listing, Klaim listing | relasi dan alur kurasi |
| Tanya jawab listing | pertanyaan, jawaban, asal (penyedia / dari pertanyaan warga), tanggal |
| Unit | listing, nama, kapasitas (mis. kursi), aktif |
| Aturan jadwal | unit, hari, interval jam, durasi slot, harga, harga jam ramai, jeda |
| Pengecualian jadwal | unit, tanggal, tutup/jam khusus |
| Blokir slot | unit, mulai, selesai, alasan (walk-in, WA, lainnya) |
| Pesanan | warga, listing, unit, waktu mulai/selesai atau tanggal, jumlah, lokasi layanan (alamat + titik, terlihat penyedia hanya setelah diterima), wilayah (kecamatan, terlihat sejak awal), rincian (JSON sesuai jenis), status, batas waktu menjawab, harga tertera |
| Riwayat status pesanan | status, pelaku, waktu, alasan |
| Ulasan | pesanan, nilai (puas/kurang puas + bintang **[TERBUKA]**), komentar |
| Pesan WA | arah, template, status kirim/baca, pesanan terkait |
| Sesi & pesan chat, panggilan AI, log pencarian, peristiwa (klik keluar, klik WA) | untuk evaluasi, biaya, dan rekap kebutuhan |
| Pohon panduan, kartu panduan, harga acuan | tahap 2 |

Kunci keamanan data: slot dan pesanan untuk unit yang sama tidak boleh tumpang tindih (constraint di database); nomor dan alamat warga disimpan terpisah dan hanya dapat dibaca penyedia untuk pesanan yang diterimanya.

---

## 11. Kebutuhan non-fungsional

| Aspek | Kebutuhan |
|---|---|
| Perangkat | Web responsif, nyaman mulai lebar 360 px; dashboard mitra bisa dipasang sebagai PWA |
| Kinerja | Beranda dan daftar hasil tampil < 2 detik di jaringan 4G; jawaban berbasis template/kode < 1 detik |
| Ketersediaan | Pesanan dan notifikasi WA tetap jalan saat AI gagal atau kuota AI habis; pencarian dengan filter selalu tersedia |
| Keamanan | Otorisasi diperiksa di server untuk setiap operasi; rahasia hanya di server; kunci API tidak pernah di browser |
| Privasi (UU PDP No. 27/2022) | Persetujuan jelas; data warga minimum; koordinat perangkat tidak disimpan kecuali dijadikan alamat; nomor/alamat hanya dibuka ke penyedia yang menerima pesanan; data ke pihak lain hanya agregat dan anonim; warga bisa menghapus akun; log chat dengan masa simpan terbatas |
| Aksesibilitas | Kontras teks minimal 4.5:1, target sentuh 44 px, fokus keyboard terlihat, label pada semua kontrol |
| Bahasa | Antarmuka Bahasa Indonesia; AI memahami bahasa Minang, campuran, singkatan, dan salah ketik |
| Biaya | Rem biaya AI harian; batas pengeluaran di dasbor penyedia AI dan WA; biaya AI per percakapan dipantau |
| Zona waktu | Asia/Jakarta untuk semua jadwal |

---

## 12. Teknologi **[DIPUTUSKAN]**

| Kebutuhan | Pilihan |
|---|---|
| Bahasa, framework | TypeScript, Next.js (App Router) |
| Database | PostgreSQL + **PostGIS** (lokasi, poligon wilayah, area layanan, jarak) + pgvector (pencocokan makna) |
| Lokasi perangkat | Geolocation API browser, diminta hanya setelah warga menekan tombol |
| ORM, validasi | Drizzle, Zod |
| UI | Tailwind CSS + shadcn/ui |
| Auth | Better Auth (admin, mitra, warga; OTP WA untuk warga) |
| AI | Vercel AI SDK dengan lapisan gateway tipis (penyedia bisa diganti: Anthropic, OpenAI, Google), batas pemakaian, pencatatan biaya |
| Pesan | WhatsApp Business API resmi |
| Media | Cloudflare R2 |
| Pengembangan | Lokal di Mac (Postgres Homebrew) |
| Produksi | VPS dengan Docker Compose + Caddy, backup harian ke penyimpanan eksternal, SSH key-only, firewall, pemantauan uptime |

Penyedia AI dipilih berdasarkan set uji (akurasi bahasa Minang dan pengisian slot, keandalan pemanggilan tool, biaya per percakapan, latensi). Akun AI gratisan hanya untuk uji coba, tidak untuk layanan warga.

---

## 13. Ukuran keberhasilan

| Ukuran | Definisi | Target tahap 1 **[USULAN]** |
|---|---|---|
| **Angka utama** | % sesi dengan niat jelas yang berakhir dengan pesanan terkirim | ditetapkan setelah 4 minggu data |
| Pesanan diterima | % pesanan yang diterima penyedia | ≥ 70% |
| Waktu jawab penyedia | median waktu sampai Terima/Tolak | ≤ 15 menit |
| Kepuasan | % ulasan "Puas" | ≥ 85% |
| Penyedia aktif | penyedia yang menerima ≥ 1 pesanan per bulan | bertambah setiap bulan |
| Warga kembali | % warga yang memesan lagi dalam 60 hari | dipantau |
| Biaya AI | rata-rata biaya AI per percakapan | dipantau, ada batas atas |
| Kualitas pemahaman | akurasi niat dan slot di set uji | ≥ 85% |

---

## 14. Rencana rilis

### Tahap 1 — Padang (sekitar 12 minggu)

| Minggu | Pekerjaan |
|---|---|
| 1–2 | Wawancara lapangan; fondasi proyek, skema data, auth, pengaturan pintu dan kategori |
| 3–6 | Mesin Jadwal, Mesin Pesanan, dashboard mitra (jadwal, pesanan, profil, aturan), dashboard admin (pesanan, pintu, kategori & aturan); mulai input data |
| 5–8 | Beranda dan alur warga untuk Ka main, Ka rawat diri, Ka uda anta, Ka servis; chat bebas tersambung ke mesin; OTP WA |
| 7–10 | Integrasi WhatsApp Business API (cadangan tautan WA selama verifikasi); peluncuran terbatas ke kenalan dan komunitas |
| 10–12 | Perbaikan dari data nyata; ringkasan bulanan untuk mitra; evaluasi ukuran keberhasilan |

**Kriteria tahap 1 selesai**
- Minimal 20 lapangan/tempat main, 15 tempat perawatan diri, 5 travel berizin, dan 15 penyedia servis terbit dengan data lengkap **[USULAN]**.
- Warga bisa memesan dari awal sampai ulasan tanpa bantuan tim.
- Penyedia bisa menerima pesanan hanya lewat WA.
- Tidak ada jadwal bentrok dalam uji beban sederhana.
- Set uji percakapan dan pencarian lulus di atas ambang yang ditetapkan.

### Tahap 2
Ka servis dengan diagnosis dan estimasi; Ka manyewa; Ka jalan-jalan; Kabatanyo; Mesin Panduan, Estimasi, Rekomendasi.

### Tahap 3
Kabaralek; Ka balanjo; Ka baubek (booking); perluasan wilayah ke kota/kabupaten lain di Sumatra Barat.

---

## 15. Model bisnis

**Masa perintisan: gratis penuh** untuk warga dan penyedia **[DIPUTUSKAN]**. Diumumkan sebagai "Program Mitra Perintis", bukan "gratis selamanya".

Selama masa perintisan:
- Semua pesanan dicatat sebagai bukti nilai bagi penyedia.
- Penyedia menerima ringkasan bulanan ("bulan ini 9 pelanggan baru dari Kamanga").
- Setiap klik keluar (WA, situs, marketplace) dicatat.
- Batas pengeluaran bulanan untuk AI, WhatsApp, dan server dipasang sejak awal.

Rencana setelah masa perintisan **[USULAN, tidak dibangun di tahap 1]**:
- Bayar per pesanan yang diterima (saldo prabayar, dengan kuota gratis bulanan).
- Langganan Mitra Pro (chatbot di nomor WA penyedia sendiri, statistik lanjutan, lencana).
- Komisi transaksi bila pembayaran lewat payment gateway (Kamanga tidak menampung uang sendiri).
- Afiliasi (hotel, produk UMKM) dan promo lokal, selalu berlabel jelas.
- Kerja sama Pemda dan hibah berbasis data kebutuhan warga yang agregat dan anonim.

Sinyal mulai menagih: selama 2 bulan berturut-turut penyedia aktif rutin menerima pesanan, penyedia mengakui manfaatnya, sebagian besar pesanan diterima, dan ada warga yang memesan kembali.

Larangan tetap: tidak ada urutan berbayar yang mengalahkan relevansi; tidak menjual data pribadi.

---

## 16. Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Warga menganggap Kamanga chat AI umum | Beranda chat dengan slider pintu dan contoh pertanyaan sejak layar pertama, jawaban selalu berujung aksi, penolakan sopan untuk permintaan di luar layanan |
| Data penyedia sedikit atau basi | Fokus Padang dan 4 pintu; tim input data awal; pengingat ke penyedia untuk memperbarui; pintu kosong disembunyikan |
| Penyedia tidak membalas pesanan | Batas waktu + tawaran penyedia lain; pengingat; penyedia yang sering tidak membalas diturunkan |
| Jadwal bentrok dengan pesanan di luar Kamanga | Blokir manual yang mudah dari HP; tahan sementara; constraint database |
| Penyedia nakal | Verifikasi berlapis, ulasan, penonaktifan |
| Biaya AI dan WA membengkak | Template/kode lebih dulu, model kelas murah, rem harian, batas pengeluaran |
| Verifikasi WhatsApp Business API lambat | Cadangan tautan WA dengan pesan terisi |
| Pelanggaran privasi | Pembukaan data bertahap, data minimum, kepatuhan UU PDP |
| Pemain nasional (aplikasi booking lapangan, kos, hotel) | Kedalaman lokal, relasi langsung dengan penyedia, satu aplikasi untuk banyak urusan; tidak bersaing di hotel |
| Fokus terpecah karena banyak ide pintu | Pintu baru hanya dibuka bila data permintaan dan kesiapan penyedia mendukung |

---

## 17. Di luar cakupan (seluruh tahap 1)

Pembayaran dan saldo; tagihan dan langganan; chatbot di nomor penyedia; asisten AI untuk admin (dibahas terpisah); pemesanan hotel; promo dan afiliasi; aplikasi native; peringkat berbayar; diagnosis kesehatan; wilayah di luar Padang; Kakarajo, Kabaraja, Kabausaho.

---

## 18. Pertanyaan terbuka **[TERBUKA]**

1. Pintu pertama yang paling diprioritaskan untuk isi data: Ka main atau Ka uda anta? (ditentukan dari wawancara lapangan)
2. Batas waktu menjawab bawaan per kategori (servis mendesak, travel, lapangan).
3. Bentuk ulasan: dua pilihan (puas/kurang puas) atau bintang 1–5?
4. Apakah penyedia boleh memilih "konfirmasi otomatis" untuk slot tertentu?
5. Masa simpan log chat dan riwayat pesanan.
6. Penyedia AI yang dipakai setelah evaluasi set uji.
7. Apakah aplikasi booking lapangan nasional sudah banyak dipakai di Padang?
8. Sumber dan versi data poligon batas wilayah yang dipakai, serta penyedia peta untuk fitur "pilih di peta".
9. Area layanan bawaan untuk penyedia panggilan yang belum mengisinya (mis. kecamatan sendiri + radius 5 km?).
10. Ruang lingkup dan urutan fitur Asisten AI untuk admin (diskusi terpisah).

---

## Lampiran A — Glosarium

| Istilah | Arti |
|---|---|
| Pintu "Ka-" | Pintu masuk berdasarkan kebutuhan warga; "Ka-___" berarti "mau ___" |
| Mesin | Kemampuan di belakang layar yang dipakai banyak pintu |
| Penyedia | Usaha atau perorangan yang bisa dipesan lewat Kamanga |
| Tempat | Lokasi yang ditampilkan sebagai informasi saja |
| Unit | Bagian dari penyedia yang dijadwalkan (lapangan, kursi, kendaraan) |
| Slot | Satu rentang waktu pada satu unit |
| Mitra | Penyedia yang memiliki akun di Kamanga |
| Masa perintisan | Periode awal gratis penuh |

## Lampiran B — Contoh isian aturan kategori

**Barbershop**: durasi layanan (potong, cukur jenggot, cuci), perlu reservasi atau bisa walk-in, batas keterlambatan, batas pembatalan, menerima anak-anak.

**Travel antarkota**: rute, jam keberangkatan, jemput di alamat atau titik kumpul, jenis kendaraan, barang bawaan maksimal, menerima titip paket, batas pembatalan, nomor izin angkutan.

**Servis AC**: merek yang dilayani, biaya kunjungan/cek, garansi pengerjaan, melayani di luar jam kerja, area layanan.

## Lampiran C — Contoh pesan WhatsApp ke penyedia

```
Pesanan baru · Ka main
Lapangan Padel 2 · Sabtu, 18 Okt · 19.00–20.00
4 orang · sewa raket: ya
Lokasi pemesan: Lubuk Begalung

[Terima]  [Tolak]
Tidak dijawab dalam 30 menit, pesanan ditawarkan ke tempat lain.
```
