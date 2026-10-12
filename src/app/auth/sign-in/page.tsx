import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { SignInForm } from '@/features/auth/components/auth-forms';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Masuk' };

export default async function Page() {
  if (await getSession()) redirect('/dashboard/overview');
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
