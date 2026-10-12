import { NavGroup } from '@/types';

// Menu sidebar. `access: { role }` menampilkan item hanya untuk peran itu (disaring di use-nav.ts).
export const navGroups: NavGroup[] = [
  {
    label: 'Ringkasan',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard/overview',
        icon: 'dashboard',
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
        isActive: false,
        access: { role: 'admin' },
        items: []
      },
      {
        title: 'Antrean',
        url: '/dashboard/review',
        icon: 'circleCheck',
        isActive: false,
        access: { role: 'admin' },
        items: []
      },
      {
        title: 'Permintaan',
        url: '/dashboard/demand',
        icon: 'trendingUp',
        isActive: false,
        access: { role: 'admin' },
        items: []
      },
      {
        title: 'Kategori',
        url: '/dashboard/categories',
        icon: 'tags',
        isActive: false,
        access: { role: 'admin' },
        items: []
      },
      {
        title: 'Kebutuhan',
        url: '/dashboard/needs',
        icon: 'bulb',
        isActive: false,
        access: { role: 'admin' },
        items: []
      },
      {
        title: 'Lokasi',
        url: '/dashboard/locations',
        icon: 'mapPin',
        isActive: false,
        access: { role: 'admin' },
        items: []
      },
      {
        title: 'Kamus',
        url: '/dashboard/glossary',
        icon: 'book',
        isActive: false,
        access: { role: 'admin' },
        items: []
      },
      {
        title: 'Uji Pencarian',
        url: '/dashboard/search',
        icon: 'search',
        isActive: false,
        access: { role: 'admin' },
        items: []
      }
    ]
  }
];
