'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Pill } from '@/components/ui/pill';
import { cn } from '@/lib/utils';
import { demandReportOptions } from '../api/queries';
import type { DemandPeriod } from '../api/types';

const PERIODS: DemandPeriod[] = [7, 30, 90];
const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });

function Stat({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className='bg-card rounded-xl p-5 shadow-sm'>
      <p className='text-muted-foreground text-sm'>{title}</p>
      <p className='mt-1 text-3xl font-bold tracking-tight'>{value}</p>
      {hint && <p className='text-muted-foreground mt-1 text-xs'>{hint}</p>}
    </div>
  );
}

export function DemandReport() {
  const [days, setDays] = useState<DemandPeriod>(30);
  const { data, isError, refetch } = useQuery({
    ...demandReportOptions(days),
    placeholderData: keepPreviousData
  });

  if (isError && !data)
    return (
      <div role='alert' className='bg-card rounded-2xl p-6 text-center shadow-sm'>
        <p className='font-medium'>Laporan gagal dimuat.</p>
        <button
          type='button'
          onClick={() => refetch()}
          className='text-primary mt-2 text-sm underline underline-offset-4'
        >
          Coba lagi
        </button>
      </div>
    );
  if (!data) return <div className='bg-card h-64 animate-pulse rounded-xl' />;

  const pct = data.totalSearches ? Math.round((data.unmetSearches / data.totalSearches) * 100) : 0;

  return (
    <div className='space-y-4'>
      <div className='bg-muted inline-flex rounded-xl p-[3px]' role='group' aria-label='Periode'>
        {PERIODS.map((p) => (
          <button
            key={p}
            type='button'
            aria-pressed={days === p}
            onClick={() => setDays(p)}
            className={cn(
              'h-8 rounded-[9px] px-3.5 text-sm transition-colors',
              days === p
                ? 'bg-card text-foreground font-semibold shadow-sm'
                : 'text-muted-foreground font-medium'
            )}
          >
            {p} hari
          </button>
        ))}
      </div>

      <div className='grid gap-3 sm:grid-cols-3'>
        <Stat title='Pencarian warga' value={data.totalSearches.toLocaleString('id-ID')} />
        <Stat
          title='Tanpa hasil'
          value={data.unmetSearches.toLocaleString('id-ID')}
          hint={data.totalSearches ? `${pct}% dari semua pencarian` : undefined}
        />
        <Stat title='Kebutuhan berbeda' value={data.rows.length.toLocaleString('id-ID')} />
      </div>

      {data.rows.length === 0 ? (
        <div className='bg-card text-muted-foreground grid min-h-48 place-items-center rounded-xl p-8 text-center shadow-sm'>
          <p>
            Belum ada pencarian tanpa hasil di {days} hari terakhir. Daftar ini terisi sendiri saat
            warga mencari sesuatu yang belum ada di direktori.
          </p>
        </div>
      ) : (
        <div className='bg-card overflow-x-auto rounded-xl shadow-sm'>
          <table className='w-full min-w-[720px] text-left text-sm'>
            <thead>
              <tr className='text-muted-foreground border-b text-xs uppercase'>
                <th className='px-4 py-3 font-semibold'>Kebutuhan</th>
                <th className='px-4 py-3 text-right font-semibold'>Dicari</th>
                <th className='px-4 py-3 text-right font-semibold'>Orang</th>
                <th className='px-4 py-3 font-semibold'>Lokasi</th>
                <th className='px-4 py-3 font-semibold'>Contoh kalimat</th>
                <th className='px-4 py-3 font-semibold'>Terakhir</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.key} className='border-b align-top last:border-0'>
                  <td className='px-4 py-3'>
                    <div className='font-medium'>{r.label}</div>
                    <div className='mt-1'>
                      {r.elsewhere ? (
                        <Pill tone='warn'>Ada di daerah lain</Pill>
                      ) : (
                        <Pill tone='bad'>Belum ada sama sekali</Pill>
                      )}
                    </div>
                  </td>
                  <td className='px-4 py-3 text-right font-semibold tabular-nums'>{r.searches}</td>
                  <td className='px-4 py-3 text-right tabular-nums'>{r.people}</td>
                  <td className='text-muted-foreground px-4 py-3'>
                    {r.places.length ? r.places.join(', ') : 'Sumatera Barat'}
                  </td>
                  <td className='text-muted-foreground max-w-xs px-4 py-3'>
                    {r.examples.length ? (
                      r.examples.map((e, i) => (
                        <div key={i} className='truncate'>
                          “{e}”
                        </div>
                      ))
                    ) : (
                      <span>–</span>
                    )}
                  </td>
                  <td className='text-muted-foreground px-4 py-3 whitespace-nowrap'>
                    {dateFmt.format(new Date(r.lastAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className='text-muted-foreground text-sm'>
        Yang paling atas adalah usaha yang paling dicari warga tetapi belum ada. Tambahkan lewat{' '}
        <Link href='/dashboard/listings/new' className='text-primary underline underline-offset-4'>
          listing baru
        </Link>{' '}
        atau buat{' '}
        <Link
          href='/dashboard/categories/new'
          className='text-primary underline underline-offset-4'
        >
          kategori baru
        </Link>
        .
      </p>
    </div>
  );
}
