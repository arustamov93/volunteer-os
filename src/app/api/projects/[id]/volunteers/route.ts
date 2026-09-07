import { NextRequest, NextResponse } from 'next/server';
import { prisma, db } from '@/lib/db';
import { requireSessionRequest } from '@/lib/security';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireSessionRequest(req, ['admin', 'manager', 'coordinator'] as any);
    if ('response' in auth) return auth.response;

    const { id: projectId } = await params;

    // Verify project exists
    const project = await db.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
    }

    // Find all distinct volunteer IDs associated with this project via tasks or checkins
    const [projectTasks, projectCheckins] = await Promise.all([
      prisma.task.findMany({
        where: { projectId, assignedTo: { not: null } },
        select: { id: true, assignedTo: true, status: true, title: true }
      }),
      prisma.checkIn.findMany({
        where: { projectId },
        select: { id: true, userId: true }
      })
    ]);

    const taskCountByUser: Record<string, number> = {};
    for (const t of projectTasks) {
      if (t.assignedTo) {
        taskCountByUser[t.assignedTo] = (taskCountByUser[t.assignedTo] || 0) + 1;
      }
    }

    const checkinCountByUser: Record<string, number> = {};
    for (const c of projectCheckins) {
      if (c.userId) {
        checkinCountByUser[c.userId] = (checkinCountByUser[c.userId] || 0) + 1;
      }
    }

    const allVolunteerIds = Array.from(
      new Set([...Object.keys(taskCountByUser), ...Object.keys(checkinCountByUser)])
    );

    if (allVolunteerIds.length === 0) {
      return NextResponse.json({ volunteers: [] });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: allVolunteerIds } },
      select: {
        id: true,
        fullName: true,
        login: true,
        phone: true,
        telegramId: true,
        avatarUrl: true,
        rating: true,
        xp: true,
        level: true,
        role: true,
        availabilityStatus: true
      },
      orderBy: { fullName: 'asc' }
    });

    const volunteers = users.map((u) => ({
      id: u.id,
      full_name: u.fullName,
      login: u.login,
      phone: u.phone,
      telegram_id: u.telegramId ? Number(u.telegramId) : null,
      avatar_url: u.avatarUrl,
      rating: u.rating,
      xp: u.xp,
      level: u.level,
      role: u.role,
      availability_status: u.availabilityStatus,
      tasks_count: taskCountByUser[u.id] || 0,
      checkins_count: checkinCountByUser[u.id] || 0
    }));

    return NextResponse.json({ volunteers });
  } catch (error) {
    console.error('Failed to get project volunteers:', error);
    return NextResponse.json({ error: 'Ошибка при загрузке волонтеров проекта' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireSessionRequest(req, ['admin', 'manager', 'coordinator'] as any);
    if ('response' in auth) return auth.response;

    const { id: projectId } = await params;

    const { searchParams } = new URL(req.url);
    let volunteerId = searchParams.get('volunteerId');

    if (!volunteerId) {
      const body = await req.json().catch(() => ({}));
      volunteerId = body.volunteerId || body.userId;
    }

    if (!volunteerId) {
      return NextResponse.json({ error: 'volunteerId обязателен для удаления' }, { status: 400 });
    }

    // Delete all tasks for this volunteer in this specific project
    const deletedTasks = await prisma.task.deleteMany({
      where: {
        projectId,
        assignedTo: volunteerId
      }
    });

    // Also remove from fallback JSON DB if active
    try {
      const fallbackData = (db as any).getFallbackData ? (db as any).getFallbackData() : null;
      if (fallbackData && fallbackData.tasks) {
        fallbackData.tasks = fallbackData.tasks.filter(
          (t: any) => !(t.project_id === projectId && t.assigned_to === volunteerId)
        );
        (db as any).saveFallbackData?.(fallbackData);
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Волонтер успешно исключен из проекта',
      deletedTasksCount: deletedTasks.count,
      volunteerId
    });
  } catch (error) {
    console.error('Failed to remove volunteer from project:', error);
    return NextResponse.json({ error: 'Ошибка при удалении волонтера из проекта' }, { status: 500 });
  }
}
