/**
 * GET   /api/applications/[appId]   — Get application detail
 * PATCH /api/applications/[appId]   — Update status, add notes
 * DELETE /api/applications/[appId]  — Remove application
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { UpdateApplicationSchema } from '@/lib/schemas';
import { dbGet, dbUpdate, dbDelete } from '@/lib/dynamo/client';
import type { Application } from '@/lib/types/application';

const getUserId = (req: NextRequest): string | null => req.headers.get('x-user-id');

export async function GET(
  request: NextRequest,
  { params }: { params: { appId: string } }
) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const app = await dbGet<Application>(`USER#${userId}`, `APP#${params.appId}`);
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(app);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { appId: string } }
) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();

    const validation = UpdateApplicationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.message }, { status: 400 });
    }

    const existing = await dbGet<Application>(`USER#${userId}`, `APP#${params.appId}`);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (validation.data.status) updates.status = validation.data.status;
    if (validation.data.appliedAt) updates.appliedAt = validation.data.appliedAt;
    if (validation.data.followUpAt) updates.followUpAt = validation.data.followUpAt;
    if (validation.data.salary) updates.salary = validation.data.salary;
    if (validation.data.offerAmount) updates.offerAmount = validation.data.offerAmount;
    if (validation.data.rejectionReason) updates.rejectionReason = validation.data.rejectionReason;

    // Append note if provided
    if (validation.data.notes) {
      const note = {
        noteId: uuidv4().split('-')[0],
        text: validation.data.notes,
        createdAt: now,
      };
      updates.notes = [...(existing.notes || []), note];
    }

    // Auto-set appliedAt when status moves to Applied
    if (validation.data.status === 'Applied' && !existing.appliedAt) {
      updates.appliedAt = now;
    }

    await dbUpdate(`USER#${userId}`, `APP#${params.appId}`, updates);

    return NextResponse.json({ applicationId: params.appId, ...updates });
  } catch (err) {
    console.error('[applications/[appId]] PATCH Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { appId: string } }
) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await dbDelete(`USER#${userId}`, `APP#${params.appId}`);
  return NextResponse.json({ deleted: true });
}
