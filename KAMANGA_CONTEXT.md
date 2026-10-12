# Kamanga AI — Konteks Proyek & Keputusan Teknis

Dokumen ini merangkum hasil diskusi perencanaan awal Kamanga AI. Baca seluruhnya sebelum mulai bekerja di proyek ini.

## Tentang pemilik proyek

- Pemilik proyek **benar-benar baru di dunia AI/ML** dan sedang belajar sambil membangun.
- Jelaskan setiap langkah dengan bahasa sederhana, sertakan alasan di balik setiap keputusan teknis, dan hindari jargon tanpa penjelasan.
- Komunikasi dalam **Bahasa Indonesia**.
- Biaya harus **hemat**: chatbot tahap awal direncanakan **gratis** untuk warga.

## Visi produk

**Kamanga AI** (dari bahasa Minang *"ka manga"* = "mau apa / mau mencari apa") adalah asisten AI lokal untuk masyarakat dan UMKM di Sumatra Barat.

Roadmap jangka panjang (untuk konteks saja):
1. **Tahap 1 — Chatbot B2C**: asisten jasa & kebutuhan lokal, gaya bahasa Minang kasual campur Indonesia.
   - *Kamanga Baralek*: rekomendasi gedung, sewa baju adat, katering, vendor pernikahan.
   - *Home Service/Urgent*: montir motor panggilan, servis AC, tukang, dll.
2. **Tahap 2 — Kamanga Bisnis (B2B berbayar)**: pencatatan keuangan/utang-piutang via voice note (*Panggaleh Hitung*), AI Marketing Kit.
3. **Tahap 3 — Kerja sama Pemda**: digitalisasi UMKM, dasbor data ekonomi daerah.

## Fokus saat ini

- **Hanya Tahap 1, fokus pada core system** agar Kamanga bisa launching dan "pintar".
- WhatsApp **belum** jadi fokus; antarmuka awal adalah **web chat** (core harus channel-agnostic agar WhatsApp nanti tinggal disambungkan).
- Urusan bisnis/monetisasi ditunda.

## Dua sistem utama

1. **Sistem direktori (fondasi, dibangun duluan)** — "buku alamat pintar" vendor/UMKM.
   - Database vendor, kategori (taksonomi), lokasi (gazetteer Sumbar).
   - Panel admin untuk input & verifikasi vendor.
   - Fungsi pencarian: filter terstruktur + pencarian semantik (pgvector) + jarak (PostGIS), dengan ranking.
   - Tidak butuh AI (kecuali pembuatan embedding).
2. **Chatbot (lapisan kecerdasan)** — memakai direktori sebagai sumber jawaban.
   - Orkestrator LLM dengan tool calling.
   - Gateway LLM (pengatur model, biaya, batas pemakaian).
   - Memori percakapan & log untuk evaluasi.

Aturan: chatbot **membaca** dari direktori; direktori tidak bergantung pada chatbot.

## Prinsip "kepintaran" Kamanga

Kamanga **tidak melatih model sendiri**. Kepintaran datang dari:
1. **Prompt/SOP** yang baik (persona Kamanga, gaya Minang, batasan topik).
2. **Data** berkualitas (database vendor terverifikasi).
3. **Tools** yang dipanggil LLM (mis. `cari_vendor`, `detail_vendor`, `info_lokal`, `simpan_preferensi`).
4. **Evaluasi** berkala dengan set uji pertanyaan nyata.

Komponen pemahaman bahasa (aset data lokal yang penting):
- **Kamus istilah Minang** (baralek, anak daro, marapulai, pelaminan, lapau, oto, onda, dll.) → dipetakan ke kategori.
- **Gazetteer lokasi** Sumbar: kecamatan, kelurahan, nagari + ejaan alternatif/sebutan populer ("Bukiktinggi" → Bukittinggi, "Pasa Raya", "Aia Pacah") + koordinat.
- **Taksonomi kategori**, mis. *Baralek → Katering / Pelaminan & dekorasi / Sewa baju adat / Gedung / Dokumentasi / Orgen tunggal*.

Orkestrator:
- Pola **agen + tool calling**, bukan if-else kaku.
- **Slot filling** per kategori (mis. katering baralek: tanggal, lokasi, jumlah tamu, budget; montir: lokasi, kendaraan, keluhan, urgensi). Tanya balik secara natural, maksimal 1–2 pertanyaan. Untuk kasus mendesak, beri opsi terdekat dulu.
- **Aturan anti-halusinasi (wajib)**: hanya boleh menyebut vendor, harga, dan kontak yang berasal dari hasil tool. Jika kosong, jujur dan tawarkan alternatif (mis. perluas radius).
- Ranking vendor: relevansi, jarak, status terverifikasi, rating, kelengkapan profil.

Memori: percakapan (beberapa pesan terakhir + ringkasan) dan jangka panjang (domisili, preferensi) di tabel database.

Evaluasi: set uji 200–300 pertanyaan berbagai gaya (Minang kental, campur, singkatan, typo), ukur akurasi niat, slot, dan relevansi vendor. Log semua percakapan (dengan izin) dan tandai kegagalan.

