'use client';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { FilePicker } from '@/components/file-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { previewListingImportMutation, runListingImportMutation } from '../api/mutations';
import type { ImportPreview, ImportResult } from '../api/types';
import type { ImportMode } from '../lib/csv-import';

const MAX_FILE_BYTES = 900_000;
const ACTION_LABEL = { create: 'Baru', update: 'Perbarui', skip: 'Dilewati' } as const;

const COLUMNS: [string, string][] = [
  [
    'name, category',
    'Wajib untuk listing baru. category = slug atau nama kategori, mis. catering atau Katering.'
  ],
  [
    'slug',
    'Kosongkan agar dibuat dari nama dan lokasi. Slug yang sama dikenali sebagai listing yang sama saat impor ulang.'
  ],
  [
    'location, areas',
    'Slug atau nama lokasi. Nama kembar (mis. Koto Baru) wajib ditulis slug-nya. areas boleh banyak, pisahkan dengan |.'
  ],
  ['service_modes', 'di tempat, panggilan, daring. Boleh banyak, pisahkan dengan |.'],
  ['whatsapp', '0812-3456-7890 atau +62 812 3456 7890; disimpan sebagai 62xxx.'],
  [
    'price_min, price_max, price_unit',
    '35.000 atau 35000; satuan: per acara, per jam, per hari, per kunjungan, per orang, per item, per proyek.'
  ],
  ['keywords, extra_categories', 'Pisahkan dengan |.'],
  [
    'attributes',
    'kunci=nilai, pisahkan dengan |, mis. capacity=500 | parkir=ya | poli=umum;anak. Kunci harus ada di kategori; ya/tidak untuk isian ya/tidak, dan pilihan ganda dipisah ; (titik koma).'
  ],
  [
    'status, verification',
    'draf (bawaan), terbit, menunggu review, diarsipkan; belum, kontak dicek, dicek langsung.'
  ]
];

