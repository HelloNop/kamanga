import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Cover, ListingCard } from '@/features/jelajah/components/public-card';
import { PublicHeader } from '@/features/jelajah/components/public-header';
import {
  PRICE_UNIT_LABELS,
  SERVICE_MODE_LABELS,
  type ServiceMode
} from '@/features/listings/constants/listing-options';
import { isHttpUrl } from '@/features/listings/lib/format';
import { getPublicListing } from '@/lib/directory/public';
import { searchListings } from '@/lib/directory/search';

type Props = { params: Promise<{ slug: string }> };

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await getPublicListing((await params).slug);
  if (!l) return { title: 'Usaha tidak ditemukan' };
  const where = l.place ? ` di ${l.place}` : '';
  return {
    title: `${l.name}${where}`,
    description: l.summary ?? `${l.name}${where}, terdaftar di Kamanga.`,
    openGraph: l.photoUrls[0] ? { images: [l.photoUrls[0]] } : undefined
  };
}

function instagramUrl(v: string) {
  const t = v.trim();
  return isHttpUrl(t) ? t : `https://instagram.com/${encodeURIComponent(t.replace(/^@/, ''))}`;
}

const TRUST: Record<string, string> = {
  visited: 'Dicek langsung oleh tim Kamanga',
  contact_checked: 'Nomor kontak sudah dicek tim Kamanga'
};

