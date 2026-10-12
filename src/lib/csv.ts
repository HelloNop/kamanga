// Pengurai CSV umum (hasil ekspor Excel / Google Sheets). Fungsi murni.

/** Pengurai CSV sesuai RFC 4180 (kutip ganda, koma/baris baru di dalam kutip). */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') ((cell += '"'), i++);
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) (row.push(cell), (cell = ''));
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) (row.push(cell), rows.push(row));
  return rows;
}

/** Excel Indonesia mengekspor dengan titik koma; Google Sheets dengan koma. Pilih yang paling sering muncul di baris judul. */
export function detectDelimiter(text: string): string {
  const header = text.split(/\r?\n/, 1)[0] ?? '';
  return [',', ';', '\t'].reduce(
    (best, d) => (header.split(d).length > header.split(best).length ? d : best),
    ','
  );
}
