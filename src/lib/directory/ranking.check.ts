// Pemeriksaan cepat: bun run check:ranking
import assert from 'node:assert/strict';
import {
  completenessScore,
  geoScore,
  priceScore,
  relevanceOf,
  scoreOf,
  verificationScore,
  WEIGHTS
} from './ranking';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

// bobot dinormalkan hanya atas sinyal yang berlaku
close(
  Object.values(WEIGHTS).reduce((a, b) => a + b, 0),
  1
);
const all = scoreOf({ relevance: 1, geo: 1, verification: 1, completeness: 1, price: 1 });
close(all.score, 1);
const noGeo = scoreOf({ relevance: 1, verification: 0, completeness: 0 }); // geo & price tidak berlaku
close(
  noGeo.score,
  WEIGHTS.relevance / (WEIGHTS.relevance + WEIGHTS.verification + WEIGHTS.completeness)
);
assert.equal(noGeo.parts.geo, undefined);
close(
  Object.values(noGeo.parts).reduce((a, p) => a + p!.weight, 0),
  1
);

// monotonik: verifikasi lebih tinggi / profil lebih lengkap tidak pernah menurunkan skor
const base = { relevance: 0.8, geo: 0.5, completeness: 0.5 };
assert.ok(
  scoreOf({ ...base, verification: 1 }).score > scoreOf({ ...base, verification: 0.6 }).score
);
assert.ok(
  scoreOf({ ...base, verification: 0.6 }).score > scoreOf({ ...base, verification: 0 }).score
);

// kategori utama mengalahkan kategori tambahan; kata membantu tapi tidak menggantikan kategori
assert.ok(relevanceOf(1, 0.2)! > relevanceOf(0.7, 0.2)!);
assert.ok(
  relevanceOf(1, null)! === 1 &&
    relevanceOf(null, 0.5) === 0.5 &&
    relevanceOf(null, null) === undefined
);

// lokasi berbobot lebih besar daripada kelengkapan profil
assert.ok(WEIGHTS.geo > WEIGHTS.completeness);
// geo: tempat yang sama > melayani area > satu induk > daring; jarak turun linear
const g = (o: Partial<Parameters<typeof geoScore>[0]>) =>
  geoScore({
    samePlace: false,
    sameParent: false,
    coversArea: false,
    online: false,
    distKm: null,
    radiusKm: 10,
    ...o
  });
assert.equal(g({ samePlace: true }), 1);
assert.ok(
  g({ coversArea: true }) > g({ sameParent: true }) && g({ sameParent: true }) > g({ online: true })
);
close(g({ distKm: 2 }), 0.8);
assert.equal(g({ distKm: 25 }), 0);
assert.equal(g({}), 0);

// verifikasi
assert.deepEqual(['unverified', 'contact_checked', 'visited'].map(verificationScore), [0, 0.6, 1]);

// kelengkapan: wisata umum tanpa kontak tidak dihukum
const empty = {
  hasContact: false,
  hasSummary: false,
  hasDescription: false,
  hasLocation: false,
  hasCoords: false,
  hasPrice: false,
  hasLinks: false,
  infoOnly: false
};
assert.equal(completenessScore(empty), 0);
close(completenessScore({ ...empty, infoOnly: true }), 0.3);
close(
  completenessScore({
    hasContact: true,
    hasSummary: true,
    hasDescription: true,
    hasLocation: true,
    hasCoords: true,
    hasPrice: true,
    hasLinks: true,
    infoOnly: false
  }),
  1
);

// harga
const b = { max: 100000, unit: 'per_person' };
assert.equal(priceScore({ min: 1, max: 1, unit: 'per_person' }, undefined), undefined);
assert.equal(priceScore({ min: 50000, max: 80000, unit: 'per_person' }, b), 1);
assert.equal(priceScore({ min: 50000, max: 150000, unit: 'per_person' }, b), 0.7);
assert.equal(priceScore({ min: 50000, max: null, unit: 'per_person' }, b), 0.85);
assert.equal(priceScore({ min: 200000, max: 300000, unit: 'per_person' }, b), null); // melebihi anggaran: keluar
assert.equal(priceScore({ min: null, max: null, unit: null }, b), 0.4); // harga tidak diketahui: tetap muncul, skor rendah
assert.equal(priceScore({ min: 5000000, max: null, unit: 'per_event' }, b), 0.4); // satuan beda: tidak dibandingkan

console.log('ranking.check: OK');
