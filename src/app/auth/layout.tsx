// Masuk dan daftar mitra/admin: tampilan sama dengan beranda (chat). Formulir shadcn memakai token .kmg
// lewat pemetaan di .auth-main (chat.css), jadi komponennya tidak perlu diubah.
import ChatLayout from '../chat/layout';
import { PublicHeader } from '@/features/jelajah/components/public-header';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatLayout>
      <div className='kmg auth-page'>
        <PublicHeader />
        <main className='auth-main'>{children}</main>
      </div>
    </ChatLayout>
  );
}
