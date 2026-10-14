import Link from 'next/link';
import { Icons } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import { Panel } from '@/features/mitra/components/bits';
import { BookingActions } from '@/features/mitra/components/booking-actions';
import { BookingDetail } from '@/features/mitra/components/booking-view';
import { booking } from '@/lib/engines/contracts';
import { cn } from '@/lib/utils';

// Halaman Terima/Tolak dari tautan di pesan WA, TANPA login (proxy.ts membiarkannya lewat).
// Token adalah kuncinya; tombol memanggil server action yang memvalidasi ulang token setiap kali.
export const metadata = { title: 'Pesanan masuk', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function TokenBookingPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const b = /^[\w-]{20,100}$/.test(token) ? await booking.getBookingForProvider({ token }) : null;

  return (
    <div className='bg-muted min-h-dvh'>
      <header className='bg-card border-b'>
        <div className='mx-auto flex max-w-2xl items-center gap-2 px-4 py-3'>
          <span className='bg-primary grid size-8 place-items-center rounded-lg font-bold text-white'>
            K
          </span>
          <p className='font-bold'>Kamanga Mitra</p>
        </div>
      </header>
      <main className='mx-auto max-w-2xl space-y-3 px-2 py-4'>
        {b ? (
          <>
            <h1 className='px-2 text-2xl font-bold'>Pesanan #{b.code}</h1>
            <BookingDetail
              b={b}
              actions={<BookingActions target={{ token }} status={b.status} />}
            />
          </>
        ) : (
          <Panel>
            <Icons.alertCircle className='text-muted-foreground mb-2 size-8' aria-hidden />
            <h1 className='text-lg font-semibold'>Tautan tidak berlaku</h1>
            <p className='text-muted-foreground mt-1 text-sm'>
              Tautan ini salah atau pesanannya tidak ada. Periksa kembali pesan WhatsApp dari
              Kamanga.
            </p>
          </Panel>
        )}
        <Panel title='Kelola usaha Anda di Kamanga'>
          <p className='text-muted-foreground text-sm'>
            Dengan akun mitra Anda bisa melihat semua pesanan, mengatur jadwal, memblokir jam yang
            sudah terisi, dan menjawab pertanyaan warga. Gratis selama masa perintisan. Usaha Anda
            sudah diinput tim? Setelah mendaftar, hubungi tim Kamanga dari nomor WhatsApp usaha
            untuk mengklaimnya.
          </p>
          <div className='mt-3 grid grid-cols-2 gap-2'>
            <Link href='/auth/sign-up?next=/mitra' className={buttonVariants()}>
              Daftar
            </Link>
            <Link
              href='/auth/sign-in?next=/mitra'
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              Masuk
            </Link>
          </div>
        </Panel>
      </main>
    </div>
  );
}
