'use client';
import { useSuspenseQuery } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { categoryByIdOptions } from '../api/queries';
import CategoryForm from './category-form';

export default function CategoryViewPage({ categoryId }: { categoryId: string }) {
  if (categoryId === 'new') return <CategoryForm pageTitle='Tambah kategori' />;
  return <EditCategory id={Number(categoryId)} />;
}

function EditCategory({ id }: { id: number }) {
  const { data: detail } = useSuspenseQuery(categoryByIdOptions(id));
  if (!detail) notFound();
  return <CategoryForm detail={detail} pageTitle='Ubah kategori' />;
}
