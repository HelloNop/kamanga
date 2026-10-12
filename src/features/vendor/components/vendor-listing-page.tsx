'use client';
import { useSuspenseQuery } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import ListingForm from '@/features/listings/components/listing-form';
import { myListingByIdOptions, vendorFormOptions } from '../api/queries';

export default function VendorListingPage({ listingId }: { listingId: string }) {
  const { data: options } = useSuspenseQuery(vendorFormOptions());
  if (listingId === 'new')
    return <ListingForm mode='vendor' options={options} pageTitle='Tambah listing' />;
  return <EditMyListing id={Number(listingId)} />;
}

function EditMyListing({ id }: { id: number }) {
  const { data: options } = useSuspenseQuery(vendorFormOptions());
  const { data: detail } = useSuspenseQuery(myListingByIdOptions(id));
  if (!detail) notFound();
  return <ListingForm mode='vendor' options={options} detail={detail} pageTitle='Ubah listing' />;
}
