// Pemeriksaan tampilan TANPA browser (agent-penguji, Gelombang 4): kontras teks WCAG 4.5:1 dari token CSS,
// target sentuh 44 px, dan lebar tetap yang memaksa gulir ke samping di layar 360 px. Hanya membaca berkas.
// Ini pemeriksaan statis (aturan CSS per aturan, latar diambil dari aturan itu sendiri atau latar dasar
// cakupannya), jadi tetap perlu dilihat di browser 360 px sebelum rilis.
// Jalankan: bun run tests/tampilan.check.ts   (usulan script: check:tampilan)
/* oxlint-disable no-console -- skrip uji: hasilnya dicetak ke terminal */
import { readFileSync } from 'node:fs';

type Rule = {
  file: string;
  line: number;
  selector: string;
  media: string;
  decls: Record<string, string>;
};

/** Pengurai CSS sederhana: aturan biasa dan @media/@supports; @keyframes, @property, @font-face dilewati. */
function parseCss(file: string): Rule[] {
  const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, ' ')
  );
  const rules: Rule[] = [];
  const stack: { kind: 'media' | 'skip' | 'rule'; head: string; line: number }[] = [];
  let buf = '';
  let line = 1;
  for (const ch of src) {
    if (ch === '\n') line++;
    if (ch === '{') {
      const head = buf.trim();
      buf = '';
      const inSkip = stack.some((s) => s.kind === 'skip');
      const kind = /^@(media|supports)/.test(head)
        ? 'media'
        : head.startsWith('@') || inSkip
          ? 'skip'
          : 'rule';
      stack.push({ kind, head, line });
    } else if (ch === '}') {
      const top = stack.pop();
      if (top?.kind === 'rule') {
        const decls: Record<string, string> = {};
        for (const d of buf.split(';')) {
          const i = d.indexOf(':');
          if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim();
        }
        const media = stack
          .filter((s) => s.kind === 'media')
          .map((s) => s.head)
          .join(' ');
        for (const selector of top.head.split(',').map((s) => s.trim()))
          rules.push({ file, line: top.line, selector, media, decls });
      }
      buf = '';
    } else buf += ch;
  }
  return rules;
}

// ───────────────────────────── warna dan kontras (WCAG 2.x) ─────────────────────────────

type RGBA = [number, number, number, number];
const NAMED: Record<string, RGBA> = {
  white: [255, 255, 255, 1],
  black: [0, 0, 0, 1],
  transparent: [0, 0, 0, 0]
};
function parseColor(v: string): RGBA | null {
  const s = v.trim().toLowerCase();
  if (NAMED[s]) return NAMED[s];
  const hex = s.match(/^#([0-9a-f]{3,8})$/)?.[1];
  if (hex) {
    const h = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  const fn = s.match(/^rgba?\(([^)]+)\)$/)?.[1];
  if (fn) {
    const p = fn.split(/[\s,/]+/).filter(Boolean);
    const a =
      p[3] === undefined ? 1 : p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3]);
    return [parseFloat(p[0]), parseFloat(p[1]), parseFloat(p[2]), a];
  }
  return null;
}
const channel = (c: number) => {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]: RGBA) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
/** Warna tembus pandang (alpha / opacity) dicampur di atas latarnya. */
const over = (fg: RGBA, bg: RGBA, alpha = fg[3]): RGBA => [
  fg[0] * alpha + bg[0] * (1 - alpha),
  fg[1] * alpha + bg[1] * (1 - alpha),
  fg[2] * alpha + bg[2] * (1 - alpha),
  1
];
export function contrast(fg: RGBA, bg: RGBA) {
  const solidBg = bg[3] < 1 ? over(bg, [255, 255, 255, 1]) : bg;
  const a = lum(over(fg, solidBg));
  const b = lum(solidBg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Uji kecil rumus: hitam/putih 21:1, #767676 di putih ≈ 4.54:1.
const near = (x: number, y: number) => Math.abs(x - y) < 0.02;
if (!near(contrast(NAMED.black, NAMED.white), 21)) throw new Error('rumus kontras salah');
if (!near(contrast(parseColor('#767676')!, NAMED.white), 4.54))
  throw new Error('rumus kontras salah');

// ───────────────────────────── cakupan token ─────────────────────────────

type Scope = {
  name: string;
  files: string[];
  /** Selektor akar yang memuat token, berurutan (yang belakangan menimpa). */
  roots: string[];
  /** Aturan berlaku bila selektornya diawali salah satu ini. */
  prefix: RegExp;
  /** Token latar dasar (dipakai bila aturan tidak memasang latar sendiri). */
  bgs: string[];
};
const WARGA = 'src/features/warga/warga.css';
const CHAT = 'src/features/chat/chat.css';
const JELAJAH = 'src/features/jelajah/jelajah.css';
const THEME = 'src/styles/themes/kamanga.css';
const SCOPES: Scope[] = [
  {
    name: 'warga',
    files: [WARGA],
    roots: ['.warga'],
    prefix: /^\.warga\b/,
    bgs: ['--paper', '--card']
  },
  {
    name: 'kmg terang',
    files: [CHAT, JELAJAH],
    roots: ['.kmg'],
    prefix: /^\.kmg\b/,
    bgs: ['--bg', '--surface']
  },
  {
    name: 'kmg gelap',
    files: [CHAT, JELAJAH],
    roots: ['.kmg', '.dark .kmg'],
    prefix: /^(\.dark )?\.kmg\b/,
    bgs: ['--bg', '--surface']
  }
];

const all = [...new Set(SCOPES.flatMap((s) => s.files))].flatMap(parseCss);
const tokensOf = (s: Scope) => {
  const t: Record<string, string> = {};
  for (const root of s.roots)
    for (const r of all.filter((x) => s.files.includes(x.file) && x.selector === root && !x.media))
      for (const [k, v] of Object.entries(r.decls)) if (k.startsWith('--')) t[k] = v;
  return t;
};
function resolve(v: string, t: Record<string, string>, depth = 0): string {
  if (depth > 8) return v;
  return v.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, k: string, fb?: string) =>
    resolve(t[k] ?? fb ?? '', t, depth + 1)
  );
}
/** Warna latar padat dari `background`/`background-color` (gradien dan url diabaikan). */
function bgColor(r: Rule, t: Record<string, string>) {
  const raw = r.decls['background-color'] ?? r.decls.background;
  if (!raw) return null;
  return parseColor(resolve(raw, t));
}

