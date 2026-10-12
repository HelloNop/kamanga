import { cn } from '@/lib/utils';

// Warna mengikuti arti, bukan dekorasi: ok = baik/terbit, warn = perlu perhatian,
// bad = ditolak/gagal, info = informasi/terverifikasi, mut = netral/belum.
export const PILL_TONES = {
  ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  bad: 'bg-red-500/15 text-red-700 dark:text-red-300',
  info: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  mut: 'bg-secondary text-muted-foreground'
} as const;
export type PillTone = keyof typeof PILL_TONES;

export function Pill({
  tone = 'mut',
  className,
  ...props
}: React.ComponentProps<'span'> & { tone?: PillTone }) {
  return (
    <span
      data-slot='pill'
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&>svg]:size-3.5',
        PILL_TONES[tone],
        className
      )}
      {...props}
    />
  );
}
