// Beranda "Kamanga hari ko?" (PRD 8.1): chat lebih dulu, pintu sebagai slider jalan pintas di atas kolom ketik.
// Pintu, urutan, ikon, dan status dari tabel doors (diatur admin). Tanpa akun dan tanpa AI sampai warga mengirim.
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import ChatView from '@/features/chat/components/chat-view';
import { getHomeDoors } from '@/features/warga/api/repository';
import { loadUiMessages, sessionExists } from '@/lib/kamanga-ai/chat-store';
import { SESSION_COOKIE } from '@/lib/kamanga-ai/request';
import { getSession, isCitizen } from '@/lib/session';

export const metadata: Metadata = {
  title: { absolute: 'Kamanga hari ko?' },
  description:
    'Asisten urusan sehari-hari warga Padang: main, rawat diri, berangkat, servis, dan mencari tempat.'
};

export default async function Home({
  searchParams
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  const [initialMessages, doors, session] = await Promise.all([
    sessionExists(sid).then((ok) => (ok ? loadUiMessages(sid!, 40) : [])),
    getHomeDoors(),
    getSession()
  ]);
  const q = (await searchParams).q;
  const initialQuery = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 500) || null;

  return (
    <ChatView
      initialMessages={initialMessages}
      initialQuery={initialQuery}
      doors={doors.map((d) => ({
        slug: d.slug,
        name: d.name,
        icon: d.icon,
        description: d.description,
        soon: d.status !== 'active'
      }))}
      signedIn={isCitizen(session)}
    />
  );
}
