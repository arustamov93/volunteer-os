import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram-api';
import { requireSessionRequest } from '@/lib/security';

export async function GET(req: NextRequest) {
  try {
    const auth = requireSessionRequest(req);
    if ('response' in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const assignedTo = searchParams.get('assignedTo') || searchParams.get('volunteerId'); // Support both
    const status = searchParams.get('status');

    let tasks = await db.getTasks();

    if (projectId) {
      tasks = tasks.filter(t => t.project_id === projectId);
    }

    if (auth.session.role === 'volunteer') {
      tasks = tasks.filter(t => t.assigned_to === auth.session.userId || !t.assigned_to);
    } else if (assignedTo) {
      tasks = tasks.filter(t => t.assigned_to === assignedTo);
    }

    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }

    // Sort by deadline ascending
    tasks.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireSessionRequest(req, ['admin', 'manager', 'coordinator']);
    if ('response' in auth) return auth.response;

    const body = await req.json();
    const { project_id, title, assigned_to, deadline } = body;

    if (!project_id || !title || !deadline) {
      return NextResponse.json({ error: 'Project ID, title, and deadline are required' }, { status: 400 });
    }

    const newTask = await db.createTask({
      project_id,
      title,
      status: 'pending',
      assigned_to: assigned_to || null,
      deadline
    });

    // Push notification to Telegram if a volunteer is assigned
    if (assigned_to) {
      const volunteer = await db.getUser(assigned_to);
      if (volunteer && volunteer.telegram_id) {
        const proj = await db.getProject(project_id);
        const text = `📬 *Новая задача для вас!*\n\n📌 *Название:* ${title}\n📂 *Проект:* ${proj ? proj.title : 'Не указан'}\n⏰ *Срок:* ${new Date(deadline).toLocaleDateString('ru-RU')}\n\nПожалуйста, примите задачу в работу с помощью кнопки ниже!`;
        
        await sendTelegramMessage(volunteer.telegram_id, text, [
          [{ text: '▶️ Принять задачу', callback_data: `start_${newTask.id}` }]
        ]);
      }
    }

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
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
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const existing = await db.getTask(id);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    await db.deleteTask(id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

