'use client';

import { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Bell, 
  MessageSquareCode, 
  Send,
  Clock,
  ExternalLink,
  Activity,
  ShieldCheck,
  Radio,
  Flame,
  UserCheck,
  Inbox
} from 'lucide-react';
import Link from 'next/link';
import { getPrivilegedHeaders } from '@/lib/client-security';
import { useApi } from '@/lib/useApi';
import { useTranslation } from '@/lib/i18n';

interface Task {
  id: string;
  project_id: string;
  assigned_to?: string | null;
  title: string;
  deadline: string;
  status: 'pending' | 'accepted' | 'completed';
  is_overdue: boolean;
}

interface Project {
  id: string;
  title: string;
  status: string;
}

interface User {
  id: string;
  full_name: string;
  role: string;
  rating: number;
  telegram_id?: number | null;
}

interface CheckIn {
  id: string;
  user_id: string;
  project_id?: string | null;
  text_report: string;
  hours: number;
  created_at: string;
  status: string;
  feedback?: string | null;
  check_out_at?: string | null;
}

interface OperationsOverview {
  radar: {
    activeTasks: number;
    overdueTasks: number;
    urgentTasks: number;
    unassignedTasks: number;
    dormantVolunteers: number;
    availableVolunteers: number;
    activeAlerts: number;
    inboxItems: number;
  };
  actionItems: { type: string; severity: string; title: string; subtitle: string; href: string }[];
  riskProjects: {
    id: string;
    title: string;
    riskScore: number;
    level: 'critical' | 'watch' | 'healthy';
    progress: number;
    reasons: string[];
  }[];
  inbox: { chatId: string; chatTitle: string; senderName: string; text: string; ageHours: number; priority: string }[];
  availableVolunteers: { id: string; full_name: string; skills: string[]; available_until?: string | null; availability_note?: string | null }[];
  digest: string[];
}

