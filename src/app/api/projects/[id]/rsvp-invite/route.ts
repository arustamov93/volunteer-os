import { NextRequest, NextResponse } from 'next/server';
import { db, prisma } from '@/lib/db';
import { requirePrivilegedRequest, getSessionFromRequest } from '@/lib/security';
import { sendTelegramMessage, TelegramButton } from '@/lib/telegram-api';

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requirePrivilegedRequest(req, ['admin', 'manager', 'coordinator']);
    if (authError) return authError;

    const session = getSessionFromRequest(req);

    const { id: projectId } = await params;
    const project = await db.getProject(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
    }

    // Validate Telegram bot token configuration
    const botConfig = await db.getBotConfig();
    const botToken = botConfig.bot_token || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken || botToken === 'MOCK_BOT_TOKEN' || botToken === '') {
      return NextResponse.json({ error: 'Telegram bot token is not configured' }, { status: 500 });
    }

    let customText: string | undefined;
    let includeButtons = false;
    let targetAudience = 'all';
    let attachment: { buffer: Buffer; fileName: string; fileType: string } | undefined = undefined;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      customText = (formData.get('customText') as string) || undefined;
      includeButtons = formData.get('includeButtons') === 'true';
      targetAudience = (formData.get('targetAudience') as string) || 'all';

      const file = formData.get('file') as File | null;
      if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        attachment = {
          buffer: Buffer.from(arrayBuffer),
          fileName: file.name,
          fileType: file.type || 'application/octet-stream'
        };
      }
    } else {
      const body = await req.json().catch(() => ({}));
      customText = body.customText;
      includeButtons = body.includeButtons === true;
      targetAudience = body.targetAudience || 'all';
    }

    // Build recipient filter based on targetAudience
    const whereClause: any = {
      role: 'volunteer',
      telegramId: { not: null }
    };

    if (targetAudience === 'senior') {
      whereClause.isSenior = true;
    } else if (targetAudience === 'project') {
      const projectTasks = await prisma.task.findMany({
        where: { projectId: projectId, assignedTo: { not: null } },
        select: { assignedTo: true }
      });
      const checkins = await prisma.checkIn.findMany({
        where: { projectId: projectId },
        select: { userId: true }
      });
      const userIds = Array.from(new Set([
        ...projectTasks.map(t => t.assignedTo!).filter(Boolean),
        ...checkins.map(c => c.userId).filter(Boolean)
      ]));
      whereClause.id = { in: userIds };
    } else if (targetAudience === 'organization' && (project.org_id || (project as any).orgId)) {
      const targetOrgId = project.org_id || (project as any).orgId;
      const orgMembers = await prisma.organizationMembership.findMany({
        where: { orgId: targetOrgId, status: 'approved' },
        select: { userId: true }
      });
      const userIds = Array.from(new Set(orgMembers.map(m => m.userId)));
      whereClause.id = { in: userIds };
    }

    if (session && session.role === 'coordinator') {
      const matchingUsers = await prisma.user.findMany({
        where: { login: session.login }
      });
      const coordIds = Array.from(new Set([session.userId, ...matchingUsers.map(u => u.id)]));

      const coordProjects = await prisma.project.findMany({
        where: { coordinatorId: { in: coordIds } },
        select: { id: true, orgId: true }
      });
      const projectIds = coordProjects.map(p => p.id);
      
      const orgMemberships = await prisma.organizationMembership.findMany({
        where: { userId: { in: coordIds }, status: 'approved' },
        select: { orgId: true }
      });
      
      const orgIds = new Set([
        ...coordProjects.map(p => p.orgId).filter(Boolean) as string[],
        ...orgMemberships.map(m => m.orgId)
      ]);
      
      const allowedTasks = await prisma.task.findMany({
        where: { projectId: { in: projectIds }, assignedTo: { not: null } },
        select: { assignedTo: true }
      });
      const allowedCheckins = await prisma.checkIn.findMany({
        where: { projectId: { in: projectIds } },
        select: { userId: true }
      });
      const allowedOrgMembers = await prisma.organizationMembership.findMany({
        where: { orgId: { in: Array.from(orgIds) }, status: 'approved' },
        select: { userId: true }
      });
      
      const allowedVolunteerIds = Array.from(new Set([
        ...allowedTasks.map(t => t.assignedTo!),
        ...allowedCheckins.map(c => c.userId),
        ...allowedOrgMembers.map(m => m.userId)
      ]));

      if (whereClause.id && whereClause.id.in) {
        whereClause.id.in = whereClause.id.in.filter((id: string) => allowedVolunteerIds.includes(id));
      } else {
        whereClause.id = { in: allowedVolunteerIds };
      }
    }

    // Find active volunteers matching the filter
    const volunteers = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        telegramId: true,
        fullName: true
      }
    });

    if (volunteers.length === 0) {
      return NextResponse.json({ error: 'В выбранном сегменте аудитории не найдено волонтеров с привязанным Telegram' }, { status: 400 });
    }

    // Default invitation text if customText is not provided
    const defaultText = `Assalomu alaykum, aziz volontyor! 🩺\n\n🎉 Sizni "${project.title}" loyihasi/tadbiri ishtirokchilari safida ko‘rishdan mamnun bo‘lamiz!\n\n${project.description || ''}\n\nIltimos, ushbu botdagi xabarlarni kuzatib boring.\n\n───────────────────────────\n\nЗдравствуйте, дорогой волонтёр! 🩺\n\n🎉 Будем рады видеть вас среди участников проекта "${project.title}"!\n\n${project.description || ''}\n\nПожалуйста, следите за сообщениями в данном боте.`;

    const textToSend = (customText && typeof customText === 'string' && customText.trim().length > 0)
      ? customText.trim()
      : defaultText;

    const keyboard: TelegramButton[][] | undefined = includeButtons ? [
      [{ text: '✅ Да, буду участвовать', callback_data: `rsvp_yes_${project.id}` }],
      [{ text: '❌ Не смогу', callback_data: `rsvp_no_${project.id}` }]
    ] : undefined;

    let successCount = 0;
    const BATCH_SIZE = 15;
    for (let i = 0; i < volunteers.length; i += BATCH_SIZE) {
      const chunk = volunteers.slice(i, i + BATCH_SIZE);
      await Promise.all(
        chunk.map(async (v) => {
          if (!v.telegramId) return;
          const ok = await sendTelegramMessage(Number(v.telegramId), textToSend, keyboard, 'Markdown', attachment);
          if (ok) successCount++;
        })
      );
      if (i + BATCH_SIZE < volunteers.length) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    return NextResponse.json({
      success: true,
      count: successCount,
      total: volunteers.length
    });
  } catch (error) {
    console.error('RSVP Invite error:', error);
    return NextResponse.json({ error: 'Ошибка отправки приглашений' }, { status: 500 });
  }
}
