/**
 * POST /api/alerts    — Create a job alert / saved search
 * GET  /api/alerts    — List alerts
 * DELETE /api/alerts/[id] — Delete alert
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { CreateAlertSchema } from '@/lib/schemas';
import { dbPut, dbQuery } from '@/lib/dynamo/client';
import type { JobAlert } from '@/lib/types/application';

const getUserId = (req: NextRequest): string | null => req.headers.get('x-user-id');

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();

    const validation = CreateAlertSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.message }, { status: 400 });
    }

    const alertId = `alrt-${uuidv4().split('-')[0]}`;
    const now = new Date().toISOString();

    const alert: JobAlert & { PK: string; SK: string } = {
      PK: `USER#${userId}`,
      SK: `ALERT#${alertId}`,
      alertId,
      userId,
      ...validation.data,
      isActive: true,
      createdAt: now,
    };

    await dbPut(alert as unknown as Record<string, unknown>);
    return NextResponse.json({ alertId, ...validation.data }, { status: 201 });
  } catch (err) {
    console.error('[alerts] POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const alerts = await dbQuery<JobAlert>(`USER#${userId}`, { skPrefix: 'ALERT#' });
    return NextResponse.json({ alerts, total: alerts.length });
  } catch (err) {
    console.error('[alerts] GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