export default function ListingImport() {
  const [csv, setCsv] = useState('');
  const [mode, setMode] = useState<ImportMode>('create');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewedKey, setPreviewedKey] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const previewMutation = useMutation(previewListingImportMutation);
  const importMutation = useMutation(runListingImportMutation);

  const reset = (text: string) => {
    setCsv(text);
    setPreview(null);
    setResult(null);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES)
      return toast.error('File terlalu besar (maksimal sekitar 900 KB).');
    reset(await file.text());
  };

  const check = () =>
    previewMutation.mutate(
      { csv, mode },
      {
        onSuccess: (p) => {
          setPreview(p);
          setPreviewedKey(`${mode}\n${csv}`);
          setResult(null);
        },
        onError: () => toast.error('Gagal memeriksa file')
      }
    );

  const run = () =>
    importMutation.mutate(
      { csv, mode },
      {
        onSuccess: (r) => {
          setResult(r);
          if (r.ok) {
            toast.success(
              `Impor selesai: ${r.created} baru, ${r.updated} diperbarui, ${r.skipped} dilewati`
            );
            setPreview(null);
          } else toast.error(r.message);
        },
        onError: () => toast.error('Impor gagal')
      }
    );

  // Tombol Impor aktif hanya bila pratinjau bersih dan isi serta mode tidak berubah sejak diperiksa.
  const workCount = preview ? preview.totals.create + preview.totals.update : 0;
  const canImport =
    !!preview && preview.errorCount === 0 && workCount > 0 && previewedKey === `${mode}\n${csv}`;

  return (
    <div className='w-full max-w-5xl space-y-4 pb-8'>
      <div className='flex items-center justify-between'>
        <h2 className='text-[1.75rem] leading-[1.15] font-bold tracking-tight md:text-4xl'>
          Impor listing dari CSV
        </h2>
        <Link href='/dashboard/listings' className='text-muted-foreground text-sm underline'>
          Kembali ke daftar
        </Link>
      </div>

      <Card size='sm'>
        <CardHeader>
          <CardTitle>Format file</CardTitle>
          <CardDescription>
            Simpan spreadsheet sebagai CSV (koma atau titik koma, keduanya dikenali). Nama kolom
            harus persis seperti di templat; kolom yang tidak dikenal ditolak agar salah ketik tidak
            diam-diam diabaikan.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3 text-sm'>
          <p>
            <a href='/templates/listing-template.csv' download className='underline'>
              Unduh templat contoh
            </a>
          </p>
          <dl className='grid gap-x-4 gap-y-2 md:grid-cols-[14rem_1fr]'>
            {COLUMNS.map(([col, desc]) => (
              <div key={col} className='contents'>
                <dt className='font-mono text-xs'>{col}</dt>
                <dd className='text-muted-foreground'>{desc}</dd>
              </div>
            ))}
          </dl>
          <ul className='text-muted-foreground list-disc space-y-1 pl-5'>
            <li>
              Bila ada satu kesalahan, tidak ada yang tersimpan. Perbaiki file lalu periksa ulang.
            </li>
            <li>
              Listing hasil impor bersumber "Impor" dan berstatus draf kecuali kolom status diisi.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card size='sm'>
        <CardHeader>
          <CardTitle>Isi file</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <FilePicker accept='.csv,.txt,text/csv' label='Pilih file CSV' onFile={onFile} />
          <Textarea
            value={csv}
            onChange={(e) => reset(e.target.value)}
            rows={10}
            placeholder='...atau tempel isi CSV di sini'
            className='font-mono text-xs'
            aria-label='Isi CSV'
          />
          <label className='flex items-start gap-2 text-sm'>
            <input
              type='checkbox'
              checked={mode === 'upsert'}
              aria-label='Perbarui listing yang sudah ada berdasarkan slug'
              onChange={(e) => {
                setMode(e.target.checked ? 'upsert' : 'create');
                setPreview(null);
                setResult(null);
              }}
              className='mt-1'
            />
            <span>
              Perbarui listing yang sudah ada (berdasarkan slug)
              <span className='text-muted-foreground block'>
                Bila tidak dicentang, listing yang slug-nya sudah ada dilewati. Bila dicentang,
                hanya kolom yang terisi di CSV yang menimpa data lama; sel kosong tidak menghapus
                apa pun.
              </span>
            </span>
          </label>
          <div className='flex gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={check}
              disabled={!csv.trim() || previewMutation.isPending}
            >
              {previewMutation.isPending ? 'Memeriksa...' : 'Periksa'}
            </Button>
            <Button type='button' onClick={run} disabled={!canImport || importMutation.isPending}>
              {importMutation.isPending ? 'Mengimpor...' : 'Impor'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card size='sm'>
          <CardHeader>
            <CardTitle>Hasil pemeriksaan</CardTitle>
            <CardDescription className='flex flex-wrap gap-2'>
              <Badge variant='secondary'>{preview.totals.create} baru</Badge>
              <Badge variant='secondary'>{preview.totals.update} diperbarui</Badge>
              <Badge variant='secondary'>{preview.totals.skip} dilewati</Badge>
              <Badge variant={preview.errorCount ? 'destructive' : 'outline'}>
                {preview.errorCount} kesalahan
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {preview.errors.length > 0 && (
              <ul className='space-y-1 text-sm' aria-label='Daftar kesalahan'>
                {preview.errors.map((e, i) => (
                  <li key={i} className='text-destructive'>
                    Baris {e.line}: {e.message}
                  </li>
                ))}
                {preview.errorCount > preview.errors.length && (
                  <li className='text-muted-foreground'>
                    ...dan {preview.errorCount - preview.errors.length} kesalahan lain.
                  </li>
                )}
              </ul>
            )}
            {preview.sample.length > 0 && (
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead className='text-muted-foreground text-left'>
                    <tr>
                      <th className='py-1 pr-4'>Baris</th>
                      <th className='pr-4'>Aksi</th>
                      <th className='pr-4'>Nama</th>
                      <th>Slug</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((r) => (
                      <tr key={r.slug} className='border-t'>
                        <td className='py-1 pr-4'>{r.line}</td>
                        <td className='pr-4'>{ACTION_LABEL[r.action]}</td>
                        <td className='pr-4'>{r.name}</td>
                        <td className='text-muted-foreground'>{r.slug}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className='text-muted-foreground mt-2 text-xs'>
                  Menampilkan {preview.sample.length} baris pertama.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card size='sm'>
          <CardHeader>
            <CardTitle>{result.ok ? 'Impor selesai' : 'Impor dibatalkan'}</CardTitle>
            <CardDescription>
              {result.ok
                ? `${result.created} listing baru, ${result.updated} diperbarui, ${result.skipped} dilewati.`
                : result.message}
            </CardDescription>
          </CardHeader>
          {result.ok ? (
            <CardContent>
              <Link href='/dashboard/listings' className='text-sm underline'>
                Lihat daftar listing
              </Link>
            </CardContent>
          ) : (
            result.errors.length > 0 && (
              <CardContent>
                <ul className='space-y-1 text-sm'>
                  {result.errors.map((e, i) => (
                    <li key={i} className='text-destructive'>
                      Baris {e.line}: {e.message}
                    </li>
                  ))}
                </ul>
              </CardContent>
            )
          )}
        </Card>
      )}
    </div>
  );
}
