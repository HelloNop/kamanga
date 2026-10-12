// Penyeragaman teks untuk mencocokkan kata warga. Murni (tanpa database), jadi aman dipakai di klien.

/** huruf kecil, tanpa aksen, tanda baca jadi spasi. Harus sama dengan `normSql` di understand.ts. */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Daftar sebutan lain yang bersih: diseragamkan, tanpa duplikat, minimal 2 karakter. */
export const normAliases = (list: string[]) => [
  ...new Set(list.map(norm).filter((a) => a.length >= 2))
];
