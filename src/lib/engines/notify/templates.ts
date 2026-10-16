// Semua template pesan WhatsApp Kamanga (PRD 8.6, gaya Lampiran C). Satu teks per template; `{nama}` diganti
// parameter dari WaParams di ../contracts.
//
// Teks yang sama dipakai dua jalur:
// - Mode cadangan: teks diisi lalu dijadikan tautan wa.me. Admin boleh menimpanya lewat
//   app_settings `wa.templates` (penanda `{nama}` yang sama).
// - API resmi: template Meta bernama `kamanga_<nama>`. Urutan kemunculan `{nama}` di teks bawaan = urutan
//   {{1}}, {{2}}, ... di template Meta. Mengubah teks di sini berarti template Meta perlu didaftarkan ulang.
//   Aturan Meta: teks tidak boleh diawali/diakhiri parameter, maksimal satu baris kosong berturut-turut.
import type { WaTemplate } from '../contracts';

export const WA_TEXTS: Record<WaTemplate, string> = {
  // Di Meta: template kategori Authentication (teks baku Meta + tombol salin kode), bukan teks ini.
  otp: 'Kode masuk Kamanga: {code}\nBerlaku 5 menit. Jangan berikan kode ini kepada siapa pun.',

  booking_new: `Pesanan baru · {door}
{listing}
{item}
{details}
Lokasi pemesan: {district}
Kode pesanan: {code}

Terima atau tolak: {link}
Tidak dijawab dalam {respondMinutes} menit, pesanan ditawarkan ke tempat lain.`,

  booking_contact: `Data pemesan · {code}
Nama: {name}
WhatsApp: {phone}
Alamat: {address}
Catatan: {note}

Lihat pesanan: {link}
Hubungi pemesan bila perlu memastikan jadwal.`,

  booking_reminder_provider: `Pengingat · pesanan {code} belum dijawab
{listing}
{item}

Terima atau tolak: {link}
Sisa {minutesLeft} menit, setelah itu pesanan ditawarkan ke tempat lain.`,

  question_new: `Pertanyaan warga · {listing}
"{question}"

Jawab di sini: {link}
Jawaban dikirim ke warga dan disimpan sebagai tanya jawab usaha Anda.`,

  monthly_summary: `Ringkasan {month} · {listing}
Pesanan lewat Kamanga: {bookings}
Pelanggan baru: {newCustomers}

Terima kasih sudah melayani warga lewat Kamanga.`,

  booking_accepted: `Pesanan {code} diterima {listing}.
{item}

Lihat pesanan: {link}
Tunjukkan kode pesanan ini saat datang.`,

  booking_rejected: `Maaf, pesanan {code} ditolak {listing}.
Alasan: {reason}

Lihat pesanan: {link}
Kamanga bisa carikan tempat lain yang masih kosong.`,

  booking_expired: `Pesanan {code} belum dijawab {listing} sampai batas waktu, jadi dibatalkan.

Lihat pesanan: {link}
Kamanga bisa carikan tempat lain yang masih kosong.`,

  booking_cancelled: `Pesanan {code} di {listing} dibatalkan.
{item}
Alasan: {reason}

Lihat pesanan: {link}
Jadwal ini sudah dilepas dan bisa dipesan orang lain.`,

  booking_reminder: `Pengingat jadwal · pesanan {code}
{listing}
{item}

Lihat pesanan: {link}
Tidak jadi datang? Batalkan dari halaman pesanan.`,

  review_request: `Pesanan {code} di {listing} sudah selesai. Puas dengan layanannya?

Beri ulasan: {link}
Ulasan Anda membantu warga lain memilih.`,

  question_answered: `Jawaban dari {listing}
Pertanyaan: {question}
Jawaban: {answer}

Lihat: {link}
Ada pertanyaan lain? Tanyakan lewat Kamanga.`
};

/** Template Meta dengan tombol balasan cepat Terima (indeks 0) dan Tolak (indeks 1). */
export const DECISION_TEMPLATES: readonly WaTemplate[] = [
  'booking_new',
  'booking_reminder_provider'
];

const PLACEHOLDER = /\{(\w+)\}/g;

/** Isi `{nama}` dengan parameter. Nilai kosong menjadi "-"; penanda tak dikenal dibiarkan. */
export const fill = (text: string, params: Record<string, unknown>) =>
  text.replace(PLACEHOLDER, (m, k: string) => (k in params ? String(params[k] ?? '') || '-' : m));

/** Nama parameter sesuai urutan {{1}}, {{2}}, ... template Meta. */
export const metaParamKeys = (template: WaTemplate) =>
  [...WA_TEXTS[template].matchAll(PLACEHOLDER)].map((m) => m[1]);
