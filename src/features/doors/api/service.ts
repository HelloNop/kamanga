'use server';
// Pintu masuk dari klien. SETIAP fungsi wajib memanggil requireAdmin() lebih dulu.
import { requireAdmin } from '@/lib/session';
import * as repo from './repository';
import type { DoorDetail, DoorFormValues, DoorOption, DoorRow, MutationResult } from './types';

export async function getDoors(): Promise<DoorRow[]> {
  await requireAdmin();
  return repo.listDoors();
}

export async function getDoorOptions(): Promise<DoorOption[]> {
  await requireAdmin();
  return repo.listDoorOptions();
}

export async function getDoorById(id: number): Promise<DoorDetail | null> {
  await requireAdmin();
  return repo.getDoorDetail(id);
}

export async function createDoor(values: DoorFormValues): Promise<MutationResult> {
  await requireAdmin();
  return repo.createDoor(values);
}

export async function updateDoor(id: number, values: DoorFormValues): Promise<MutationResult> {
  await requireAdmin();
  return repo.updateDoor(id, values);
}

export async function moveDoor(id: number, dir: 'up' | 'down'): Promise<MutationResult> {
  await requireAdmin();
  return repo.moveDoor(id, dir === 'up' ? 'up' : 'down');
}
