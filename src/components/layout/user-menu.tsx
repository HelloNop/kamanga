'use client';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { authClient } from '@/lib/auth-client';

const initials = (name?: string) =>
  (name ?? 'A')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

const ROLE_LABEL: Record<string, string> = { admin: 'Admin Kamanga', vendor: 'Pemilik usaha' };

const item =
  'h-10 gap-3 rounded-xl px-3 text-sm [&_svg:not([class*=size-])]:size-[1.15rem] [&_svg]:text-muted-foreground';

/** Avatar, nama, dan surel pengguna di header; menu berisi pintasan dan tombol keluar. */
export function UserMenu() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const isAdmin = user?.role === 'admin';
  const signOut = async () => {
    await authClient.signOut();
    router.push('/auth/sign-in');
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label='Menu akun'
        className='focus-visible:ring-ring/50 flex items-center gap-3 rounded-full py-0 pr-1 pl-1 outline-none focus-visible:ring-2'
      >
        <span className='grid size-11 shrink-0 place-items-center rounded-full bg-[linear-gradient(140deg,var(--primary-hi),var(--primary))] text-sm font-bold text-white'>
          {initials(user?.name)}
        </span>
        <span className='hidden text-left leading-tight lg:block'>
          <span className='block text-sm font-semibold'>{user?.name ?? 'Akun'}</span>
          <span className='text-muted-foreground block text-xs'>{user?.email ?? ''}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className='w-72 min-w-72 rounded-2xl p-2'
        side='bottom'
        align='end'
        sideOffset={10}
      >
        <div className='flex items-center gap-3 rounded-xl bg-muted/60 p-3'>
          <span className='grid size-11 shrink-0 place-items-center rounded-full bg-[linear-gradient(140deg,var(--primary-hi),var(--primary))] text-sm font-bold text-white'>
            {initials(user?.name)}
          </span>
          <div className='min-w-0'>
            <p className='truncate text-sm font-semibold'>{user?.name ?? 'Akun'}</p>
            <p className='text-muted-foreground truncate text-xs'>{user?.email}</p>
            <span className='bg-primary/10 text-primary mt-1.5 inline-block rounded-full px-2 py-px text-[0.6875rem] font-semibold'>
              {ROLE_LABEL[user?.role ?? ''] ?? 'Pengguna'}
            </span>
          </div>
        </div>

        <DropdownMenuGroup className='mt-2'>
          <DropdownMenuItem className={item} onClick={() => router.push('/dashboard/overview')}>
            <Icons.dashboard /> Ringkasan
          </DropdownMenuItem>
          <DropdownMenuItem
            className={item}
            onClick={() => router.push(isAdmin ? '/dashboard/review' : '/dashboard/my-listings')}
          >
            {isAdmin ? <Icons.circleCheck /> : <Icons.workspace />}
            {isAdmin ? 'Antrean review' : 'Listing saya'}
          </DropdownMenuItem>
          <DropdownMenuItem className={item} onClick={() => window.open('/', '_blank')}>
            <Icons.chat /> Lihat seperti warga
            <Icons.arrowUpRight className='ml-auto' />
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className='my-2' />
        <DropdownMenuGroup>
          <DropdownMenuItem className={item} variant='destructive' onClick={signOut}>
            <Icons.logout /> Keluar
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