export default async function Page({ params }: Props) {
  const l = await getPublicListing((await params).slug);
  if (!l) notFound();

  const similar = l.category
    ? (
        await searchListings({
          categoryIds: [l.category.id],
          locationId: l.locationId ?? undefined,
          limit: 4
        })
      ).items
        .filter((i) => i.id !== l.id)
        .slice(0, 3)
    : [];

  const wa = l.whatsapp
    ? `https://wa.me/${l.whatsapp}?text=${encodeURIComponent(`Halo, saya melihat ${l.name} di Kamanga AI. Boleh tanya ketersediaannya?`)}`
    : null;
  const unit = l.priceUnit ? PRICE_UNIT_LABELS[l.priceUnit] : null;
  const isRange = l.priceMin !== null && l.priceMax !== null && l.priceMax !== l.priceMin;
  const price = isRange
    ? `${rupiah(l.priceMin!)} – ${rupiah(l.priceMax!)}`
    : l.priceMin !== null || l.priceMax !== null
      ? rupiah((l.priceMin ?? l.priceMax)!)
      : null;
  const modes = l.serviceModes.map((m) => SERVICE_MODE_LABELS[m as ServiceMode]).filter(Boolean);
  const mapsHref =
    l.mapsUrl && isHttpUrl(l.mapsUrl)
      ? l.mapsUrl
      : l.lat !== null && l.lng !== null
        ? `https://www.google.com/maps?q=${l.lat},${l.lng}`
        : null;
  const web = l.website && isHttpUrl(l.website) ? l.website : null;
  const hasContact = !!(wa || l.phone || l.instagram || web || mapsHref);
  const seed = l.category?.slug ?? l.slug;
  const facts = [
    l.place && { k: 'Lokasi', v: l.address ? `${l.address}, ${l.place}` : l.place },
    modes.length > 0 && { k: 'Cara layanan', v: modes.join(' · ') },
    l.areas.length > 0 && { k: 'Area layanan', v: l.areas.join(', ') },
    ...l.attributes
      .filter((a) => a.text !== 'Ya' && a.text !== 'Tidak')
      .map((a) => ({ k: a.label, v: a.text }))
  ].filter(Boolean) as { k: string; v: string }[];
  const perks = l.attributes.filter((a) => a.text === 'Ya').map((a) => a.label);
  const [first, ...rest] = l.photoUrls;
  const side = rest.slice(0, 2);
  const more = rest.length - side.length;

  return (
    <div className='kmg pub-page'>
      <PublicHeader />
      <main className='pub pub-detail'>
        <nav className='crumbs' aria-label='Jejak halaman'>
          <Link href='/jelajah'>Jelajah</Link>
          {l.category && (
            <>
              <span aria-hidden='true'>/</span>
              <Link href={`/jelajah?kategori=${l.category.slug}`}>{l.category.name}</Link>
            </>
          )}
        </nav>

        {first ? (
          <div className={`pd-gal n-${Math.min(l.photoUrls.length, 3)}`}>
            <a href={first} target='_blank' rel='noopener noreferrer' aria-label='Buka foto sampul'>
              <Cover photo={first} name={l.name} seed={seed} />
            </a>
            {side.map((u, i) => (
              <a key={u} href={u} target='_blank' rel='noopener noreferrer' aria-label='Buka foto'>
                <Cover photo={u} name={l.name} seed={seed} />
                {more > 0 && i === side.length - 1 && <span className='pd-more'>+{more} foto</span>}
              </a>
            ))}
          </div>
        ) : (
          <Cover name={l.name} seed={seed} className='pd-hero' />
        )}

        <div className='pd-grid'>
          <article className='pd-main'>
            <p className='pub-eyebrow'>
              {[l.category?.name, ...l.extraCategories].filter(Boolean).join(' · ')}
            </p>
            <h1 className='pd-title'>{l.name}</h1>
            {l.place && <p className='pd-place'>{l.place}</p>}
            {l.summary && <p className='pd-lead'>{l.summary}</p>}

            {perks.length > 0 && (
              <ul className='pd-perks' aria-label='Fasilitas'>
                {perks.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}

            {l.description && (
              <section>
                <h2 className='pd-h'>Tentang usaha ini</h2>
                <p className='pd-desc'>{l.description}</p>
              </section>
            )}

            {facts.length > 0 && (
              <section>
                <h2 className='pd-h'>Rincian</h2>
                <dl className='pd-facts'>
                  {facts.map((f) => (
                    <div key={f.k}>
                      <dt>{f.k}</dt>
                      <dd>{f.v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </article>

          <aside className='pd-contact' aria-label='Hubungi'>
            {price && (
              <div className='pd-price'>
                <span>{isRange ? 'Kisaran harga' : 'Harga'}</span>
                <b>{price}</b>
                {unit && <em>{unit}</em>}
                {l.priceNote && <p>{l.priceNote}</p>}
              </div>
            )}

            {hasContact ? (
              <div className='pd-actions'>
                {wa && (
                  <a className='wa' href={wa} target='_blank' rel='noopener noreferrer'>
                    Hubungi via WhatsApp
                  </a>
                )}
                {l.phone && <a href={`tel:${l.phone}`}>Telepon {l.phone}</a>}
                {l.instagram && (
                  <a href={instagramUrl(l.instagram)} target='_blank' rel='noopener noreferrer'>
                    Instagram ↗
                  </a>
                )}
                {web && (
                  <a href={web} target='_blank' rel='noopener noreferrer'>
                    Website ↗
                  </a>
                )}
                {mapsHref && (
                  <a href={mapsHref} target='_blank' rel='noopener noreferrer'>
                    Buka di peta ↗
                  </a>
                )}
              </div>
            ) : (
              <p className='pd-nocontact'>Kontak belum tersedia.</p>
            )}

            <p className={`pd-trust${TRUST[l.verificationLevel] ? ' ok' : ''}`}>
              {TRUST[l.verificationLevel] ?? 'Belum diverifikasi tim Kamanga.'}
              <small>Pastikan ketersediaan dan harga langsung ke penyedia sebelum memesan.</small>
            </p>
          </aside>
        </div>

        {similar.length > 0 && (
          <section className='pd-similar'>
            <h2 className='pd-h'>
              Usaha serupa{l.place ? ` di sekitar ${l.place.split(',')[0]}` : ''}
            </h2>
            <ul className='pub-grid'>
              {similar.map((i, n) => (
                <ListingCard key={i.id} item={i} index={n} />
              ))}
            </ul>
          </section>
        )}
      </main>

      {(wa || l.phone) && (
        <div className='pd-bar'>
          <div>
            {price ? (
              <>
                <small>{unit ? `${isRange ? 'Kisaran' : 'Harga'} · ${unit}` : 'Harga'}</small>
                <b>{price}</b>
              </>
            ) : (
              <b>{l.name}</b>
            )}
          </div>
          <a
            className='wa'
            href={wa ?? `tel:${l.phone}`}
            target={wa ? '_blank' : undefined}
            rel='noopener noreferrer'
          >
            {wa ? 'WhatsApp' : 'Telepon'}
          </a>
        </div>
      )}
    </div>
  );
}
