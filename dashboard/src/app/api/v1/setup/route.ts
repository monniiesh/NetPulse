import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { sql } from 'drizzle-orm';

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const [existingUser] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    if (existingUser.count > 0) {
      return NextResponse.json(
        { error: 'Setup already completed' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { email, password } = setupSchema.parse(body);

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.insert(users).values({
      email,
      password: hashedPassword,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
