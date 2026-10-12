'use client';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { InitialAvatar } from '@/components/ui/initial-avatar';
import { Pill } from '@/components/ui/pill';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { isHttpUrl } from '@/features/listings/lib/format';
import { SOURCE_LABELS } from '@/features/listings/constants/listing-options';
import { cn } from '@/lib/utils';
import { reviewListingMutation } from '../api/mutations';
import { reviewDetailOptions, reviewQueueOptions } from '../api/queries';
import type { ReviewItem } from '../api/types';

const PHOTO_REASONS = [
  'Foto buram atau terlalu gelap',
  'Foto bukan milik usaha ini',
  'Ada tulisan atau nomor kontak di foto',
  'Foto tidak pantas'
];

const REASON_SUGGESTIONS = [
  'Nomor kontak tidak bisa dihubungi',
  'Data belum lengkap',
  'Mirip dengan listing yang sudah ada',
  'Bukan usaha di Sumatera Barat'
];

function waitingText(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'hari ini';
  return `${days} hari`;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='min-w-0'>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      <dd className='mt-0.5 text-sm break-words'>{children}</dd>
    </div>
  );
}

function RejectDialog({ item, onClose }: { item: ReviewItem | null; onClose: () => void }) {
  const [note, setNote] = useState('');
  const review = useMutation(reviewListingMutation);
  const close = () => {
    setNote('');
    onClose();
  };
  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{item?.photosOnly ? 'Tolak foto' : 'Tolak listing'}</DialogTitle>
          <DialogDescription>
            {item?.name}.{' '}
            {item?.photosOnly
              ? 'Foto baru dihapus, listing tetap tampil. Alasan ini bisa dibaca pemiliknya.'
              : 'Alasan ini bisa dibaca pemilik listing agar tahu apa yang perlu diperbaiki.'}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            autoFocus
            placeholder='Tulis alasan penolakan'
            aria-label='Alasan penolakan'
          />
          <div className='flex flex-wrap gap-1.5'>
            {(item?.photosOnly ? PHOTO_REASONS : REASON_SUGGESTIONS).map((s) => (
              <button
                key={s}
                type='button'
                onClick={() => setNote(s)}
                className='text-muted-foreground hover:text-foreground hover:bg-muted rounded-full border border-dashed px-2.5 py-0.5 text-xs transition-colors'
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type='button' variant='ghost' onClick={close}>
            Batal
          </Button>
          <Button
            type='button'
            variant='destructive'
            disabled={review.isPending || note.trim().length < 3}
            onClick={() =>
              item &&
              review.mutate(
                { id: item.id, decision: 'reject', note },
                {
                  onSuccess: () => {
                    toast.success(item.photosOnly ? 'Foto ditolak' : 'Listing ditolak');
                    close();
                  },
                  onError: (e) => toast.error(e.message)
                }
              )
            }
          >
            {item?.photosOnly ? 'Tolak foto' : 'Tolak listing'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Thumbs({ urls, label }: { urls: string[]; label?: string }) {
  if (!urls.length) return null;
  return (
    <div>
      {label && <div className='text-muted-foreground mb-1.5 text-xs'>{label}</div>}
      <ul className='flex flex-wrap gap-2'>
        {urls.map((u) => (
          <li key={u}>
            <a href={u} target='_blank' rel='noopener noreferrer'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt='' className='bg-muted h-24 w-32 rounded-lg object-cover' />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className='text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase'>
        {title}
      </h4>
      <dl className='space-y-2.5'>{children}</dl>
    </section>
  );
}

const Empty = ({ children = 'Tidak diisi' }: { children?: React.ReactNode }) => (
  <span className='text-muted-foreground'>{children}</span>
);

/** Rincian lengkap listing di panel samping, supaya admin bisa membaca sebelum memutuskan. */
function ReviewSheet({
  item,
  onClose,
  onReject
}: {
  item: ReviewItem | null;
  onClose: () => void;
  onReject: (item: ReviewItem) => void;
}) {
  const { data: d, isPending } = useQuery({
    ...reviewDetailOptions(item?.id ?? 0),
    enabled: item !== null
  });
  const review = useMutation(reviewListingMutation);
  const title = item?.name.replace('[DUMMY] ', '') ?? '';
  const place = [d?.locationName, d?.locationPath].filter(Boolean).join(', ');
  const contact = d?.whatsapp ? `0${d.whatsapp.replace(/^62/, '')}` : null;
  const chatLine = d
    ? [
        d.attributes
          .filter((a) => a.text === 'Ya')
          .map((a) => a.label)
          .concat(
            d.attributes.filter((a) => a.text !== 'Ya' && a.text !== 'Tidak').map((a) => a.text)
          )
          .slice(0, 4)
          .join(' · '),
        d.priceText && `mulai ${d.priceText}`
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <Sheet open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side='right' className='w-full gap-0 overflow-hidden p-0 sm:max-w-xl'>
        <SheetHeader className='border-b p-5 pr-12'>
          <div className='flex items-start gap-3.5'>
            <InitialAvatar name={title} seed={d?.categoryName} />
            <div className='min-w-0'>
              <SheetTitle className='text-lg leading-snug'>{title}</SheetTitle>
              <SheetDescription className='mt-0.5'>
                {[d?.categoryName, place].filter(Boolean).join(' · ') || 'Memuat…'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className='min-h-0 flex-1 space-y-6 overflow-y-auto p-5'>
          {isPending || !d ? (
            <div className='space-y-3'>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className='bg-muted h-16 animate-pulse rounded-xl' />
              ))}
            </div>
          ) : (
            <>
              {d.owner && (
                <p className='text-muted-foreground text-[0.8125rem]'>
                  Dikirim oleh <b className='text-foreground'>{d.owner.name}</b> ({d.owner.email})
                  {' · '}
                  dibuat {dateFmt.format(new Date(d.createdAt))}, diubah{' '}
                  {dateFmt.format(new Date(d.updatedAt))}
                </p>
              )}

              {(d.photos.length > 0 || d.pendingPhotos.length > 0) && (
                <section className='space-y-3'>
                  <h4 className='text-muted-foreground text-xs font-semibold tracking-wider uppercase'>
                    Foto
                  </h4>
                  <Thumbs
                    urls={d.pendingPhotos}
                    label={`Menunggu keputusan (${d.pendingPhotos.length})`}
                  />
                  <Thumbs urls={d.photos} label='Sudah tampil' />
                </section>
              )}

              <section>
                <h4 className='text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase'>
                  Seperti tampil di chat
                </h4>
                <div className='rounded-2xl border p-3.5'>
                  <div className='text-[0.9375rem] font-semibold'>{title}</div>
                  <div className='mt-1.5 flex flex-wrap gap-1.5'>
                    <Pill tone='mut'>{d.categoryName ?? 'Tanpa kategori'}</Pill>
                  </div>
                  <p className='text-muted-foreground mt-2.5 text-[0.8125rem]'>
                    {[place || 'Lokasi belum dipilih', d.serviceModes.join(', ')]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {d.summary && <p className='mt-1.5 text-[0.8125rem]'>{d.summary}</p>}
                  {chatLine && <p className='mt-1.5 text-[0.8125rem]'>{chatLine}</p>}
                  {contact && !d.infoOnly && (
                    <span className='mt-3 flex h-[34px] items-center justify-center rounded-full bg-emerald-600 text-[0.8125rem] font-semibold text-white'>
                      Hubungi via WhatsApp
                    </span>
                  )}
                </div>
              </section>

              <Block title='Tentang usaha'>
                <Detail label='Ringkasan'>{d.summary ?? <Empty />}</Detail>
                <Detail label='Deskripsi'>
                  {d.description ? (
                    <span className='whitespace-pre-line'>{d.description}</span>
                  ) : (
                    <Empty />
                  )}
                </Detail>
                {d.extraCategories.length > 0 && (
                  <Detail label='Juga masuk kategori'>{d.extraCategories.join(', ')}</Detail>
                )}
                {d.keywords.length > 0 && (
                  <Detail label='Kata kunci'>
                    <span className='flex flex-wrap gap-1.5'>
                      {d.keywords.map((k) => (
                        <Pill key={k} tone='mut'>
                          {k}
                        </Pill>
                      ))}
                    </span>
                  </Detail>
                )}
              </Block>

              <Block title='Lokasi dan layanan'>
                <Detail label='Lokasi'>{place || <Empty>Belum dipilih</Empty>}</Detail>
                <Detail label='Alamat'>{d.address ?? <Empty />}</Detail>
                <Detail label='Koordinat'>
                  {d.lat !== null && d.lng !== null ? (
                    `${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}`
                  ) : (
                    <Empty>Belum ada</Empty>
                  )}
                  {d.mapsUrl && isHttpUrl(d.mapsUrl) && (
                    <>
                      {' · '}
                      <a
                        href={d.mapsUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-primary underline underline-offset-4'
                      >
                        Buka peta
                      </a>
                    </>
                  )}
                </Detail>
                <Detail label='Cara layanan'>{d.serviceModes.join(', ') || <Empty />}</Detail>
                {d.areas.length > 0 && <Detail label='Area layanan'>{d.areas.join(', ')}</Detail>}
              </Block>

              <Block title='Kontak'>
                <Detail label='WhatsApp'>{contact ?? <Empty />}</Detail>
                <Detail label='Telepon'>{d.phone ?? <Empty />}</Detail>
                <Detail label='Instagram'>{d.instagram ?? <Empty />}</Detail>
                <Detail label='Website'>
                  {d.website ? (
                    isHttpUrl(d.website) ? (
                      <a
                        href={d.website}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-primary underline underline-offset-4'
                      >
                        {d.website}
                      </a>
                    ) : (
                      d.website
                    )
                  ) : (
                    <Empty />
                  )}
                </Detail>
              </Block>

              <Block title='Harga'>
                <Detail label='Kisaran'>{d.priceText ?? <Empty>Tidak dicantumkan</Empty>}</Detail>
                {d.priceNote && <Detail label='Catatan'>{d.priceNote}</Detail>}
              </Block>

              <Block title='Isian khusus kategori'>
                {d.attributes.length ? (
                  d.attributes.map((a) => (
                    <Detail key={a.label} label={a.label}>
                      {a.text}
                    </Detail>
                  ))
                ) : (
                  <Empty>Belum ada isian khusus yang diisi</Empty>
                )}
              </Block>
            </>
          )}
        </div>

        {item && (
          <SheetFooter className='flex-row flex-wrap items-center gap-2 border-t p-4'>
            <Button
              type='button'
              disabled={review.isPending}
              onClick={() =>
                review.mutate(
                  { id: item.id, decision: 'approve' },
                  {
                    onSuccess: () => {
                      toast.success(
                        item.photosOnly ? 'Foto disetujui' : 'Listing disetujui dan terbit'
                      );
                      onClose();
                    },
                    onError: (e) => toast.error(e.message)
                  }
                )
              }
            >
              <Icons.circleCheck className='mr-1.5 size-4' /> Setujui
            </Button>
            <Button
              type='button'
              variant='outline'
              disabled={review.isPending}
              onClick={() => onReject(item)}
            >
              Tolak
            </Button>
            <Link
              href={`/dashboard/listings/${item.id}`}
              className='text-muted-foreground hover:text-foreground ml-auto text-sm underline-offset-4 hover:underline'
            >
              Buka dan ubah
            </Link>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Card({
  item,
  onView,
  onReject
}: {
  item: ReviewItem;
  onView: () => void;
  onReject: () => void;
}) {
  const review = useMutation(reviewListingMutation);
  // 62812... -> 0812... (format yang biasa dibaca warga)
  const contact = item.whatsapp ? `WA 0${item.whatsapp.replace(/^62/, '')}` : item.phone;
  return (
    <article className='bg-card rounded-xl p-5 shadow-sm'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h3 className='text-[1.0625rem] font-semibold'>{item.name.replace('[DUMMY] ', '')}</h3>
          <p className='text-muted-foreground mt-0.5 text-sm'>
            {[item.categoryName ?? 'Tanpa kategori', item.locationName ?? 'Lokasi belum dipilih']
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className='flex shrink-0 flex-wrap items-center gap-1.5'>
          <span className='bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold'>
            {SOURCE_LABELS[item.source]}
          </span>
          <span className='rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300'>
            {item.photosOnly ? 'Foto baru · ' : 'Menunggu '}
            {waitingText(item.submittedAt)}
          </span>
        </div>
      </div>

      {item.owner && (
        <p className='text-muted-foreground mt-2.5 text-[0.8125rem]'>
          Dikirim oleh <b className='text-foreground'>{item.owner.name}</b> ({item.owner.email})
        </p>
      )}

      {item.similar.length > 0 && (
        <p
          role='status'
          className='mt-3.5 flex items-start gap-2 rounded-xl bg-amber-500/15 px-3.5 py-2.5 text-sm'
        >
          <Icons.warning className='mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300' />
          <span>
            <b>Mirip dengan listing lain:</b>{' '}
            {item.similar.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ', '}
                <Link
                  href={`/dashboard/listings/${s.id}`}
                  target='_blank'
                  className='text-primary font-semibold underline underline-offset-4'
                >
                  {s.name.replace('[DUMMY] ', '')}
                </Link>
                {s.reason === 'whatsapp' ? ' (nomor sama)' : ''}
              </span>
            ))}
          </span>
        </p>
      )}

      {item.summary && <p className='mt-3.5 text-sm'>{item.summary}</p>}
      {item.pendingPhotos.length > 0 && (
        <div className='mt-3.5'>
          <Thumbs
            urls={item.pendingPhotos}
            label={`Foto menunggu keputusan (${item.pendingPhotos.length})`}
          />
        </div>
      )}

      <dl className='mt-3.5 grid grid-cols-2 gap-x-6 gap-y-3 xl:grid-cols-4'>
        <Detail label='Kontak'>
          {contact ?? <span className='text-muted-foreground'>Tidak ada</span>}
        </Detail>
        <Detail label='Harga'>
          {item.priceText ?? <span className='text-muted-foreground'>Tidak dicantumkan</span>}
        </Detail>
        <Detail label='Isian khusus'>
          {item.attributeCount > 0 ? (
            `${item.attributeCount} terisi`
          ) : (
            <span className='text-muted-foreground'>Belum ada</span>
          )}
        </Detail>
        <Detail label='Kelengkapan'>
          <span
            className={cn(
              'font-semibold',
              item.completeness < 60 && 'text-amber-700 dark:text-amber-300'
            )}
          >
            {item.completeness}%
          </span>
          {item.missing.length > 0 && (
            <span className='text-muted-foreground text-xs'>
              {' '}
              · kurang {item.missing.join(', ')}
            </span>
          )}
        </Detail>
      </dl>

      <div className='mt-4 flex flex-wrap items-center gap-2 border-t pt-4'>
        <Button
          type='button'
          disabled={review.isPending}
          onClick={() =>
            review.mutate(
              { id: item.id, decision: 'approve' },
              {
                onSuccess: () =>
                  toast.success(
                    item.photosOnly ? 'Foto disetujui' : 'Listing disetujui dan terbit'
                  ),
                onError: (e) => toast.error(e.message)
              }
            )
          }
        >
          <Icons.circleCheck className='mr-1.5 size-4' /> Setujui
        </Button>
        <Button type='button' variant='outline' disabled={review.isPending} onClick={onReject}>
          Tolak
        </Button>
        <Button type='button' variant='ghost' onClick={onView}>
          <Icons.search className='mr-1.5 size-4' /> Lihat
        </Button>
        <Link
          href={`/dashboard/listings/${item.id}`}
          className='text-muted-foreground hover:text-foreground ml-auto text-sm underline-offset-4 hover:underline'
        >
          Buka dan ubah
        </Link>
      </div>
    </article>
  );
}

export function ReviewQueue() {
  const { data } = useSuspenseQuery(reviewQueueOptions());
  const [rejecting, setRejecting] = useState<ReviewItem | null>(null);
  const [viewing, setViewing] = useState<ReviewItem | null>(null);

  if (data.items.length === 0)
    return (
      <div className='bg-card text-muted-foreground grid min-h-56 place-items-center rounded-xl p-8 text-center shadow-sm'>
        <div>
          <Icons.circleCheck className='mx-auto mb-3 size-8' />
          <p className='text-foreground font-medium'>Antrean kosong</p>
          <p className='mt-1 text-sm'>Tidak ada listing yang menunggu review. Kerja bagus.</p>
        </div>
      </div>
    );

  return (
    <>
      <p className='text-muted-foreground mb-3.5 text-sm'>
        {data.total} menunggu. Yang paling lama menunggu ada di atas.
      </p>
      <div className='space-y-3.5'>
        {data.items.map((item) => (
          <Card
            key={item.id}
            item={item}
            onView={() => setViewing(item)}
            onReject={() => setRejecting(item)}
          />
        ))}
      </div>
      {data.total > data.items.length && (
        <p className='text-muted-foreground mt-3.5 text-center text-sm'>
          Menampilkan {data.items.length} teratas dari {data.total}.
        </p>
      )}
      <ReviewSheet
        item={viewing}
        onClose={() => setViewing(null)}
        onReject={(it) => {
          setViewing(null);
          setRejecting(it);
        }}
      />
      <RejectDialog item={rejecting} onClose={() => setRejecting(null)} />
    </>
  );
}
