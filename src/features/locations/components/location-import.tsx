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
import { previewImportMutation, runImportMutation } from '../api/mutations';
import type { ImportPreview, ImportResult } from '../api/types';
import { LEVEL_LABELS } from '../constants';

const MAX_FILE_BYTES = 900_000;

export default function LocationImport() {
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewedCsv, setPreviewedCsv] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const previewMutation = useMutation(previewImportMutation);
  const importMutation = useMutation(runImportMutation);

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
    previewMutation.mutate(csv, {
      onSuccess: (p) => {
        setPreview(p);
        setPreviewedCsv(csv);
        setResult(null);
      },
      onError: () => toast.error('Gagal memeriksa file')
    });

  const run = () =>
    importMutation.mutate(csv, {
      onSuccess: (r) => {
        setResult(r);
        if (r.ok) {
          toast.success(`Impor selesai: ${r.created} baru, ${r.updated} diperbarui`);
          setPreview(null);
        } else toast.error(r.message);
      },
      onError: () => toast.error('Impor gagal')
    });

  // Tombol Impor hanya aktif bila pratinjau bersih dan teks tidak berubah sejak diperiksa.
  const canImport =
    !!preview &&
    preview.errorCount === 0 &&
    preview.totals.create + preview.totals.update > 0 &&
    previewedCsv === csv;

  return (
    <div className='w-full max-w-5xl space-y-4 pb-8'>
      <div className='flex items-center justify-between'>
        <h2 className='text-[1.75rem] leading-[1.15] font-bold tracking-tight md:text-4xl'>
          Impor lokasi dari CSV
        </h2>
        <Link href='/dashboard/locations' className='text-muted-foreground text-sm underline'>
          Kembali ke daftar
        </Link>
      </div>

      <Card size='sm'>
        <CardHeader>
          <CardTitle>Format file</CardTitle>
          <CardDescription>
            Simpan spreadsheet sebagai CSV (koma atau titik koma, keduanya dikenali). Kolom wajib:{' '}
            <code>slug</code>, <code>name</code>, <code>level</code>. Kolom opsional:{' '}
            <code>parent_slug</code>, <code>lat</code>, <code>lng</code>, <code>aliases</code>{' '}
            (pisahkan dengan <code>|</code>). Level boleh ditulis provinsi, kota, kabupaten,
            kecamatan, nagari, kelurahan, atau tempat.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-2 text-sm'>
          <p>
            <a href='/templates/lokasi-template.csv' download className='underline'>
              Unduh templat contoh
            </a>
          </p>
          <ul className='text-muted-foreground list-disc space-y-1 pl-5'>
            <li>
              Slug yang sudah ada diperbarui (nama, induk, koordinat bila diisi). Sebutan hanya
              ditambah, tidak pernah dihapus.
            </li>
            <li>Tingkat lokasi yang sudah ada tidak bisa diubah lewat impor.</li>
            <li>
              Bila ada satu kesalahan, tidak ada yang tersimpan. Perbaiki file lalu periksa ulang.
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
                      <th className='pr-4'>Tingkat</th>
                      <th>Induk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((r) => (
                      <tr key={r.slug} className='border-t'>
                        <td className='py-1 pr-4'>{r.line}</td>
                        <td className='pr-4'>{r.action === 'create' ? 'Baru' : 'Perbarui'}</td>
                        <td className='pr-4'>{r.name}</td>
                        <td className='pr-4'>{LEVEL_LABELS[r.level]}</td>
                        <td>{r.parentSlug ?? '-'}</td>
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
                ? `${result.created} lokasi baru, ${result.updated} diperbarui.`
                : result.message}
            </CardDescription>
          </CardHeader>
          {result.ok ? (
            <CardContent>
              <Link href='/dashboard/locations' className='text-sm underline'>
                Lihat daftar lokasi
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
