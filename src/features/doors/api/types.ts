import type { DoorFormValues, DoorKind, DoorStatus } from '../schemas/door';

export type { DoorFormValues };

export type DoorRow = {
  id: number;
  slug: string;
  name: string;
  icon: string | null;
  description: string | null;
  rotatingText: string | null;
  aliases: string[];
  sortOrder: number;
  status: DoorStatus;
  kind: DoorKind;
  /** Kategori yang pintu utamanya pintu ini. */
  categories: { id: number; name: string; isActive: boolean; scheduleKind: string }[];
};

export type DoorOption = { id: number; name: string; status: DoorStatus };

export type DoorDetail = { id: number; values: DoorFormValues; categoryCount: number };

export type MutationResult = { ok: true; id: number } | { ok: false; message: string };
