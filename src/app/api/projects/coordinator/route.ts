import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSessionRequest } from '@/lib/security';

export async function GET(req: NextRequest) {
  // Allow coordinator, manager, and admin roles
  const auth = requireSessionRequest(req, ['coordinator', 'manager', 'admin'] as any);
  if ('response' in auth) return auth.response;
  const session = auth.session!;

  try {
    const allProjects = await db.getProjects();
    const allTasks = await db.getTasks();
    const allUsers = await db.getUsers();

    // Find the actual coordinator user record to get their stable login
    let coordUser = await db.getUser(session.userId).catch(() => null);
    if (!coordUser && session.login) {
      coordUser = await db.getUserByLogin(session.login).catch(() => null);
    }

    // Build a set of all possible IDs for this coordinator
    const coordIds = new Set<string>([session.userId]);
    if (coordUser?.id) coordIds.add(coordUser.id);

    // Also find users with same login to handle ID changes across sessions
    const matchingUsers = allUsers.filter((u: any) =>
      u.login === session.login || (coordUser && u.login === coordUser.login)
    );
    matchingUsers.forEach((u: any) => coordIds.add(u.id));

    // Filter projects assigned to this coordinator (by any of their possible IDs)
    let myProjects = allProjects.filter((p: any) =>
      p.coordinator_id && coordIds.has(p.coordinator_id)
    );

    // If caller is admin/manager and has no specific coordinator projects, allow viewing all
    if (myProjects.length === 0 && (session.role === 'admin' || session.role === 'manager')) {
      myProjects = allProjects;
    }

    // Enrich each project with task and volunteer counts
    const enriched = myProjects.map((project: any) => {
      const projectTasks = allTasks.filter((t: any) => t.project_id === project.id);
      const completedTasks = projectTasks.filter((t: any) => t.status === 'completed').length;

      const volunteerIds = new Set(
        projectTasks.map((t: any) => t.assigned_to).filter(Boolean) as string[]
      );

      return {
        ...project,
        taskCount: projectTasks.length,
        completedTasks,
        volunteerCount: volunteerIds.size,
        is_my_project: project.coordinator_id ? coordIds.has(project.coordinator_id) : false,
      };
    });

    return NextResponse.json({ projects: enriched });
  } catch (error) {
    console.error('Coordinator projects fetch error:', error);
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }
}
