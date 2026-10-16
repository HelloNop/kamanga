'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Icons } from '@/components/icons';
import { paths } from '@/lib/engines/paths';

export type DoorTile = {
  slug: string;
  name: string;
  icon: string | null;
  description: string | null;
  soon: boolean;
};

const EVERY = 4000; // geser otomatis tiap 4 detik
const REST = 6000; // jeda setelah warga menggeser sendiri
const GAP = 10; // sama dengan gap .dc-track

/**
 * Pintu di beranda sebagai slider. Kartu berikutnya terlihat sebagian sebagai isyarat geser.
 * Geser otomatis; sampai di kartu terakhir, kembali ke kartu pertama. Digeser manual berhenti di ujung.
 * Tombol "berikutnya" menggeser satu kartu (di ujung kembali ke awal). Disentuh/diarahkan/difokus = berhenti
 * sebentar; jalan lagi beberapa detik setelah warga selesai. Warga yang memilih kurangi gerak: tidak bergerak sendiri.
 * ponytail: tanpa tombol jeda permanen (WCAG 2.2.2) atas permintaan pemilik; tambahkan bila ada keluhan gerak.
 */
export function DoorSlider({
  doors,
  onFront
}: {
  doors: DoorTile[];
  /** Pintu di depan berubah: judul beranda ikut berganti. */
  onFront: (name: string) => void;
}) {
  const track = useRef<HTMLUListElement>(null);
  const holding = useRef(false);
  const resumeAt = useRef(0);

  // Satu kartu ke kanan; di kartu terakhir kembali ke kartu pertama.
  const next = () => {
    const el = track.current;
    if (!el) return;
    const step = (el.firstElementChild?.getBoundingClientRect().width ?? 0) + GAP;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: 'smooth' });
  };

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      if (!holding.current && Date.now() >= resumeAt.current && !document.hidden) next();
    }, EVERY);
    return () => clearInterval(t);
  }, []);

  // Pintu terdepan = kartu paling dekat ke tepi kiri, dibaca setelah geseran berhenti.
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = track.current;
      if (!el?.firstElementChild) return;
      const step = el.firstElementChild.getBoundingClientRect().width + GAP;
      const i = Math.min(Math.round(el.scrollLeft / step), doors.length - 1);
      // Pintu "segera" tidak dijadikan judul: belum bisa dipakai.
      if (!doors[i].soon) onFront(doors[i].name);
    }, 140);
  };
  const hold = () => (holding.current = true);
  const release = () => {
    holding.current = false;
    resumeAt.current = Date.now() + REST;
  };

  if (!doors.length) return null;
  return (
    <section className='dc rise' aria-label='Pintu layanan' style={{ animationDelay: '.2s' }}>
      <ul
        ref={track}
        className='dc-track'
        onScroll={onScroll}
        onPointerEnter={hold}
        onPointerLeave={release}
        onFocus={hold}
        onBlur={release}
        onTouchStart={hold}
        onTouchEnd={release}
        onWheel={release}
      >
        {doors.map((d) => {
          const Icon = (d.icon && Icons[d.icon as keyof typeof Icons]) || Icons.door;
          const body = (
            <>
              <span className='dc-ic' aria-hidden='true'>
                <Icon size={20} />
              </span>
              <b>{d.name}</b>
              {d.description && <small>{d.description}</small>}
            </>
          );
          return (
            <li key={d.slug}>
              {d.soon ? (
                <div className='dcard soon' aria-disabled='true'>
                  {body}
                  <span className='soon-tag'>Segera</span>
                </div>
              ) : (
                <Link className='dcard' href={paths.door(d.slug)}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type='button'
        className='dc-next'
        aria-label='Pintu berikutnya'
        onClick={() => {
          next();
          resumeAt.current = Date.now() + REST;
        }}
      >
        <Icons.chevronRight size={20} aria-hidden />
      </button>
    </section>
  );
}
