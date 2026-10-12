'use client';

import { authClient } from '@/lib/auth-client';
import type { NavGroup, NavItem } from '@/types';

// Hanya untuk tampilan menu (UX). Keamanan sebenarnya ada di requireAdmin() sisi server.
function useRole() {
  return authClient.useSession().data?.user.role ?? null;
}

const allowed = (item: NavItem, role: string | null) =>
  !item.access?.role || item.access.role === role;

function filterItems(items: NavItem[], role: string | null): NavItem[] {
  return items
    .filter((item) => allowed(item, role))
    .map((item) => (item.items ? { ...item, items: filterItems(item.items, role) } : item));
}

export function useFilteredNavItems(items: NavItem[]) {
  return filterItems(items, useRole());
}

export function useFilteredNavGroups(groups: NavGroup[]) {
  const role = useRole();
  return groups
    .map((group) => ({ ...group, items: filterItems(group.items, role) }))
    .filter((group) => group.items.length > 0);
}
