'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { addDays, formatClock, formatDay, fromJakarta, jakartaDate } from '@/lib/engines/time';
import { cn } from '@/lib/utils';
import { blockSlotMutation, unblockSlotMutation } from '../api/mutations';
import { calendarOptions } from '../api/queries';
import type { CalendarSlot, UnitView } from '../api/types';
import { BOOKING_STATUS_LABEL, rupiah } from '../lib/format';
import { BLOCK_REASON_LABEL, BLOCK_REASONS } from '../schemas';

type Look = { label: string; cls: string };
const LOOK: Record<CalendarSlot['state'] | 'past', Look> = {
  free: { label: 'Kosong', cls: 'bg-card border-primary/40 text-foreground' },
  held: {
    label: 'Ditahan',
    cls: 'bg-amber-500/15 border-amber-600/40 text-amber-900 dark:text-amber-200'
  },
  booked: {
    label: 'Dipesan',
    cls: 'bg-sky-500/15 border-sky-600/40 text-sky-900 dark:text-sky-200'
  },
  blocked: {
    label: 'Diblokir',
    cls: 'bg-secondary border-foreground/30 text-foreground bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(0_0_0/0.06)_6px_12px)]'
  },
  past: { label: 'Lewat', cls: 'bg-muted border-transparent text-muted-foreground' }
};

const isPast = (s: CalendarSlot) => s.endsAt.getTime() <= Date.now();
const lookOf = (s: CalendarSlot) => (isPast(s) && s.state === 'free' ? LOOK.past : LOOK[s.state]);

/**
 * Kalender per unit. Blokir dua ketukan: ketuk slot kosong → ketuk alasan (Datang langsung / Pesanan lewat WA /
 * Lainnya). Ketuk slot terblokir → Buka blokir.
 */
