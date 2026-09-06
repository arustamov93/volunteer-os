import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePrivilegedRequest } from '@/lib/security';
import { sendTelegramMessage } from '@/lib/telegram-api';

export async function POST(req: NextRequest) {
  try {
    // Check authorization: only admin or manager can broadcast
    const authError = requirePrivilegedRequest(req, ['admin', 'manager', 'coordinator']);
    if (authError) return authError;

    let message = '';
    let roles: string[] = [];
    let userIds: string[] = [];
    let projectId: string | null = null;
    let organizationId: string | null = null;
    let attachment: { buffer: Buffer; fileName: string; fileType: string } | undefined = undefined;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      message = (formData.get('message') as string) || '';
      
      const rolesRaw = formData.get('roles');
      if (rolesRaw) {
        try {
          roles = JSON.parse(rolesRaw as string);
        } catch {
          roles = (rolesRaw as string).split(',').filter(Boolean);
        }
      }

      const userIdsRaw = formData.get('userIds');
      if (userIdsRaw) {
        try {
          userIds = JSON.parse(userIdsRaw as string);
        } catch {
          userIds = (userIdsRaw as string).split(',').filter(Boolean);
        }
      }

      projectId = (formData.get('projectId') as string) || null;
      organizationId = (formData.get('organizationId') as string) || null;

      const file = formData.get('file') as File | null;
      if (file && typeof file !== 'string' && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        attachment = {
          buffer: Buffer.from(arrayBuffer),
          fileName: file.name,
          fileType: file.type || 'application/octet-stream'
        };
      }
    } else {
      const body = await req.json();
      message = body.message || '';
      roles = body.roles || [];
      userIds = body.userIds || [];
      projectId = body.projectId || null;
      organizationId = body.organizationId || null;
    }

    if (!message.trim() && !attachment) {
      return NextResponse.json({ error: 'Укажите текст сообщения или прикрепите файл' }, { status: 400 });
    }

    // Determine target users based on targeting mode
    let targetUserIds: string[] = [];

    if (userIds && userIds.length > 0) {
      // Selective user targeting
      targetUserIds = userIds;
    } else if (projectId) {
      // Target users involved in project tasks
      const tasks = await prisma.task.findMany({
        where: { projectId: projectId, assignedTo: { not: null } },
        select: { assignedTo: true }
      });
      targetUserIds = Array.from(new Set(tasks.map(t => t.assignedTo).filter(Boolean) as string[]));
    } else if (organizationId) {
      // Target approved organization members
      const memberships = await prisma.organizationMembership.findMany({
        where: { orgId: organizationId, status: 'approved' },
        select: { userId: true }
      });
      targetUserIds = memberships.map(m => m.userId);
    }

    let whereClause: any = {
      telegramId: { not: null }
    };

    if (targetUserIds.length > 0) {
      whereClause.id = { in: targetUserIds };
    } else if (roles && roles.length > 0) {
      whereClause.role = { in: roles };
    } else {
      return NextResponse.json({ error: 'Не выбраны получатели рассылки' }, { status: 400 });
    }

    // Fetch matching users with valid Telegram accounts
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        telegramId: true,
        fullName: true
      }
    });

    if (users.length === 0) {
      return NextResponse.json({ 
        success: true, 
        count: 0, 
        message: 'Нет пользователей с привязанным Telegram среди выбранных получателей' 
      });
    }

    let successCount = 0;
    const BATCH_SIZE = 25;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const chunk = users.slice(i, i + BATCH_SIZE);
      await Promise.all(
        chunk.map(async (user) => {
          if (!user.telegramId) return;
          const success = await sendTelegramMessage(
            Number(user.telegramId),
            message || (attachment ? `📎 [Файл: ${attachment.fileName}]` : ''),
            undefined,
            'Markdown',
            attachment
          );
          if (success) {
            successCount++;
          }
        })
      );
      if (i + BATCH_SIZE < users.length) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    return NextResponse.json({
      success: true,
      count: successCount,
      totalAttempted: users.length
    });

  } catch (error) {
    console.error('Broadcast API error:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
