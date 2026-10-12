'use client';
import { useSuspenseQuery } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { needByIdOptions, needFormOptions } from '../api/queries';
import NeedForm from './need-form';

export default function NeedViewPage({ needId }: { needId: string }) {
  const { data: options } = useSuspenseQuery(needFormOptions());
  if (needId === 'new') return <NeedForm options={options} pageTitle='Tambah kebutuhan' />;
  return <EditNeed id={Number(needId)} />;
}

function EditNeed({ id }: { id: number }) {
  const { data: options } = useSuspenseQuery(needFormOptions());
  const { data: detail } = useSuspenseQuery(needByIdOptions(id));
  if (!detail) notFound();
  return <NeedForm options={options} detail={detail} pageTitle='Ubah kebutuhan' />;
}
