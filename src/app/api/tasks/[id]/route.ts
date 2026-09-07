import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram-api';
import { requireSessionRequest } from '@/lib/security';

type Params = Promise<{ id: string }>;

export async function PATCH(req: NextRequest, segmentData: { params: Params }) {
  try {
    const auth = requireSessionRequest(req);
    if ('response' in auth) return auth.response;

    const { id } = await segmentData.params;
    const body = await req.json();
    
    const oldTask = await db.getTask(id);
    if (!oldTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const isManager = ['admin', 'manager'].includes(auth.session.role);
    const isAssignedVolunteer = auth.session.role === 'volunteer' && oldTask.assigned_to === auth.session.userId;
    const isVolunteerClaimingOpenTask = auth.session.role === 'volunteer'
      && !oldTask.assigned_to
      && body.assigned_to === auth.session.userId
      && body.status === 'accepted';
    if (!isManager && !isAssignedVolunteer && !isVolunteerClaimingOpenTask) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isManager) {
      if (oldTask.is_overdue || new Date(oldTask.deadline) < new Date()) {
        return NextResponse.json({ error: 'Task is overdue and cannot be modified' }, { status: 403 });
      }

      const allowedVolunteerFields = new Set(isVolunteerClaimingOpenTask ? ['status', 'assigned_to'] : ['status']);
      for (const key of Object.keys(body)) {
        if (!allowedVolunteerFields.has(key)) {
          delete body[key];
        }
      }

      if (body.assigned_to && body.assigned_to !== auth.session.userId) {
        return NextResponse.json({ error: 'Volunteers can assign tasks only to themselves' }, { status: 403 });
      }

      if (body.status && !['accepted', 'completed'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status transition' }, { status: 400 });
      }
    }

    const updatedTask = await db.updateTask(id, body);

    // If assigned_to was changed, notify the new volunteer
    if (body.assigned_to && body.assigned_to !== oldTask.assigned_to) {
      const volunteer = await db.getUser(body.assigned_to);
      if (volunteer && volunteer.telegram_id) {
        const proj = await db.getProject(updatedTask.project_id);
        const text = `📬 *На вас назначена задача!*\n\n📌 *Название:* ${updatedTask.title}\n📂 *Проект:* ${proj ? proj.title : 'Не указан'}\n⏰ *Срок:* ${new Date(updatedTask.deadline).toLocaleDateString('ru-RU')}\n\nПримите задачу в работу с помощью кнопки ниже:`;
        
        await sendTelegramMessage(volunteer.telegram_id, text, [
          [{ text: '▶️ Принять задачу', callback_data: `start_${updatedTask.id}` }]
        ]);
      }
    }

    // If status was changed from web dashboard to accepted or completed, notify volunteer
    if (body.status && body.status !== oldTask.status && updatedTask.assigned_to) {
      const volunteer = await db.getUser(updatedTask.assigned_to);
      if (volunteer && volunteer.telegram_id) {
        if (body.status === 'accepted') {
          await sendTelegramMessage(
            volunteer.telegram_id, 
            `⚡ Ваша задача *"${updatedTask.title}"* переведена в статус *Принята*.`
          );
        } else if (body.status === 'completed') {
          await sendTelegramMessage(
            volunteer.telegram_id, 
            `✅ Ваша задача *"${updatedTask.title}"* отмечена как *Выполненная*. Спасибо за вашу работу! Рейтинг волонтера обновлен.`
          );
        }
      }
    }

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Failed to update task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, segmentData: { params: Params }) {
  try {
    const auth = requireSessionRequest(req, ['admin', 'manager', 'coordinator']);
    if ('response' in auth) return auth.response;

    const { id } = await segmentData.params;
    const task = await db.getTask(id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    await db.deleteTask(id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

