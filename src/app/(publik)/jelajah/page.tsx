import type { Metadata } from 'next';
import Link from 'next/link';
import { ListingCard } from '@/features/jelajah/components/public-card';
import { PublicHeader } from '@/features/jelajah/components/public-header';
import { getBrowseOptions } from '@/lib/directory/public';
import { searchListings } from '@/lib/directory/search';

export const metadata: Metadata = {
  title: 'Jelajah usaha lokal',
  description: 'Jelajahi jasa, tempat, wisata, dan usaha lokal di Sumatera Barat.'
};

const PER_PAGE = 12;
type Q = { q?: string; kategori?: string; lokasi?: string; hal?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Q> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const page = Math.max(Number(sp.hal) || 1, 1);
  const opts = await getBrowseOptions();
  const cat = opts.categories.find((c) => c.slug === sp.kategori);
  const city = opts.cities.find((c) => c.slug === sp.lokasi);

  const r = await searchListings({
    q,
    categoryIds: cat ? [cat.id] : undefined,
    locationId: city?.id,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE
  });
  const pages = Math.max(Math.ceil(r.total / PER_PAGE), 1);
  const href = (o: { kategori?: string; hal?: number } = {}) => {
    const u = new URLSearchParams();
    if (q) u.set('q', q);
    const k = 'kategori' in o ? o.kategori : cat?.slug;
    if (k) u.set('kategori', k);
    if (city) u.set('lokasi', city.slug);
    if (o.hal && o.hal > 1) u.set('hal', String(o.hal));
    const s = u.toString();
    return s ? `/jelajah?${s}` : '/jelajah';
  };
  const filtered = !!(q || cat || city);
  const headline = [cat?.name, city?.name].filter(Boolean).join(' di ');

  return (
    <div className='kmg pub-page'>
      <div className='bg' aria-hidden='true'>
        <div className='planet' />
      </div>
      <PublicHeader />

      <main className='pub'>
        <section className='pub-hero'>
          <p className='pub-eyebrow'>Jelajah</p>
          <h1>
            Usaha lokal
            <br />
            di <span>Sumatera Barat</span>
          </h1>
          <p className='pub-sub'>
            Jasa, tempat, wisata, dan produk dari pelaku usaha setempat. Belum tahu mau cari apa?{' '}
            <Link href='/'>Tanya Kamanga</Link>.
          </p>

          <form className='pub-search' action='/jelajah' role='search'>
            <input
              name='q'
              defaultValue={q}
              placeholder='Cari: servis AC, katering, penginapan…'
              aria-label='Cari usaha'
              maxLength={100}
            />
            {cat && <input type='hidden' name='kategori' value={cat.slug} />}
            <select name='lokasi' defaultValue={city?.slug ?? ''} aria-label='Lokasi'>
              <option value=''>Seluruh Sumatera Barat</option>
              {opts.cities.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type='submit'>Cari</button>
          </form>
        </section>

        <nav className='pub-cats' aria-label='Kategori'>
          <Link href={href({ kategori: '' })} aria-current={!cat ? 'page' : undefined}>
            Semua
          </Link>
          {opts.categories.map((c) => (
            <Link
              key={c.id}
              href={href({ kategori: c.slug })}
              aria-current={cat?.slug === c.slug ? 'page' : undefined}
            >
              {c.name}
            </Link>
          ))}
        </nav>

        <div className='pub-bar' role='status'>
          <p>
            <b>{r.total}</b>
            {r.truncated ? '+' : ''} usaha
            {headline && <> · {headline}</>}
            {q && <> · “{q}”</>}
          </p>
          {filtered && <Link href='/jelajah'>Hapus filter</Link>}
        </div>

        {r.items.length === 0 ? (
          <div className='pub-empty'>
            <div className='pub-empty-motif' aria-hidden='true' />
            <h2>Belum ada yang cocok</h2>
            <p>Coba kata lain atau kurangi filter. Kamanga juga bisa membantu mencarikan.</p>
            <Link className='pub-btn' href='/'>
              Tanya Kamanga
            </Link>
          </div>
        ) : (
          <ul className='pub-grid'>
            {r.items.map((i, n) => (
              <ListingCard key={i.id} item={i} index={n} />
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav className='pub-pager' aria-label='Halaman'>
            {page > 1 ? (
              <Link href={href({ hal: page - 1 })}>← Sebelumnya</Link>
            ) : (
              <span aria-hidden='true' />
            )}
            <span>
              {page} / {pages}
            </span>
            {page < pages ? (
              <Link href={href({ hal: page + 1 })}>Berikutnya →</Link>
            ) : (
              <span aria-hidden='true' />
            )}
          </nav>
        )}

        <aside className='pub-cta'>
          <div>
            <h2>Punya usaha di Sumatera Barat?</h2>
            <p>Daftarkan gratis agar warga bisa menemukan dan menghubungi Anda.</p>
          </div>
          <Link className='pub-btn' href='/auth/sign-up'>
            Daftarkan usaha
          </Link>
        </aside>
      </main>
    </div>
  );
}
