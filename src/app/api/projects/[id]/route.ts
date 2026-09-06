import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSessionRequest } from '@/lib/security';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireSessionRequest(req, ['admin']);
    if ('response' in auth) return auth.response;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    await db.deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireSessionRequest(req, ['admin', 'manager', 'coordinator'] as any);
    if ('response' in auth) return auth.response;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const coordinatorId = body.coordinatorId !== undefined ? body.coordinatorId : body.coordinator_id;
    const orgId = body.orgId !== undefined ? body.orgId : body.org_id;
    const { status, latitude, longitude, allowed_radius_km, title, description } = body;
    const startDate = body.start_date !== undefined ? body.start_date : body.startDate;
    const endDate = body.end_date !== undefined ? body.end_date : body.endDate;

    const updates: any = {};
    if (title !== undefined) updates.title = typeof title === 'string' ? title.trim() : title;
    if (description !== undefined) updates.description = typeof description === 'string' ? description.trim() : description;
    if (status !== undefined) updates.status = status;
    if (startDate !== undefined) updates.start_date = startDate ? new Date(startDate).toISOString() : null;
    if (endDate !== undefined) updates.end_date = endDate ? new Date(endDate).toISOString() : null;
    if (coordinatorId !== undefined) updates.coordinator_id = coordinatorId || null;
    if (orgId !== undefined) updates.org_id = orgId || null;
    if (latitude !== undefined) updates.latitude = latitude === null ? null : parseFloat(latitude);
    if (longitude !== undefined) updates.longitude = longitude === null ? null : parseFloat(longitude);
    if (allowed_radius_km !== undefined) updates.allowed_radius_km = parseFloat(allowed_radius_km);

    const updated = await db.updateProject(id, updates);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}
