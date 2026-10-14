import { queryOptions } from '@tanstack/react-query';
import { getCalendar, getQa, getScheduleEditor } from './service';

export const mitraKeys = {
  all: ['mitra'] as const,
  schedule: (listingId: number) => [...mitraKeys.all, 'schedule', listingId] as const,
  // Di bawah kunci schedule: membatalkan jadwal ikut menyegarkan kalender.
  calendar: (listingId: number, unitId: number, date: string) =>
    [...mitraKeys.schedule(listingId), 'calendar', unitId, date] as const,
  qa: (listingId: number) => [...mitraKeys.all, 'qa', listingId] as const
};

export const scheduleEditorOptions = (listingId: number) =>
  queryOptions({
    queryKey: mitraKeys.schedule(listingId),
    queryFn: () => getScheduleEditor(listingId)
  });

export const calendarOptions = (listingId: number, unitId: number, date: string) =>
  queryOptions({
    queryKey: mitraKeys.calendar(listingId, unitId, date),
    queryFn: () => getCalendar(listingId, unitId, date),
    staleTime: 15_000
  });

export const qaOptions = (listingId: number) =>
  queryOptions({ queryKey: mitraKeys.qa(listingId), queryFn: () => getQa(listingId) });
