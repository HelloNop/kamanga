'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import Link from 'next/link';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icons } from '@/components/icons';
import { VERIFICATION_LABELS } from '@/features/listings/constants/listing-options';
import { cn } from '@/lib/utils';
import type { CardItem, KamangaMessage } from '@/lib/kamanga-ai/types';
import { ITIK_PATH, ITIK_VIEWBOX } from './motif-strokes';
import { ThemeToggle } from './theme-toggle';

export type Coverage = { cities: number; districts: number; villages: number };
export type PeekItem = { id: number; name: string; meta: string };

const transport = new DefaultChatTransport({
  api: '/api/chat',
  // Server menyimpan riwayat sendiri; klien hanya mengirim pesan terbaru.
  prepareSendMessagesRequest: ({ messages }) => {
    const last = [...messages].reverse().find((m) => m.role === 'user');
    return {
      body: { text: last?.parts.map((p) => (p.type === 'text' ? p.text : '')).join('') ?? '' }
    };
  }
});

const MODE_LABEL: Record<string, string> = { on_call: 'Datang ke tempat Anda', online: 'Daring' };
const EXAMPLES = [
  'servis AC di Lubeg',
  'onda mogok di Bukittinggi',
  'gedung untuk 400 orang di Padang',
  'katering nasi kapau, budget 40rb per orang',
  'penginapan dekat Jam Gadang'
];
// Kata-kata judul muncul satu per satu, dari kabur ke tajam.
function Words({ text, from = 0 }: { text: string; from?: number }) {
  return text.split(' ').map((w, i) => (
    <Fragment key={i}>
      <span className='w' style={{ ['--w' as string]: from + i }}>
        {w}
      </span>{' '}
    </Fragment>
  ));
}

// Tiga "titik" menunggu berupa satu butir motif Itiak Pulang Patang, melompat bergantian.
function ItikDots() {
  return (
    <span className='itik-dots' aria-hidden='true'>
      {[0, 1, 2].map((n) => (
        <svg key={n} viewBox={ITIK_VIEWBOX} style={{ animationDelay: `${n * 0.16}s` }}>
          <path d={ITIK_PATH} />
        </svg>
      ))}
    </span>
  );
}

function Thinking() {
  return (
    <div className='think' role='status'>
      <ItikDots />
      <span className='sr-only'>Kamanga sedang mencari</span>
    </div>
  );
}

function trackClick(listingId: number) {
  try {
    navigator.sendBeacon(
      '/api/chat/event',
      new Blob([JSON.stringify({ type: 'whatsapp_click', listingId })], {
        type: 'application/json'
      })
    );
  } catch {
    /* pencatatan klik tidak boleh menghalangi pengguna */
  }
}

function ListingCard({ item, index }: { item: CardItem; index: number }) {
  const wa = item.whatsapp
    ? `https://wa.me/${item.whatsapp}?text=${encodeURIComponent(`Halo, saya melihat ${item.name} di Kamanga AI. Boleh tanya ketersediaannya?`)}`
    : null;
  const meta = [
    item.location,
    item.distanceKm !== null && `${item.distanceKm.toFixed(1).replace('.', ',')} km`,
    ...item.modes.map((m) => MODE_LABEL[m]).filter(Boolean)
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <article className='card fade-in' style={{ ['--i' as string]: index }}>
      {item.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className='thumb'
          src={item.photo}
          alt=''
          loading='lazy'
          // percakapan tersimpan bisa memuat foto yang sudah dihapus pemiliknya
          onError={(e) => e.currentTarget.remove()}
        />
      )}
      <h3>
        {item.slug ? (
          <Link className='card-link' href={`/listing/${item.slug}`}>
            {item.name}
          </Link>
        ) : (
          item.name
        )}
      </h3>
      <div className='row'>
        {item.category && <span className='tag'>{item.category}</span>}
        {item.verification !== 'unverified' && (
          <span className='tag ok'>
            {VERIFICATION_LABELS[item.verification as keyof typeof VERIFICATION_LABELS]}
          </span>
        )}
      </div>
      {meta && <p className='meta'>{meta}</p>}
      {item.price && (
        <p className='meta'>
          <b>{item.price}</b>
        </p>
      )}
      {wa ? (
        <a
          className='wa'
          href={wa}
          target='_blank'
          rel='noopener noreferrer'
          onClick={() => trackClick(item.id)}
        >
          Hubungi via WhatsApp
        </a>
      ) : (
        <p className='meta'>Kontak belum tersedia.</p>
      )}
    </article>
  );
}

