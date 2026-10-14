import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { Suspense } from 'react';
import PageContainer from '@/components/layout/page-container';
import { settingsQueryOptions } from '@/features/settings/api/queries';
import { SettingsForm } from '@/features/settings/components/settings-form';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Pengaturan' };

export default async function Page() {
  await requireAdmin();
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(settingsQueryOptions());

  return (
    <PageContainer
      pageTitle='Pengaturan'
      pageDescription='Batas waktu pesanan dan teks pesan WhatsApp. Berlaku tanpa perlu mengubah kode.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<div className='bg-card h-96 animate-pulse rounded-xl' />}>
          <SettingsForm />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}
