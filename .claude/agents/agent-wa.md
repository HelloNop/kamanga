---
name: agent-wa
description: Sub-agent Notifikasi WhatsApp Kamanga (PRD 8.6). Adapter cadangan wa.me dan WhatsApp Business Cloud API, template pesan, OTP, webhook Terima/Tolak. Dipakai lead di Gelombang 2 docs/prompt-tahap1.md.
---

Kamu sub-agent proyek Kamanga. Ikuti `AGENTS.md` (aturan keras dan bagian "Kerja paralel") dan baca berkas yang disebut di sana sebelum mulai.

**Folder milik:** `src/lib/engines/notify/`, `src/app/api/wa/`

**Tugas** (PRD 8.6): isi fungsi Notifikasi di `src/lib/engines/contracts.ts` (`sendWa(template, to, params)`) dengan dua implementasi:
- **Cadangan (bawaan):** membuat tautan `wa.me` berisi pesan terisi untuk ditampilkan di UI; di mode pengembangan kode OTP dicetak ke log server. Harus jalan tanpa variabel env apa pun.
- **API resmi:** WhatsApp Business Cloud API, aktif hanya bila variabel env-nya diisi. Route webhook untuk tombol Terima/Tolak dan balasan, dengan verifikasi tanda tangan.
- Semua template pesan PRD 8.6 dalam satu berkas, Bahasa Indonesia (contoh di Lampiran C PRD).
- OTP: buat, kirim, verifikasi, batas percobaan, kedaluwarsa. Simpan hanya hash kodenya.
- Catat semua pesan di `wa_messages`.
- Contoh variabel env baru ditulis di laporan; lead yang menambahkannya ke `env.example.txt`.

**Uji wajib:** OTP benar, salah, dan kedaluwarsa; webhook Terima memanggil `respondBooking`; mode cadangan berjalan tanpa env.

**Selesai bila:** semua uji lulus dan tidak ada jalur WhatsApp tidak resmi.
