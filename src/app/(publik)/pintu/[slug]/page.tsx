// Halaman pintu (PRD 9.1–9.3): pilih kategori, lalu formulir singkat sesuai jenis jadwalnya.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icons } from '@/components/icons';
import {
  getDoor,
  getTravelDestinations,
  listSavedAddresses
} from '@/features/warga/api/repository';
import { DoorSearch } from '@/features/warga/components/door-search';
import { WargaHeader } from '@/features/warga/components/header';
import { nextDays } from '@/features/warga/lib/format';
import { paths } from '@/lib/engines/contracts';
import { getSession } from '@/lib/session';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ kategori?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getDoor((await params).slug);
  return { title: d && d.door.status !== 'hidden' ? d.door.name : 'Pintu tidak ditemukan' };
}

export default async function DoorPage({ params, searchParams }: Props) {
  const [{ slug }, { kategori }] = await Promise.all([params, searchParams]);
  const data = await getDoor(slug);
  if (!data || data.door.status === 'hidden') notFound();
  const { door, categories } = data;
  const Icon = Icons[door.icon as keyof typeof Icons] ?? Icons.door;
  const chosen =
    categories.find((c) => c.slug === kategori) ??
    (categories.length === 1 ? categories[0] : undefined);
  const kind = chosen?.scheduleKind;
  const usable = kind === 'slot' || kind === 'seat' || kind === 'none';

  const session = await getSession();
  const saved =
    session?.user.role === 'citizen'
      ? (await listSavedAddresses(session.user.id)).map((a) => ({
          id: a.id,
          label: a.label,
          address: a.address
        }))
      : null;
  const destinations = chosen && kind === 'seat' ? await getTravelDestinations(chosen.id) : [];

  return (
    <div className='warga'>
      <WargaHeader />
      <main className='w-main'>
        <Link
          className='w-back'
          href={chosen && categories.length > 1 ? paths.door(door.slug) : '/'}
        >
          <Icons.chevronLeft size={18} aria-hidden='true' />
          {chosen && categories.length > 1 ? `Semua ${door.name}` : 'Beranda'}
        </Link>
        <div className='w-row' style={{ gap: 12 }}>
          <span className='w-door-icon' aria-hidden='true'>
            <Icon size={24} />
          </span>
          <h1 className='w-title'>{chosen ? chosen.name : door.name}</h1>
        </div>
        {!chosen && door.description && <p className='w-lead'>{door.description}</p>}

        {door.status === 'soon' ? (
          <p className='w-alert info'>
            Pintu ini segera dibuka. Sementara itu, <Link href={paths.chat()}>ceritakan saja</Link>{' '}
            kebutuhanmu.
          </p>
        ) : !chosen ? (
          <nav className='w-section' aria-label={`Pilihan ${door.name}`}>
            <h2 className='w-h2'>Mau yang mana?</h2>
            <div className='w-chips'>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  className='w-chip'
                  href={`${paths.door(door.slug)}?kategori=${c.slug}`}
                >
                  {c.name}
                </Link>
              ))}
            </div>
            {!categories.length && <p className='w-muted'>Belum ada layanan di pintu ini.</p>}
          </nav>
        ) : !usable ? (
          <p className='w-alert info'>
            {chosen.name} belum bisa dipesan lewat pintu ini.{' '}
            <Link href={paths.chat(chosen.name)}>Tanyakan di chat</Link>.
          </p>
        ) : (
          <DoorSearch
            key={chosen.id}
            category={{ id: chosen.id, name: chosen.name, kind }}
            dates={nextDays(14)}
            destinations={destinations}
            saved={saved}
            askPeople={door.slug === 'ka-main' && kind === 'slot'}
            servis={door.slug === 'ka-servis'}
            chatHref={paths.chat(chosen.name)}
          />
        )}
      </main>
    </div>
  );
}
