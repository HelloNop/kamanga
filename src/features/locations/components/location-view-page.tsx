'use client';
import { useSuspenseQuery } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { locationByIdOptions, locationFormOptions } from '../api/queries';
import LocationForm from './location-form';

export default function LocationViewPage({ locationId }: { locationId: string }) {
  const { data: options } = useSuspenseQuery(locationFormOptions());
  if (locationId === 'new') return <LocationForm options={options} pageTitle='Tambah lokasi' />;
  return <EditLocation id={Number(locationId)} />;
}

function EditLocation({ id }: { id: number }) {
  const { data: options } = useSuspenseQuery(locationFormOptions());
  const { data: detail } = useSuspenseQuery(locationByIdOptions(id));
  if (!detail) notFound();
  return <LocationForm options={options} detail={detail} pageTitle='Ubah lokasi' />;
}
