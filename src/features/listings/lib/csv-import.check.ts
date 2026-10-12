// Pemeriksaan cepat: bun run check:listing-import
import assert from 'node:assert/strict';
import { parseListingCsv, parseRupiah, planListingImport, type Lookups } from './csv-import';

const lookups: Lookups = {
  categories: [
    {
      id: 1,
      slug: 'catering',
      name: 'Katering',
      attributes: [
        { key: 'min_order', label: 'Minimal pesanan', type: 'number' },
        { key: 'bpjs', label: 'Terima BPJS', type: 'boolean' },
        { key: 'poli', label: 'Poli', type: 'multiselect', options: ['Umum', 'Anak'] }
      ]
    },
    { id: 2, slug: 'ac-repair', name: 'Servis AC', attributes: [] }
  ],
  locations: [
    { id: 10, slug: 'padang', name: 'Kota Padang', level: 'city', parentName: 'Sumatera Barat' },
    { id: 11, slug: 'koto-baru-a', name: 'Koto Baru', level: 'village', parentName: 'A' },
    { id: 12, slug: 'koto-baru-b', name: 'Koto Baru', level: 'village', parentName: 'B' }
  ],
  existing: new Map([['sudah-ada', 99]])
};
const run = (csv: string, mode: 'create' | 'upsert' = 'create') => {
  const p = parseListingCsv(csv);
  assert.deepEqual(p.errors, []);
  return planListingImport(p.rows, lookups, mode);
};
const H =
  'name,category,location,whatsapp,price_min,price_max,price_unit,service_modes,keywords,attributes,status,verification\n';

// rupiah gaya Indonesia
assert.equal(parseRupiah('Rp 35.000'), 35000);
assert.equal(parseRupiah('1.250.000'), 1250000);
assert.equal(parseRupiah('35000'), 35000);
assert.ok(Number.isNaN(parseRupiah('35,5')) && Number.isNaN(parseRupiah('12.34')));

// baris bagus, istilah Indonesia, slug otomatis dari nama + lokasi
let r = run(
  H +
    'Katering Uni Et,katering,Kota Padang,0812-3456-7890,"35.000","60.000",per orang,di tempat|panggilan,"nasi kapau| masakan padang",min_order=100,terbit,kontak dicek\n'
);
assert.deepEqual(r.errors, []);
const row = r.planned[0];
assert.equal(row.slug, 'katering-uni-et-padang');
assert.equal(row.action, 'create');
assert.equal(row.values.primaryCategoryId, '1');
assert.equal(row.values.locationId, '10');
assert.equal(row.values.priceMin, 35000);
assert.equal(row.values.priceUnit, 'per_person');
assert.deepEqual(row.values.serviceModes, ['on_site', 'on_call']);
assert.deepEqual(row.values.keywords, ['nasi kapau', 'masakan padang']);
assert.deepEqual(row.values.attributes, { min_order: '100' });
assert.equal(row.values.status, 'published');
assert.equal(row.values.verificationLevel, 'contact_checked');
assert.equal(row.values.source, 'import');

// bawaan: draf, tanpa kesalahan walau banyak kolom kosong
r = run(H + 'Servis AC Dedi,ac-repair,,,,,,,,,,\n');
assert.equal(r.planned[0].values.status, 'draft');
assert.deepEqual(r.planned[0].values.serviceModes, ['on_site']);

// kesalahan yang harus ditangkap
r = run(
  H +
    'Usaha A,tidak-ada,,,,,,,,,,\n' +
    'Usaha B,katering,Koto Baru,,,,,,,,,\n' +
    'Usaha C,katering,,123,,,,,,,,\n' +
    'Usaha D,katering,,,,,,,,xyz=1,,\n' +
    'Usaha E,katering,,,10.000,5.000,,,,,,\n' +
    'Usaha F,katering,,,,,,,,,rejected,\n' +
    ',katering,,,,,,,,,,\n' +
    'Katering G,katering,Lubuk,,,,,,,,,\n'
);
const msgs = r.errors.map((e) => `${e.line}:${e.message}`);
assert.ok(
  msgs.some((m) => m.startsWith('2:kategori "tidak-ada"')),
  msgs.join('\n')
);
assert.ok(msgs.some((m) => m.startsWith('3:lokasi "Koto Baru" ambigu (2')));
assert.ok(msgs.some((m) => m.startsWith('4:') && m.includes('WhatsApp')));
assert.ok(msgs.some((m) => m.startsWith('5:atribut xyz')));
assert.ok(msgs.some((m) => m.startsWith('6:') && m.includes('maksimum')));
assert.ok(msgs.some((m) => m.startsWith('7:status rejected')));
assert.ok(msgs.some((m) => m.startsWith('8:')));
assert.ok(msgs.some((m) => m.startsWith('9:lokasi "Lubuk" tidak ditemukan'))); // nama harus persis, atau tulis slug

// slug ganda di file, kolom tak dikenal, kolom wajib hilang
r = run(H + 'Usaha X,katering,,,,,,,,,,\nUsaha X,katering,,,,,,,,,,\n');
assert.equal(r.errors.length, 1);
assert.equal(
  parseListingCsv('name,category,whatsap\nx,y,z').errors[0].message,
  'Kolom tidak dikenal: whatsap'
);
assert.match(
  parseListingCsv('name,summary\nx,y').errors[0].message,
  /Kolom wajib tidak ada: category/
);

// baris yang sudah ada: dilewati (create) atau diperbarui (upsert)
const dup = 'slug,name,category\nsudah-ada,Lama,katering\n';
assert.equal(run(dup, 'create').planned[0].action, 'skip');
const up = run(dup, 'upsert').planned[0];
assert.equal(up.action, 'update');
assert.equal(up.existingId, 99);
assert.deepEqual(Object.keys(up.values).sort(), ['name', 'primaryCategoryId']); // hanya kolom yang diisi

// titik koma + BOM (Excel Indonesia)
r = run('﻿name;category;lat;lng\nSalon A;katering;-0,95;100,41\n');
assert.equal(r.planned[0].values.lat, -0.95);

// tipe isian baru: nilai valid lolos, nilai yang tidak cocok ditandai per baris
r = run(H + 'Katering A,katering,Kota Padang,,,,,,,bpjs=ya | poli=umum;anak,terbit,\n');
assert.deepEqual(r.errors, []);
r = run(
  H +
    'Katering B,katering,Kota Padang,,,,,,,bpjs=mungkin,terbit,\n' +
    'Katering C,katering,Kota Padang,,,,,,,poli=gigi,terbit,\n' +
    'Katering D,katering,Kota Padang,,,,,,,min_order=banyak,terbit,\n'
);
assert.equal(r.errors.length, 3);
assert.match(r.errors[0].message, /bpjs.*ya atau tidak/);
assert.match(r.errors[1].message, /poli.*Umum, Anak/);
assert.match(r.errors[2].message, /min_order.*angka/);

console.log('csv-import.check: OK');
