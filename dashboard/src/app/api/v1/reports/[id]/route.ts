import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { reports } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [report] = await db
      .select()
      .from(reports)
      .where(and(eq(reports.id, id), eq(reports.userId, session.user.id)))
      .limit(1);

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (report.status === 'ready' && report.pdfPath) {
      try {
        const absolutePath = path.isAbsolute(report.pdfPath)
          ? report.pdfPath
          : path.join(process.cwd(), report.pdfPath);

        const pdfBuffer = await fs.readFile(absolutePath);

        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="report-${id}.pdf"`,
          },
        });
      } catch (fileError) {
        console.error('PDF file read error:', fileError);
        return NextResponse.json(
          { error: 'PDF file not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      id: report.id,
      status: report.status,
      created_at: report.createdAt?.toISOString(),
    });
  } catch (error) {
    console.error('Report get error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [report] = await db
      .select()
      .from(reports)
      .where(and(eq(reports.id, id), eq(reports.userId, session.user.id)))
      .limit(1);

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (report.pdfPath) {
      try {
        const absolutePath = path.isAbsolute(report.pdfPath)
          ? report.pdfPath
          : path.join(process.cwd(), report.pdfPath);

        await fs.unlink(absolutePath);
      } catch (fileError) {
        console.error('PDF file deletion error (continuing):', fileError);
      }
    }

    await db.delete(reports).where(eq(reports.id, id));

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Report delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
