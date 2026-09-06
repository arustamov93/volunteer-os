import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSessionRequest } from '@/lib/security';

export async function GET(req: NextRequest) {
  try {
    const auth = requireSessionRequest(req);
    if ('response' in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let projects = await db.getProjects();

    if (status) {
      projects = projects.filter(p => p.status === status);
    }

    // Sort by creation date descending
    projects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireSessionRequest(req, ['admin', 'manager']);
    if ('response' in auth) return auth.response;

    const body = await req.json();
    const { title, description, status, start_date, end_date, latitude, longitude, allowed_radius_km, org_id, orgId } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const newProject = await db.createProject({
      title,
      description: description || '',
      status: status || 'planning',
      start_date: start_date || null,
      end_date: end_date || null,
      org_id: org_id || orgId || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      allowed_radius_km: allowed_radius_km ?? 0.5
    });

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

// PATCH /api/projects — update project details, dates, status, coordinator, or location
export async function PATCH(req: NextRequest) {
  try {
    const auth = requireSessionRequest(req, ['admin', 'manager', 'coordinator'] as any);
    if ('response' in auth) return auth.response;

    const body = await req.json();
    const projectId = body.projectId || body.id;
    const coordinatorId = body.coordinatorId !== undefined ? body.coordinatorId : body.coordinator_id;
    const orgId = body.orgId !== undefined ? body.orgId : body.org_id;
    const { status, latitude, longitude, allowed_radius_km, title, description } = body;
    const startDate = body.start_date !== undefined ? body.start_date : body.startDate;
    const endDate = body.end_date !== undefined ? body.end_date : body.endDate;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

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

    const updated = await db.updateProject(projectId, updates);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/projects — delete project (STRICTLY for admin / Руководитель)
export async function DELETE(req: NextRequest) {
  try {
    const auth = requireSessionRequest(req, ['admin']);
    if ('response' in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id') || searchParams.get('projectId');

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id || body?.projectId;
      } catch {}
    }

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
