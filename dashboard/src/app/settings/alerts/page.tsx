import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { probes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { DashboardShell } from '@/components/layout/DashboardShell';
import AlertsClient from './AlertsClient';

export default async function AlertsSettingsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const probeList = await db
    .select({ id: probes.id, name: probes.name, location: probes.location })
    .from(probes)
    .where(eq(probes.isActive, true));

  return (
    <DashboardShell>
      <AlertsClient probes={probeList} />
    </DashboardShell>
  );
}
