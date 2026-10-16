import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/session';

// Pintu masuk panel: admin ke ringkasan, mitra ke dashboard mitra (ramah ponsel).
export default async function Dashboard() {
  const session = await requireStaff();
  redirect(session.user.role === 'vendor' ? '/mitra' : '/dashboard/overview');
}
