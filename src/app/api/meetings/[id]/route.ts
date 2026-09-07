import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSessionRequest } from '@/lib/security';

type Params = Promise<{ id: string }>;

export async function GET(req: NextRequest, segmentData: { params: Params }) {
  try {
    const auth = requireSessionRequest(req);
    if ('response' in auth) return auth.response;

    const { id } = await segmentData.params;
    const meeting = await db.getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    return NextResponse.json(meeting);
  } catch (error) {
    console.error('Failed to get meeting:', error);
    return NextResponse.json({ error: 'Failed to get meeting' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, segmentData: { params: Params }) {
  try {
    const auth = requireSessionRequest(req, ['admin', 'manager', 'coordinator']);
    if ('response' in auth) return auth.response;

    const { id } = await segmentData.params;
    const body = await req.json();

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

export async function DELETE(req: NextRequest, segmentData: { params: Params }) {
  try {
    const auth = requireSessionRequest(req, ['admin', 'manager', 'coordinator']);
    if ('response' in auth) return auth.response;

    const { id } = await segmentData.params;
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
