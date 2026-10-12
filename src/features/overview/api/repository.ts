// Angka ringkasan dashboard. TANPA pemeriksaan login: hanya diimpor oleh service.ts.
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import type { Overview } from './types';

const rows = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];

export async function getOverview(): Promise<Overview> {
  const [l] = await rows<Record<string, number>>(sql`
    select count(*)::int as total,
      count(*) filter (where status = 'published')::int as published,
      count(*) filter (where status = 'pending_review')::int as pending_review,
      count(*) filter (where status = 'draft')::int as draft,
      count(*) filter (where status = 'rejected')::int as rejected,
      count(*) filter (where status = 'archived')::int as archived,
      count(*) filter (where status = 'published' and verification_level = 'visited')::int as visited,
      count(*) filter (where status = 'published' and verification_level = 'contact_checked')::int as contact_checked,
      count(*) filter (where status = 'published' and verification_level = 'unverified')::int as unverified,
      count(*) filter (where status = 'published' and coalesce(whatsapp, '') = '')::int as no_whatsapp
    from listings`);

  const [c] = await rows<Record<string, number>>(sql`
    select
      (select count(*)::int from chat_sessions where created_at >= now() - interval '7 days') as sessions,
      (select count(*)::int from chat_messages where role = 'user' and created_at >= now() - interval '7 days') as messages,
      (select count(*)::int from chat_events where type = 'whatsapp_click' and created_at >= now() - interval '7 days') as clicks,
      (select count(distinct session_id)::int from chat_events where type = 'whatsapp_click' and created_at >= now() - interval '7 days') as clicked_sessions,
      (select count(*)::int from llm_calls where created_at >= now() - interval '7 days') as llm_calls,
      (select coalesce(sum(cost_usd), 0)::float8 from llm_calls where created_at >= now() - interval '7 days') as cost_usd`);

  const routeRows = await rows<{ route: string; n: number }>(sql`
    select route::text as route, count(*)::int as n from chat_messages
    where role = 'assistant' and route is not null and created_at >= now() - interval '7 days'
    group by route`);
  const routes = { template: 0, rules: 0, llm: 0, limit: 0, error: 0 };
  for (const r of routeRows) if (r.route in routes) routes[r.route as keyof typeof routes] = r.n;

  const [d] = await rows<Record<string, number>>(sql`
    select (select count(*)::int from categories) as categories,
      (select count(*)::int from needs) as needs,
      (select count(*)::int from locations where level = 'city') as cities,
      (select count(*)::int from locations where level = 'district') as districts,
      (select count(*)::int from locations where level = 'village') as villages`);

  const groups = await rows<{ name: string; n: number }>(sql`
    select g.name, count(distinct l.id)::int as n
    from listings l
    join listing_categories lc on lc.listing_id = l.id and lc.is_primary
    join categories c on c.id = lc.category_id
    join category_groups g on g.id = c.group_id
    where l.status = 'published'
    group by g.name order by n desc, g.name limit 7`);

  const topCategories = await rows<{ name: string; grp: string; n: number }>(sql`
    select c.name, g.name as grp, count(distinct l.id)::int as n
    from listings l
    join listing_categories lc on lc.listing_id = l.id and lc.is_primary
    join categories c on c.id = lc.category_id
    join category_groups g on g.id = c.group_id
    where l.status = 'published'
    group by c.id, c.name, g.name order by n desc, c.name limit 5`);

  const recentChats = await rows<{ text: string; route: string | null; at: string }>(sql`
    select m.content as text,
      (select a.route::text from chat_messages a
        where a.session_id = m.session_id and a.role = 'assistant' and a.id > m.id
        order by a.id limit 1) as route,
      (to_json(m.created_at) #>> '{}') as at
    from chat_messages m where m.role = 'user' order by m.id desc limit 5`);

  return {
    groups: groups.map((g) => ({ name: g.name, count: g.n })),
    topCategories: topCategories.map((c) => ({ name: c.name, group: c.grp, count: c.n })),
    recentChats,
    listings: {
      total: l.total,
      published: l.published,
      pendingReview: l.pending_review,
      draft: l.draft,
      rejected: l.rejected,
      archived: l.archived,
      visited: l.visited,
      contactChecked: l.contact_checked,
      unverified: l.unverified,
      noWhatsapp: l.no_whatsapp
    },
    chat: {
      sessions: c.sessions,
      messages: c.messages,
      clicks: c.clicks,
      clickedSessions: c.clicked_sessions,
      llmCalls: c.llm_calls,
      costUsd: Number(c.cost_usd),
      routes
    },
    directory: {
      categories: d.categories,
      needs: d.needs,
      cities: d.cities,
      districts: d.districts,
      villages: d.villages
    }
  };
}