export function ScheduleCalendar({
  listingId,
  kind,
  units
}: {
  listingId: number;
  kind: 'slot' | 'seat';
  units: UnitView[];
}) {
  const today = jakartaDate(new Date());
  const [unitId, setUnitId] = useState(units[0]?.id ?? 0);
  const [date, setDate] = useState(today);
  const [sel, setSel] = useState<CalendarSlot | null>(null);
  const [note, setNote] = useState('');
  const unit = units.find((u) => u.id === unitId) ?? units[0];
  const q = useQuery({ ...calendarOptions(listingId, unit?.id ?? 0, date), enabled: !!unit });
  const block = useMutation(blockSlotMutation(listingId));
  const unblock = useMutation(unblockSlotMutation(listingId));
  const close = () => {
    setSel(null);
    setNote('');
  };

  if (!unit)
    return (
      <p className='text-muted-foreground text-sm'>
        Belum ada unit aktif. Tambahkan unit dan jam buka di tab Jam buka.
      </p>
    );

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const doBlock = (reason: (typeof BLOCK_REASONS)[number]) =>
    sel &&
    block.mutate(
      { unitId: unit.id, startsAt: sel.startsAt, endsAt: sel.endsAt, reason, note },
      {
        onSuccess: () => {
          toast.success(`${formatClock(sel.startsAt)} diblokir`);
          close();
        },
        onError: (e) => toast.error(e.message)
      }
    );
  const doUnblock = () =>
    sel?.block &&
    unblock.mutate(sel.block.id, {
      onSuccess: () => {
        toast.success('Blokir dibuka');
        close();
      },
      onError: (e) => toast.error(e.message)
    });

  return (
    <div className='space-y-3'>
      {units.length > 1 && (
        <div role='group' aria-label='Pilih unit' className='flex gap-2 overflow-x-auto pb-1'>
          {units.map((u) => (
            <Button
              key={u.id}
              size='sm'
              variant={u.id === unit.id ? 'default' : 'secondary'}
              aria-pressed={u.id === unit.id}
              className='h-11 shrink-0'
              onClick={() => setUnitId(u.id)}
            >
              {u.name}
            </Button>
          ))}
        </div>
      )}

      <div role='group' aria-label='Pilih tanggal' className='flex gap-1.5 overflow-x-auto pb-1'>
        {days.map((d) => {
          const on = d === date;
          const label = formatDay(fromJakarta(d, '12:00'));
          return (
            <button
              key={d}
              type='button'
              aria-pressed={on}
              aria-label={label}
              onClick={() => setDate(d)}
              className={cn(
                'focus-visible:ring-ring/50 flex min-h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-xs outline-none focus-visible:ring-3',
                on ? 'bg-primary text-primary-foreground border-primary' : 'bg-card'
              )}
            >
              <span>{d === today ? 'Hari ini' : label.split(',')[0].slice(0, 3)}</span>
              <span className='text-base font-semibold'>{Number(d.slice(8))}</span>
            </button>
          );
        })}
      </div>
      <div className='flex items-center gap-2'>
        <Label htmlFor='kalender-tanggal' className='shrink-0 text-sm'>
          Tanggal lain
        </Label>
        <Input
          id='kalender-tanggal'
          type='date'
          min={today}
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className='w-auto'
        />
      </div>

      <h4 className='text-sm font-semibold'>
        {unit.name} · {formatDay(fromJakarta(date, '12:00'))}
      </h4>
      {q.isPending ? (
        <div className='grid grid-cols-3 gap-2'>
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className='h-16 rounded-xl' />
          ))}
        </div>
      ) : !q.data?.length ? (
        <p className='text-muted-foreground text-sm'>
          {q.isError ? 'Kalender gagal dimuat.' : 'Tutup pada tanggal ini (tidak ada jam buka).'}
        </p>
      ) : (
        <ul className='grid grid-cols-3 gap-2'>
          {q.data.map((s) => {
            const look = lookOf(s);
            return (
              <li key={s.startsAt.toISOString()}>
                <button
                  type='button'
                  onClick={() => setSel(s)}
                  aria-label={`${formatClock(s.startsAt)}–${formatClock(s.endsAt)}, ${look.label}`}
                  className={cn(
                    'focus-visible:ring-ring/50 flex min-h-16 w-full flex-col items-center justify-center rounded-xl border-[1.5px] px-1 py-1.5 outline-none focus-visible:ring-3',
                    look.cls
                  )}
                >
                  <span className='text-[0.9375rem] font-semibold'>{formatClock(s.startsAt)}</span>
                  <span className='text-xs'>
                    {kind === 'seat' && s.state !== 'blocked'
                      ? `${s.seatsLeft}/${s.capacity} kursi`
                      : look.label}
                  </span>
                  {s.isPeak && <span className='text-[0.68rem] font-semibold'>Jam ramai</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className='text-muted-foreground text-xs'>
        Ketuk jam yang kosong untuk memblokirnya (mis. pelanggan datang langsung atau pesan lewat
        WA). Ketuk jam yang diblokir untuk membukanya lagi.
      </p>

      <Sheet open={!!sel} onOpenChange={(o) => !o && close()}>
        <SheetContent side='bottom' className='mx-auto max-w-2xl rounded-t-2xl p-4'>
          {sel && (
            <>
              <SheetHeader className='p-0'>
                <SheetTitle>
                  {unit.name} · {formatClock(sel.startsAt)}–{formatClock(sel.endsAt)}
                </SheetTitle>
                <SheetDescription>
                  {formatDay(sel.startsAt)} · {lookOf(sel).label}
                  {sel.price != null &&
                    ` · ${rupiah(sel.price)}${kind === 'seat' ? ' per kursi' : ''}`}
                </SheetDescription>
              </SheetHeader>

              {sel.bookings.length > 0 && (
                <ul className='space-y-1.5'>
                  {sel.bookings.map((b) => (
                    <li key={b.id} className='bg-muted rounded-lg px-3 py-2 text-sm'>
                      {b.href ? (
                        <Link href={b.href} className='font-semibold underline underline-offset-4'>
                          Pesanan #{b.code}
                        </Link>
                      ) : (
                        <span className='font-semibold'>Pesanan #{b.code}</span>
                      )}{' '}
                      · {BOOKING_STATUS_LABEL[b.status]}
                      {kind === 'seat' && ` · ${b.seats} kursi`}
                    </li>
                  ))}
                </ul>
              )}

              {sel.state === 'blocked' && sel.block ? (
                <>
                  <p className='text-sm'>
                    Diblokir: <b>{BLOCK_REASON_LABEL[sel.block.reason]}</b>
                    {sel.block.note && ` · ${sel.block.note}`}
                  </p>
                  <Button disabled={unblock.isPending} onClick={doUnblock} className='w-full'>
                    <Icons.lock aria-hidden /> Buka blokir
                  </Button>
                </>
              ) : !isPast(sel) && sel.state === 'free' && sel.bookings.length === 0 ? (
                <>
                  <div className='space-y-1.5'>
                    <Label htmlFor='blokir-catatan'>Catatan (boleh kosong)</Label>
                    <Input
                      id='blokir-catatan'
                      value={note}
                      maxLength={200}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder='Mis. Pak Budi, 4 orang'
                    />
                  </div>
                  <p className='text-sm font-semibold'>Blokir karena:</p>
                  <div className='grid gap-2'>
                    {BLOCK_REASONS.map((r) => (
                      <Button
                        key={r}
                        variant={r === 'walk_in' ? 'default' : 'secondary'}
                        disabled={block.isPending}
                        onClick={() => doBlock(r)}
                      >
                        {BLOCK_REASON_LABEL[r]}
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <p className='text-muted-foreground text-sm'>
                  {isPast(sel)
                    ? 'Waktunya sudah lewat.'
                    : sel.state === 'held'
                      ? 'Slot ini ditahan pesanan yang menunggu jawaban Anda.'
                      : 'Slot ini sudah ada pesanannya.'}
                </p>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
