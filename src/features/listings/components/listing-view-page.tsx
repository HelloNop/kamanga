'use client';
import { useSuspenseQuery } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { listingByIdOptions, listingFormOptions } from '../api/queries';
import ListingForm from './listing-form';

export default function ListingViewPage({ listingId }: { listingId: string }) {
  const { data: options } = useSuspenseQuery(listingFormOptions());
  if (listingId === 'new') return <ListingForm options={options} pageTitle='Tambah listing' />;
  return <EditListing id={Number(listingId)} />;
}

function EditListing({ id }: { id: number }) {
  const { data: options } = useSuspenseQuery(listingFormOptions());
  const { data: detail } = useSuspenseQuery(listingByIdOptions(id));
  if (!detail) notFound();
  return <ListingForm options={options} detail={detail} pageTitle='Ubah listing' />;
}
