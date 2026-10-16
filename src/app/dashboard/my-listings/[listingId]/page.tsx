import { notFound, redirect } from 'next/navigation';

// Portal vendor lama pindah ke /mitra/usaha. Formulir listing (mode vendor) masih kembali ke
// /dashboard/my-listings setelah menyimpan, lalu diteruskan ke sini.
export default async function Page(props: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await props.params;
  if (listingId !== 'new' && !/^\d+$/.test(listingId)) notFound();
  redirect(`/mitra/usaha/${listingId === 'new' ? 'baru' : listingId}`);
}
