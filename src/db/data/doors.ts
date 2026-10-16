// Pintu "Ka-" (PRD 7). Nama, ikon, urutan, dan status bisa diubah admin; seed hanya menambah yang belum ada.
// icon = kunci di src/components/icons.tsx.
export type DoorSeed = {
  slug: string;
  name: string;
  icon: string;
  description: string;
  rotatingText: string;
  status: 'active' | 'soon' | 'hidden';
  kind: 'single' | 'plan' | 'guide';
};

export const DOORS: DoorSeed[] = [
  // Tahap 1
  {
    slug: 'ka-main',
    name: 'Ka main',
    icon: 'ballFootball',
    description: 'Olahraga dan hiburan: lapangan, billiard, karaoke, gym.',
    rotatingText: 'ka main…',
    status: 'active',
    kind: 'single'
  },
  {
    slug: 'ka-rawat-diri',
    name: 'Ka rawat diri',
    icon: 'scissors',
    description: 'Barbershop, salon, spa, pijat, refleksi, perawatan wajah.',
    rotatingText: 'ka rawat diri…',
    status: 'active',
    kind: 'single'
  },
  {
    slug: 'ka-uda-anta',
    name: 'Ka uda anta',
    icon: 'bus',
    description: 'Travel antarkota berizin, titip paket, pindahan.',
    rotatingText: 'ka uda anta…',
    status: 'active',
    kind: 'single'
  },
  {
    slug: 'ka-servis',
    name: 'Ka servis',
    icon: 'tool',
    description: 'Servis AC, motor, mobil, elektronik, tukang, kebersihan, laundry.',
    rotatingText: 'ka servis…',
    status: 'active',
    kind: 'single'
  },
  // Tahap 2 ke atas: tampil "Segera" atau disembunyikan sampai datanya cukup.
  {
    slug: 'ka-manyewa',
    name: 'Ka manyewa',
    icon: 'key',
    description: 'Sewa motor, mobil, kamera, tenda, baju adat, gedung.',
    rotatingText: 'ka manyewa…',
    status: 'soon',
    kind: 'single'
  },
  {
    slug: 'ka-jalan-jalan',
    name: 'Ka jalan-jalan',
    icon: 'compass',
    description: 'Ide main dan wisata.',
    rotatingText: 'ka jalan-jalan…',
    status: 'soon',
    kind: 'single'
  },
  {
    slug: 'kabatanyo',
    name: 'Kabatanyo',
    icon: 'messageQuestion',
    description: 'Urusan layanan publik: KTP, KK, Samsat, izin usaha.',
    rotatingText: 'kabatanyo…',
    status: 'hidden',
    kind: 'guide'
  },
  {
    slug: 'kabaralek',
    name: 'Kabaralek',
    icon: 'confetti',
    description: 'Menggelar acara: pernikahan, aqiqah, syukuran.',
    rotatingText: 'kabaralek…',
    status: 'hidden',
    kind: 'plan'
  },
  {
    slug: 'ka-balanjo',
    name: 'Ka balanjo',
    icon: 'shoppingBag',
    description: 'Produk UMKM, oleh-oleh, kue, katering harian.',
    rotatingText: 'ka balanjo…',
    status: 'hidden',
    kind: 'single'
  },
  {
    slug: 'ka-baubek',
    name: 'Ka baubek',
    icon: 'stethoscope',
    description: 'Klinik, bidan, dokter gigi, fisioterapi.',
    rotatingText: 'ka baubek…',
    status: 'hidden',
    kind: 'single'
  }
];
