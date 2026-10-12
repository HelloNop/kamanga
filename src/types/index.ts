import { Icons } from '@/components/icons';
import type { Role } from '@/lib/auth';

export interface NavItem {
  title: string;
  url: string;
  icon?: keyof typeof Icons;
  isActive?: boolean;
  items?: NavItem[];
  // Item hanya tampil untuk peran ini. Kosong = tampil untuk semua yang sudah masuk.
  access?: { role?: Role };
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}
