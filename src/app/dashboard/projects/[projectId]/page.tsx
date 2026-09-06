'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  User, 
  AlertCircle, 
  Clock, 
  ArrowRight,
  ChevronRight,
  ArrowLeftRight,
  ShieldAlert,
  MessageSquare,
  Megaphone,
  Send,
  X,
  Trash2,
  Search,
  Check,
  ChevronDown,
  Pencil
} from 'lucide-react';
import RsvpModal from '@/components/RsvpModal';

interface Task {
  id: string;
  project_id: string;
  title: string;
  status: 'pending' | 'accepted' | 'completed';
  assigned_to: string | null;
  deadline: string;
  is_overdue: boolean;
}

interface Project {
  id: string;
  title: string;
  description: string;
  status: 'planning' | 'active' | 'completed';
  start_date?: string | null;
  end_date?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  allowedRadiusKm?: number | null;
}

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
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

export default function ProjectKanbanPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Project Details & Dates State
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<'planning' | 'active' | 'completed'>('active');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [isUpdatingProject, setIsUpdatingProject] = useState(false);

  function openEditProjectModal() {
    if (!project) return;
    setEditTitle(project.title || '');
    setEditDescription(project.description || '');
    setEditStatus(project.status || 'active');
    setEditStartDate(toDateInputValue(project.start_date));
    setEditEndDate(toDateInputValue(project.end_date));
    setIsEditProjectModalOpen(true);
  }

  async function handleUpdateProjectDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !editTitle.trim()) return;
    setIsUpdatingProject(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          title: editTitle.trim(),
          description: editDescription.trim(),
          status: editStatus,
          start_date: editStartDate ? new Date(editStartDate).toISOString() : null,
          end_date: editEndDate ? new Date(editEndDate).toISOString() : null
        })
      });
      if (res.ok) {
        setIsEditProjectModalOpen(false);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Ошибка при обновлении проекта');
      }
    } catch (e) {
      console.error('Failed to update project:', e);
      alert('Ошибка при обновлении проекта');
    } finally {
      setIsUpdatingProject(false);
    }
  }

  // Delete project state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirmDeleteProject() {
    if (!project) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects?id=${project.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setIsDeleteModalOpen(false);
        router.push(role === 'coordinator' ? '/coordinator-dashboard' : '/dashboard/projects');
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

  // Current authenticated role
  const [role, setRole] = useState('manager');
  const backHref = role === 'coordinator' ? '/coordinator-dashboard' : '/dashboard/projects';

  // New Task Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskVolunteerId, setTaskVolunteerId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Volunteer Dropdown State
  const [isVolunteerDropdownOpen, setIsVolunteerDropdownOpen] = useState(false);
  const [volunteerSearch, setVolunteerSearch] = useState('');

  // Project Chat State
  const [chat, setChat] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMsgText, setNewMsgText] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');

  // Project Partners State
  const [projectPartners, setProjectPartners] = useState<any[]>([]);
  const [availablePartners, setAvailablePartners] = useState<any[]>([]);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [partnerRole, setPartnerRole] = useState('');
  const [isSubmittingPartner, setIsSubmittingPartner] = useState(false);

  // Check-in State
  const [activeCheckIn, setActiveCheckIn] = useState<any>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Edit Project Coordinates State
  const [isEditGeoModalOpen, setIsEditGeoModalOpen] = useState(false);
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editRadius, setEditRadius] = useState('0.5');
  const [isSubmittingGeo, setIsSubmittingGeo] = useState(false);
  // RSVP Modal state
  const [isRsvpModalOpen, setIsRsvpModalOpen] = useState(false);

  // Complete Task Modal State
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<any>(null);
  const [completeHours, setCompleteHours] = useState('2');
  const [completeScore, setCompleteScore] = useState('5');
  const [completeFeedback, setCompleteFeedback] = useState('Отличная работа!');
  const [isCompletingTask, setIsCompletingTask] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('currentUserRole');
    if (savedRole) setRole(savedRole);
    setCurrentUserId(localStorage.getItem('currentUserId') || '');
    setCurrentUserName(localStorage.getItem('currentUserName') || '');

    const handleSessionChange = () => {
      const updated = localStorage.getItem('currentUserRole');
      if (updated) setRole(updated);
      setCurrentUserId(localStorage.getItem('currentUserId') || '');
      setCurrentUserName(localStorage.getItem('currentUserName') || '');
    };

    window.addEventListener('auth-session-change', handleSessionChange);
    fetchData();

    return () => window.removeEventListener('auth-session-change', handleSessionChange);
  }, [projectId]);

  // Polling for project chat messages
  useEffect(() => {
    if (!chat) return;
    
    const interval = setInterval(() => {
      fetchChatMessages(chat.id);
    }, 4000);

    return () => clearInterval(interval);
  }, [chat]);

  async function fetchProjectChat() {
    try {
      const res = await fetch(`/api/chats?projectId=${projectId}`);
      if (res.ok) {
        const chatsData = await res.json();
        if (chatsData.length > 0) {
          setChat(chatsData[0]);
          fetchChatMessages(chatsData[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch project chat', e);
    }
  }

  async function fetchChatMessages(chatId: string) {
    try {
      const res = await fetch(`/api/chats/messages?chatId=${chatId}`);
      if (res.ok) {
        setChatMessages(await res.json());
      }
    } catch (e) {
      console.error('Failed to load project chat messages', e);
    }
  }

  async function handleSendProjectMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chat || !newMsgText.trim()) return;
    const textToSend = newMsgText.trim();
    setNewMsgText('');

    const senderId = currentUserId;
    const senderName = currentUserName || (role === 'admin' ? 'Директор' : 'Координатор');
    const senderRole = role === 'admin' ? 'admin' : 'manager';
    if (!senderId) return;

    try {
      const res = await fetch('/api/chats/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chat.id,
          senderId,
          senderName,
          senderRole,
          text: textToSend
        })
      });
      if (res.ok) {
        fetchChatMessages(chat.id);
      }
    } catch (e) {
      console.error('Failed to send project chat message', e);
    }
  }

  async function fetchData() {
    try {
      const [projRes, tasksRes, usersRes, projPartnersRes, allPartnersRes] = await Promise.all([
        fetch(`/api/projects`),
        fetch(`/api/tasks?projectId=${projectId}`),
        fetch(`/api/users?role=volunteer`),
        fetch(`/api/project-partners?projectId=${projectId}`),
        fetch(`/api/partners`)
      ]);

      const [projectsData, tasksData, usersData, projPartnersData, allPartnersData] = await Promise.all([
        projRes.json(),
        tasksRes.json(),
        usersRes.json(),
        projPartnersRes.json(),
        allPartnersRes.json()
      ]);

      const matchedProj = Array.isArray(projectsData) ? projectsData.find((p: any) => p.id === projectId) : null;
      setProject(matchedProj || null);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setVolunteers(Array.isArray(usersData) ? usersData : Array.isArray(usersData?.users) ? usersData.users : []);
      
      setProjectPartners(Array.isArray(projPartnersData) ? projPartnersData : []);
      setAvailablePartners(Array.isArray(allPartnersData) ? allPartnersData : []);
      
      // Fetch active checkin if volunteer
      const uId = localStorage.getItem('currentUserId');
      if (uId && localStorage.getItem('currentUserRole') === 'volunteer') {
        const checkinRes = await fetch(`/api/checkins?projectId=${projectId}&userId=${uId}`);
        if (checkinRes.ok) {
          const cData = await checkinRes.json();
          setActiveCheckIn(cData.activeCheckIn);
        }
      }

      // Load project chat
      fetchProjectChat();
    } catch (e) {
      console.error('Failed to load Kanban board data', e);
    } finally {
      setLoading(false);
    }
  }

  const handleGeofencedAction = async (action: 'checkin' | 'checkout') => {
    if (!navigator.geolocation) {
      alert('Геолокация не поддерживается вашим браузером');
      return;
    }
    
    setIsCheckingIn(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        try {
          const res = await fetch('/api/checkins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action,
              projectId,
              lat,
              lng,
              user_id: currentUserId,
              text_report: action === 'checkout' ? prompt('Оставьте краткий отчет о смене (опционально):') || 'Смена завершена' : undefined
            })
          });
          const data = await res.json();
          if (!res.ok) {
            alert(data.error || 'Ошибка при чекине');
          } else {
            alert(action === 'checkin' ? 'Чекин успешен! Смена начата.' : 'Смена завершена.');
            fetchData();
          }
        } catch (e) {
          console.error(e);
          alert('Сетевая ошибка при чекине');
        } finally {
          setIsCheckingIn(false);
        }
      },
      (error) => {
        setIsCheckingIn(false);
        alert('Не удалось получить координаты. Разрешите доступ к геопозиции.');
        console.error(error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function handleConfirmComplete(e: React.FormEvent) {
    e.preventDefault();
    if (!taskToComplete) return;
    setIsCompletingTask(true);
    try {
      // 1. Move task to completed
      await fetch(`/api/tasks/${taskToComplete.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', is_overdue: false })
      });

      // 2. Create manual Check-in (hours)
      const checkinRes = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: taskToComplete.assigned_to,
          project_id: projectId,
          text_report: 'Закрыто координатором',
          hours: completeHours
        })
      });

      if (checkinRes.ok) {
        const checkinData = await checkinRes.json();
        // 3. Grade the check-in (feedback & KPI)
        await fetch('/api/checkins', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkInId: checkinData.id,
            kpi_score: completeScore,
            feedback: completeFeedback,
            status: 'approved'
          })
        });
      }

      setIsCompleteModalOpen(false);
      setTaskToComplete(null);
      fetchData(); // refresh board
    } catch (e) {
      console.error(e);
      alert('Ошибка при закрытии задачи');
    } finally {
      setIsCompletingTask(false);
    }
  }

  // Shift status handler
  async function handleMoveTask(taskId: string, newStatus: 'pending' | 'accepted' | 'completed') {
    if (role !== 'admin' && role !== 'manager') return; // Restriction safeguard
    
    if (newStatus === 'completed') {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.assigned_to) {
        setTaskToComplete(task);
        setIsCompleteModalOpen(true);
        return;
      }
    }
    
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, is_overdue: false })
      });
      if (res.ok) {
        // Optimistic UI update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      }
    } catch (e) {
      console.error('Failed to shift task status', e);
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDeadline) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          title: taskTitle.trim(),
          assigned_to: taskVolunteerId || null,
          deadline: new Date(taskDeadline).toISOString()
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        setTaskTitle('');
        setTaskDeadline('');
        setTaskVolunteerId('');
        setVolunteerSearch('');
        setIsVolunteerDropdownOpen(false);
        fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Ошибка при создании задачи');
      }
    } catch (err) {
      console.error('Failed to create task', err);
      alert('Ошибка при создании задачи');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateGeo(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmittingGeo(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          latitude: editLat ? editLat : null,
          longitude: editLng ? editLng : null,
          allowed_radius_km: editRadius
        })
      });
      if (res.ok) {
        setIsEditGeoModalOpen(false);
        fetchData();
      } else {
        alert('Ошибка при обновлении геозоны');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingGeo(false);
    }
  }

  async function handleAddPartner(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPartnerId) return;
    setIsSubmittingPartner(true);
    try {
      const res = await fetch('/api/project-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          partnerId: selectedPartnerId,
          role: partnerRole
        })
      });
      if (res.ok) {
        setIsPartnerModalOpen(false);
        setSelectedPartnerId('');
        setPartnerRole('');
        fetchData(); // reload
      } else {
        const err = await res.json();
        alert(err.error || 'Ошибка при добавлении партнера');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmittingPartner(false);
    }
  }

  async function handleRemovePartner(id: string) {
    if (!confirm('Вы уверены, что хотите отвязать этого партнера от проекта?')) return;
    try {
      const res = await fetch(`/api/project-partners?id=${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-24 bg-[#F9FAFB]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-24 space-y-4">
        <h3 className="text-slate-900 text-lg font-bold">Проект не найден</h3>
        <Link href="/dashboard/projects" className="text-slate-600 text-xs hover:underline">
          Вернуться к реестру проектов
        </Link>
      </div>
    );
  }

  // Helper to determine deadline color state
  const getDeadlineState = (task: Task) => {
    if (task.status === 'completed') return 'normal';
    const now = new Date();
    const deadline = new Date(task.deadline);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffTime < 0) return 'overdue'; // Red
    if (diffDays <= 3) return 'urgent'; // Yellow
    return 'normal'; // Standard
  };

  // Group tasks by columns matching the database statuses
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeVolunteers = Array.isArray(volunteers) ? volunteers : [];

  const columns = [
    { title: 'К исполнению (Входящие)', status: 'pending' as const, tasks: safeTasks.filter(t => t.status === 'pending') },
    { title: 'В работе', status: 'accepted' as const, tasks: safeTasks.filter(t => t.status === 'accepted') },
    { title: 'Выполнено', status: 'completed' as const, tasks: safeTasks.filter(t => t.status === 'completed') }
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Back button and title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link 
            href={backHref}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к проектам
          </Link>
          
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{project.title}</h2>
            {['admin', 'manager'].includes(role) ? (
              <select
                value={project.status}
                onChange={async (e) => {
                  const newStatus = e.target.value as any;
                  await fetch('/api/projects', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId: project.id, status: newStatus })
                  });
                  fetchData();
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-bold border cursor-pointer outline-none transition-all ${
                  project.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : project.status === 'active'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
                title="Нажмите, чтобы изменить статус проекта"
              >
                <option value="active">🔵 Активен</option>
                <option value="planning">⏳ Подготовка</option>
                <option value="completed">✅ Завершен</option>
              </select>
            ) : (
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                project.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : project.status === 'active'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {project.status === 'completed' ? '✅ Завершен' : project.status === 'active' ? '🔵 Активен' : '⏳ Подготовка'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">{project.description || 'Описание проекта отсутствует.'}</p>

          {/* Project Dates Display */}
          <div className="flex items-center gap-3 text-xs text-slate-600 pt-1 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-medium bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Начало: <strong className="text-slate-800">{project.start_date ? new Date(project.start_date).toLocaleDateString('ru-RU') : 'не задано'}</strong></span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Окончание: <strong className="text-slate-800">{project.end_date ? new Date(project.end_date).toLocaleDateString('ru-RU') : 'не задано'}</strong></span>
            </span>
          </div>
        </div>
        
        {role === 'admin' || role === 'manager' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openEditProjectModal}
              className="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Редактировать название, описание и даты проекта"
            >
              <Pencil className="w-4 h-4 text-indigo-600" />
              Редактировать
            </button>
            {role === 'admin' && (
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                title="Удалить проект (доступно только Руководителю)"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
                Удалить проект
              </button>
            )}
            <button
              onClick={() => setIsRsvpModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              title="Настройка и отправка рассылки волонтерам"
            >
              <Megaphone className="w-4 h-4 text-amber-600" />
              Пригласить волонтеров (RSVP)
            </button>
            <button
              onClick={() => {
                setEditLat(project.latitude?.toString() || '');
                setEditLng(project.longitude?.toString() || '');
                setEditRadius(project.allowedRadiusKm?.toString() || '0.5');
                setIsEditGeoModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              Геозона
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Добавить задачу
            </button>
          </div>
        ) : role === 'volunteer' ? (
          <div className="flex items-center gap-3 bg-white p-2 pr-4 rounded-xl shadow-sm border border-slate-200">
            {activeCheckIn ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Смена активна
                </div>
                <button
                  onClick={() => handleGeofencedAction('checkout')}
                  disabled={isCheckingIn}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50"
                >
                  {isCheckingIn ? 'Завершение...' : 'Завершить смену'}
                </button>
              </>
            ) : (
              <button
                onClick={() => handleGeofencedAction('checkin')}
                disabled={isCheckingIn}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isCheckingIn ? 'Чекин...' : 'Начать смену (Чекин)'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-wider self-start">
            <ShieldAlert className="w-3.5 h-3.5" />
            Режим мониторинга (Координатор)
          </div>
        )}
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {columns.map((col) => (
          <div key={col.status} className="glass-panel p-5 bg-white border border-slate-200 shadow-sm rounded-xl flex flex-col h-[650px] min-w-0">
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 px-1">
              <h3 className="font-bold text-slate-900 text-xs tracking-wider uppercase">{col.title}</h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 font-bold">
                {col.tasks.length}
              </span>
            </div>

            {/* Column Tasks Container */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 kanban-column">
              {col.tasks.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-8 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                  Задач нет
                </div>
              ) : (
                col.tasks.map((task) => {
                  const deadlineState = getDeadlineState(task);
                  const volunteer = safeVolunteers.find(v => v.id === task.assigned_to);

                  const cardStyle = {
                    overdue: 'border-red-200 bg-red-50/20 hover:border-red-300',
                    urgent: 'border-amber-200 bg-amber-50/20 hover:border-amber-300',
                    normal: 'border-slate-200 bg-white hover:border-slate-350'
                  }[deadlineState];

                  return (
                    <div 
                      key={task.id} 
                      className={`p-4 rounded-xl border flex flex-col justify-between min-h-[140px] shadow-sm transition-all ${cardStyle}`}
                    >
                      <div>
                        {/* Header details */}
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                            ID: {task.id.slice(0, 5)}
                          </span>
                          
                          {deadlineState === 'overdue' && (
                            <span className="text-[10px] text-red-600 flex items-center gap-1 font-bold">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              Просрочено
                            </span>
                          )}
                          {deadlineState === 'urgent' && (
                            <span className="text-[10px] text-amber-600 flex items-center gap-1 font-bold">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              Срочно
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="font-bold text-slate-900 text-xs mt-2 leading-snug">{task.title}</h4>
                      </div>

                      {/* Footer & Actions */}
                      <div className="space-y-2.5 mt-4 pt-2.5 border-t border-slate-100">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1 truncate max-w-[55%]">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{volunteer ? volunteer.full_name : 'Не назначен'}</span>
                          </span>
                          <span className="flex items-center gap-1 text-[10px]">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {new Date(task.deadline).toLocaleDateString('ru-RU')}
                          </span>
                        </div>

                        {/* Shift action buttons (only visible if Director/admin or manager) */}
                        {(role === 'admin' || role === 'manager') && (
                          <div className="flex justify-end gap-1.5 pt-1">
                            {col.status !== 'pending' && (
                              <button
                                onClick={() => handleMoveTask(task.id, col.status === 'accepted' ? 'pending' : 'accepted')}
                                title="Переместить влево"
                                className="p-1 rounded-lg bg-slate-50 hover:bg-slate-150 border border-slate-200 text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            
                            {col.status !== 'completed' && (
                              <button
                                onClick={() => handleMoveTask(task.id, col.status === 'pending' ? 'accepted' : 'completed')}
                                title="Переместить вправо"
                                className="p-1 rounded-lg bg-slate-50 hover:bg-slate-150 border border-slate-200 text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Project Partners Block */}
      <div className="glass-panel p-6 bg-white border border-slate-200 shadow-sm rounded-xl space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-900" />
            <h3 className="font-bold text-slate-900 text-xs tracking-wider uppercase">Партнеры проекта</h3>
          </div>
          {(role === 'admin' || role === 'manager') && (
            <button
              onClick={() => setIsPartnerModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-bold tracking-wider hover:bg-slate-800 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Привязать партнера
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectPartners.length === 0 ? (
            <div className="col-span-full py-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
              К этому проекту еще не привязаны партнеры
            </div>
          ) : (
            projectPartners.map(pp => (
              <div key={pp.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{pp.partner.name}</h4>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{pp.role || 'Партнер'}</p>
                </div>
                {(role === 'admin' || role === 'manager') && (
                  <button
                    onClick={() => handleRemovePartner(pp.id)}
                    className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors"
                    title="Отвязать партнера"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Project Chat & Discussions */}
      <div className="glass-panel p-6 bg-white border border-slate-200 shadow-sm rounded-xl space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-900" />
            <h3 className="font-bold text-slate-900 text-xs tracking-wider uppercase">Обсуждение проекта (Чат)</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-semibold uppercase">Сотрудники и Волонтеры</span>
        </div>

        {/* Messages list */}
        <div className="h-[250px] overflow-y-auto space-y-3 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
          {chatMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              В чате пока нет сообщений. Начните обсуждение проекта!
            </div>
          ) : (
            chatMessages.map((msg) => {
              const isMine = msg.sender_id === currentUserId;

              return (
                <div 
                  key={msg.id}
                  className={`flex flex-col max-w-[75%] ${isMine ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                >
                  <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider mb-0.5 px-1">
                    {msg.sender_name} ({msg.sender_role === 'volunteer' ? 'Волонтер' : 'Куратор'})
                  </span>
                  <div className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                    isMine 
                      ? 'bg-slate-900 text-white rounded-tr-none'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[8px] text-slate-400 font-semibold mt-0.5 px-1">
                    {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Input box */}
        <form onSubmit={handleSendProjectMessage} className="flex gap-2">
          <input
            type="text"
            required
            placeholder="Напишите сообщение в чат проекта..."
            value={newMsgText}
            onChange={(e) => setNewMsgText(e.target.value)}
            className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-xs placeholder:text-slate-450 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            Отправить
          </button>
        </form>
      </div>

      {/* Create Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-5">
            <h3 className="text-sm font-bold text-slate-900">Добавить новую задачу</h3>
            
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 font-bold block">Название задачи</label>
                <input
                  type="text"
                  required
                  placeholder="Введите краткое описание задачи"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>

              <div className="space-y-1.5 relative">
                <label className="text-xs text-slate-500 font-bold block">Назначить исполнителя</label>
                
                <div 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-900 cursor-pointer flex justify-between items-center"
                  onClick={() => setIsVolunteerDropdownOpen(!isVolunteerDropdownOpen)}
                >
                  <span className="truncate">
                    {taskVolunteerId 
                      ? safeVolunteers.find(v => v.id === taskVolunteerId)?.full_name || 'Волонтер выбран'
                      : '-- Оставить неназначенной --'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                {isVolunteerDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 flex flex-col">
                    <div className="p-2 border-b border-slate-100 shrink-0 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        placeholder="Поиск по имени..."
                        value={volunteerSearch}
                        onChange={(e) => setVolunteerSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                    <div className="overflow-y-auto p-1 flex-1">
                      <div 
                        className={`px-3 py-2 text-xs rounded-lg cursor-pointer hover:bg-slate-50 flex items-center justify-between ${!taskVolunteerId ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-700'}`}
                        onClick={() => {
                          setTaskVolunteerId('');
                          setIsVolunteerDropdownOpen(false);
                        }}
                      >
                        -- Оставить неназначенной --
                        {!taskVolunteerId && <Check className="w-3.5 h-3.5" />}
                      </div>
                      {safeVolunteers
                        .filter(v => (v.full_name || '').toLowerCase().includes(volunteerSearch.toLowerCase()))
                        .map(v => (
                        <div 
                          key={v.id}
                          className={`px-3 py-2 text-xs rounded-lg cursor-pointer hover:bg-slate-50 flex items-center justify-between ${taskVolunteerId === v.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-700'}`}
                          onClick={() => {
                            setTaskVolunteerId(v.id);
                            setIsVolunteerDropdownOpen(false);
                          }}
                        >
                          {v.full_name}
                          {taskVolunteerId === v.id && <Check className="w-3.5 h-3.5" />}
                        </div>
                      ))}
                      {safeVolunteers.filter(v => (v.full_name || '').toLowerCase().includes(volunteerSearch.toLowerCase())).length === 0 && (
                        <div className="px-3 py-4 text-xs text-center text-slate-500">
                          Волонтер не найден
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 font-bold block">Срок сдачи (Дедлайн)</label>
                <input
                  type="datetime-local"
                  required
                  value={taskDeadline}
                  onChange={(e) => setTaskDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>

              <div className="flex gap-3 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setIsVolunteerDropdownOpen(false);
                    setVolunteerSearch('');
                  }}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-colors text-xs"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Добавление...' : 'Создать задачу'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add Partner Modal */}
      {isPartnerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-6">
            <div className="space-y-1 border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Привязать партнера</h3>
              <p className="text-xs text-slate-500">
                Выберите существующего партнера из CRM и укажите его роль в данном проекте.
              </p>
            </div>
            
            <form onSubmit={handleAddPartner} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 font-bold block">Организация / Партнер</label>
                <select
                  required
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">-- Выберите партнера --</option>
                  {availablePartners.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 font-bold block">Роль в проекте (опционально)</label>
                <input
                  type="text"
                  placeholder="Например: Генеральный спонсор"
                  value={partnerRole}
                  onChange={(e) => setPartnerRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex gap-3 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsPartnerModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-all"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPartner}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                >
                  {isSubmittingPartner ? 'Привязка...' : 'Привязать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Geo Modal */}
      {isEditGeoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900">Редактирование Геозоны</h3>
              <button onClick={() => setIsEditGeoModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateGeo} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500 font-semibold block">Широта (Lat)</label>
                <input
                  type="number" step="any"
                  value={editLat} onChange={(e) => setEditLat(e.target.value)}
                  placeholder="41.2995"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500 font-semibold block">Долгота (Lng)</label>
                <input
                  type="number" step="any"
                  value={editLng} onChange={(e) => setEditLng(e.target.value)}
                  placeholder="69.2401"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500 font-semibold block">Радиус (км)</label>
                <select
                  value={editRadius} onChange={(e) => setEditRadius(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-950 text-xs focus:outline-none focus:border-slate-900"
                >
                  <option value="0.2">200 м</option>
                  <option value="0.5">500 м</option>
                  <option value="1">1 км</option>
                  <option value="2">2 км</option>
                  <option value="5">5 км</option>
                </select>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingGeo}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmittingGeo ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

        {/* RSVP Customization Modal */}
        <RsvpModal
          isOpen={isRsvpModalOpen}
          project={project}
          onClose={() => setIsRsvpModalOpen(false)}
          onSuccess={() => fetchData()}
        />

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && project && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                  <Trash2 className="w-5 h-5" />
                </div>
                <button 
                  onClick={() => setIsDeleteModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Удалить проект?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Вы действительно хотите безвозвратно удалить проект <strong className="text-slate-800">«{project.title}»</strong>? Все связанные задачи и данные проекта будут удалены.
                </p>
              </div>

              <div className="flex gap-3 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
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

        {/* Complete Task Modal */}
        {isCompleteModalOpen && taskToComplete && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-slate-900 text-sm">Подтверждение выполнения</h3>
                <button onClick={() => setIsCompleteModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleConfirmComplete} className="p-5 space-y-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-600">Задача: <strong>{taskToComplete.title}</strong></p>
                  <p className="text-[10px] text-slate-500">Волонтер получит часы и отзыв.</p>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Часы волонтера</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={completeHours}
                    onChange={(e) => setCompleteHours(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Оценка (1-5)</label>
                  <select
                    required
                    value={completeScore}
                    onChange={(e) => setCompleteScore(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
                  >
                    <option value="5">⭐⭐⭐⭐⭐ (Отлично)</option>
                    <option value="4">⭐⭐⭐⭐ (Хорошо)</option>
                    <option value="3">⭐⭐⭐ (Нормально)</option>
                    <option value="2">⭐⭐ (Плохо)</option>
                    <option value="1">⭐ (Ужасно)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Отзыв волонтеру</label>
                  <textarea
                    required
                    rows={3}
                    value={completeFeedback}
                    onChange={(e) => setCompleteFeedback(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none resize-none"
                    placeholder="Напишите пару слов о работе волонтера..."
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCompleteModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isCompletingTask}
                    className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {isCompletingTask ? 'Сохранение...' : 'Завершить задачу'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Project Modal */}
        {isEditProjectModalOpen && (
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
                  onClick={() => setIsEditProjectModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateProjectDetails} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 font-semibold block">Название проекта</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none"
                    placeholder="Введите название проекта"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 font-semibold block">Описание проекта</label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none resize-none"
                    placeholder="Опишите цели и детали проекта"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 font-semibold block">Статус проекта</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none cursor-pointer"
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
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none cursor-pointer"
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
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditProjectModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingProject}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {isUpdatingProject ? 'Сохранение...' : 'Сохранить изменения'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}
