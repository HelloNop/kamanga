import { redirect } from 'next/navigation';

// Portal vendor lama pindah ke dashboard mitra (ramah ponsel). Alamat lama tetap berfungsi.
export default function Page() {
  redirect('/mitra/usaha');
}
