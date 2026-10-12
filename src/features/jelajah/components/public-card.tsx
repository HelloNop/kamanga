import Link from 'next/link';
import { initialsOf } from '@/components/ui/initial-avatar';
import { VERIFICATION_LABELS } from '@/features/listings/constants/listing-options';
import type { SearchItem } from '@/lib/directory/search';
import { priceText } from '@/lib/kamanga-ai/search-tool';

/** Warna sampul pengganti ditentukan kategori, supaya yang sejenis tampak serumpun. */
export const hueOf = (seed: string) =>
  [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 17);

/** Sampul: foto bila ada, bila tidak motif Itiak Pulang Patang dengan warna kategori. */
export function Cover({
  photo,
  name,
  seed,
  className
}: {
  photo?: string | null;
  name: string;
  seed: string;
  className?: string;
}) {
  if (photo)
    return (
      <div className={`cover ${className ?? ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt='' loading='lazy' />
      </div>
    );
  return (
    <div
      className={`cover cover-motif ${className ?? ''}`}
      style={{ ['--h' as string]: hueOf(seed) }}
      aria-hidden='true'
    >
      <span>{initialsOf(name)}</span>
    </div>
  );
}

export function ListingCard({ item, index = 0 }: { item: SearchItem; index?: number }) {
  const place = item.location
    ? [item.location.name, item.location.parentName].filter(Boolean).join(', ')
    : null;
  const price = priceText(item);
  const verified = item.verification !== 'unverified';
  return (
    <li className='pcard' style={{ ['--i' as string]: index }}>
      <div className='pcard-media'>
        <Cover photo={item.photo} name={item.name} seed={item.category?.slug ?? item.slug} />
        {verified && (
          <span className='pcard-ok'>
            {VERIFICATION_LABELS[item.verification as keyof typeof VERIFICATION_LABELS]}
          </span>
        )}
      </div>
      <div className='pcard-body'>
        {item.category && <span className='pcard-cat'>{item.category.name}</span>}
        <h2>
          <Link className='pcard-link' href={`/listing/${item.slug}`}>
            {item.name}
          </Link>
        </h2>
        {place && <p className='pcard-place'>{place}</p>}
        {item.summary && <p className='pcard-sum'>{item.summary}</p>}
        {price && <p className='pcard-price'>{price}</p>}
      </div>
    </li>
  );
}