type Problem = { kind: string; where: string; detail: string };
const problems: Problem[] = [];
const where = (r: Rule) => `${r.file}:${r.line} ${r.selector}${r.media ? ` (${r.media})` : ''}`;

// 1. Kontras teks.
const LIGHT_TEXT = 0.5; // luminansi: teks terang tanpa latar sendiri dianggap berada di atas latar gelap induknya
for (const s of SCOPES) {
  const t = tokensOf(s);
  const dark = s.name.endsWith('gelap');
  for (const r of all.filter((x) => s.files.includes(x.file) && s.prefix.test(x.selector))) {
    if (!dark && r.selector.startsWith('.dark ')) continue;
    if (/:disabled|\[disabled\]|::placeholder|sr-only|:hover/.test(r.selector)) continue;
    const c = r.decls.color ? parseColor(resolve(r.decls.color, t)) : null;
    if (!c) continue;
    const own = bgColor(r, t);
    const bases = own && own[3] > 0 ? [own] : s.bgs.map((k) => parseColor(resolve(t[k] ?? '', t)));
    const opacity = r.decls.opacity ? parseFloat(r.decls.opacity) : 1;
    for (const bg of bases) {
      if (!bg) continue;
      if (!own && lum(c) > LIGHT_TEXT && lum(bg) > LIGHT_TEXT) continue;
      const fg: RGBA = opacity < 1 ? [c[0], c[1], c[2], c[3] * opacity] : c;
      const ratio = contrast(fg, bg);
      if (ratio < 4.5)
        problems.push({
          kind: 'kontras',
          where: `[${s.name}] ${where(r)}`,
          detail: `${resolve(r.decls.color, t)} di atas rgb(${bg.slice(0, 3).map(Math.round).join(' ')}) = ${ratio.toFixed(2)}:1${opacity < 1 ? ` (opacity ${opacity})` : ''}`
        });
    }
  }
}

// Token tema panel (dashboard mitra/admin, kelas Tailwind): pasangan yang dipakai di komponen mitra.
{
  const theme = parseCss(THEME);
  const tok = (dark: boolean) => {
    const t: Record<string, string> = {};
    for (const r of theme.filter(
      (x) =>
        x.selector === "[data-theme='kamanga']" ||
        (dark && x.selector === "[data-theme='kamanga'].dark")
    ))
      for (const [k, v] of Object.entries(r.decls)) if (k.startsWith('--')) t[k] = v;
    return t;
  };
  const pairs: [string, string][] = [
    ['--muted-foreground', '--card'],
    ['--muted-foreground', '--muted'],
    ['--muted-foreground', '--background'],
    ['--foreground', '--muted'],
    ['--primary', '--card'],
    ['--primary-foreground', '--primary'],
    ['--destructive', '--card'],
    ['--destructive-foreground', '--destructive'],
    ['--secondary-foreground', '--secondary'],
    ['--sidebar-foreground', '--sidebar']
  ];
  for (const dark of [false, true]) {
    const t = tok(dark);
    for (const [fg, bg] of pairs) {
      const a = parseColor(resolve(t[fg] ?? '', t));
      const b = parseColor(resolve(t[bg] ?? '', t));
      if (!a || !b) continue;
      const ratio = contrast(a, b);
      if (ratio < 4.5)
        problems.push({
          kind: 'kontras',
          where: `[tema panel ${dark ? 'gelap' : 'terang'}] ${THEME}`,
          detail: `${fg} (${t[fg]}) di atas ${bg} (${t[bg]}) = ${ratio.toFixed(2)}:1`
        });
    }
  }
}

