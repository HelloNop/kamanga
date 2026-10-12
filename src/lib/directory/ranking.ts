// Ranking listing. Murni (tanpa database), semua bobot ada di sini agar mudah dibaca dan disetel.
//
// skor = rata-rata berbobot dari sinyal yang BERLAKU untuk pencarian itu (bobot dinormalkan):
//   relevansi    kesesuaian kategori dan kata kunci
//   geo          kedekatan: satu tempat, satu kota, melayani area itu, atau jarak
//   verifikasi   belum 0 / kontak dicek 0,6 / dicek langsung 1
//   kelengkapan  seberapa lengkap profilnya
//   harga        kecocokan dengan anggaran (hanya bila anggaran diberikan)

// Lokasi sengaja lebih berat daripada kelengkapan profil: untuk kebutuhan lokal, yang benar-benar dekat
// lebih berguna daripada yang profilnya rapi tetapi jauh.
export const WEIGHTS = {
  relevance: 0.4,
  geo: 0.3,
  verification: 0.15,
  completeness: 0.1,
  price: 0.05
} as const;
export type SignalName = keyof typeof WEIGHTS;

export type Signals = Partial<Record<SignalName, number>> & {
  verification: number;
  completeness: number;
};
export type ScoreParts = Partial<Record<SignalName, { value: number; weight: number }>>;

export const MIN_TEXT_RELEVANCE = 0.35; // di bawah ini dianggap tidak nyambung bila pencarian hanya berdasar kata
export const PRIMARY_CATEGORY = 1;
export const EXTRA_CATEGORY = 0.7;

export const verificationScore = (level: string) =>
  ({ unverified: 0, contact_checked: 0.6, visited: 1 })[level] ?? 0;

export function scoreOf(s: Signals): { score: number; parts: ScoreParts } {
  const active = (Object.keys(WEIGHTS) as SignalName[]).filter((k) => s[k] !== undefined);
  const total = active.reduce((a, k) => a + WEIGHTS[k], 0);
  const parts: ScoreParts = {};
  let score = 0;
  for (const k of active) {
    const weight = WEIGHTS[k] / total;
    parts[k] = { value: s[k]!, weight };
    score += weight * s[k]!;
  }
  return { score, parts };
}

/** Gabungan kecocokan kategori dan kata. Bila keduanya ada, kategori lebih menentukan. */
export function relevanceOf(
  categoryMatch: number | null,
  textRelevance: number | null
): number | undefined {
  if (categoryMatch !== null && textRelevance !== null)
    return 0.6 * categoryMatch + 0.4 * textRelevance;
  return categoryMatch ?? textRelevance ?? undefined;
}

export type GeoInput = {
  samePlace: boolean;
  sameParent: boolean;
  coversArea: boolean;
  online: boolean;
  distKm: number | null;
  radiusKm: number;
};
export function geoScore(g: GeoInput): number {
  const proximity = g.distKm === null ? 0 : Math.max(0, 1 - g.distKm / g.radiusKm);
  return Math.max(
    g.samePlace ? 1 : 0,
    g.sameParent ? 0.7 : 0,
    g.coversArea ? 0.8 : 0,
    g.online ? 0.5 : 0,
    proximity
  );
}

export type Completeness = {
  hasContact: boolean;
  hasSummary: boolean;
  hasDescription: boolean;
  hasLocation: boolean;
  hasCoords: boolean;
  hasPrice: boolean;
  hasLinks: boolean;
  infoOnly: boolean; // objek wisata umum: tidak dihukum karena tanpa kontak
};
export function completenessScore(c: Completeness): number {
  return (
    ((c.hasContact || c.infoOnly ? 0.3 : 0) +
      (c.hasSummary ? 0.15 : 0) +
      (c.hasDescription ? 0.1 : 0) +
      (c.hasLocation ? 0.15 : 0) +
      (c.hasCoords ? 0.1 : 0) +
      (c.hasPrice ? 0.1 : 0) +
      (c.hasLinks ? 0.1 : 0)) *
    1
  );
}

/** undefined bila tidak ada anggaran. `null` = harus dikeluarkan dari hasil (melebihi anggaran). */
export function priceScore(
  l: { min: number | null; max: number | null; unit: string | null },
  budget: { max: number; unit?: string } | undefined
): number | undefined | null {
  if (!budget) return undefined;
  if (l.min === null || (budget.unit && l.unit && l.unit !== budget.unit)) return 0.4; // tidak bisa dibandingkan
  if (l.min > budget.max) return null;
  if (l.max === null) return 0.85;
  return l.max <= budget.max ? 1 : 0.7;
}

const km = (n: number) => `${n < 10 ? n.toFixed(1).replace('.', ',') : Math.round(n)} km`;

/** Alasan singkat dalam Bahasa Indonesia, untuk ditampilkan ke admin (dan nanti dijelaskan chatbot). */
export function reasonsOf(p: {
  catMatch: number | null;
  textRel: number | null;
  geo: {
    samePlace: boolean;
    sameParent: boolean;
    coversArea: boolean;
    online: boolean;
    distKm: number | null;
  };
  verification: string;
  completeness: number;
  priceScore: number | undefined | null;
}): string[] {
  const r: string[] = [];
  if (p.catMatch === PRIMARY_CATEGORY) r.push('kategori utama cocok');
  else if (p.catMatch === EXTRA_CATEGORY) r.push('kategori tambahan cocok');
  if (p.textRel !== null && p.textRel >= 0.5) r.push('kata kunci cocok');
  if (p.geo.samePlace) r.push('di lokasi yang sama');
  else if (p.geo.coversArea) r.push('melayani area ini');
  else if (p.geo.sameParent) r.push('satu kota/kecamatan induk');
  else if (p.geo.online) r.push('layanan daring');
  if (p.geo.distKm !== null) r.push(`${km(p.geo.distKm)} dari titik`);
  if (p.verification === 'visited') r.push('dicek langsung');
  else if (p.verification === 'contact_checked') r.push('kontak sudah dicek');
  r.push(`profil ${Math.round(p.completeness * 100)}% lengkap`);
  if (p.priceScore === 1) r.push('sesuai anggaran');
  else if (p.priceScore === 0.7) r.push('sebagian harga dalam anggaran');
  else if (p.priceScore === 0.4) r.push('harga belum bisa dibandingkan');
  return r;
}
