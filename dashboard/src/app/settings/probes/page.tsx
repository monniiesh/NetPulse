import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import ProbesClient from './ProbesClient';

export default async function ProbesSettingsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <DashboardShell>
      <ProbesClient />
    </DashboardShell>
  );
}
