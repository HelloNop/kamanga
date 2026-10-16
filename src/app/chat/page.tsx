import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import ChatView, { type Coverage, type PeekItem } from '@/features/chat/components/chat-view';
import { VERIFICATION_LABELS } from '@/features/listings/constants/listing-options';
import { loadUiMessages, sessionExists } from '@/lib/kamanga-ai/chat-store';
import { SESSION_COOKIE } from '@/lib/kamanga-ai/request';
import { doorChips } from '@/lib/kamanga-ai/router';

export const metadata: Metadata = {
  title: 'Kamanga AI',
  description:
    'Asisten urusan sehari-hari warga Padang: main, rawat diri, berangkat, servis, dan mencari tempat.'
};

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  const initialMessages = (await sessionExists(sid)) ? await loadUiMessages(sid!, 40) : [];
  const q = (await searchParams).q;
  const initialQuery = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 500) || null;

  // Tombol awal: pintu yang aktif (data, bisa diubah admin).
  const starters = (await doorChips()).slice(0, 6);

  const [c] = (
    await db.execute(sql`
    select count(*) filter (where level = 'city')::int as cities, count(*) filter (where level = 'district')::int as districts,
           count(*) filter (where level = 'village')::int as villages from locations`)
  ).rows as unknown as Coverage[];

  // Intip hasil di dasar layar: tiga listing terbit yang paling lengkap dan terverifikasi (data asli, bukan contoh buatan).
  const peekRows = (
    await db.execute(sql`
    select l.id, l.name, c.name as category, loc.name as place, l.verification_level::text as ver
    from listings l
    left join listing_categories lc on lc.listing_id = l.id and lc.is_primary
    left join categories c on c.id = lc.category_id
    left join locations loc on loc.id = l.location_id
    where l.status = 'published'
    order by l.verification_level desc, (l.whatsapp is not null) desc, l.updated_at desc
    limit 3`)
  ).rows as {
    id: number;
    name: string;
    category: string | null;
    place: string | null;
    ver: string;
  }[];
  const peek: PeekItem[] = peekRows.map((r) => ({
    id: r.id,
    name: r.name,
    meta: [
      r.category,
      r.place,
      r.ver !== 'unverified' ? VERIFICATION_LABELS[r.ver as keyof typeof VERIFICATION_LABELS] : null
    ]
      .filter(Boolean)
      .join(' · ')
  }));

  return (
    <ChatView
      initialMessages={initialMessages}
      initialQuery={initialQuery}
      starters={starters}
      coverage={c}
      peek={peek}
    />
  );
}
