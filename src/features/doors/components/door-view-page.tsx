'use client';
import { useSuspenseQuery } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { doorByIdOptions } from '../api/queries';
import DoorForm from './door-form';

export default function DoorViewPage({ doorId }: { doorId: string }) {
  if (doorId === 'new') return <DoorForm />;
  return <EditDoor id={Number(doorId)} />;
}

function EditDoor({ id }: { id: number }) {
  const { data: detail } = useSuspenseQuery(doorByIdOptions(id));
  if (!detail) notFound();
  return <DoorForm detail={detail} />;
}
