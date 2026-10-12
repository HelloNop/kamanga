'use server';
// Pintu masuk dari klien. SETIAP fungsi wajib memanggil requireAdmin() lebih dulu.
import { requireAdmin } from '@/lib/session';
import * as repo from './repository';
import type { LocationFormValues } from '../schemas/location';
import type {
  ImportPreview,
  ImportResult,
  LocationDetail,
  LocationFilters,
  LocationOption,
  LocationsResponse,
  MutationResult
} from './types';

export async function getLocations(filters: LocationFilters): Promise<LocationsResponse> {
  await requireAdmin();
  return repo.listLocations(filters);
}

export async function getLocationById(id: number): Promise<LocationDetail | null> {
  await requireAdmin();
  return repo.getLocationDetail(id);
}

export async function getLocationOptions(): Promise<LocationOption[]> {
  await requireAdmin();
  return repo.getLocationOptions();
}

export async function createLocation(values: LocationFormValues): Promise<MutationResult> {
  await requireAdmin();
  return repo.createLocation(values);
}

export async function updateLocation(
  id: number,
  values: LocationFormValues
): Promise<MutationResult> {
  await requireAdmin();
  return repo.updateLocation(id, values);
}

export async function deleteLocation(id: number): Promise<MutationResult> {
  await requireAdmin();
  return repo.deleteLocation(id);
}

export async function previewLocationImport(csvText: string): Promise<ImportPreview> {
  await requireAdmin();
  return repo.previewImport(String(csvText));
}

export async function importLocations(csvText: string): Promise<ImportResult> {
  await requireAdmin();
  return repo.runImport(String(csvText));
}
