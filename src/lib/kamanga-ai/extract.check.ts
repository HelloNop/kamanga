// Pemeriksaan cepat: bun run check:extract
import assert from 'node:assert/strict';
import { extractBudget, extractCapacity, isGreeting, isMenuRequest, isThanks } from './extract';

// anggaran
assert.deepEqual(extractBudget('katering budget 40rb per orang'), {
  max: 40000,
  unit: 'per_person'
});
assert.deepEqual(extractBudget('maksimal Rp 2 juta'), { max: 2_000_000, unit: undefined });
assert.deepEqual(extractBudget('di bawah 500.000 per hari'), { max: 500000, unit: 'per_day' });
assert.deepEqual(extractBudget('anggaran 1,5 juta'), { max: 1_500_000, unit: undefined });
assert.deepEqual(extractBudget('cari yang 50k saja'), { max: 50000, unit: undefined });
assert.equal(extractBudget('gedung untuk 300 orang'), undefined); // jumlah orang bukan anggaran
assert.equal(extractBudget('budget 5'), undefined);
assert.equal(extractBudget('servis ac di lubeg'), undefined);

// kapasitas
assert.equal(extractCapacity('gedung untuk 300 tamu'), 300);
assert.equal(extractCapacity('kapasitas minimal 500'), 500);
assert.equal(extractCapacity('baralek 1.200 orang'), 1200);
assert.equal(extractCapacity('katering 40rb per orang'), undefined); // "per orang" bukan kapasitas
assert.equal(extractCapacity('3 orang'), undefined); // terlalu kecil untuk jadi kapasitas gedung

// sapaan, terima kasih, menu
for (const g of ['halo', 'Hai Kamanga', 'Assalamualaikum', 'selamat pagi uda', 'tes'])
  assert.ok(isGreeting(g), g);
for (const n of ['halo, onda saya mogok di lubeg', 'servis ac', 'pagi ini ac saya rusak'])
  assert.equal(isGreeting(n), false, n);
assert.ok(
  isThanks('makasih ya uda') &&
    isThanks('terima kasih banyak') &&
    !isThanks('cari katering terima kasih'.repeat(2))
);
assert.ok(
  isMenuRequest('bisa apa saja?') &&
    isMenuRequest('menu') &&
    !isMenuRequest('cari menu katering untuk 100 orang di padang')
);

console.log('extract.check: OK');
