import { db } from '@/lib/db';
import { probes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import bcryptjs from 'bcryptjs';
import type { Probe } from '@/lib/db/schema';

export async function authenticateProbe(
  apiKey: string
): Promise<Probe | null> {
  const prefix = apiKey.substring(0, 16);

  const candidateProbes = await db
    .select()
    .from(probes)
    .where(and(eq(probes.apiKeyPrefix, prefix), eq(probes.isActive, true)));

  for (const probe of candidateProbes) {
    const matches = await bcryptjs.compare(apiKey, probe.apiKey);
    if (matches) {
      return probe;
    }
  }

  return null;
}