export default function ChatView({
  initialMessages,
  starters,
  coverage,
  peek
}: {
  initialMessages: KamangaMessage[];
  starters: string[];
  coverage: Coverage;
  peek: PeekItem[];
}) {
  const { messages, sendMessage, setMessages, regenerate, stop, status } = useChat<KamangaMessage>({
    messages: initialMessages,
    transport
  });
  const [input, setInput] = useState('');
  // Jawaban macet (tidak ada kabar apa pun terlalu lama): dihentikan dan ditawarkan coba lagi.
  const [stalled, setStalled] = useState(false);
  const [example, setExample] = useState(0);
  // Pesan warga terbaru yang sedang dijadikan patokan gulir, dan apakah gulir otomatis masih berlaku.
  const anchoredTo = useRef<string | null>(null);
  const follow = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const planetRef = useRef<HTMLDivElement>(null);
  const busy = status === 'submitted' || status === 'streaming';
  const chatting = messages.length > 0;
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const waitingForReply = busy && messages.at(-1)?.role === 'user';
  // Jawaban sudah dimulai (mis. kartu tampil) tetapi teksnya belum ada: indikator tetap menyala.
  const composing =
    busy &&
    !waitingForReply &&
    !!lastAssistant &&
    lastAssistant.id === messages.at(-1)?.id &&
    !lastAssistant.parts.some((p) => p.type === 'text' && p.text.trim());

  // Jaring pengaman: server paling lama ~50 detik. Bila 60 detik tanpa kabar, hentikan dan tawarkan coba lagi,
  // supaya tombol kirim tidak terkunci selamanya (mis. koneksi putus tanpa error).
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => {
      stop();
      setStalled(true);
    }, 60_000);
    return () => clearTimeout(t);
  }, [busy, messages, stop]);

  // Kolom tulis tumbuh mengikuti isinya (maksimal sekitar enam baris), lalu menggulir di dalam.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [input]);

  // Pesan warga terbaru ditaruh di bagian atas layar, sehingga jawaban (teks, lalu kartu) terbaca dari
  // awalnya. Menggulir ke dasar daftar membuat bagian atas jawaban terlewat dan teks terbaru
  // tertutup kolom tulis. Bila warga menggulir sendiri, gulir otomatis berhenti sampai ia mengirim lagi.
  const lastUserId = [...messages].reverse().find((m) => m.role === 'user')?.id ?? null;
  useEffect(() => {
    if (!chatting || !lastUserId) return;
    if (anchoredTo.current !== lastUserId) {
      anchoredTo.current = lastUserId;
      follow.current = true;
    }
    if (!follow.current) return;
    document
      .querySelector(`[data-msg="${CSS.escape(lastUserId)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [messages, busy, chatting, lastUserId]);

  useEffect(() => {
    const stop = () => {
      follow.current = false;
    };
    const keys = (e: KeyboardEvent) => {
      if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' '].includes(e.key))
        if (!['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '')) stop();
    };
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchmove', stop, { passive: true });
    window.addEventListener('keydown', keys);
    return () => {
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
      window.removeEventListener('keydown', keys);
    };
  }, []);

  // Contoh kalimat berganti di kolom tulis, hanya saat kosong dan tidak sedang diketik.
  useEffect(() => {
    if (chatting) return;
    const t = setInterval(() => {
      if (!inputRef.current?.value && document.activeElement !== inputRef.current)
        setExample((e) => (e + 1) % EXAMPLES.length);
    }, 3200);
    return () => clearInterval(t);
  }, [chatting]);

  // Senter motif: garis Itiak Pulang Patang sedikit lebih jelas di sekitar kursor (hanya perangkat dengan kursor).
  useEffect(() => {
    if (
      !matchMedia('(hover: hover)').matches ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = planetRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
        el.style.setProperty('--lit', '1');
      });
    };
    const leave = () => planetRef.current?.style.setProperty('--lit', '0');
    window.addEventListener('pointermove', move);
    document.addEventListener('mouseleave', leave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('mouseleave', leave);
    };
  }, []);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setStalled(false);
    sendMessage({ text: t });
    setInput('');
  };

  const newConversation = async () => {
    try {
      await fetch('/api/chat/reset', { method: 'POST' });
    } catch {
      /* bila gagal, percakapan lama tetap terbawa di server; tampilan tetap dibersihkan */
    }
    setMessages([]);
    inputRef.current?.focus();
  };

  return (
    <div className={cn('kmg', chatting && 'is-chat')}>
      <div className='bg' aria-hidden='true'>
        <div className='planet' ref={planetRef} />
      </div>

      <header className='nav'>
        <Link className='brand' href='/chat' aria-label='Kamanga, beranda'>
          kamanga
        </Link>
        <div className='nav-right'>
          <ThemeToggle />
          {chatting && (
            <button
              type='button'
              className='btn-new'
              aria-label='Percakapan baru'
              onClick={newConversation}
            >
              <Icons.add className='btn-new-icon' aria-hidden='true' />
              <span className='btn-new-text'>Percakapan baru</span>
            </button>
          )}
          <Link className='link-quiet keep' href='/jelajah'>
            Jelajah
          </Link>
          <Link className='link-quiet' href='/auth/sign-in'>
            Masuk
          </Link>
          <Link className='cta' href='/auth/sign-up' aria-label='Daftarkan usaha'>
            <span className='cta-long'>Daftarkan usaha</span>
            <span className='cta-short' aria-hidden='true'>
              Daftar
            </span>
          </Link>
        </div>
      </header>

      <div className='shell'>
        {!chatting && (
          <section className='hero'>
            <div className='orb-label rise' style={{ animationDelay: '.05s' }}>
              Kamanga AI<sup>Beta</sup>
            </div>
            <h1>
              <Words text='Ka manga hari ini?' />
              <span className='fade'>
                <Words text='Cukup ketik, Kamanga carikan.' from={4} />
              </span>
            </h1>
          </section>
        )}

        {chatting && (
          <section className='thread' aria-live='polite' aria-label='Percakapan'>
            <div className='thread-inner'>
              {messages.map((m) => (
                <div
                  key={m.id}
                  data-msg={m.id}
                  className={cn('msg fade-in', m.role === 'user' ? 'user' : 'bot')}
                >
                  {m.role === 'assistant' && <div className='avatar'>K</div>}
                  <div className={m.role === 'assistant' ? 'stack' : undefined}>
                    {m.parts.map((p, i) => {
                      if (p.type === 'text') {
                        const streaming =
                          status === 'streaming' &&
                          m.id === lastAssistant?.id &&
                          i === m.parts.length - 1;
                        return (
                          <div key={i} className={cn('bubble', streaming && 'streaming')}>
                            {p.text}
                          </div>
                        );
                      }
                      if (p.type === 'data-listings')
                        return p.data.items.map((it, k) => (
                          <ListingCard key={`${it.id}`} item={it} index={k + 1} />
                        ));
                      if (p.type === 'data-chips' && m.id === lastAssistant?.id && !busy)
                        return (
                          <div key={i} className='chips'>
                            {p.data.options.map((o) => (
                              <button
                                key={o}
                                type='button'
                                className='chip'
                                onClick={() => send(o)}
                              >
                                {o}
                              </button>
                            ))}
                          </div>
                        );
                      return null;
                    })}
                    {composing && m.id === lastAssistant?.id && <Thinking />}
                  </div>
                </div>
              ))}
              {waitingForReply && (
                <div className='msg bot'>
                  <div className='avatar'>K</div>
                  <Thinking />
                </div>
              )}
              {(status === 'error' || stalled) && (
                <div className='msg bot' role='alert'>
                  <div className='avatar'>K</div>
                  <div className='stack'>
                    <div className='bubble'>
                      Maaf, Kamanga sedang bermasalah dan belum bisa menjawab. Pesan Anda tidak
                      hilang.
                    </div>
                    <div>
                      <button
                        type='button'
                        className='retry'
                        onClick={() => {
                          setStalled(false);
                          regenerate();
                        }}
                      >
                        Coba lagi
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <div className='composer-wrap rise' style={{ animationDelay: '.32s' }}>
          <form
            className={cn('pill', busy && 'busy')}
            autoComplete='off'
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              ref={inputRef}
              id='kmg-input'
              aria-label='Pesan untuk Kamanga'
              rows={1}
              maxLength={500}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter mengirim; Shift+Enter baris baru. Jangan mengirim saat memilih kata di keyboard IME.
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={chatting ? 'Tulis pertanyaan lanjutan...' : EXAMPLES[example]}
            />
            {busy ? (
              // Selama menunggu jawaban, tombol ini berubah jadi "Berhenti": selalu bisa ditekan.
              <button className='go stop' type='button' onClick={() => stop()}>
                <span className='stop-icon' aria-hidden='true' />
                Berhenti
              </button>
            ) : (
              <button className='go' type='submit' disabled={!input.trim()}>
                Cari
                <svg
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2.4'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  aria-hidden='true'
                >
                  <path d='M5 12h14M13 6l6 6-6 6' />
                </svg>
              </button>
            )}
          </form>
          {!chatting && starters.length > 0 && (
            <div className='chips' id='chips'>
              {starters.map((s) => (
                <button key={s} type='button' className='chip' onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <p className='privacy'>
            Percakapan dicatat tanpa nama untuk memperbaiki layanan. Jangan mengirim data pribadi.
            Konfirmasi harga dan ketersediaan langsung ke penyedia.
          </p>
        </div>
      </div>

      {!chatting && coverage.cities > 0 && (
        <aside className='coverage' aria-label='Cakupan data'>
          <b>{coverage.cities} kota/kabupaten</b>
          {coverage.districts.toLocaleString('id-ID')} kecamatan,{' '}
          {coverage.villages.toLocaleString('id-ID')} nagari dan kelurahan di Sumatera Barat
        </aside>
      )}
      {!chatting && peek.length === 3 && (
        <div className='peek' aria-hidden='true'>
          {peek.map((p) => (
            <div key={p.id} className='mini'>
              <b>{p.name}</b>
              <span>{p.meta}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
