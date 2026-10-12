# Mengubah wilayah.sql (hanya dibaca sebagai teks) menjadi CSV Sumbar siap impor.
import csv, re, sys, unicodedata
src, curated_csv, out = sys.argv[1:4]

def slugify(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'-+$', '', re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', s))[:80])

norm = lambda s: re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()

# 1) baca baris Sumbar (kode 13...)
line_re = re.compile(r"^\('(13[0-9.]*)','((?:[^'\\]|\\.|'')*)'\)[,;]?\s*$")
rows = []
for line in open(src, encoding='utf-8'):
    m = line_re.match(line)
    if m:
        rows.append((m.group(1), m.group(2).replace("\\'", "'").replace("''", "'").strip()))
by_len = lambda n: [r for r in rows if len(r[0]) == n]
prov, kabkota, kec, vil = by_len(2), by_len(5), by_len(8), by_len(13)
print(f"dibaca: provinsi={len(prov)} kota/kab={len(kabkota)} kecamatan={len(kec)} nagari/kelurahan={len(vil)}")
assert len(prov) == 1 and len(kabkota) == 19, "struktur tidak sesuai harapan"

# 2) petakan ke data kurasi yang sudah ada (slug lama dipertahankan)
cur = list(csv.DictReader(open(curated_csv, encoding='utf-8')))
slug_of_kab = {norm(r['name']): r['slug'] for r in cur if r['level'] in ('kota', 'kabupaten')}
slug_of_kec = {(r['parent_slug'], norm(r['name'])): r['slug'] for r in cur if r['level'] == 'kecamatan'}
slug_of_vil = {(r['parent_slug'], norm(r['name'])): r['slug'] for r in cur if r['level'] == 'kelurahan'}
used = {r['slug'] for r in cur}

kab_slug = {}
for kode, nama in kabkota:
    key = norm(nama)
    if key not in slug_of_kab:
        sys.exit(f"Kota/kabupaten resmi tidak ada di data kurasi: {nama}")
    kab_slug[kode] = slug_of_kab[key]
print("19 kota/kabupaten resmi cocok semua dengan data kurasi")

new_rows, kec_slug, matched_kec, new_kec = [], {}, 0, 0
for kode, nama in kec:
    parent = kab_slug[kode[:5]]
    if (parent, norm(nama)) in slug_of_kec:
        kec_slug[kode] = slug_of_kec[(parent, norm(nama))]; matched_kec += 1; continue
    slug = slugify(f"{nama} {parent.removeprefix('kab-')}")
    assert slug not in used, f"slug kecamatan bentrok: {slug}"
    used.add(slug); kec_slug[kode] = slug; new_kec += 1
    new_rows.append([slug, nama, 'kecamatan', parent, '', '', ''])

curated_kec_missing = [r['name'] for r in cur if r['level'] == 'kecamatan' and r['slug'] not in set(kec_slug.values())]
print(f"kecamatan: {matched_kec} cocok dengan data kurasi, {new_kec} baru; kurasi yang TIDAK ada di data resmi: {curated_kec_missing or 'tidak ada'}")

matched_vil = new_vil = 0
for kode, nama in vil:
    parent = kec_slug[kode[:8]]
    level = 'kelurahan' if kode.split('.')[-1].startswith('1') else 'nagari'
    if (parent, norm(nama)) in slug_of_vil:
        matched_vil += 1; continue
    slug = slugify(f"{nama} {parent}")
    if slug in used: slug = slugify(f"{nama} {parent}")[:75].rstrip('-') + '-' + kode[-4:]
    assert slug not in used, f"slug bentrok: {slug}"
    used.add(slug); new_vil += 1
    new_rows.append([slug, nama, level, parent, '', '', ''])
print(f"nagari/kelurahan: {matched_vil} cocok dengan data kurasi, {new_vil} baru")

with open(out, 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f, lineterminator='\n')
    w.writerow(['slug', 'name', 'level', 'parent_slug', 'lat', 'lng', 'aliases'])
    w.writerows(new_rows)
print(f"ditulis {len(new_rows)} baris ke {out}")
