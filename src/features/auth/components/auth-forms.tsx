'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import * as z from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { authClient } from '@/lib/auth-client';
import { useAppForm } from '@/lib/form';

const emailSchema = z.email('Email tidak valid');
const passwordSchema = z.string().min(8, 'Kata sandi minimal 8 karakter');

// Hanya izinkan tujuan di dalam /dashboard agar `next` tidak bisa dipakai membelokkan ke situs lain.
const safeNext = (next: string | null) =>
  next && next.startsWith('/dashboard') && !next.startsWith('//') ? next : '/dashboard/overview';

function AuthCard({
  title,
  description,
  error,
  footer,
  children
}: {
  title: string;
  description: string;
  error: string | null;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className='w-full max-w-sm'>
      <CardHeader>
        <CardTitle className='text-2xl'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {error && (
          <Alert variant='destructive'>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {children}
        <p className='text-muted-foreground text-center text-sm'>{footer}</p>
      </CardContent>
    </Card>
  );
}

export function SignInForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [error, setError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: { email: '', password: '' },
    validators: { onSubmit: z.object({ email: emailSchema, password: passwordSchema }) },
    onSubmit: async ({ value }) => {
      setError(null);
      const { error } = await authClient.signIn.email(value);
      if (error)
        return setError(
          error.status === 403
            ? (error.message ?? 'Akun diblokir.')
            : 'Email atau kata sandi salah.'
        );
      router.push(next);
      router.refresh();
    }
  });

  return (
    <AuthCard
      title='Masuk'
      description='Masuk ke panel Kamanga.'
      error={error}
      footer={
        <>
          Belum punya akun vendor?{' '}
          <Link href='/auth/sign-up' className='underline'>
            Daftar
          </Link>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.AppField
            name='email'
            children={(f) => (
              <f.TextField label='Email' type='email' autoComplete='email' required />
            )}
          />
          <form.AppField
            name='password'
            children={(f) => (
              <f.TextField
                label='Kata sandi'
                type='password'
                autoComplete='current-password'
                required
              />
            )}
          />
          <form.AppForm>
            <form.SubmitButton className='w-full'>Masuk</form.SubmitButton>
          </form.AppForm>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: { name: '', email: '', password: '' },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, 'Nama minimal 2 huruf'),
        email: emailSchema,
        password: passwordSchema
      })
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const { error } = await authClient.signUp.email(value);
      if (error)
        return setError(
          error.code?.includes('EXISTS')
            ? 'Email ini sudah terdaftar.'
            : 'Pendaftaran gagal. Coba lagi.'
        );
      router.push('/dashboard/overview');
      router.refresh();
    }
  });

  return (
    <AuthCard
      title='Daftar sebagai vendor'
      description='Buat akun untuk menambahkan usaha Anda ke Kamanga.'
      error={error}
      footer={
        <>
          Sudah punya akun?{' '}
          <Link href='/auth/sign-in' className='underline'>
            Masuk
          </Link>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.AppField
            name='name'
            children={(f) => <f.TextField label='Nama' autoComplete='name' required />}
          />
          <form.AppField
            name='email'
            children={(f) => (
              <f.TextField label='Email' type='email' autoComplete='email' required />
            )}
          />
          <form.AppField
            name='password'
            children={(f) => (
              <f.TextField
                label='Kata sandi'
                type='password'
                autoComplete='new-password'
                description='Minimal 8 karakter.'
                required
              />
            )}
          />
          <form.AppForm>
            <form.SubmitButton className='w-full'>Daftar</form.SubmitButton>
          </form.AppForm>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