// 2. Target sentuh: kontrol interaktif dengan tinggi/lebar eksplisit < 44 px.
const INTERACTIVE =
  /(^|[\s>+~(])(a|button|input|select|textarea|summary)\b|\[role=|btn|chip|slot|tab\b|close|toggle|send|stop|pill|link|cta|nav a|choice|opt/;
const px = (v: string | undefined, fontPx = 16) => {
  if (!v) return null;
  const m = v.match(/^(-?[\d.]+)(px|rem|em)$/);
  if (!m) return null;
  return m[2] === 'px' ? parseFloat(m[1]) : parseFloat(m[1]) * fontPx;
};
for (const r of all) {
  const parts = r.selector.split(/\s+(?![^[]*\])/);
  const last = parts.at(-1) ?? '';
  if (!INTERACTIVE.test(last) || /-icon\b|::?(before|after)|sr-only|:disabled/.test(last)) continue;
  // Kontrol di dalam label/pembungkus yang sendiri sudah ≥ 44 px (mis. kotak centang di dalam label).
  const parent = parts.slice(0, -1).join(' ');
  if (all.some((x) => x.selector === parent && (px(x.decls['min-height']) ?? 0) >= 44)) continue;
  // Kontrol yang disembunyikan (input di dalam label/pil) memakai ukuran induknya.
  if (r.decls.opacity === '0' || r.decls.position === 'absolute') continue;
  const minH = px(r.decls['min-height']) ?? px(r.decls.height);
  const minW = px(r.decls['min-width']) ?? px(r.decls.width);
  if (minH !== null && minH > 0 && minH < 44)
    problems.push({ kind: 'sentuh', where: where(r), detail: `tinggi ${minH}px < 44px` });
  if (minW !== null && minW > 0 && minW < 44 && (minH === null || minH < 44))
    problems.push({ kind: 'sentuh', where: where(r), detail: `lebar ${minW}px < 44px` });
}

// 3. Lebar tetap > 328 px (360 − 2 × 16 px tepi) di luar @media (min-width …): memaksa gulir ke samping.
//    Tidak dihitung bila selektor yang sama ditimpa di @media (max-width …) untuk layar sempit.
const overridden = (r: Rule, k: string) =>
  all.some(
    (x) => x !== r && x.selector === r.selector && /max-width/.test(x.media) && k in x.decls
  );
for (const r of all) {
  if (/min-width/.test(r.media)) continue;
  for (const k of ['width', 'min-width', 'flex-basis']) {
    const v = px(r.decls[k]);
    if (v !== null && v > 328 && !overridden(r, k))
      problems.push({ kind: '360px', where: where(r), detail: `${k}: ${r.decls[k]}` });
  }
  const cols = r.decls['grid-template-columns'];
  if (cols && !overridden(r, 'grid-template-columns')) {
    const sum = [...cols.matchAll(/(?<![\w(-])(\d+(?:\.\d+)?)(px|rem)\b/g)].reduce(
      (n, m) => n + parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1),
      0
    );
    if (sum > 328)
      problems.push({ kind: '360px', where: where(r), detail: `grid-template-columns: ${cols}` });
  }
}

// Kelas Tailwind di komponen warga/mitra yang mematok lebar > 328 px tanpa awalan responsif.
for (const file of [
  'src/features/mitra/components/booking-view.tsx',
  'src/features/mitra/components/booking-actions.tsx',
  'src/features/mitra/components/schedule-calendar.tsx',
  'src/features/mitra/components/schedule-editor.tsx',
  'src/features/mitra/components/qa-editor.tsx',
  'src/features/mitra/components/mitra-nav.tsx',
  'src/features/mitra/components/bits.tsx',
  'src/app/mitra/pesanan/t/[token]/page.tsx'
]) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(
    /(?<![\w:-])(?:w|min-w)-\[(\d+)px\]|(?<![\w:-])(?:w|min-w)-(\d+)\b/g
  )) {
    const n = m[1] ? Number(m[1]) : Number(m[2]) * 4;
    if (n > 328)
      problems.push({
        kind: '360px',
        where: `${file}:${src.slice(0, m.index).split('\n').length}`,
        detail: m[0]
      });
  }
}

for (const kind of ['kontras', 'sentuh', '360px']) {
  const list = problems.filter((p) => p.kind === kind);
  console.log(`\n${kind}: ${list.length} temuan`);
  for (const p of list) console.log(`  ${p.where}\n      ${p.detail}`);
}
console.log(
  problems.length ? '\ntampilan.check: ADA TEMUAN (periksa daftar di atas)' : '\ntampilan.check: OK'
);
process.exit(problems.length ? 1 : 0);
