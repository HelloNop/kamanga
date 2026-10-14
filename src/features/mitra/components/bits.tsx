import Link from 'next/link';
import { Icons } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Kartu bagian halaman mitra. */
export function Panel({
  title,
  action,
  className,
  children
}: {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('bg-card rounded-xl p-4 shadow-sm', className)}>
      {(title || action) && (
        <div className='mb-3 flex items-center justify-between gap-3'>
          {title && <h3 className='text-[1.0625rem] font-semibold'>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className='text-muted-foreground py-2 text-sm'>{children}</p>;
}

/** Mitra belum punya usaha. */
export function NoListing() {
  return (
    <Panel>
      <Icons.buildingStore className='text-muted-foreground mb-3 size-8' aria-hidden />
      <p className='font-semibold'>Belum ada usaha</p>
      <p className='text-muted-foreground mt-1 text-sm'>
        Daftarkan usaha Anda supaya warga bisa memesan lewat Kamanga. Usaha yang sudah diinput tim
        Kamanga bisa diklaim: hubungi tim Kamanga dari nomor WhatsApp usaha Anda.
      </p>
      <Link href='/mitra/usaha/baru' className={cn(buttonVariants(), 'mt-4 w-full')}>
        <Icons.add aria-hidden /> Daftarkan usaha
      </Link>
    </Panel>
  );
}
