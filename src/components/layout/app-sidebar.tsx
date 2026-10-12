'use client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail
} from '@/components/ui/sidebar';
import { navGroups } from '@/config/nav-config';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useFilteredNavGroups } from '@/hooks/use-nav';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { Icons } from '@/components/icons';
import { pendingCountOptions } from '@/features/review/api/queries';
import { useQuery } from '@tanstack/react-query';

/** Jumlah listing menunggu review di samping menu Antrean. */
function PendingBadge() {
  const { data } = useQuery(pendingCountOptions());
  if (!data) return null;
  return (
    <span className='bg-primary text-primary-foreground ml-auto rounded-full px-2 py-px text-[0.6875rem] font-semibold group-data-[collapsible=icon]:hidden'>
      {data > 99 ? '99+' : data}
    </span>
  );
}

export default function AppSidebar() {
  const pathname = usePathname();
  const { isOpen } = useMediaQuery();
  const filteredGroups = useFilteredNavGroups(navGroups);

  React.useEffect(() => {
    // Side effects based on sidebar state changes
  }, [isOpen]);

  return (
    <Sidebar variant='floating' collapsible='icon'>
      <SidebarHeader className='px-[26px] pt-[22px] pb-2 group-data-[collapsible=icon]:px-3'>
        <Link
          href='/dashboard/overview'
          aria-label='Kamanga, ringkasan'
          className='flex items-center gap-2.5 text-[1.375rem] font-bold tracking-tight'
        >
          <span className='flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(160deg,var(--primary),var(--primary-hi))] text-base text-white'>
            K
          </span>
          <span className='group-data-[collapsible=icon]:hidden'>kamanga</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className='overflow-x-hidden'>
        {filteredGroups.map((group, gi) => (
          <SidebarGroup
            key={group.label || 'ungrouped'}
            // Kelompok pertama lebih rapat ke logo; jarak total tetap sama karena header diberi ruang bawah.
            className={cn(
              'px-4 pb-0 group-data-[collapsible=icon]:px-2',
              gi === 0 ? 'pt-2' : 'pt-4'
            )}
          >
            {group.label && <SidebarGroupLabel className='px-2.5'>{group.label}</SidebarGroupLabel>}
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon ? Icons[item.icon] : Icons.logo;
                return item?.items && item?.items?.length > 0 ? (
                  <Collapsible
                    key={item.title}
                    defaultOpen={item.isActive}
                    render={<SidebarMenuItem />}
                  >
                    <CollapsibleTrigger
                      render={
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={pathname === item.url}
                          className='group/collapsible'
                        />
                      }
                    >
                      {item.icon && <Icon />}
                      <span>{item.title}</span>
                      <Icons.chevronRight className='ml-auto transition-transform duration-200 group-data-panel-open/collapsible:rotate-90' />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              render={<Link href={subItem.url} aria-label={subItem.title} />}
                              isActive={pathname === subItem.url}
                            >
                              <span>{subItem.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<Link href={item.url} aria-label={item.title} />}
                      tooltip={item.title}
                      isActive={pathname === item.url}
                    >
                      <Icon />
                      <span>{item.title}</span>
                      {item.url === '/dashboard/review' && <PendingBadge />}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
        {/* Mengisi ruang kosong agar kartu di bawah menempel ke dasar, dengan jarak minimal saat konten panjang. */}
        <div aria-hidden='true' className='min-h-6 flex-1 group-data-[collapsible=icon]:hidden' />
        <Link
          href='/chat'
          target='_blank'
          className='relative mx-4 mb-4 block shrink-0 overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#1c3f54,var(--primary)_55%,var(--primary-hi))] p-4 text-white group-data-[collapsible=icon]:hidden'
        >
          <span
            aria-hidden='true'
            className='absolute inset-0 bg-white/25 opacity-60 [-webkit-mask:url(/patterns/itiak-pulang-patang.svg)_0_0/auto_70px_repeat] [mask:url(/patterns/itiak-pulang-patang.svg)_0_0/auto_70px_repeat]'
          />
          <span className='relative block text-base font-semibold'>Lihat seperti warga</span>
          <span className='relative mt-0.5 block text-xs text-white/85'>
            Coba tanya Kamanga dan lihat hasilnya langsung.
          </span>
          <span className='relative mt-3 inline-block rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1c3f54]'>
            Buka chat
          </span>
        </Link>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
