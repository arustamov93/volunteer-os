'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FolderGit2, 
  Plus, 
  Activity, 
  Clock, 
  CheckCircle, 
  ChevronRight,
  Calendar,
  UserCheck,
  Megaphone,
  Users,
  X,
  Building2,
  Trash2,
  Pencil
} from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { useSWRConfig } from 'swr';
import RsvpModal from '@/components/RsvpModal';

interface Project {
  id: string;
  title: string;
  description: string;
  status: 'planning' | 'active' | 'completed';
  org_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  coordinator_id?: string | null;
}

interface VolunteerOrganization {
  id: string;
  name: string;
}

interface Coordinator {
  id: string;
  full_name: string;
  login?: string | null;
}

interface Task {
  id: string;
  project_id: string;
  title: string;
  status: string;
}

function toDateInputValue(dateStr?: string | null): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ProjectsPage() {
  const { mutate } = useSWRConfig();
  
  const { data: projects = [] } = useApi<Project[]>('/api/projects');
  const { data: tasks = [] } = useApi<Task[]>('/api/tasks');
  const { data: usersData } = useApi<any>('/api/users');
  const { data: organizationsData } = useApi<any>('/api/organizations');
  
  const rawUsers = Array.isArray(usersData?.users) ? usersData.users : (Array.isArray(usersData) ? usersData : []);
  const coordinators: Coordinator[] = rawUsers.filter((u: any) => ['coordinator', 'manager'].includes(u.role));
  const organizations: VolunteerOrganization[] = Array.isArray(organizationsData) ? organizationsData : [];

  const loading = !projects.length && !tasks.length && !usersData;

  // Current authenticated role
  const [role, setRole] = useState('manager');

  // New Project Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'planning' | 'active' | 'completed'>('planning');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [allowedRadiusKm, setAllowedRadiusKm] = useState<string>('0.5');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Project State
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editOrgId, setEditOrgId] = useState('');
  const [editStatus, setEditStatus] = useState<'planning' | 'active' | 'completed'>('planning');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  function openEditModal(proj: Project) {
    setEditingProject(proj);
    setEditTitle(proj.title || '');
    setEditDescription(proj.description || '');
    setEditOrgId(proj.org_id || '');
    setEditStatus(proj.status || 'planning');
    setEditStartDate(toDateInputValue(proj.start_date));
    setEditEndDate(toDateInputValue(proj.end_date));
  }

  async function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProject || !editTitle.trim()) return;
    setIsEditSubmitting(true);

    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: editingProject.id,
          title: editTitle.trim(),
          description: editDescription.trim(),
          org_id: editOrgId || null,
          status: editStatus,
          start_date: editStartDate ? new Date(editStartDate).toISOString() : null,
          end_date: editEndDate ? new Date(editEndDate).toISOString() : null,
        })
      });

      if (res.ok) {
        setEditingProject(null);
        mutate('/api/projects');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Ошибка при сохранении проекта');
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении проекта');
    } finally {
      setIsEditSubmitting(false);
    }
  }

  // Coordinator assignment
  const [assigningProjectId, setAssigningProjectId] = useState<string | null>(null);
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('');
  
  // Filter tab state
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'planning' | 'completed'>('all');

  async function handleUpdateProjectStatus(projectId: string, newStatus: 'planning' | 'active' | 'completed') {
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, status: newStatus })
      });
      if (res.ok) {
        mutate('/api/projects');
      } else {
        alert('Ошибка при обновлении статуса проекта');
      }
    } catch (e) {
      console.error(e);
      alert('Ошибка при обновлении статуса проекта');
    }
  }

  // RSVP Modal state
  const [rsvpProject, setRsvpProject] = useState<Project | null>(null);

  // Delete project state
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirmDeleteProject() {
    if (!deletingProject) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects?id=${deletingProject.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setDeletingProject(null);
        mutate('/api/projects');
        mutate('/api/tasks');
      } else {
        const err = await res.json();
        alert(err.error || 'Ошибка при удалении проекта');
      }
    } catch (e) {
      console.error(e);
      alert('Ошибка при удалении проекта');
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    const savedRole = localStorage.getItem('currentUserRole');
    if (savedRole) setRole(savedRole);

    const handleRoleChange = () => {
      const updated = localStorage.getItem('currentUserRole');
      if (updated) setRole(updated);
    };

    window.addEventListener('auth-session-change', handleRoleChange);
    return () => window.removeEventListener('auth-session-change', handleRoleChange);
  }, []);

  async function handleAssignCoordinator() {
    if (!assigningProjectId) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: assigningProjectId,
          coordinatorId: selectedCoordinatorId || null,
        }),
      });
      if (res.ok) {
        setAssigningProjectId(null);
        mutate('/api/projects');
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Ошибка при назначении координатора');
      }
    } catch (e) {
      console.error('Failed to assign coordinator', e);
      alert('Ошибка при сохранении координатора');
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          status,
          org_id: selectedOrgId || null,
          start_date: startDate ? new Date(startDate).toISOString() : null,
          end_date: endDate ? new Date(endDate).toISOString() : null,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          allowed_radius_km: parseFloat(allowedRadiusKm)
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        setTitle('');
        setDescription('');
        setSelectedOrgId('');
        setStartDate('');
        setEndDate('');
        setLatitude('');
        setLongitude('');
        setAllowedRadiusKm('0.5');
        mutate('/api/projects');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-24 bg-[#F9FAFB]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Реестр проектов</h2>
          <p className="text-xs text-slate-500 mt-1">
            Координация и мониторинг социальных инициатив
          </p>
        </div>
        {role === 'admin' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all duration-150 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            Новый проект
          </button>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit text-xs font-semibold">
        <button
          onClick={() => setSelectedStatusFilter('all')}
          className={`px-3.5 py-1.5 rounded-lg transition-all ${
            selectedStatusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Все ({projects.length})
        </button>
        <button
          onClick={() => setSelectedStatusFilter('active')}
          className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            selectedStatusFilter === 'active' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-blue-500" />
          Активные ({projects.filter(p => p.status === 'active').length})
        </button>
        <button
          onClick={() => setSelectedStatusFilter('planning')}
          className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            selectedStatusFilter === 'planning' ? 'bg-white text-amber-700 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          Подготовка ({projects.filter(p => p.status === 'planning').length})
        </button>
        <button
          onClick={() => setSelectedStatusFilter('completed')}
          className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            selectedStatusFilter === 'completed' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          Завершенные ({projects.filter(p => p.status === 'completed').length})
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects
          .filter((proj) => selectedStatusFilter === 'all' || proj.status === selectedStatusFilter)
          .map((proj) => {
          const projTasks = tasks.filter(t => t.project_id === proj.id);
          const completedTasks = projTasks.filter(t => t.status === 'completed').length;
          const progressPercent = projTasks.length > 0 
            ? Math.round((completedTasks / projTasks.length) * 100) 
            : 0;

          const statusColors = {
            planning: 'bg-amber-50 text-amber-700 border-amber-200',
            active: 'bg-blue-50 text-blue-700 border-blue-200',
            completed: 'bg-emerald-50 text-emerald-700 border-emerald-200'
          };

          const statusText = {
            planning: 'Подготовка',
            active: 'Активен',
            completed: 'Завершен'
          };

          const statusIcon = {
            planning: Clock,
            active: Activity,
            completed: CheckCircle
          }[proj.status];

          const IconComponent = statusIcon;

          return (
            <div key={proj.id} className="glass-panel p-6 bg-white flex flex-col justify-between min-h-[270px] h-full hover:border-slate-350 transition-all shadow-sm rounded-2xl">
              <div>
                {/* Header elements */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {proj.start_date ? new Date(proj.start_date).toLocaleDateString('ru-RU') : 'Начало не задано'}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    {['admin', 'manager'].includes(role) ? (
                      <select
                        value={proj.status}
                        onChange={(e) => handleUpdateProjectStatus(proj.id, e.target.value as any)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border cursor-pointer outline-none transition-all ${statusColors[proj.status]}`}
                        title="Нажмите, чтобы изменить статус проекта"
                      >
                        <option value="active">🔵 Активен</option>
                        <option value="planning">⏳ Подготовка</option>
                        <option value="completed">✅ Завершен</option>
                      </select>
                    ) : (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${statusColors[proj.status]}`}>
                        <IconComponent className="w-3.5 h-3.5" />
                        {statusText[proj.status]}
                      </span>
                    )}

                    {['admin', 'manager'].includes(role) && (
                      <button
                        onClick={() => openEditModal(proj)}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                        title="Редактировать проект и даты"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {role === 'admin' && (
                      <button
                        onClick={() => setDeletingProject(proj)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                        title="Удалить проект (доступно только Руководителю)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Title and description */}
                <div className="mt-3 space-y-1">
                  {proj.org_id && (
                    <span 
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold text-slate-700 bg-slate-100 border border-slate-200 shrink-0 max-w-[200px] truncate"
                      title={`Организация: ${organizations.find(o => o.id === proj.org_id)?.name || 'Организация'}`}
                    >
                      <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{organizations.find(o => o.id === proj.org_id)?.name || 'Организация'}</span>
                    </span>
                  )}
                  <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{proj.title}</h4>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                  {proj.description || 'Описание проекта отсутствует.'}
                </p>
              </div>

              {/* Progress and footer */}
              <div className="space-y-3 mt-4">
                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-medium">Выполнение задач</span>
                    <span className="font-bold text-slate-900">{completedTasks} / {projTasks.length} ({progressPercent}%)</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        proj.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-900'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Card footer details */}
                <div className="flex flex-col gap-2 pt-2.5 border-t border-slate-100">
                  {/* Footer Line 1: End Date & RSVP stats */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-medium">
                      Срок до: {proj.end_date ? new Date(proj.end_date).toLocaleDateString('ru-RU') : 'отсутствует'}
                    </span>

                    {(() => {
                      const rsvpTasks = projTasks.filter(t => t.title.startsWith('RSVP:'));
                      const yesCount = rsvpTasks.filter(t => t.status === 'accepted').length;
                      const noCount = rsvpTasks.filter(t => t.status === 'rejected').length;
                      return rsvpTasks.length > 0 ? (
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                          👍 <span className="text-emerald-600 font-bold">{yesCount}</span> | 👎 <span className="text-red-500 font-bold">{noCount}</span>
                        </span>
                      ) : null;
                    })()}
                  </div>
                  
                  {/* Footer Line 2: All 3 Action Buttons on 1 Line (Compact RSVP + Assign + Board link) */}
                  <div className="flex items-center justify-between gap-1 pt-1">
                    <button
                      onClick={() => setRsvpProject(proj)}
                      className="shrink-0 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all whitespace-nowrap active:scale-95 shadow-2xs cursor-pointer"
                      title="Настройка и отправка рассылки (RSVP) волонтерам"
                    >
                      <Megaphone className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>RSVP</span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {role === 'admin' && (
                        <button
                          onClick={() => {
                            setAssigningProjectId(proj.id);
                            setSelectedCoordinatorId(proj.coordinator_id || '');
                          }}
                          className="shrink-0 text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 whitespace-nowrap cursor-pointer hover:underline"
                          title="Назначить координатора"
                        >
                          <UserCheck className="w-3 h-3 text-blue-500" />
                          {proj.coordinator_id
                            ? (coordinators.find(c => c.id === proj.coordinator_id)?.full_name?.split(' ')[0] || 'Координатор')
                            : 'Назначить'}
                        </button>
                      )}

                      <Link 
                        href={`/dashboard/projects/${proj.id}`}
                        className="shrink-0 px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold flex items-center gap-0.5 whitespace-nowrap shadow-2xs active:scale-95 cursor-pointer"
                      >
                        <span>Доска</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Assign Coordinator Modal */}
      {assigningProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Назначить координатора</h3>
              <button onClick={() => setAssigningProjectId(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Проект: <strong>{projects.find(p => p.id === assigningProjectId)?.title}</strong>
            </p>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 font-semibold block">Выберите координатора</label>
              <select
                value={selectedCoordinatorId}
                onChange={e => setSelectedCoordinatorId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:outline-none focus:border-slate-900"
              >
                <option value="">— Без координатора —</option>
                {coordinators.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name} ({c.login})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setAssigningProjectId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
              >
                Отмена
              </button>
              <button
                onClick={handleAssignCoordinator}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-6 animate-fade-in">
            <h3 className="text-sm font-bold text-slate-900">Создать новый проект</h3>
            
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 font-semibold block">Название проекта</label>
                <input
                  type="text"
                  required
                  placeholder="Введите название инициативы"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-950 text-xs placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 font-semibold block">Описание проекта</label>
                <textarea
                  placeholder="Опишите цели и задачи проекта"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-950 text-xs placeholder:text-slate-400 focus:outline-none focus:border-slate-900 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 font-semibold block flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  Привязать к организации (опционально)
                </label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:outline-none focus:border-slate-900"
                >
                  <option value="">— Без организации —</option>
                  {organizations.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 font-semibold block">Статус проекта</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:outline-none focus:border-slate-900"
                >
                  <option value="planning">Подготовка</option>
                  <option value="active">Активен</option>
                  <option value="completed">Завершен</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500 font-semibold block">Дата начала</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500 font-semibold block">Дата завершения</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 mt-2">
                <div className="space-y-1.5 col-span-3">
                  <label className="text-xs text-slate-900 font-bold block flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    Гео-Чекин (Координаты)
                  </label>
                  <p className="text-[10px] text-slate-500">Укажите координаты места проведения для включения проверки локации.</p>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-500 font-semibold block">Широта (Lat)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="41.2995"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-500 font-semibold block">Долгота (Lng)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="69.2401"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-500 font-semibold block">Радиус (км)</label>
                  <select
                    value={allowedRadiusKm}
                    onChange={(e) => setAllowedRadiusKm(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:outline-none focus:border-slate-900"
                  >
                    <option value="0.2">200 м</option>
                    <option value="0.5">500 м</option>
                    <option value="1">1 км</option>
                    <option value="2">2 км</option>
                    <option value="5">5 км</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Создание...' : 'Создать проект'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Редактировать проект</h3>
                  <p className="text-[10px] text-slate-500">Изменение названия, описания и дат проекта</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 font-semibold block">Название проекта</label>
                <input
                  type="text"
                  required
                  placeholder="Введите название инициативы"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-950 text-xs placeholder:text-slate-400 focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 font-semibold block">Описание проекта</label>
                <textarea
                  placeholder="Опишите цели и задачи проекта"
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-950 text-xs placeholder:text-slate-400 focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 font-semibold block flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  Привязать к организации (опционально)
                </label>
                <select
                  value={editOrgId}
                  onChange={(e) => setEditOrgId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none cursor-pointer"
                >
                  <option value="">— Без организации —</option>
                  {organizations.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 font-semibold block">Статус проекта</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none cursor-pointer"
                >
                  <option value="planning">⏳ Подготовка</option>
                  <option value="active">🔵 Активен</option>
                  <option value="completed">✅ Завершен</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 font-semibold block flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Дата начала
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 font-semibold block flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Дата завершения
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isEditSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RSVP Customization Modal */}
      <RsvpModal
        isOpen={!!rsvpProject}
        project={rsvpProject}
        onClose={() => setRsvpProject(null)}
        onSuccess={() => mutate('/api/tasks')}
      />

      {/* Delete Confirmation Modal */}
      {deletingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <button 
                onClick={() => setDeletingProject(null)} 
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Удалить проект?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Вы действительно хотите безвозвратно удалить проект <strong className="text-slate-800">«{deletingProject.title}»</strong>? Все связанные задачи и данные проекта будут удалены.
              </p>
            </div>

            <div className="flex gap-3 pt-2 justify-end">
              <button
                type="button"
                onClick={() => setDeletingProject(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmDeleteProject}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? 'Удаление...' : 'Да, удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
