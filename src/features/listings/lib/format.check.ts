// Pemeriksaan cepat: bun run check:listings
import assert from 'node:assert/strict';
import {
  cleanAttributes,
  coerceAttribute,
  normalizeWhatsapp,
  parseAttributeSchema,
  parseMapsCoords,
  slugify,
  type AttributeDef
} from './format';

assert.equal(slugify('  Katering Uni Et — Lubuk Begalung! '), 'katering-uni-et-lubuk-begalung');
assert.equal(slugify('Café Ñandú'), 'cafe-nandu');
assert.equal(slugify('!!!'), '');

assert.equal(normalizeWhatsapp('0812-3456-7890'), '6281234567890');
assert.equal(normalizeWhatsapp('+62 812 3456 7890'), '6281234567890');
assert.equal(normalizeWhatsapp('81234567890'), '6281234567890');
assert.equal(normalizeWhatsapp('123'), null);
assert.equal(normalizeWhatsapp(''), null);

assert.deepEqual(
  parseMapsCoords('https://www.google.com/maps/place/X/@-0.9471,100.4172,17z/data=!4m6'),
  {
    lat: -0.9471,
    lng: 100.4172
  }
);
assert.deepEqual(parseMapsCoords('https://maps.google.com/?q=-0.95,100.35'), {
  lat: -0.95,
  lng: 100.35
});
assert.deepEqual(
  parseMapsCoords('https://x/maps/place/Y/@-1.0,100.0,15z/data=!3d-0.9471!4d100.4172'),
  {
    lat: -0.9471,
    lng: 100.4172
  }
);
assert.equal(parseMapsCoords('https://maps.app.goo.gl/abc123'), null);
assert.equal(parseMapsCoords('https://x/@95.0,100.0,10z'), null);

const defs = [{ key: 'capacity', label: 'Kapasitas', type: 'number' as const }];
assert.deepEqual(cleanAttributes({ capacity: '500', hack: 'x' }, defs), { capacity: 500 });
assert.deepEqual(cleanAttributes({ capacity: '' }, defs), {});

// tipe isian baru
const rich: AttributeDef[] = [
  { key: 'bpjs', label: 'Terima BPJS', type: 'boolean' },
  { key: 'kelas', label: 'Kelas', type: 'select', options: ['Ekonomi', 'Bisnis'] },
  { key: 'poli', label: 'Poli', type: 'multiselect', options: ['Umum', 'Anak', 'Gigi'] }
];
assert.deepEqual(
  cleanAttributes({ bpjs: 'Ya', kelas: 'bisnis', poli: 'umum; GIGI;tidak-ada' }, rich),
  { bpjs: true, kelas: 'Bisnis', poli: ['Umum', 'Gigi'] }
);
assert.deepEqual(cleanAttributes({ bpjs: false, poli: ['Anak', 'Anak'] }, rich), {
  bpjs: false,
  poli: ['Anak']
});
assert.deepEqual(cleanAttributes({ bpjs: 'mungkin', kelas: 'Mewah', poli: [] }, rich), {});
assert.equal(coerceAttribute(rich[0], 'tidak'), false);
assert.equal(coerceAttribute(rich[1], 'Mewah'), undefined);

// pilihan tanpa daftar tidak lolos; tipe tak dikenal dibuang
assert.deepEqual(
  parseAttributeSchema([
    { key: 'a', label: 'A', type: 'select' },
    { key: 'b', label: 'B', type: 'select', options: [' X ', 'X', 'Y'] },
    { key: 'c', label: 'C', type: 'tanggal' },
    { key: 'd', label: 'D', type: 'boolean', options: ['x'] }
  ]),
  [
    { key: 'b', label: 'B', type: 'select', options: ['X', 'Y'] },
    { key: 'd', label: 'D', type: 'boolean' }
  ]
);

console.log('format.check: OK');
