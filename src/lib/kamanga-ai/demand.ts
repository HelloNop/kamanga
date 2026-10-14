// Mencatat tiap pencarian direktori. Pencarian tanpa hasil adalah sinyal usaha apa yang perlu dicari
// dan didaftarkan lebih dulu (halaman admin "Permintaan").
import { db } from '@/db';
import { searchLogs } from '@/db/schema';
import { norm } from '@/lib/directory/norm';
import type { Outcome, SearchArgs } from './search-tool';
import type { ChatState } from './types';

export async function logSearch(args: SearchArgs, o: Outcome) {
  if (!args.meta) return;
  const query = args.query?.trim().slice(0, 200) || null;
  const names = o.status === 'ok' ? o.categories : (args.labels?.names ?? []);
  // Kategori dikenal: kelompokkan menurut kategorinya. Tidak dikenal: menurut kata yang dicari.
  const label = (names.length ? names.join(' + ') : (query ?? '')).slice(0, 80);
  const needKey = norm(label).slice(0, 80);
  if (!needKey) return;
  const ok = o.status === 'ok';
  await db.insert(searchLogs).values({
    sessionId: args.meta.sessionId,
    source: args.meta.source,
    status: o.status,
    query,
    needKey,
    label,
    locationId: ok ? (o.location?.id ?? null) : (args.locationId ?? null),
    locationName: ok ? (o.location?.name ?? null) : null,
    resultCount: ok ? o.total : 0,
    altCount: ok ? Math.max(0, ...o.alternatives.map((a) => a.count)) : 0
  });
}

/** Catatan pencarian lewat mesin (findProviders), dengan bentuk yang sama agar halaman "Permintaan" tetap utuh. */
export async function logProviderSearch(
  sessionId: string,
  source: 'rules' | 'llm',
  s: ChatState,
  r: { total: number; relaxCount: number }
) {
  const label = (s.categories ?? [])
    .map((c) => c.name)
    .join(' + ')
    .slice(0, 80);
  const needKey = norm(label).slice(0, 80);
  if (!needKey) return;
  await db.insert(searchLogs).values({
    sessionId,
    source,
    status: 'ok',
    query: null,
    needKey,
    label,
    locationId: s.region?.id ?? null,
    locationName: s.region?.label ?? null,
    resultCount: r.total,
    altCount: r.relaxCount
  });
}
