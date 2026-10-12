import { cn } from '@/lib/utils';
import { PILL_TONES, type PillTone } from './pill';

const TONES: PillTone[] = ['info', 'ok', 'warn', 'bad', 'mut'];

/** Huruf awal dua kata pertama: "RS Uji Sehat" -> "RU". */
export const initialsOf = (name: string) =>
  name
    .replace(/^\[[^\]]*\]\s*/, '') // awalan seperti [DUMMY]
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** Kotak inisial berwarna. Warna ditentukan `seed` (mis. nama kategori) agar yang sejenis serupa. */
export function InitialAvatar({
  name,
  seed,
  className
}: {
  name: string;
  seed?: string | null;
  className?: string;
}) {
  const key = seed || name;
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden='true'
      className={cn(
        'grid size-[34px] shrink-0 place-items-center rounded-[11px] text-xs font-bold',
        PILL_TONES[TONES[h % TONES.length]],
        className
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