## Strategi hemat biaya

1. **Jangan panggil LLM jika tidak perlu**: sapaan/menu → template; ekstraksi kamus/lokasi oleh kode; cache jawaban (termasuk semantic cache).
2. **Model kelas murah sebagai default**; eskalasi ke model besar hanya jika model murah menandai tidak yakin, permintaan kompleks (mis. paket baralek lengkap), atau user tidak puas.
3. **Prompt caching**: bagian statis (persona, kamus, definisi tool) di depan, bagian dinamis di belakang.
4. **Konteks ramping**: riwayat pendek + ringkasan; hasil pencarian padat (top 5, field penting); batasi panjang output.
5. **Proteksi layanan gratis**: batas pesan per user per hari, rem darurat biaya harian, tolak topik di luar layanan.
6. **Batch API** untuk pekerjaan non-real-time (embedding, evaluasi).
7. **Batas pengeluaran** di dashboard vendor LLM sejak hari pertama.

Vendor LLM **belum diputuskan** (GPT / Gemini / Claude). Putuskan berdasarkan hasil set evaluasi pada model kelas murah masing-masing (akurasi Minang & slot, keandalan tool calling, biaya per percakapan, latensi). Karena itu semua panggilan LLM wajib lewat **gateway** agar vendor mudah diganti. Router berbasis tingkat kesulitan dibangun nanti setelah ada data log.

## Infrastruktur

- **VPS sendiri** (dipilih agar biaya terprediksi, bukan Supabase): 2 vCPU, 8 GB RAM, 100 GB NVMe, 8 TB bandwidth. OS belum dikonfirmasi.
- Semua komponen via **Docker Compose**:
  - PostgreSQL + pgvector + PostGIS
  - Aplikasi Next.js
  - **Caddy** sebagai reverse proxy + HTTPS otomatis
- VPS untuk data & logika; **kecerdasan via API** (tidak menjalankan LLM atau speech-to-text sendiri di VPS).
- Wajib: backup database harian ke penyimpanan eksternal (mis. Cloudflare R2/Backblaze B2), SSH key-only, firewall (port database tidak terbuka ke internet), update berkala, uptime monitoring.

Yang sengaja TIDAK dilakukan di awal: fine-tuning/training model, self-host LLM di GPU, vector DB terpisah, microservices/Kubernetes, router ML.

## Stack (keputusan: satu stack, ekosistem JavaScript)

| Kebutuhan | Pilihan |
|---|---|
| Bahasa | TypeScript |
| Framework | Next.js (dipilih atas TanStack Start karena referensi lebih banyak untuk pemula) |
| Database | PostgreSQL + pgvector + PostGIS |
| ORM | Drizzle ORM |
| AI / gateway | Vercel AI SDK (+ lapisan tipis: rate limit per user, pencatatan biaya) |
| Validasi | Zod |
| UI | Tailwind CSS + shadcn/ui |
| Auth admin | Better Auth |
| Deploy | Docker Compose + Caddy di VPS |

Laravel sempat dipertimbangkan untuk panel input vendor, tapi diputuskan **satu stack JS** untuk mengurangi kerumitan.

## Struktur proyek yang disarankan

```
kamanga/
├── app/
│   ├── (publik)/        → halaman direktori untuk warga
│   ├── (admin)/         → panel input & verifikasi vendor
│   ├── (chat)/          → tampilan web chat
│   └── api/chat/        → pintu masuk pesan ke chatbot
├── lib/
│   ├── direktori/       → SISTEM 1: skema, pencarian, ranking
│   └── kamanga-ai/      → SISTEM 2: prompt, tools, gateway, memori
├── db/                  → skema & migrasi database
└── docker-compose.yml   → Postgres + aplikasi + Caddy
```

Aturan: `kamanga-ai` boleh memanggil `direktori`, tidak sebaliknya.

## Strategi data & peluncuran

- Mulai dari **supply**: satu kota (mis. Padang) dan 1–2 kategori (Baralek + servis AC/motor), kumpulkan ±100–200 vendor sebelum dibuka ke warga.
- Perhatikan **UU PDP (UU No. 27/2022)**: consent jelas, kebijakan privasi, data untuk pihak lain hanya agregat & anonim.

## Urutan kerja

1. **Skema database direktori** (vendor, kategori, lokasi, dll.) ← LANGKAH BERIKUTNYA
2. Setup proyek Next.js + Docker di VPS
3. Panel admin input vendor, mulai isi data
4. Fungsi pencarian & ranking
5. Chatbot: prompt, tools, web chat, evaluasi

## Pertanyaan yang masih terbuka

- Apakah direktori juga akan jadi **website publik** (halaman profil vendor yang bisa diindeks Google dan dibagikan chatbot), atau hanya dipakai di balik layar oleh chatbot?
- Sistem operasi VPS (mis. Ubuntu) dan apakah VPS sudah dibeli.
- Tingkat pengalaman coding pemilik proyek secara umum (yang pasti: baru di AI/ML).
