import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSessionRequest } from '@/lib/security';

export async function GET(req: NextRequest) {
  try {
    const auth = requireSessionRequest(req);
    const { searchParams } = new URL(req.url);
    const paramVolunteerId = searchParams.get('volunteerId');
    const projectId = searchParams.get('projectId');

    let sessionUser: any = null;
    if ('session' in auth) {
      sessionUser = auth.session;
    } else if (paramVolunteerId) {
      const volUser = await db.getUser(paramVolunteerId);
      if (volUser && volUser.role === 'volunteer') {
        sessionUser = { userId: volUser.id, role: 'volunteer', fullName: volUser.full_name, login: volUser.login || '' };
      }
    }

    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const volunteerId = sessionUser.role === 'volunteer' ? sessionUser.userId : paramVolunteerId;
    const chats = await db.getChats();

    // 1. If projectId query is specified, return only that project's chat
    if (projectId) {
      if (sessionUser.role === 'volunteer') {
        const allTasks = await db.getTasks();
        const canAccessProject = allTasks.some(t => t.project_id === projectId && t.assigned_to === sessionUser.userId);
        if (!canAccessProject) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      let projectChat = chats.find(c => c.type === 'project' && c.project_id === projectId);
      if (!projectChat) {
        const project = await db.getProject(projectId);
        projectChat = await db.createChat({
          type: 'project',
          title: project ? `Обсуждение: ${project.title}` : 'Обсуждение проекта',
          project_id: projectId,
          volunteer_id: null,
          target_org_id: null
        });
      }
      return NextResponse.json([projectChat]);
    }

    // 2. If volunteerId is specified, return direct chats + project chats they are assigned to
    if (volunteerId) {
      const volChats = chats.filter(c => c.volunteer_id === volunteerId);
      
      // Find projects where the volunteer has assigned tasks
      const allTasks = await db.getTasks();
      const volTasks = allTasks.filter(t => t.assigned_to === volunteerId);
      const assignedProjIds = Array.from(new Set(volTasks.map(t => t.project_id)));

      // Fetch or create project chats for assigned projects
      const projChats = chats.filter(c => c.type === 'project' && c.project_id && assignedProjIds.includes(c.project_id));
      const finalProjChats = [...projChats];

      for (const projId of assignedProjIds) {
        if (!finalProjChats.some(c => c.project_id === projId)) {
          const project = await db.getProject(projId);
          const newProjChat = await db.createChat({
            type: 'project',
            title: project ? `Обсуждение: ${project.title}` : 'Обсуждение проекта',
            project_id: projId,
            volunteer_id: null,
            target_org_id: null
          });
          finalProjChats.push(newProjChat);
        }
      }

      return NextResponse.json([...volChats, ...finalProjChats]);
    }

    // 3. For admins/coordinators, return all chats to allow replying
    return NextResponse.json(chats);
  } catch (error) {
    console.error('Failed to fetch chats:', error);
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireSessionRequest(req);
    const body = await req.json();
    const { type, title, project_id, volunteer_id, target_org_id } = body;

    let sessionUser: any = null;
    if ('session' in auth) {
      sessionUser = auth.session;
    } else if (volunteer_id) {
      const volUser = await db.getUser(volunteer_id);
      if (volUser && volUser.role === 'volunteer') {
        sessionUser = { userId: volUser.id, role: 'volunteer', fullName: volUser.full_name, login: volUser.login || '' };
      }
    }

    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!type || !title) {
      return NextResponse.json({ error: 'Type and title are required' }, { status: 400 });
    }

    const isManager = ['admin', 'manager', 'coordinator'].includes(sessionUser.role);
    if (!isManager && volunteer_id !== sessionUser.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const newChat = await db.createChat({
      type,
      title,
      project_id: project_id || null,
      volunteer_id: isManager ? (volunteer_id || null) : sessionUser.userId,
      target_org_id: target_org_id || null
    });

    return NextResponse.json(newChat, { status: 201 });
  } catch (error) {
    console.error('Failed to create chat:', error);
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
  }
}
