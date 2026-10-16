// Laporan "permintaan belum terpenuhi". TANPA pemeriksaan login: hanya diimpor oleh service.ts.
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import type { DemandPeriod, DemandReport, DemandRow, QuestionRow } from './types';

export async function getDemandReport(days: DemandPeriod): Promise<DemandReport> {
  const since = sql`now() - make_interval(days => ${days})`;
  const [totals, unmet] = await Promise.all([
    db.execute(sql`
      select count(*)::int as total,
             count(*) filter (where status = 'ok' and result_count = 0)::int as unmet
      from search_logs where created_at >= ${since}`),
    db.execute(sql`
      select need_key as key,
             (array_agg(label order by created_at desc))[1] as label,
             count(*)::int as searches,
             count(distinct session_id)::int as people,
             max(created_at) as last_at,
             coalesce((array_agg(distinct location_name) filter (where location_name is not null))[1:4], '{}') as places,
             coalesce((array_agg(query order by created_at desc) filter (where query is not null))[1:3], '{}') as examples,
             bool_and(alt_count > 0) as elsewhere
      from search_logs
      where status = 'ok' and result_count = 0 and created_at >= ${since}
      group by need_key
      order by searches desc, last_at desc
      limit 100`)
  ]);
  const t = (totals.rows[0] ?? { total: 0, unmet: 0 }) as { total: number; unmet: number };
  return {
    days,
    totalSearches: t.total,
    unmetSearches: t.unmet,
    rows: (unmet.rows as Record<string, unknown>[]).map(
      (r): DemandRow => ({
        key: String(r.key),
        label: String(r.label),
        searches: Number(r.searches),
        people: Number(r.people),
        lastAt: new Date(r.last_at as string).toISOString(),
        places: (r.places as string[]) ?? [],
        examples: (r.examples as string[]) ?? [],
        elsewhere: r.elsewhere === true
      })
    )
  };
}

export async function listUnansweredQuestions(): Promise<QuestionRow[]> {
  const res = await db.execute(sql`
    select qa.id, qa.question, qa.created_at, l.id as listing_id, l.name, l.whatsapp,
      c.name as category, loc.name as place
    from listing_qa qa
    join listings l on l.id = qa.listing_id
    left join listing_categories lc on lc.listing_id = l.id and lc.is_primary
    left join categories c on c.id = lc.category_id
    left join locations loc on loc.id = l.location_id
    where qa.answer is null
    order by qa.created_at
    limit 100`);
  return (res.rows as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    question: String(r.question),
    createdAt: new Date(r.created_at as string).toISOString(),
    listing: {
      id: Number(r.listing_id),
      name: String(r.name),
      whatsapp: (r.whatsapp as string | null) ?? null
    },
    category: (r.category as string | null) ?? null,
    place: (r.place as string | null) ?? null
  }));
}

export async function getQuestion(id: number) {
  const res = await db.execute(sql`
    select qa.question, qa.answer, l.name, l.whatsapp
    from listing_qa qa join listings l on l.id = qa.listing_id
    where qa.id = ${id}`);
  const r = res.rows[0] as
    | { question: string; answer: string | null; name: string; whatsapp: string | null }
    | undefined;
  return r ?? null;
}
