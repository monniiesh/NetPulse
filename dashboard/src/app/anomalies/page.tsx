import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { probes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { DashboardShell } from '@/components/layout/DashboardShell';
import AnomaliesClient from './AnomaliesClient';

export default async function AnomaliesPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const probeList = await db
    .select({ id: probes.id, name: probes.name, location: probes.location })
    .from(probes)
    .where(eq(probes.isActive, true));

  return (
    <DashboardShell>
      <AnomaliesClient probes={probeList} />
    </DashboardShell>
  );
}
