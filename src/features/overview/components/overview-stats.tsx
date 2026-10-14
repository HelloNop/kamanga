'use client';
import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { overviewQueryOptions } from '../api/queries';

const id = (n: number) => n.toLocaleString('id-ID');
const usd = (n: number) =>
  n.toLocaleString('id-ID', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });
const initials = (s: string) =>
  s
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  if (m < 1440) return `${Math.round(m / 60)} jam lalu`;
  return `${Math.round(m / 1440)} hari lalu`;
};
const ROUTE: Record<string, { label: string; cls: string }> = {
  template: { label: 'Template', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  rules: { label: 'Aturan kode', cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  llm: { label: 'Model AI', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  limit: { label: 'Kena batas', cls: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  error: { label: 'Galat', cls: 'bg-red-500/15 text-red-700 dark:text-red-300' }
};

const panel = 'bg-card rounded-2xl p-5 shadow-sm min-w-0';

function Kpi({
  title,
  value,
  hint,
  href,
  hi
}: {
  title: string;
  value: string;
  hint: string;
  href?: string;
  hi?: boolean;
}) {
  const body = (
    <div
      className={cn(
        panel,
        'flex h-full min-h-[165px] flex-col justify-between transition-shadow',
        hi
          ? 'bg-[linear-gradient(170deg,var(--primary),var(--primary-hi))] text-white shadow-[0_14px_28px_-14px_var(--primary)]'
          : href && 'hover:shadow-md'
      )}
    >
      <div className='flex items-start justify-between gap-2 text-base font-semibold'>
        <span>{title}</span>
        {href && (
          <span
            aria-hidden='true'
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-full border-[1.5px]',
              hi ? 'border-white bg-white text-[var(--primary)]' : 'border-foreground'
            )}
          >
            <Icons.arrowUpRight className='size-4' />
          </span>
        )}
      </div>
      <div>
        <div className='mt-3 text-4xl leading-none font-normal tracking-tight tabular-nums md:text-5xl'>
          {value}
        </div>
        <div className={cn('mt-2 text-xs', hi ? 'text-white/80' : 'text-muted-foreground')}>
          {hint}
        </div>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className='block'>
      {body}
    </Link>
  ) : (
    body
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className='text-muted-foreground grid min-h-28 place-items-center rounded-xl border border-dashed px-4 py-6 text-center text-sm'>
      {children}
    </div>
  );
}

/** Batang kapsul: yang terbanyak berwarna, sisanya berarsir, seperti di referensi. */
function Bars({ rows }: { rows: { name: string; count: number }[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  const fills = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3'];
  const ranked = [...rows].sort((a, b) => b.count - a.count).map((r) => r.name);
  return (
    <div
      className='flex h-[168px] items-end justify-between gap-2 pt-6'
      role='img'
      aria-label='Listing terbit per kelompok'
    >
      {rows.map((r) => {
        const rank = ranked.indexOf(r.name);
        return (
          <div
            key={r.name}
            className='flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2'
          >
            <span className='text-[0.7rem] font-semibold tabular-nums'>{r.count}</span>
            <div
              title={`${r.name}: ${r.count}`}
              style={{ height: `${Math.max(10, (r.count / max) * 100)}%` }}
              className={cn(
                'w-full max-w-14 rounded-full',
                rank < 3
                  ? fills[rank]
                  : 'border-chart-4 border-[1.5px] bg-[repeating-linear-gradient(135deg,var(--chart-4)_0_1.5px,transparent_1.5px_7px)]'
              )}
            />
            <span className='text-muted-foreground w-full truncate text-center text-[0.7rem]'>
              {r.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Setengah lingkaran: proporsi listing terbit menurut tingkat verifikasi. */
function Gauge({ visited, checked, total }: { visited: number; checked: number; total: number }) {
  const L = Math.PI * 100; // panjang busur radius 100
  const seg = (n: number) => (total > 0 ? (n / total) * L : 0);
  const pct = total > 0 ? Math.round(((visited + checked) / total) * 100) : 0;
  const arc = 'M30 130a100 100 0 0 1 200 0';
  return (
    <div>
      <div className='relative mx-auto max-w-64'>
        <svg viewBox='0 0 260 150' aria-hidden='true' className='w-full'>
          <path
            d={arc}
            fill='none'
            stroke='var(--secondary)'
            strokeWidth='30'
            strokeLinecap='round'
          />
          <path
            d={arc}
            fill='none'
            stroke='var(--chart-1)'
            strokeWidth='30'
            strokeLinecap='round'
            strokeDasharray={`${seg(visited + checked)} ${L * 2}`}
          />
          <path
            d={arc}
            fill='none'
            stroke='var(--chart-3)'
            strokeWidth='30'
            strokeLinecap='round'
            strokeDasharray={`${seg(visited)} ${L * 2}`}
          />
        </svg>
        <div className='absolute inset-x-0 bottom-3 text-center'>
          <div className='text-4xl leading-none font-normal tracking-tight tabular-nums'>
            {pct}%
          </div>
          <div className='text-muted-foreground text-xs'>sudah dicek</div>
        </div>
      </div>
      <div className='mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs'>
        <span className='inline-flex items-center gap-1.5'>
          <i className='bg-chart-3 inline-block size-2 rounded-full' />
          Dicek langsung {visited}
        </span>
        <span className='inline-flex items-center gap-1.5'>
          <i className='bg-chart-1 inline-block size-2 rounded-full' />
          Kontak dicek {checked}
        </span>
      </div>
    </div>
  );
}

export function OverviewStats() {
  const { data } = useSuspenseQuery(overviewQueryOptions());
  const { listings: l, chat: c, directory: d, bookings: b } = data;
  const clickRate = c.sessions > 0 ? Math.round((c.clickedSessions / c.sessions) * 100) : 0;
  const answered =
    c.routes.template + c.routes.rules + c.routes.llm + c.routes.limit + c.routes.error;

  const attention = [
    b.stuck > 0 && {
      text: `${id(b.stuck)} pesanan macet`,
      href: '/dashboard/bookings?flag=stuck'
    },
    b.unanswered > 0 && {
      text: `${id(b.unanswered)} pesanan menunggu jawaban penyedia`,
      href: '/dashboard/bookings?status=sent'
    },
    b.questionsUnanswered > 0 && {
      text: `${id(b.questionsUnanswered)} pertanyaan warga belum terjawab`,
      href: '/dashboard/demand'
    },
    l.pendingReview > 0 && {
      text: `${id(l.pendingReview)} listing menunggu review`,
      href: '/dashboard/review'
    },
    l.draft > 0 && {
      text: `${id(l.draft)} listing masih draf`,
      href: '/dashboard/listings?status=draft'
    },
    l.noWhatsapp > 0 && {
      text: `${id(l.noWhatsapp)} listing terbit belum punya nomor WhatsApp`,
      href: '/dashboard/listings?status=published'
    },
    l.unverified > 0 && {
      text: `${id(l.unverified)} listing terbit belum terverifikasi`,
      href: '/dashboard/listings?status=published&verification=unverified'
    },
    c.routes.limit + c.routes.error > 0 && {
      text: `${id(c.routes.limit + c.routes.error)} jawaban 7 hari ini kena batas atau galat`
    }
  ].filter((x): x is { text: string; href?: string } => Boolean(x));

  return (
    <div className='space-y-3.5'>
      <div className='grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5'>
        <Kpi
          hi
          title='Pesanan hari ini'
          value={id(b.today)}
          hint='masuk sejak 00.00 WIB'
          href='/dashboard/bookings'
        />
        <Kpi
          title='Belum dijawab'
          value={id(b.unanswered)}
          hint='menunggu penyedia'
          href='/dashboard/bookings?status=sent'
        />
        <Kpi
          title='Pesanan macet'
          value={id(b.stuck)}
          hint='hampir kedaluwarsa atau lewat jadwal'
          href='/dashboard/bookings?flag=stuck'
        />
        <Kpi
          title='Pertanyaan warga'
          value={id(b.questionsUnanswered)}
          hint='belum dijawab penyedia'
          href='/dashboard/demand'
        />
        <Kpi
          title='Pencarian tanpa hasil'
          value={id(b.unmetSearches)}
          hint='7 hari terakhir'
          href='/dashboard/demand'
        />
      </div>

      <div className='grid grid-cols-2 gap-3.5 xl:grid-cols-4'>
        <Kpi
          title='Listing terbit'
          value={id(l.published)}
          hint={`dari ${id(l.total)} listing`}
          href='/dashboard/listings?status=published'
        />
        <Kpi
          title='Menunggu review'
          value={id(l.pendingReview)}
          hint='belum tampil di chat'
          href='/dashboard/review'
        />
        <Kpi
          title='Percakapan 7 hari'
          value={id(c.sessions)}
          hint={`${id(c.messages)} pesan warga`}
        />
        <Kpi
          title='Klik WhatsApp'
          value={id(c.clicks)}
          hint={`${clickRate}% percakapan berakhir klik`}
        />
      </div>

      <div className='grid gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,.95fr)]'>
        <div className={panel}>
          <div className='flex items-center justify-between gap-2'>
            <h3 className='text-[1.0625rem] font-semibold'>Listing per kelompok</h3>
            <span className='bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium'>
              {id(l.published)} terbit
            </span>
          </div>
          {data.groups.length ? (
            <Bars rows={data.groups} />
          ) : (
            <div className='mt-4'>
              <Empty>Belum ada listing terbit. Grafik muncul setelah ada yang diterbitkan.</Empty>
            </div>
          )}
        </div>

        <div className={panel}>
          <h3 className='text-[1.0625rem] font-semibold'>Perlu ditindaklanjuti</h3>
          {attention.length ? (
            <>
              <p className='mt-3 text-xl leading-snug font-semibold tracking-tight'>
                {attention[0].text}
              </p>
              <ul className='text-muted-foreground mt-2 space-y-1 text-sm'>
                {attention.slice(1).map((a) => (
                  <li key={a.text}>{a.text}</li>
                ))}
              </ul>
              {attention[0].href && (
                <Link
                  href={attention[0].href}
                  className='mt-4 flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--primary-hi),var(--primary))] text-sm font-semibold text-white'
                >
                  Tinjau sekarang
                </Link>
              )}
            </>
          ) : (
            <div className='mt-4'>
              <Empty>Tidak ada yang perlu ditindaklanjuti.</Empty>
            </div>
          )}
        </div>

        <div className={panel}>
          <div className='flex items-center justify-between gap-2'>
            <h3 className='text-[1.0625rem] font-semibold'>Kategori teratas</h3>
            <Link
              href='/dashboard/categories'
              className='border-foreground/70 rounded-full border px-3 py-1 text-xs font-semibold'
            >
              Semua
            </Link>
          </div>
          {data.topCategories.length ? (
            <ul className='mt-4 space-y-3'>
              {data.topCategories.map((t) => (
                <li key={t.name} className='flex items-center gap-3'>
                  <span className='bg-secondary text-secondary-foreground grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold'>
                    {initials(t.name)}
                  </span>
                  <span className='min-w-0'>
                    <span className='block truncate text-sm font-semibold'>{t.name}</span>
                    <span className='text-muted-foreground block truncate text-xs'>
                      {t.group} · {id(t.count)} listing
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className='mt-4'>
              <Empty>Belum ada kategori dengan listing terbit.</Empty>
            </div>
          )}
        </div>
      </div>

      <div className='grid gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,.95fr)]'>
        <div className={panel}>
          <h3 className='text-[1.0625rem] font-semibold'>Percakapan terbaru</h3>
          {data.recentChats.length ? (
            <ul className='mt-4 space-y-3.5'>
              {data.recentChats.map((r, i) => {
                const route = r.route ? ROUTE[r.route] : undefined;
                return (
                  <li key={i} className='flex items-center gap-3'>
                    <span className='bg-secondary text-muted-foreground grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold'>
                      W
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate text-sm font-semibold'>{r.text}</span>
                      <span
                        className='text-muted-foreground block text-xs'
                        suppressHydrationWarning
                      >
                        {ago(r.at)}
                      </span>
                    </span>
                    {route && (
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold',
                          route.cls
                        )}
                      >
                        {route.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className='mt-4'>
              <Empty>Belum ada percakapan warga.</Empty>
            </div>
          )}
        </div>

        <div className={panel}>
          <h3 className='mb-3 text-[1.0625rem] font-semibold'>Verifikasi listing</h3>
          {l.published > 0 ? (
            <Gauge visited={l.visited} checked={l.contactChecked} total={l.published} />
          ) : (
            <Empty>Belum ada listing terbit.</Empty>
          )}
        </div>

        <div className='relative overflow-hidden rounded-2xl bg-[linear-gradient(170deg,#1b2f3b,var(--primary))] p-5 text-white shadow-sm'>
          <span
            aria-hidden='true'
            className='absolute inset-0 bg-white/25 opacity-50 [-webkit-mask:url(/patterns/itiak-pulang-patang.svg)_0_0/auto_64px_repeat] [mask:url(/patterns/itiak-pulang-patang.svg)_0_0/auto_64px_repeat]'
          />
          <div className='relative'>
            <h3 className='text-[1.0625rem] font-semibold'>Jalur jawaban 7 hari</h3>
            <ul className='mt-3 space-y-1.5 text-sm'>
              {(
                [
                  ['Template', c.routes.template],
                  ['Aturan kode', c.routes.rules],
                  ['Model AI', c.routes.llm],
                  ['Kena batas / galat', c.routes.limit + c.routes.error]
                ] as const
              ).map(([label, n]) => (
                <li key={label} className='flex justify-between'>
                  <span className='text-white/85'>{label}</span>
                  <span className='tabular-nums'>
                    {id(n)}
                    {answered > 0 && (
                      <span className='ml-1 text-white/60'>
                        ({Math.round((n / answered) * 100)}%)
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div className='mt-4 border-t border-white/20 pt-3 text-xs text-white/80'>
              {c.llmCalls > 0
                ? `${id(c.llmCalls)} panggilan model, biaya ${usd(c.costUsd)}`
                : 'Belum ada panggilan model AI'}
            </div>
          </div>
        </div>
      </div>

      <div className={panel}>
        <h3 className='text-[1.0625rem] font-semibold'>Cakupan direktori</h3>
        <dl className='mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5'>
          {[
            ['Kategori', d.categories],
            ['Kebutuhan', d.needs],
            ['Kota/kabupaten', d.cities],
            ['Kecamatan', d.districts],
            ['Nagari/kelurahan', d.villages]
          ].map(([label, n]) => (
            <div key={label}>
              <dt className='text-muted-foreground'>{label}</dt>
              <dd className='text-2xl font-semibold tabular-nums'>{id(n as number)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className='space-y-3.5' role='status' aria-label='Memuat ringkasan'>
      <div className='grid grid-cols-2 gap-3.5 xl:grid-cols-4'>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className='bg-card h-36 animate-pulse rounded-2xl' />
        ))}
      </div>
      <div className='bg-card h-60 animate-pulse rounded-2xl' />
    </div>
  );
}
