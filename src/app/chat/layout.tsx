import { Poppins } from 'next/font/google';
import '@/features/chat/chat.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-kmg',
  display: 'swap'
});

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <div className={poppins.variable}>{children}</div>;
}