export default function DashboardPage() {
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'manager' | 'admin'>('manager');
  const { t } = useTranslation();

  const { data: tasks = [] } = useApi<Task[]>('/api/tasks');
  const { data: projects = [] } = useApi<Project[]>('/api/projects');
  const { data: users = [] } = useApi<User[]>('/api/users');
  const { data: checkinsData } = useApi<{ checkins: CheckIn[]; activeCheckIn: any }>('/api/checkins');
  const checkins = checkinsData?.checkins || [];
  const { data: operations } = useApi<OperationsOverview>('/api/operations/overview');

  const loading = !tasks.length && !projects.length && !users.length && !checkins.length && !operations;

  useEffect(() => {
    const savedRole = localStorage.getItem('currentUserRole') as 'manager' | 'admin';
    if (savedRole) setCurrentUserRole(savedRole);
  }, []);

  async function handleSendReminder(taskId: string) {
    setNotifyingId(taskId);
    setAlertMessage(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/remind`, {
        method: 'POST',
        headers: getPrivilegedHeaders()
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAlertMessage({ type: 'error', text: payload.error || 'Не удалось отправить напоминание в Telegram.' });
        return;
      }

      setAlertMessage({ type: 'success', text: `Напоминание отправлено в Telegram: ${payload.assignee_name}` });
      setTimeout(() => setAlertMessage(null), 4000);
      // Data will automatically revalidate, but we could trigger it manually using SWR mutate if needed
    } catch (e) {
      console.error('Failed to send telegram alert', e);
      setAlertMessage({ type: 'error', text: 'Ошибка соединения при отправке напоминания в Telegram.' });
    } finally {
      setNotifyingId(null);
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-24 bg-[#F9FAFB]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  // Calculate metrics
  const activeTasksCount = tasks.filter(t => t.status !== 'completed').length;
  const pendingCheckinsCount = checkins.length; // All check-ins registered
  const totalVolunteers = users.filter(u => u.role === 'volunteer').length;
  const totalHours = checkins.reduce((acc, c) => acc + Number(c.hours), 0);
  
  const volunteers = users.filter(u => u.role === 'volunteer');
  const avgRating = volunteers.reduce((acc, u) => acc + Number(u.rating ?? 5.0), 0) / (volunteers.length || 1);

  // Filter overdue tasks: status is not completed, and is_overdue or deadline is in the past
  const now = new Date();
  const overdueTasks = tasks.filter(task => {
    if (task.status === 'completed') return false;
    const deadline = new Date(task.deadline);
    if (task.title.startsWith('RSVP:')) {
      return task.is_overdue && deadline < now;
    }
    return task.is_overdue || deadline < now;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Toast Alert Notification */}
      {alertMessage && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl border text-xs shadow-lg flex items-center gap-2 animate-fade-in ${
          alertMessage.type === 'success'
            ? 'bg-slate-900 border-slate-800 text-white'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <Bell className={`w-4 h-4 shrink-0 ${alertMessage.type === 'success' ? 'text-emerald-400 animate-bounce' : 'text-red-500'}`} />
          <span>{alertMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{t('dashboard.title')}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {t('dashboard.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm self-start">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('dashboard.role')}</span>
          <span className="text-xs font-bold text-slate-900">
            {currentUserRole === 'admin' ? t('dashboard.role_admin') : t('dashboard.role_manager')}
          </span>
        </div>
      </div>

      {/* Metrics Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 glass-panel relative overflow-hidden bg-white">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.active_tasks')}</p>
          <h4 className="text-2xl font-bold text-slate-900 mt-2">{activeTasksCount}</h4>
          <p className="text-[10px] text-slate-400 mt-1.5">{t('dashboard.in_progress')}</p>
        </div>

        <div className="p-6 glass-panel relative overflow-hidden bg-white">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.checkins_received')}</p>
          <h4 className="text-2xl font-bold text-slate-900 mt-2">{pendingCheckinsCount}</h4>
          <p className="text-[10px] text-slate-400 mt-1.5">{t('dashboard.total_reports')}</p>
        </div>

        <div className="p-6 glass-panel relative overflow-hidden bg-white">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.total_hours')}</p>
          <h4 className="text-2xl font-bold text-slate-900 mt-2">{totalHours.toFixed(1)} <span className="text-xs font-semibold text-slate-400">ч.</span></h4>
          <p className="text-[10px] text-slate-400 mt-1.5">{t('dashboard.total_time')}</p>
        </div>

        <div className="p-6 glass-panel relative overflow-hidden bg-white">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.avg_rating')}</p>
          <h4 className="text-2xl font-bold text-slate-900 mt-2">{avgRating.toFixed(2)} <span className="text-xs font-semibold text-slate-400">/ 5.0</span></h4>
          <p className="text-[10px] text-slate-400 mt-1.5">{t('dashboard.crm_rating')}</p>
        </div>
      </div>

      {/* Control Tower */}
      {operations && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 glass-panel bg-white p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-900" />
                <h3 className="font-bold text-slate-900 text-sm">{t('dashboard.operational_radar')}</h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{t('dashboard.today')}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: t('dashboard.overdue'), value: operations.radar.overdueTasks, icon: Flame, tone: 'text-red-600 bg-red-50 border-red-100' },
                { label: t('dashboard.unassigned'), value: operations.radar.unassignedTasks, icon: AlertTriangle, tone: 'text-amber-600 bg-amber-50 border-amber-100' },
                { label: 'Inbox', value: operations.radar.inboxItems, icon: Inbox, tone: 'text-blue-600 bg-blue-50 border-blue-100' },
                { label: t('dashboard.ready_to_help'), value: operations.radar.availableVolunteers, icon: UserCheck, tone: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
              ].map((item) => (
                <div key={item.label} className={`p-3 rounded-xl border ${item.tone}`}>
                  <div className="flex items-center justify-between">
                    <item.icon className="w-4 h-4" />
                    <span className="text-xl font-black">{item.value}</span>
                  </div>
                  <p className="text-[10px] font-bold mt-2 uppercase tracking-wide">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('dashboard.action_required')}</p>
                {operations.actionItems.length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-700 font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    {t('dashboard.no_critical_actions')}
                  </div>
                ) : (
                  operations.actionItems.slice(0, 5).map((item, index) => (
                    <Link key={`${item.type}-${index}`} href={item.href} className="block p-3 rounded-xl border border-slate-100 hover:border-slate-300 bg-slate-50/60 transition-all">
                      <p className="text-xs font-bold text-slate-900">{item.title}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{item.subtitle}</p>
                    </Link>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('dashboard.manager_summary')}</p>
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                  {operations.digest.map((line) => (
                    <p key={line} className="text-xs text-slate-700 leading-relaxed">{line}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel bg-white p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-slate-900" />
              <h3 className="font-bold text-slate-900 text-sm">{t('dashboard.live_team')}</h3>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('dashboard.ready_now')}</p>
              {operations.availableVolunteers.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">{t('dashboard.no_availability')}</p>
              ) : operations.availableVolunteers.map((volunteer) => (
                <div key={volunteer.id} className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/50">
                  <p className="text-xs font-bold text-slate-900">{volunteer.full_name}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{volunteer.availability_note || volunteer.skills.slice(0, 3).join(', ') || t('dashboard.ready_for_tasks')}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('dashboard.coordinators_inbox')}</p>
              {operations.inbox.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">{t('dashboard.no_new_messages')}</p>
              ) : operations.inbox.slice(0, 4).map((item) => (
                <Link key={item.chatId} href="/dashboard/chats" className="block p-3 rounded-xl border border-slate-100 hover:border-slate-300 bg-white">
                  <p className="text-xs font-bold text-slate-900">{item.senderName}</p>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{item.text}</p>
                  <p className="text-[9px] text-slate-400 mt-2">{item.ageHours} ч. назад</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="xl:col-span-3 glass-panel bg-white p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-900" />
                <h3 className="font-bold text-slate-900 text-sm">{t('dashboard.risk_scoring')}</h3>
              </div>
              <Link href="/dashboard/projects" className="text-[10px] font-bold text-slate-500 hover:text-slate-900 uppercase">{t('dashboard.all_projects')}</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {operations.riskProjects.slice(0, 6).map((project) => (
                <Link key={project.id} href={`/dashboard/projects/${project.id}`} className="p-4 rounded-xl border border-slate-100 hover:border-slate-300 bg-slate-50/40 transition-all">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 truncate">{project.title}</p>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                      project.level === 'critical' ? 'bg-red-100 text-red-700' :
                      project.level === 'watch' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {project.riskScore}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full bg-slate-900" style={{ width: `${project.progress}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-3">{project.reasons[0]}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Overdue Tasks & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Overdue Tasks List (Left 2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 bg-white">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="font-bold text-slate-900 text-sm">{t('dashboard.overdue_tasks')}</h3>
              </div>
              <span className="text-[10px] bg-red-50 text-red-600 px-2.5 py-1 rounded-full border border-red-100 font-bold uppercase tracking-wider">
                {overdueTasks.length} {t('dashboard.attention')}
              </span>
            </div>

            {overdueTasks.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                {t('dashboard.all_tasks_on_time')}
              </div>
            ) : (
              <div className="space-y-3">
                {overdueTasks.map((task) => {
                  const deadline = new Date(task.deadline);
                  const volunteer = users.find(u => u.id === task.assigned_to);
                  const project = projects.find(p => p.id === task.project_id);
                  const assigneeName = volunteer?.full_name || (task.title.startsWith('Смена: ') ? task.title.replace('Смена: ', '').trim() : null) || t('dashboard.unassigned_person');
                  const canSendTelegramReminder = !!task.assigned_to && !!volunteer?.telegram_id;

                  return (
                    <div 
                      key={task.id} 
                      className="p-4 rounded-xl border border-red-100 bg-red-50/20 hover:bg-red-50/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <h4 className="font-bold text-slate-900 text-xs">{task.title}</h4>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {t('dashboard.project')} <span className="font-medium text-slate-700">{project?.title || t('dashboard.unknown')}</span> | {t('dashboard.assignee')} <span className="font-semibold text-slate-700">{assigneeName}</span>
                        </p>
                        <p className="text-[10px] text-red-600 font-semibold">
                          {t('dashboard.expired')} {deadline.toLocaleDateString('ru-RU')} в {deadline.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => handleSendReminder(task.id)}
                        disabled={notifyingId === task.id || !canSendTelegramReminder}
                        title={
                          !task.assigned_to
                            ? 'Назначьте ответственного перед отправкой'
                            : !volunteer?.telegram_id
                              ? 'У ответственного не привязан Telegram ID'
                              : 'Отправить напоминание ответственному в Telegram'
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[10px] font-semibold transition-colors flex items-center gap-1.5 self-start sm:self-auto"
                      >
                        <Send className="w-3 h-3" />
                        {notifyingId === task.id
                          ? '...'
                          : canSendTelegramReminder
                            ? t('dashboard.remind_in_tg')
                            : t('dashboard.tg_unlinked')}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Check-ins Monitor (Right 1 Column) */}
        <div className="space-y-6">
          <div className="glass-panel p-6 bg-white flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-900" />
                <h3 className="font-bold text-slate-900 text-sm">Мониторинг Чекинов</h3>
              </div>
              <Link 
                href="/dashboard/reports" 
                className="text-[10px] text-slate-500 hover:text-slate-900 font-bold uppercase tracking-wider"
              >
                {t('dashboard.all')}
              </Link>
            </div>

            {checkins.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                {t('dashboard.no_reports_yet')}
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto max-h-[420px] pr-1">
                {checkins.slice(0, 10).map((report) => {
                  const volunteer = users.find(u => u.id === report.user_id);
                  const project = projects.find(p => p.id === report.project_id);
                  
                  // Status visualization
                  const isBlocked = report.status === 'rejected' && report.feedback?.includes('Geofence block');
                  const isActive = report.status === 'pending' && !report.text_report;
                  const isCompleted = report.text_report !== null && report.text_report !== undefined && !isActive && !isBlocked;

                  let statusClasses = "border-slate-100 bg-white";
                  let statusBadge = null;

                  if (isBlocked) {
                    statusClasses = "border-red-100 bg-red-50/30";
                    statusBadge = <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-700">БЛОКИРОВКА</span>;
                  } else if (isActive) {
                    statusClasses = "border-amber-100 bg-amber-50/30";
                    statusBadge = <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-700">АКТИВЕН</span>;
                  } else {
                    statusBadge = <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-100 text-emerald-700">ЗАВЕРШЕН</span>;
                  }

                  return (
                    <div key={report.id} className={`p-3.5 rounded-xl border space-y-2 ${statusClasses}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-900 truncate max-w-[120px]">{volunteer?.full_name || 'Неизвестно'}</span>
                          {statusBadge}
                        </div>
                        {report.hours > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            {report.hours} ч.
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                        {t('dashboard.project')} <span className="text-slate-600">{project ? project.title : t('dashboard.unknown')}</span>
                      </p>
                      
                      {isBlocked && (
                        <p className="text-xs text-red-700 font-medium leading-relaxed bg-red-50 p-2.5 rounded-lg border border-red-100">
                          {report.feedback}
                        </p>
                      )}
                      
                      {isActive && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                          <span className="text-[10px] text-amber-700 font-medium">Волонтер на локации</span>
                        </div>
                      )}

                      {isCompleted && report.text_report && (
                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          {report.text_report}
                        </p>
                      )}

                      <div className="text-[9px] text-slate-400 text-right mt-2">
                        {new Date(report.created_at).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
