import { NavGroup } from '@/types';

// Menu sidebar. `access: { role }` menampilkan item hanya untuk peran itu (disaring di use-nav.ts).
// Mitra (vendor) memakai dashboard mitra di /mitra; di panel ini hanya tautan ke sana dan portal lama.
const admin = { role: 'admin' } as const;
const vendor = { role: 'vendor' } as const;

export const navGroups: NavGroup[] = [
  {
    label: 'Ringkasan',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard/overview',
        icon: 'dashboard',
        isActive: false,
        access: admin,
        items: []
      },
      {
        title: 'Pesanan',
        url: '/dashboard/bookings',
        icon: 'receipt',
        isActive: false,
        access: admin,
        items: []
      }
    ]
  },
  {
    label: 'Usaha saya',
    items: [
      {
        title: 'Dashboard mitra',
        url: '/mitra',
        icon: 'buildingStore',
        isActive: false,
        access: vendor,
        items: []
      },
      {
        title: 'Listing saya',
        url: '/mitra/usaha',
        icon: 'workspace',
        isActive: false,
        access: vendor,
        items: []
      }
    ]
  },
  {
    label: 'Direktori',
    items: [
      {
        title: 'Penyedia & Tempat',
        url: '/dashboard/listings',
        icon: 'workspace',
        isActive: false,
        access: admin,
        items: []
      },
      {
        title: 'Antrean',
        url: '/dashboard/review',
        icon: 'circleCheck',
        isActive: false,
        access: admin,
        items: []
      },
      {
        title: 'Permintaan warga',
        url: '/dashboard/demand',
        icon: 'trendingUp',
        isActive: false,
        access: admin,
        items: []
      }
    ]
  },
  {
    label: 'Isi aplikasi',
    items: [
      {
        title: 'Pintu',
        url: '/dashboard/doors',
        icon: 'door',
        isActive: false,
        access: admin,
        items: []
      },
      {
        title: 'Kategori & aturan',
        url: '/dashboard/categories',
        icon: 'tags',
        isActive: false,
        access: admin,
        items: []
      },
      {
        title: 'Kebutuhan',
        url: '/dashboard/needs',
        icon: 'bulb',
        isActive: false,
        access: admin,
        items: []
      },
      {
        title: 'Wilayah',
        url: '/dashboard/locations',
        icon: 'mapPin',
        isActive: false,
        access: admin,
        items: []
      },
      {
        title: 'Kamus',
        url: '/dashboard/glossary',
        icon: 'book',
        isActive: false,
        access: admin,
        items: []
      }
    ]
  },
  {
    label: 'Sistem',
    items: [
      {
        title: 'Uji Pencarian',
        url: '/dashboard/search',
        icon: 'search',
        isActive: false,
        access: admin,
        items: []
      },
      {
        title: 'Pengaturan',
        url: '/dashboard/settings',
        icon: 'settings',
        isActive: false,
        access: admin,
        items: []
      }
    ]
  }
];
