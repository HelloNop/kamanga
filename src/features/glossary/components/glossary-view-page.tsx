'use client';
import { useSuspenseQuery } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { glossaryByIdOptions } from '../api/queries';
import GlossaryForm from './glossary-form';

export default function GlossaryViewPage({ termId }: { termId: string }) {
  if (termId === 'new') return <GlossaryForm pageTitle='Tambah kata' />;
  return <EditTerm id={Number(termId)} />;
}

function EditTerm({ id }: { id: number }) {
  const { data: detail } = useSuspenseQuery(glossaryByIdOptions(id));
  if (!detail) notFound();
  return <GlossaryForm detail={detail} pageTitle='Ubah kata' />;
}
