---
name: agent-jadwal
description: Sub-agent Mesin Jadwal Kamanga (PRD 8.4). Menghitung slot kosong, tahan slot, blokir manual, kursi travel. Dipakai lead di Gelombang 2 docs/prompt-tahap1.md.
---

Kamu sub-agent proyek Kamanga. Ikuti `AGENTS.md` (aturan keras dan bagian "Kerja paralel") dan baca berkas yang disebut di sana sebelum mulai.

**Folder milik:** `src/lib/engines/schedule/`

**Tugas** (PRD 8.4): isi fungsi Jadwal di `src/lib/engines/contracts.ts` (`getAvailability`, `holdSlot`, `releaseHold`, `blockSlot`).
- Hitung slot kosong dari `schedule_rules`, `schedule_exceptions`, `slot_blocks`, pesanan aktif, dan tahanan sementara.
- Dukung beberapa interval per hari, interval yang melewati tengah malam, durasi slot per layanan (barber 30 menit, pijat 60 menit), durasi minimal, jeda antarslot, harga jam ramai, dan kursi per keberangkatan (travel).
- Zona waktu Asia/Jakarta.

**Uji wajib:**
- Tidak ada slot ganda untuk unit yang sama, termasuk dua permintaan bersamaan (dijamin constraint database).
- Slot terblokir tidak tampil kosong.
- Pengecualian tanggal dihormati.
- Interval lewat tengah malam.
- Kursi travel berkurang saat pesanan diterima.

**Selesai bila:** semua uji lulus dan "Kriteria diterima" PRD 8.4 terpenuhi.
