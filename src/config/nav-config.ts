import { NavGroup } from '@/types';

/**
 * Navigation configuration with RBAC support
 *
 * This configuration is used for both the sidebar navigation and Cmd+K bar.
 * Items are organized into groups, each rendered with a SidebarGroupLabel.
 *
 * RBAC Access Control:
 * Each navigation item can have an `access` property that controls visibility
 * based on permissions, plans, features, roles, and organization context.
 *
 * Examples:
 *
 * 1. Require organization:
 *    access: { requireOrg: true }
 *
 * 2. Require specific permission:
 *    access: { requireOrg: true, permission: 'org:teams:manage' }
 *
 * 3. Require specific plan:
 *    access: { plan: 'pro' }
 *
 * 4. Require specific feature:
 *    access: { feature: 'premium_access' }
 *
 * 5. Require specific role:
 *    access: { role: 'admin' }
 *
 * 6. Multiple conditions (all must be true):
 *    access: { requireOrg: true, permission: 'org:teams:manage', plan: 'pro' }
 *
 * Note: The `visible` function is deprecated but still supported for backward compatibility.
 * Use the `access` property for new items.
 */
export const navGroups: NavGroup[] = [
  {
    label: 'Ringkasan',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard/overview',
        icon: 'dashboard',
        shortcut: ['d', 'd'],
        isActive: false,
        items: []
      }
    ]
  },
  {
    label: 'Usaha saya',
    items: [
      {
        title: 'Listing saya',
        url: '/dashboard/my-listings',
        icon: 'workspace',
        shortcut: ['l', 's'],
        isActive: false,
        access: { role: 'vendor' },
        items: []
      }
    ]
  },
  {
    label: 'Direktori',
    items: [
      {
        title: 'Listing',
        url: '/dashboard/listings',
        icon: 'workspace',
        shortcut: ['l', 'l'],
        isActive: false,
        access: { role: 'admin' },
        items: []
      },
      {
        title: 'Antrean',
        url: '/dashboard/review',
        icon: 'circleCheck',
        shortcut: ['a', 'a'],
        isActive: false,
        access: { role: 'admin' },
        items: []
      },
      {
        title: 'Permintaan',
        url: '/dashboard/demand',
        icon: 'trendingUp',
        shortcut: ['p', 'p'],
        isActive: false,
        access: { role: 'admin' },
        items: []
      },
      {
        title: 'Kategori',
        url: '/dashboard/categories',
        icon: 'tags',
        shortcut: ['k', 'k'],
        isActive: false,
        access: { role: 'admin' },
        items: []
      },
      {
        title: 'Kebutuhan',
        url: '/dashboard/needs',
        icon: 'bulb',
        shortcut: ['b', 'b'],
        isActive: false,
        access: { role: 'admin' },
        items: []
      },
      {
        title: 'Lokasi',
        url: '/dashboard/locations',
        icon: 'mapPin',
        shortcut: ['o', 'o'],
        isActive: false,
        access: { role: 'admin' },
        items: []
      },
      {
        title: 'Kamus',
        url: '/dashboard/glossary',
        icon: 'book',
        shortcut: ['m', 'm'],
        isActive: false,
        access: { role: 'admin' },
        items: []
      },
      {
        title: 'Uji Pencarian',
        url: '/dashboard/search',
        icon: 'search',
        shortcut: ['s', 's'],
        isActive: false,
        access: { role: 'admin' },
        items: []
      }
    ]
  }
];
