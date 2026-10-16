'use client';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Pill, type PillTone } from '@/components/ui/pill';
import { SCHEDULE_KIND_LABELS, type ScheduleKindValue } from '@/features/categories/constants';
import { cn } from '@/lib/utils';
import { moveDoorMutation } from '../api/mutations';
import { doorsQueryOptions } from '../api/queries';
import { DOOR_KIND_LABELS, DOOR_STATUS_LABELS, type DoorStatus } from '../schemas/door';

const STATUS_TONE: Record<DoorStatus, PillTone> = { active: 'ok', soon: 'warn', hidden: 'mut' };

export function DoorIcon({ icon, className }: { icon: string | null; className?: string }) {
  const I = (icon && Icons[icon as keyof typeof Icons]) || Icons.door;
  return <I className={className} aria-hidden='true' />;
}

export function DoorList() {
  const { data: doors } = useSuspenseQuery(doorsQueryOptions());
  const move = useMutation(moveDoorMutation);

  if (!doors.length)
    return (
      <div className='bg-card text-muted-foreground rounded-2xl p-8 text-center shadow-sm'>
        Belum ada pintu. Klik &ldquo;Tambah pintu&rdquo; untuk membuat yang pertama.
      </div>
    );

  return (
    <ol className='space-y-3' aria-label='Urutan pintu di beranda'>
      {doors.map((d, i) => (
        <li
          key={d.id}
          className={cn(
            'bg-card flex gap-3 rounded-2xl p-4 shadow-sm',
            d.status === 'hidden' && 'opacity-75'
          )}
        >
          <div className='flex shrink-0 flex-col gap-1'>
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label={`Naikkan ${d.name}`}
              disabled={i === 0 || move.isPending}
              onClick={() =>
                move.mutate({ id: d.id, dir: 'up' }, { onError: (e) => toast.error(e.message) })
              }
            >
              <Icons.chevronUp className='size-4' />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label={`Turunkan ${d.name}`}
              disabled={i === doors.length - 1 || move.isPending}
              onClick={() =>
                move.mutate({ id: d.id, dir: 'down' }, { onError: (e) => toast.error(e.message) })
              }
            >
              <Icons.chevronDown className='size-4' />
            </Button>
          </div>

          <span className='bg-primary/10 text-primary grid size-12 shrink-0 place-items-center rounded-xl'>
            <DoorIcon icon={d.icon} className='size-6' />
          </span>

          <div className='min-w-0 flex-1 space-y-1.5'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-base font-semibold'>{d.name}</span>
              <Pill tone={STATUS_TONE[d.status]}>{DOOR_STATUS_LABELS[d.status]}</Pill>
              <span className='text-muted-foreground text-xs'>
                {DOOR_KIND_LABELS[d.kind]} · /pintu/{d.slug}
              </span>
            </div>
            {d.description && <p className='text-muted-foreground text-sm'>{d.description}</p>}
            {(d.rotatingText || d.aliases.length > 0) && (
              <p className='text-muted-foreground text-xs'>
                {d.rotatingText && <>Teks berganti: &ldquo;{d.rotatingText}&rdquo;</>}
                {d.rotatingText && d.aliases.length > 0 && ' · '}
                {d.aliases.length > 0 && <>Sebutan lain: {d.aliases.join(', ')}</>}
              </p>
            )}
            <div className='flex flex-wrap gap-1.5 pt-0.5'>
              {d.categories.length ? (
                d.categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/categories/${c.id}`}
                    title={SCHEDULE_KIND_LABELS[c.scheduleKind as ScheduleKindValue]}
                    className={cn(
                      'bg-secondary hover:bg-muted rounded-full px-2.5 py-0.5 text-xs',
                      !c.isActive && 'line-through opacity-60'
                    )}
                  >
                    {c.name}
                  </Link>
                ))
              ) : (
                <span className='text-muted-foreground text-xs'>
                  Belum ada kategori. Pilih pintu ini di formulir kategori.
                </span>
              )}
            </div>
          </div>

          <Link
            href={`/dashboard/doors/${d.id}`}
            aria-label={`Ubah ${d.name}`}
            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'shrink-0' })}
          >
            <Icons.edit className='size-4 sm:mr-1.5' />
            <span className='hidden sm:inline'>Ubah</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
