import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSessionRequest } from '@/lib/security';

export async function GET(req: NextRequest) {
  try {
    const auth = requireSessionRequest(req);
    if ('response' in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    let meetings = await db.getMeetings();

    if (projectId) {
      meetings = meetings.filter(m => m.project_id === projectId);
    }

    // Sort by scheduled date ascending
    meetings.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    return NextResponse.json(meetings);
  } catch (error) {
    console.error('Failed to fetch meetings:', error);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireSessionRequest(req, ['admin', 'manager', 'coordinator']);
    if ('response' in auth) return auth.response;

    const body = await req.json();
    const { title, description, scheduled_at, link, project_id } = body;

    if (!title || !scheduled_at) {
      return NextResponse.json({ error: 'Title and scheduled time are required' }, { status: 400 });
    }

    const newMeeting = await db.createMeeting({
      title,
      description: description || '',
      scheduled_at,
      link: link || '',
      project_id: project_id || null,
      created_by: auth.session.userId
    });

    return NextResponse.json(newMeeting, { status: 201 });
  } catch (error) {
    console.error('Failed to create meeting:', error);
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = requireSessionRequest(req, ['admin', 'manager', 'coordinator']);
    if ('response' in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    const queryId = searchParams.get('id');
    const body = await req.json();
    const id = body.id || queryId;

    if (!id) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 });
    }

    const existing = await db.getMeeting(id);
    if (!existing) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const updated = await db.updateMeeting(id, {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.scheduled_at !== undefined && { scheduled_at: body.scheduled_at }),
      ...(body.link !== undefined && { link: body.link }),
      ...(body.project_id !== undefined && { project_id: body.project_id || null }),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update meeting:', error);
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = requireSessionRequest(req, ['admin', 'manager', 'coordinator']);
    if ('response' in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 });
    }

    const existing = await db.getMeeting(id);
    if (!existing) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    await db.deleteMeeting(id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Failed to delete meeting:', error);
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 });
  }
}
