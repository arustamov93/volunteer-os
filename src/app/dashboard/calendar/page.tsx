'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Briefcase, 
  Flag, 
  Plus, 
  Video, 
  Clock, 
  CheckSquare, 
  CheckCircle2, 
  Filter, 
  List, 
  LayoutGrid, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  X, 
  Search, 
  User, 
  AlertCircle,
  FolderKanban,
  Sparkles,
  Link2
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface Project {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Task {
  id: string;
  title: string;
  project_id: string;
  assigned_to?: string | null;
  deadline: string;
  status: string;
  is_overdue?: boolean;
}

interface Meeting {
  id: string;
  title: string;
  description?: string | null;
  scheduled_at: string;
  link?: string | null;
  project_id?: string | null;
  created_by?: string | null;
}

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
}

type CalendarItemType = 'meeting' | 'task' | 'project_start' | 'project_end';

interface UnifiedCalendarEvent {
  id: string;
  type: CalendarItemType;
  title: string;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  isoDateTime: string;
  projectId?: string | null;
  raw: any;
}

export default function CalendarPage() {
  const { t } = useTranslation();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Views
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');
  const [typeFilter, setTypeFilter] = useState<'all' | 'meetings' | 'tasks' | 'projects'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Creation Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<'meeting' | 'task'>('meeting');
  const [createDate, setCreateDate] = useState('');
  const [createTime, setCreateTime] = useState('11:00');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createLink, setCreateLink] = useState('');
  const [createProjectId, setCreateProjectId] = useState('');
  const [createAssignedTo, setCreateAssignedTo] = useState('');
  const [createStatus, setCreateStatus] = useState('pending');
  const [submitting, setSubmitting] = useState(false);

  // Event Detail / Edit Modal State
  const [selectedEvent, setSelectedEvent] = useState<UnifiedCalendarEvent | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('11:00');
  const [editDescription, setEditDescription] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editProjectId, setEditProjectId] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editStatus, setEditStatus] = useState('pending');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [projRes, tasksRes, meetRes, usersRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/tasks'),
        fetch('/api/meetings'),
        fetch('/api/users')
      ]);

      const [projData, tasksData, meetData, usersData] = await Promise.all([
        projRes.json().catch(() => []),
        tasksRes.json().catch(() => []),
        meetRes.json().catch(() => []),
        usersRes.json().catch(() => [])
      ]);

      setProjects(Array.isArray(projData) ? projData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setMeetings(Array.isArray(meetData) ? meetData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (e) {
      console.error('Failed to load calendar data', e);
    } finally {
      setLoading(false);
    }
  }

  // Parse ISO date string helper with local date preservation
  const parseDateTime = (isoString?: string | null) => {
    if (!isoString) return { dateStr: '', timeStr: '10:00' };
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return { dateStr: '', timeStr: '10:00' };
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return { dateStr, timeStr };
    } catch {
      return { dateStr: '', timeStr: '10:00' };
    }
  };

  // Convert raw items into UnifiedCalendarEvent array
  const allEvents = useMemo<UnifiedCalendarEvent[]>(() => {
    const list: UnifiedCalendarEvent[] = [];

    // Meetings
    meetings.forEach(m => {
      const { dateStr, timeStr } = parseDateTime(m.scheduled_at);
      if (dateStr) {
        list.push({
          id: `meet_${m.id}`,
          type: 'meeting',
          title: m.title,
          dateStr,
          timeStr,
          isoDateTime: m.scheduled_at,
          projectId: m.project_id,
          raw: m
        });
      }
    });

    // Tasks
    tasks.forEach(t => {
      const { dateStr, timeStr } = parseDateTime(t.deadline);
      if (dateStr) {
        list.push({
          id: `task_${t.id}`,
          type: 'task',
          title: t.title,
          dateStr,
          timeStr,
          isoDateTime: t.deadline,
          projectId: t.project_id,
          raw: t
        });
      }
    });

    // Project Starts
    projects.forEach(p => {
      if (p.start_date) {
        const { dateStr } = parseDateTime(p.start_date);
        if (dateStr) {
          list.push({
            id: `pstart_${p.id}`,
            type: 'project_start',
            title: `${t('calendar.start')}: ${p.title}`,
            dateStr,
            timeStr: '09:00',
            isoDateTime: p.start_date,
            projectId: p.id,
            raw: p
          });
        }
      }
      if (p.end_date) {
        const { dateStr } = parseDateTime(p.end_date);
        if (dateStr) {
          list.push({
            id: `pend_${p.id}`,
            type: 'project_end',
            title: `${t('calendar.end')}: ${p.title}`,
            dateStr,
            timeStr: '18:00',
            isoDateTime: p.end_date,
            projectId: p.id,
            raw: p
          });
        }
      }
    });

    // Sort by ISO datetime ascending
    list.sort((a, b) => new Date(a.isoDateTime).getTime() - new Date(b.isoDateTime).getTime());
    return list;
  }, [meetings, tasks, projects, t]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return allEvents.filter(event => {
      // Type filter
      if (typeFilter === 'meetings' && event.type !== 'meeting') return false;
      if (typeFilter === 'tasks' && event.type !== 'task') return false;
      if (typeFilter === 'projects' && !['project_start', 'project_end'].includes(event.type)) return false;

      // Project filter
      if (projectFilter !== 'all' && event.projectId !== projectFilter) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = event.title.toLowerCase().includes(q);
        const matchDesc = event.raw?.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }

      return true;
    });
  }, [allEvents, typeFilter, projectFilter, searchQuery]);

  // Calendar Grid Calculations
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Adjust to start week on Monday (0 = Monday, 6 = Sunday)
    const startDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    return { daysInMonth, startDay };
  };

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const today = () => setCurrentDate(new Date());

  const { daysInMonth, startDay } = getDaysInMonth(currentDate);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: startDay }, (_, i) => i);

  const monthNames = [
    t('calendar.jan'), t('calendar.feb'), t('calendar.mar'), t('calendar.apr'), t('calendar.may'), t('calendar.jun'),
    t('calendar.jul'), t('calendar.aug'), t('calendar.sep'), t('calendar.oct'), t('calendar.nov'), t('calendar.dec')
  ];

  // Open Create Modal with optional pre-filled date
  const openCreateModal = (prefilledDate?: string, defaultType: 'meeting' | 'task' = 'meeting') => {
    const d = prefilledDate || new Date().toISOString().split('T')[0];
    setCreateDate(d);
    setCreateTime('11:00');
    setCreateType(defaultType);
    setCreateTitle('');
    setCreateDescription('');
    setCreateLink('');
    setCreateProjectId(projects[0]?.id || '');
    setCreateAssignedTo('');
    setCreateStatus('pending');
    setIsCreateOpen(true);
  };

  // Open Event Details
  const handleEventClick = (event: UnifiedCalendarEvent) => {
    setSelectedEvent(event);
    setIsEditMode(false);
    setEditTitle(event.raw.title || event.title);
    setEditDate(event.dateStr);
    setEditTime(event.timeStr || '11:00');
    setEditDescription(event.raw.description || '');
    setEditLink(event.raw.link || '');
    setEditProjectId(event.projectId || (projects[0]?.id || ''));
    setEditAssignedTo(event.raw.assigned_to || '');
    setEditStatus(event.raw.status || 'pending');
    setIsDetailOpen(true);
  };

  // Handle Event Creation
  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!createTitle.trim() || !createDate) return;

    setSubmitting(true);
    try {
      const [year, month, day] = createDate.split('-').map(Number);
      const [hours, minutes] = (createTime || '11:00').split(':').map(Number);
      const scheduledDate = new Date(year, month - 1, day, hours, minutes);
      const scheduledIso = scheduledDate.toISOString();

      if (createType === 'meeting') {
        const res = await fetch('/api/meetings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: createTitle.trim(),
            description: createDescription.trim(),
            scheduled_at: scheduledIso,
            link: createLink.trim(),
            project_id: createProjectId || null
          })
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || 'Ошибка при создании встречи');
          return;
        }
      } else {
        // Task
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: createTitle.trim(),
            project_id: createProjectId || (projects[0]?.id || ''),
            deadline: scheduledIso,
            assigned_to: createAssignedTo || null,
            status: createStatus
          })
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || 'Ошибка при создании задачи');
          return;
        }
      }

      setIsCreateOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Create event error:', err);
      alert('Ошибка при сохранении события');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Edit Submit
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEvent || !editTitle.trim() || !editDate) return;

    setActionLoading(true);
    try {
      const [year, month, day] = editDate.split('-').map(Number);
      const [hours, minutes] = (editTime || '11:00').split(':').map(Number);
      const scheduledDate = new Date(year, month - 1, day, hours, minutes);
      const scheduledIso = scheduledDate.toISOString();

      if (selectedEvent.type === 'meeting') {
        const res = await fetch(`/api/meetings/${selectedEvent.raw.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editTitle.trim(),
            description: editDescription.trim(),
            scheduled_at: scheduledIso,
            link: editLink.trim(),
            project_id: editProjectId || null
          })
        });
        if (!res.ok) throw new Error('Не удалось обновить встречу');
      } else if (selectedEvent.type === 'task') {
        const res = await fetch(`/api/tasks/${selectedEvent.raw.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editTitle.trim(),
            deadline: scheduledIso,
            project_id: editProjectId,
            assigned_to: editAssignedTo || null,
            status: editStatus
          })
        });
        if (!res.ok) throw new Error('Не удалось обновить задачу');
      }

      setIsDetailOpen(false);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Ошибка обновления');
    } finally {
      setActionLoading(false);
    }
  }

  // Quick Toggle Task Status
  async function handleToggleTaskStatus(task: Task) {
    setActionLoading(true);
    try {
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        await fetchData();
        if (selectedEvent && selectedEvent.raw.id === task.id) {
          setSelectedEvent({
            ...selectedEvent,
            raw: { ...selectedEvent.raw, status: nextStatus }
          });
        }
      }
    } catch (err) {
      console.error('Failed to toggle task status:', err);
    } finally {
      setActionLoading(false);
    }
  }

  // Delete Event
  async function handleDeleteEvent() {
    if (!selectedEvent) return;
    const confirmText = selectedEvent.type === 'meeting' 
      ? 'Удалить эту встречу из расписания?' 
      : 'Удалить эту задачу?';
    if (!confirm(confirmText)) return;

    setActionLoading(true);
    try {
      if (selectedEvent.type === 'meeting') {
        const res = await fetch(`/api/meetings/${selectedEvent.raw.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Не удалось удалить встречу');
      } else if (selectedEvent.type === 'task') {
        const res = await fetch(`/api/tasks/${selectedEvent.raw.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Не удалось удалить задачу');
      }

      setIsDetailOpen(false);
      setSelectedEvent(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления');
    } finally {
      setActionLoading(false);
    }
  }

  // Month Statistics
  const monthYearKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthTasks = tasks.filter(t => t.deadline?.startsWith(monthYearKey));
  const currentMonthMeetings = meetings.filter(m => m.scheduled_at?.startsWith(monthYearKey));
  const completedTasksCount = currentMonthTasks.filter(t => t.status === 'completed').length;
  const pendingTasksCount = currentMonthTasks.filter(t => t.status !== 'completed').length;

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center bg-[#F9FAFB]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3"></div>
        <span className="text-xs text-slate-500 font-medium">Загрузка расписания и календаря...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                {t('calendar.title')}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Trello Pro Suite
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('calendar.subtitle')}
              </p>
            </div>
          </div>
        </div>
        
        {/* Top Actions: View toggle & Add button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'month' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {t('calendar.viewMonth')}
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'agenda' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              {t('calendar.viewAgenda')}
            </button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button 
              onClick={today} 
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors border-r border-slate-100"
            >
              {t('calendar.today')}
            </button>
            <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold px-2 text-center text-slate-900 min-w-[120px]">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Add Event Button */}
          <button
            onClick={() => openCreateModal()}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm hover:shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            {t('calendar.addEvent')}
          </button>
        </div>
      </div>

      {/* Mini Executive Dashboard Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">{t('calendar.statTotal')}</div>
            <div className="text-base font-bold text-slate-900">{currentMonthMeetings.length + currentMonthTasks.length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">{t('calendar.statMeetings')}</div>
            <div className="text-base font-bold text-slate-900">{currentMonthMeetings.length}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">{t('calendar.statPending')}</div>
            <div className="text-base font-bold text-slate-900">{pendingTasksCount}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">{t('calendar.statCompleted')}</div>
            <div className="text-base font-bold text-slate-900">{completedTasksCount}</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              typeFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t('calendar.allTypes')} ({allEvents.length})
          </button>
          <button
            onClick={() => setTypeFilter('meetings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              typeFilter === 'meetings'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/60'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            {t('calendar.meetingsTab')} ({meetings.length})
          </button>
          <button
            onClick={() => setTypeFilter('tasks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              typeFilter === 'tasks'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            {t('calendar.tasksTab')} ({tasks.length})
          </button>
          <button
            onClick={() => setTypeFilter('projects')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              typeFilter === 'projects'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            {t('calendar.projectsTab')}
          </button>
        </div>

        {/* Project Selector & Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">{t('calendar.allProjects')}</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск дел..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36 sm:w-44"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'month' ? (
        /* MONTH GRID VIEW */
        <div className="glass-panel bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
            {[t('calendar.mon'), t('calendar.tue'), t('calendar.wed'), t('calendar.thu'), t('calendar.fri'), t('calendar.sat'), t('calendar.sun')].map(day => (
              <div key={day} className="py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-100 last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 min-h-[620px] auto-rows-fr">
            {emptyDays.map(i => (
              <div key={`empty-${i}`} className="border-r border-b border-slate-100/80 bg-slate-50/30"></div>
            ))}
            
            {daysArray.map(day => {
              const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              
              // Events for this day from filtered list
              const dayEvents = filteredEvents.filter(e => e.dateStr === dateStr);
              const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

              return (
                <div 
                  key={day} 
                  className={`group relative border-r border-b border-slate-100/90 p-2 flex flex-col gap-1 transition-all hover:bg-slate-50/70 min-h-[115px] ${
                    isToday ? 'bg-indigo-50/25' : 'bg-white'
                  }`}
                >
                  {/* Day Header with + Button on Hover */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-transform ${
                      isToday ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200' : 'text-slate-700'
                    }`}>
                      {day}
                    </span>

                    <button
                      onClick={() => openCreateModal(dateStr)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
                      title="Добавить дело на этот день"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  {/* Event Pills */}
                  <div className="flex-1 space-y-1 mt-1 overflow-y-auto max-h-28 no-scrollbar pr-0.5">
                    {dayEvents.map(event => {
                      if (event.type === 'meeting') {
                        return (
                          <div 
                            key={event.id}
                            onClick={() => handleEventClick(event)}
                            className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-purple-50 text-purple-700 border border-purple-200/80 hover:bg-purple-100 hover:border-purple-300 transition-all cursor-pointer flex items-center justify-between gap-1 shadow-sm group/card"
                            title={`Встреча: ${event.title} (${event.timeStr})`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <Video className="w-3 h-3 text-purple-600 shrink-0" />
                              <span className="truncate">{event.title}</span>
                            </div>
                            <span className="text-[9px] font-mono text-purple-600 bg-purple-100/80 px-1 py-0.5 rounded shrink-0">
                              {event.timeStr}
                            </span>
                          </div>
                        );
                      }

                      if (event.type === 'task') {
                        const isDone = event.raw.status === 'completed';
                        return (
                          <div 
                            key={event.id}
                            onClick={() => handleEventClick(event)}
                            className={`px-2 py-1 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-1 shadow-sm group/card ${
                              isDone
                                ? 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                                : 'bg-indigo-50/90 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                            }`}
                            title={`Задача: ${event.title} (${event.timeStr})`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <CheckSquare className={`w-3 h-3 shrink-0 ${isDone ? 'text-emerald-500' : 'text-indigo-600'}`} />
                              <span className="truncate">{event.title}</span>
                            </div>
                            <span className={`text-[9px] font-mono px-1 py-0.5 rounded shrink-0 ${
                              isDone ? 'bg-slate-200 text-slate-500' : 'bg-indigo-100 text-indigo-600'
                            }`}>
                              {event.timeStr}
                            </span>
                          </div>
                        );
                      }

                      if (event.type === 'project_start') {
                        return (
                          <div 
                            key={event.id}
                            onClick={() => handleEventClick(event)}
                            className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 truncate flex items-center gap-1 cursor-pointer hover:bg-emerald-100"
                            title={event.title}
                          >
                            <Flag className="w-2.5 h-2.5 shrink-0 text-emerald-600" /> 
                            <span className="truncate">{event.title}</span>
                          </div>
                        );
                      }

                      if (event.type === 'project_end') {
                        return (
                          <div 
                            key={event.id}
                            onClick={() => handleEventClick(event)}
                            className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-rose-50 text-rose-700 border border-rose-200 truncate flex items-center gap-1 cursor-pointer hover:bg-rose-100"
                            title={event.title}
                          >
                            <Flag className="w-2.5 h-2.5 shrink-0 text-rose-600" /> 
                            <span className="truncate">{event.title}</span>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* AGENDA / SCHEDULE VIEW (TRELLO CHRONOLOGICAL VIEW) */
        <div className="space-y-4">
          {filteredEvents.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                <CalendarIcon className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Нет запланированных дел</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                По выбранным фильтрам и периоду событий не найдено. Нажмите «+ Добавить дело / встречу», чтобы составить расписание.
              </p>
              <button
                onClick={() => openCreateModal()}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Создать первое дело
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredEvents.map(event => {
                const isMeeting = event.type === 'meeting';
                const isTask = event.type === 'task';
                const isProjectEvent = ['project_start', 'project_end'].includes(event.type);
                const isDone = isTask && event.raw.status === 'completed';

                const assignedUser = isTask && event.raw.assigned_to 
                  ? users.find(u => u.id === event.raw.assigned_to) 
                  : null;

                const project = projects.find(p => p.id === event.projectId);

                return (
                  <div
                    key={event.id}
                    className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isDone 
                        ? 'border-slate-200 opacity-75 bg-slate-50/50' 
                        : isMeeting 
                          ? 'border-purple-200/80 hover:border-purple-300' 
                          : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {/* Left details */}
                    <div className="flex items-start gap-3.5">
                      {/* Category Icon */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        isMeeting
                          ? 'bg-purple-100 text-purple-700'
                          : isTask
                            ? isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isMeeting && <Video className="w-5 h-5" />}
                        {isTask && <CheckSquare className="w-5 h-5" />}
                        {isProjectEvent && <Flag className="w-5 h-5" />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isMeeting
                              ? 'bg-purple-100 text-purple-800'
                              : isTask
                                ? isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-800'
                          }`}>
                            {isMeeting ? 'Встреча' : isTask ? (isDone ? 'Выполнено' : 'Задача') : 'Проект'}
                          </span>

                          <span className="text-xs font-bold text-slate-900">
                            {event.dateStr}
                          </span>
                          <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {event.timeStr}
                          </span>

                          {project && (
                            <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <FolderKanban className="w-3 h-3 text-slate-400" />
                              {project.title}
                            </span>
                          )}
                        </div>

                        <h4 className={`text-sm font-bold text-slate-900 ${isDone ? 'line-through text-slate-500' : ''}`}>
                          {event.title}
                        </h4>

                        {event.raw.description && (
                          <p className="text-xs text-slate-600 line-clamp-2 max-w-2xl">
                            {event.raw.description}
                          </p>
                        )}

                        {assignedUser && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-0.5">
                            <User className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Исполнитель: <strong className="text-slate-800">{assignedUser.full_name}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {isMeeting && event.raw.link && (
                        <a
                          href={event.raw.link.startsWith('http') ? event.raw.link : `https://${event.raw.link}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition-colors"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Войти в звонок
                        </a>
                      )}

                      {isTask && (
                        <button
                          onClick={() => handleToggleTaskStatus(event.raw)}
                          disabled={actionLoading}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                            isDone 
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' 
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {isDone ? 'В работу' : 'Выполнено'}
                        </button>
                      )}

                      <button
                        onClick={() => handleEventClick(event)}
                        className="p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition-colors"
                        title="Подробнее и редактировать"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE EVENT MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Новое событие в календарь</h3>
                <p className="text-xs text-slate-500">Запланируйте встречу или поставьте задачу сотрудникам</p>
              </div>
            </div>

            {/* Event Type Switcher */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl mb-5">
              <button
                type="button"
                onClick={() => setCreateType('meeting')}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                  createType === 'meeting'
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Video className="w-4 h-4 text-purple-600" />
                Встреча / Митинг
              </button>
              <button
                type="button"
                onClick={() => setCreateType('task')}
                className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                  createType === 'task'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckSquare className="w-4 h-4 text-indigo-600" />
                Задача / Дело
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {createType === 'meeting' ? 'Название встречи / планерки *' : 'Название задачи / дела *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={createType === 'meeting' ? 'Например: Планерка координаторов проектов' : 'Например: Согласовать списки волонтеров'}
                  value={createTitle}
                  onChange={e => setCreateTitle(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Дата *
                  </label>
                  <input
                    type="date"
                    required
                    value={createDate}
                    onChange={e => setCreateDate(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {createType === 'meeting' ? 'Время начала *' : 'Дедлайн (время) *'}
                  </label>
                  <input
                    type="time"
                    required
                    value={createTime}
                    onChange={e => setCreateTime(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              {/* Project Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {createType === 'task' ? 'Проект (обязательно) *' : 'Привязать к проекту (опционально)'}
                </label>
                <select
                  required={createType === 'task'}
                  value={createProjectId}
                  onChange={e => setCreateProjectId(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {createType === 'meeting' && <option value="">Без привязки (Общее мероприятие компании)</option>}
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              {/* Conditional: Meeting Link vs Task Assignee */}
              {createType === 'meeting' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ссылка на видеозвонок (Google Meet / Zoom / Telegram)
                  </label>
                  <div className="relative">
                    <Link2 className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="url"
                      placeholder="https://meet.google.com/xxx-xxxx-xxx"
                      value={createLink}
                      onChange={e => setCreateLink(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ответственный сотрудник / волонтер
                  </label>
                  <select
                    value={createAssignedTo}
                    onChange={e => setCreateAssignedTo(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="">Не назначен (общая задача проекта)</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role === 'manager' ? 'Руководитель' : u.role === 'coordinator' ? 'Координатор' : 'Волонтер'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {createType === 'meeting' ? 'Повестка дня и заметки' : 'Описание задачи'}
                </label>
                <textarea
                  rows={3}
                  placeholder={createType === 'meeting' ? 'Темы для обсуждения, вопросы планерки...' : 'Инструкции, детали выполнения задачи...'}
                  value={createDescription}
                  onChange={e => setCreateDescription(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {createType === 'meeting' ? 'Запланировать встречу' : 'Создать задачу'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVENT DETAIL & EDIT MODAL */}
      {isDetailOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsDetailOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            {!isEditMode ? (
              /* VIEW MODE */
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    selectedEvent.type === 'meeting'
                      ? 'bg-purple-100 text-purple-800'
                      : selectedEvent.type === 'task'
                        ? selectedEvent.raw.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                        : 'bg-slate-100 text-slate-800'
                  }`}>
                    {selectedEvent.type === 'meeting' ? 'Встреча / Митинг' : selectedEvent.type === 'task' ? 'Задача / Дело' : 'Проект'}
                  </span>
                  
                  {selectedEvent.type === 'task' && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      selectedEvent.raw.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {selectedEvent.raw.status === 'completed' ? 'Выполнено' : 'В работе'}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-900 leading-tight">
                  {selectedEvent.title}
                </h3>

                {/* Date & Time info */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                    <span><strong>Дата:</strong> {selectedEvent.dateStr}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span><strong>Время:</strong> {selectedEvent.timeStr}</span>
                  </div>
                </div>

                {/* Project Info */}
                {selectedEvent.projectId && (
                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-slate-400" />
                    <span>Проект: <strong className="text-slate-800">{projects.find(p => p.id === selectedEvent.projectId)?.title || 'Не указан'}</strong></span>
                  </div>
                )}

                {/* Meeting Link Button */}
                {selectedEvent.type === 'meeting' && selectedEvent.raw.link && (
                  <div className="pt-1">
                    <a
                      href={selectedEvent.raw.link.startsWith('http') ? selectedEvent.raw.link : `https://${selectedEvent.raw.link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                    >
                      <Video className="w-4 h-4" />
                      Открыть онлайн-встречу
                    </a>
                  </div>
                )}

                {/* Task Assignee */}
                {selectedEvent.type === 'task' && selectedEvent.raw.assigned_to && (
                  <div className="text-xs text-slate-600 flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <User className="w-4 h-4 text-indigo-500" />
                    <span>Ответственный: <strong className="text-slate-900">{users.find(u => u.id === selectedEvent.raw.assigned_to)?.full_name || 'Не назначен'}</strong></span>
                  </div>
                )}

                {/* Description */}
                {selectedEvent.raw.description && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 mb-1">Повестка / Описание:</h4>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 whitespace-pre-wrap">
                      {selectedEvent.raw.description}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {selectedEvent.type === 'task' && (
                      <button
                        onClick={() => handleToggleTaskStatus(selectedEvent.raw)}
                        disabled={actionLoading}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                          selectedEvent.raw.status === 'completed'
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {selectedEvent.raw.status === 'completed' ? 'Вернуть в работу' : 'Отметить выполненным'}
                      </button>
                    )}

                    {['meeting', 'task'].includes(selectedEvent.type) && (
                      <button
                        onClick={() => setIsEditMode(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Редактировать
                      </button>
                    )}
                  </div>

                  {['meeting', 'task'].includes(selectedEvent.type) && (
                    <button
                      onClick={handleDeleteEvent}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* EDIT MODE */
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    Редактирование {selectedEvent.type === 'meeting' ? 'встречи' : 'задачи'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEditMode(false)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Назад к просмотру
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Название *</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Дата *</label>
                    <input
                      type="date"
                      required
                      value={editDate}
                      onChange={e => setEditDate(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Время *</label>
                    <input
                      type="time"
                      required
                      value={editTime}
                      onChange={e => setEditTime(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Проект</label>
                  <select
                    value={editProjectId}
                    onChange={e => setEditProjectId(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {selectedEvent.type === 'meeting' && <option value="">Без проекта</option>}
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                {selectedEvent.type === 'meeting' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ссылка на встречу</label>
                    <input
                      type="url"
                      value={editLink}
                      onChange={e => setEditLink(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Исполнитель</label>
                    <select
                      value={editAssignedTo}
                      onChange={e => setEditAssignedTo(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="">Не назначен</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Описание / Заметки</label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditMode(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all"
                  >
                    {actionLoading ? 'Сохранение...' : 'Сохранить изменения'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
