// Pemeriksaan cepat: bun run check:locations
import assert from 'node:assert/strict';
import { detectDelimiter, parseCsv, parseLocationCsv, planImport } from './csv';

// pengurai dasar: kutip, koma & baris baru di dalam kutip, CRLF
assert.deepEqual(parseCsv('a,"b,1","c ""q"""\r\nd,"x\ny",e', ','), [
  ['a', 'b,1', 'c "q"'],
  ['d', 'x\ny', 'e']
]);
assert.equal(detectDelimiter('slug;name;level'), ';');
assert.equal(detectDelimiter('slug,name,level'), ',');

// titik koma + koma desimal + BOM + istilah Indonesia + alias
const csv =
  '﻿slug;name;level;parent_slug;lat;lng;aliases\n' +
  'sumbar;Sumatera Barat;provinsi;;;;Sumbar\n' +
  'padang;Kota Padang;kota;sumbar;-0,9471;100,4172;Padang|Pdg\n' +
  'lubeg;Lubuk Begalung;kecamatan;padang;;;Lubeg|lubeg\n';
const p = parseLocationCsv(csv);
assert.deepEqual(p.errors, []);
assert.equal(p.rows.length, 3);
assert.equal(p.rows[1].lat, -0.9471);
assert.equal(p.rows[1].lng, 100.4172);
assert.deepEqual(p.rows[2].aliases, ['Lubeg', 'lubeg']);
assert.equal(p.rows[2].level, 'district');

// urutan: induk lebih dulu walau di file terbalik
const rev = parseLocationCsv(
  'slug,name,level,parent_slug\nlubeg,Lubeg,district,padang\npadang,Padang,city,sumbar\nsumbar,Sumbar,province,\n'
);
const plan = planImport(rev.rows, new Map());
assert.deepEqual(plan.errors, []);
assert.deepEqual(
  plan.ordered.map((r) => r.slug),
  ['sumbar', 'padang', 'lubeg']
);

// induk dari database dianggap ada
assert.deepEqual(
  planImport(
    parseLocationCsv('slug,name,level,parent_slug\nlubeg,Lubeg,district,padang\n').rows,
    new Map([['padang', { level: 'city' as const }]])
  ).errors,
  []
);

// kesalahan yang harus ditangkap
const bad = parseLocationCsv(
  'slug,name,level,parent_slug,lat,lng\nBAD SLUG,x,city,,,\nok,,city,,,\nok2,x,planet,,,\nok3,x,city,,1,\nok4,x,city,,95,10\n'
);
assert.equal(bad.errors.length, 5);
assert.equal(
  parseLocationCsv('name,level\nx,city').errors[0].message.startsWith('Kolom wajib'),
  true
);
const dup = planImport(parseLocationCsv('slug,name,level\na,A,city\na,B,city\n').rows, new Map());
assert.equal(dup.errors.length, 1);
const orphan = planImport(
  parseLocationCsv(
    'slug,name,level,parent_slug\na,A,district,ghost\nb,B,district,b\nc,C,city,d\nd,D,district,\n'
  ).rows,
  new Map()
);
assert.equal(orphan.errors.length, 3); // ghost tidak ada, parent diri sendiri, induk (city) tidak lebih tinggi dari... c->d: d district lebih rendah dari city
const rank = planImport(
  parseLocationCsv('slug,name,level,parent_slug\np,P,province,\nx,X,province,p\n').rows,
  new Map()
);
assert.equal(rank.errors.length, 1);

console.log('csv.check: OK');
