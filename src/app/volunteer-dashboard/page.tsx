'use client';

import { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Phone, 
  Award, 
  AlertTriangle, 
  Clock, 
  Send,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  Inbox,
  BookOpen,
  Trophy,
  Radio,
  Target,
  Zap,
  UserCheck
} from 'lucide-react';
import VolunteerBottomNav from '@/components/VolunteerBottomNav';
import Link from 'next/link';
const BADGES_MAP: Record<string, { name: string; icon: string; desc: string }> = {
  badge_first_step: { name: 'Первый шаг', icon: '🆕', desc: 'Присоединился к Volunteer OS' },
  badge_eco_1: { name: 'Эко-Помощник', icon: '🌱', desc: 'Выполнил экологическую задачу' },
  badge_animals_1: { name: 'Друг животных', icon: '🐾', desc: 'Помог приюту или братьям меньшим' },
  badge_hours_10: { name: 'Трудолюбивый', icon: '⏱️', desc: 'Отработал более 10 часов в проектах' },
  badge_level_5: { name: 'Эксперт', icon: '👑', desc: 'Достиг 5-го уровня развития волонтера' }
};

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
  start_date?: string | null;
  end_date?: string | null;
}

interface User {
  id: string;
  full_name: string;
  role: string;
  phone?: string | null;
  rating: number;
  telegram_id?: number | null;
  xp?: number;
  level?: number;
  badges?: string[];
  interests?: string[];
  skills?: string[];
  latitude?: number;
  longitude?: number;
  availability_status?: 'offline' | 'available' | 'busy';
  available_until?: string | null;
  availability_note?: string | null;
}

interface CheckIn {
  id: string;
  user_id: string;
  project_id?: string | null;
  text_report?: string | null;
  hours?: number | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
  created_at: string;
}
 
export default function VolunteerDashboard() {
  const [volunteerId, setVolunteerId] = useState<string | null>(null);
  const [volunteer, setVolunteer] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allVolunteers, setAllVolunteers] = useState<User[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [marketplaceTasks, setMarketplaceTasks] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Emergency alerts state
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
 
  // Sign-in Form
  const [selectedVolId, setSelectedVolId] = useState('');
 
  // Active status filter tab
  const [activeTab, setActiveTab] = useState<'pending' | 'accepted' | 'completed'>('pending');
 
  // Report Modal Form State
  const [reportingTask, setReportingTask] = useState<Task | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportHours, setReportHours] = useState('1');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  
  // Geofenced Check-in State
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [activeCheckInId, setActiveCheckInId] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
 
  useEffect(() => {
    const cachedId = localStorage.getItem('volunteerId');
    setVolunteerId(cachedId);
    loadInitialData(cachedId);
  }, []);
 
  async function loadInitialData(currentId: string | null) {
    setLoading(true);
    try {
      const usersRes = await fetch('/api/users?role=volunteer');
      const usersData = await usersRes.json();
      const usersList = Array.isArray(usersData) ? usersData : [];
      setAllVolunteers(usersList);
 
      if (currentId) {
        const found = usersList.find((u: any) => u.id === currentId);
        if (found) {
          setVolunteer(found);
          const [tasksRes, projectsRes, recsRes, alertsRes, marketplaceRes, checkinsRes] = await Promise.all([
            fetch(`/api/tasks?volunteerId=${currentId}`),
            fetch('/api/projects'),
            fetch(`/api/tasks/recommend?volunteerId=${currentId}`),
            fetch('/api/alerts'),
            fetch('/api/tasks?status=pending'),
            fetch(`/api/checkins?userId=${currentId}`)
          ]);
          const tasksData = await tasksRes.json();
          const projectsData = await projectsRes.json();
          const recsData = await recsRes.json();
          const alertsData = await alertsRes.json();
          const marketplaceData = await marketplaceRes.json();
          const checkinsData = await checkinsRes.json();

          setTasks(Array.isArray(tasksData) ? tasksData : []);
          setProjects(Array.isArray(projectsData) ? projectsData : []);
          setRecommendations(recsData && Array.isArray(recsData.recommendations) ? recsData.recommendations : []);
          setActiveAlerts(Array.isArray(alertsData) ? alertsData : []);
          setMarketplaceTasks(Array.isArray(marketplaceData) ? marketplaceData.filter((task: Task) => !task.assigned_to) : []);
          setCheckins(Array.isArray(checkinsData) ? checkinsData : checkinsData?.checkins || []);
        } else {
          localStorage.removeItem('volunteerId');
          setVolunteerId(null);
        }
      }
    } catch (e) {
      console.error('Failed to load initial volunteer data', e);
    } finally {
      setLoading(false);
    }
  }

  const handleAttendAlert = async (alertId: string) => {
    if (!volunteerId) return;
    try {
      const res = await fetch('/api/alerts/attend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, volunteerId })
      });
      if (res.ok) {
        setAlertMessage('Вы подтвердили выезд на место! Ваше участие зафиксировано.');
        setTimeout(() => setAlertMessage(null), 4000);
        // Refresh volunteer data (level up, rating, tasks, alerts)
        loadInitialData(volunteerId);
      } else {
        alert('Не удалось подтвердить выезд');
      }
    } catch (e) {
      console.error('Failed to attend alert:', e);
      alert('Ошибка при отправке отклика');
    }
  };

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlertIds(prev => [...prev, alertId]);
  };

  const handleLogin = () => {
    if (!selectedVolId) return;
    localStorage.setItem('volunteerId', selectedVolId);
    setVolunteerId(selectedVolId);
    loadInitialData(selectedVolId);
  };

  const handleAcceptTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted', assigned_to: volunteerId })
      });
      if (res.ok) {
        setAlertMessage('Задача принята в работу!');
        setTimeout(() => setAlertMessage(null), 3000);
        if (volunteerId) loadInitialData(volunteerId);
        setActiveTab('accepted');
      }
    } catch (e) {
      console.error('Failed to accept task', e);
    }
  };

  const handleAvailability = async (status: 'available' | 'busy' | 'offline') => {
    if (!volunteerId) return;
    setAvailabilityLoading(true);
    const availableUntil = status === 'available'
      ? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
      : null;

    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: volunteerId,
          availability_status: status,
          available_until: availableUntil,
          availability_note: status === 'available' ? 'Свободен на ближайшие 3 часа' : ''
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setVolunteer(updated);
        setAlertMessage(status === 'available' ? 'Статус “готов помочь” включен на 3 часа.' : 'Статус доступности обновлен.');
        setTimeout(() => setAlertMessage(null), 3500);
      }
    } catch (error) {
      console.error('Failed to update availability', error);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleStartCheckIn = async (projectId: string) => {
    if (!volunteerId) return;
    setIsCheckingIn(true);
    
    try {
      if (!navigator.geolocation) {
        throw new Error('Геолокация не поддерживается вашим браузером');
      }
      
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;

      const res = await fetch('/api/checkins/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: volunteerId,
          projectId,
          latitude,
          longitude
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка при чекине');
      }

      setAlertMessage('Успешный чекин! Смена началась.');
      setTimeout(() => setAlertMessage(null), 3000);
      if (volunteerId) loadInitialData(volunteerId);
    } catch (err: any) {
      console.error(err);
      setAlertMessage(`Ошибка: ${err.message}`);
      setTimeout(() => setAlertMessage(null), 4000);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const hoursNum = parseFloat(reportHours);
    if (!reportingTask || isNaN(hoursNum) || hoursNum <= 0 || reportText.trim().length < 5) return;
    setIsSubmittingReport(true);

    try {
      let finalLat = undefined;
      let finalLng = undefined;

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        finalLat = pos.coords.latitude;
        finalLng = pos.coords.longitude;
      } catch (e) {
        // Geolocation failed on checkout, proceed anyway
      }

      // 1. Submit check-in report (checkout)
      const checkinRes = await fetch('/api/checkins/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInId: activeCheckInId,
          text_report: reportText,
          hours: hoursNum,
          latitude: finalLat,
          longitude: finalLng
        })
      });

      // 2. Set task to completed
      const taskRes = await fetch(`/api/tasks/${reportingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });

      // 3. Simulating Telegram Notification update so bot chat reflects the report
      if (volunteer && volunteer.telegram_id) {
        await fetch('/api/telegram/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId: volunteer.telegram_id,
            text: `report_${reportingTask.id}` // trigger bot flow
          })
        });
      }

      if (checkinRes.ok && taskRes.ok) {
        setReportingTask(null);
        setReportText('');
        setReportHours('1');
        setAlertMessage('Отчет успешно отправлен! Часы зафиксированы.');
        setTimeout(() => setAlertMessage(null), 4000);
        if (volunteerId) loadInitialData(volunteerId);
        setActiveTab('completed');
      }
    } catch (err) {
      console.error('Failed to submit report', err);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const getDeadlineState = (task: Task) => {
    if (task.status === 'completed') return 'normal';
    const now = new Date();
    if (task.title.startsWith('RSVP:')) {
      const project = projects.find(p => p.id === task.project_id);
      if (project && project.end_date) {
        if (now > new Date(project.end_date)) return 'overdue';
      }
      return 'normal';
    }
    const deadline = new Date(task.deadline);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffTime < 0) return 'overdue';
    if (diffDays <= 3) return 'urgent';
    return 'normal';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  // --- SIGN-IN SCREEN ---
  if (!volunteerId || !volunteer) {
    return (
      <main className="min-h-[80vh] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 text-center animate-fade-in">
          <div className="mx-auto w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Кабинет волонтера</h2>
            <p className="text-xs text-slate-500 mt-1">
              Выберите свой профиль для просмотра задач
            </p>
          </div>

          <div className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ваш профиль</label>
              <select
                value={selectedVolId}
                onChange={(e) => setSelectedVolId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              >
                <option value="">-- Выберите профиль --</option>
                {allVolunteers.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.full_name} ({v.phone || 'без телефона'})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleLogin}
              disabled={!selectedVolId}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:text-slate-400"
            >
              Войти в кабинет
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Filter tasks by status tab
  const filteredTasks = tasks.filter(t => t.status === activeTab);

  const xp = volunteer.xp ?? 0;
  const level = volunteer.level ?? 1;
  const levelProgressPercent = xp % 100;
  const badgesList = volunteer.badges || [];
  const completedTasksCount = tasks.filter(t => t.status === 'completed').length;
  const totalHours = checkins.reduce((sum, checkin) => sum + Number(checkin.hours || 0), 0);
  const activeProjectsCount = new Set(tasks.map(task => task.project_id)).size;
  const reportQuality = reportText.trim().length >= 90 ? 'strong' : reportText.trim().length >= 35 ? 'ok' : 'weak';
  const marketplaceFeed = [
    ...recommendations,
    ...marketplaceTasks.filter(task => !recommendations.some(rec => rec.id === task.id)).slice(0, 6)
  ];

  return (
    <div className="space-y-5 pb-6 animate-fade-in">
      {/* Toast Alert */}
      {alertMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs shadow-lg flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{alertMessage}</span>
        </div>
      )}

      {/* Active Emergency Alerts Banner */}
      {activeAlerts.filter(alert => 
        alert.status === 'active' && 
        alert.notified_volunteer_ids?.includes(volunteer.id) && 
        !alert.attending_volunteer_ids?.includes(volunteer.id) && 
        !dismissedAlertIds.includes(alert.id)
      ).map(alert => (
        <div key={alert.id} className="p-4 bg-rose-50 border border-rose-250 rounded-2xl shadow-md space-y-3 animate-pulse">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-rose-800 font-black text-xs uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
              <span>🚨 Экстренный сбор по тревоге!</span>
            </div>
            <button 
              onClick={() => handleDismissAlert(alert.id)}
              className="text-rose-400 hover:text-rose-700 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full hover:bg-rose-100 transition-all cursor-pointer"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-1">
            <h4 className="font-extrabold text-slate-950 text-xs">{alert.title}</h4>
            <p className="text-[10px] text-slate-600 leading-relaxed">{alert.description}</p>
          </div>

          <div className="text-[9px] text-rose-850 font-bold bg-rose-100/50 p-2 rounded-lg border border-rose-200/50 space-y-1">
            <div>🛠 Требуемые навыки: <span className="font-semibold text-rose-950">{alert.required_skills?.join(', ')}</span></div>
            <div>📍 Радиус сбора: <span className="font-semibold text-rose-950">{alert.radius_km} км</span></div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => handleDismissAlert(alert.id)}
              className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-100/40 text-[10px] font-bold transition-all cursor-pointer"
            >
              Отклонить
            </button>
            <button
              onClick={() => handleAttendAlert(alert.id)}
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow cursor-pointer flex items-center gap-1"
            >
              🚨 Выехать на место
            </button>
          </div>
        </div>
      ))}

      {/* Quick Availability */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => handleAvailability('available')}
          disabled={availabilityLoading}
          className={`p-3 rounded-2xl border text-left transition-all ${
            volunteer.availability_status === 'available'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <Radio className="w-4 h-4 mb-2" />
          <span className="block text-[10px] font-black uppercase">Готов помочь</span>
        </button>
        <button
          onClick={() => handleAvailability('busy')}
          disabled={availabilityLoading}
          className={`p-3 rounded-2xl border text-left transition-all ${
            volunteer.availability_status === 'busy'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <Clock className="w-4 h-4 mb-2" />
          <span className="block text-[10px] font-black uppercase">Занят</span>
        </button>
        <button
          onClick={() => handleAvailability('offline')}
          disabled={availabilityLoading}
          className={`p-3 rounded-2xl border text-left transition-all ${
            volunteer.availability_status === 'offline'
              ? 'bg-slate-100 border-slate-300 text-slate-800'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <UserCheck className="w-4 h-4 mb-2" />
          <span className="block text-[10px] font-black uppercase">Оффлайн</span>
        </button>
      </div>

      {/* Volunteer Profile Summary */}
      <div className="glass-panel bg-white p-5 border border-slate-200 shadow-sm rounded-2xl space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] bg-slate-900 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Уровень {level}
              </span>
              <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Волонтер
              </span>
            </div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight mt-1">{volunteer.full_name}</h2>
            {volunteer.phone && (
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Телефон: {volunteer.phone}
              </p>
            )}
          </div>
          
          <div className="text-right flex flex-col items-end gap-1.5">
            <Link 
              href="/volunteer-dashboard/leaderboards"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px] hover:bg-amber-100 transition-all cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
              Топ-Лист
            </Link>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              {(volunteer.rating ?? 5.0).toFixed(1)}
            </span>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
          <div className="flex justify-between text-[10px] font-bold text-slate-500">
            <span>Опыт: {xp} XP</span>
            <span>До уровня {level + 1}: {100 - levelProgressPercent} XP</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-slate-900 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${levelProgressPercent}%` }}
            />
          </div>
        </div>

        {/* Badges Collection */}
        {badgesList.length > 0 && (
          <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Награды:</span>
            <div className="flex flex-wrap gap-1.5">
              {badgesList.map(bId => {
                const badgeInfo = BADGES_MAP[bId] || { name: 'Награда', icon: '🏆', desc: 'За участие' };
                return (
                  <span 
                    key={bId} 
                    title={`${badgeInfo.name}: ${badgeInfo.desc}`}
                    className="inline-flex items-center gap-1 bg-slate-50 hover:bg-slate-100 px-2 py-0.5 border border-slate-200 rounded-lg text-[9px] font-semibold text-slate-700 transition-all cursor-help"
                  >
                    <span>{badgeInfo.icon}</span>
                    <span>{badgeInfo.name}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Impact Profile */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <Target className="w-4 h-4 text-slate-500 mb-2" />
          <p className="text-lg font-black text-slate-900">{completedTasksCount}</p>
          <p className="text-[9px] text-slate-400 font-bold uppercase">Задач закрыто</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <Clock className="w-4 h-4 text-slate-500 mb-2" />
          <p className="text-lg font-black text-slate-900">{totalHours.toFixed(1)}</p>
          <p className="text-[9px] text-slate-400 font-bold uppercase">Часов вклада</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
          <Layers className="w-4 h-4 text-slate-500 mb-2" />
          <p className="text-lg font-black text-slate-900">{activeProjectsCount}</p>
          <p className="text-[9px] text-slate-400 font-bold uppercase">Проектов</p>
        </div>
      </div>

      {/* Knowledge Base Link Banner */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 leading-snug">База знаний</h4>
            <p className="text-[10px] text-slate-400">Кодекс волонтера, регламенты, инструкции</p>
          </div>
        </div>
        <Link 
          href="/volunteer-dashboard/kb"
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-all flex items-center justify-center"
        >
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </Link>
      </div>

      {/* Recommended Tasks */}
      {marketplaceFeed.length > 0 && (
        <div className="space-y-2.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Маркетплейс задач:</span>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
            {marketplaceFeed.map(rec => (
              <div 
                key={rec.id} 
                className="w-72 shrink-0 bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-lg snap-start flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] bg-slate-850 text-slate-300 px-2 py-0.5 rounded-full font-bold uppercase">
                      {rec.org_category || 'Открытая задача'}
                    </span>
                    <span className="text-[9px] text-emerald-400 font-bold">
                      {recommendations.some(r => r.id === rec.id) ? '★ Подходит вам' : 'Можно взять'}
                    </span>
                  </div>
                  <h4 className="font-bold text-white text-xs leading-snug pt-1">{rec.title}</h4>
                  <p className="text-[9px] text-slate-400 truncate">
                    Проект: {rec.project_title || projects.find(p => p.id === rec.project_id)?.title || 'Общий'}
                  </p>
                </div>
                
                <div className="flex justify-between items-center border-t border-slate-800 pt-2.5">
                  <span className="text-[9px] text-slate-400">Дедлайн: {new Date(rec.deadline).toLocaleDateString('ru-RU')}</span>
                  <button
                    onClick={() => handleAcceptTask(rec.id)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-950 text-[9px] font-extrabold rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    Взять себе
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all ${
            activeTab === 'pending'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Входящие ({tasks.filter(t => t.status === 'pending').length})
        </button>
        <button
          onClick={() => setActiveTab('accepted')}
          className={`flex-1 py-2 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all ${
            activeTab === 'accepted'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          В работе ({tasks.filter(t => t.status === 'accepted').length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-2 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all ${
            activeTab === 'completed'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Выполнены ({tasks.filter(t => t.status === 'completed').length})
        </button>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="glass-panel bg-white p-8 text-center text-slate-400 text-xs border border-slate-200 shadow-sm rounded-xl py-12 flex flex-col items-center justify-center space-y-2">
            <Inbox className="w-6 h-6 text-slate-300" />
            <span>Задачи в этом статусе отсутствуют</span>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const deadlineState = getDeadlineState(task);
            const project = projects.find(p => p.id === task.project_id);
            const activeCheckIn = checkins.find(c => c.project_id === task.project_id && !c.check_out_at);

            const cardBorder = {
              overdue: 'border-red-200 bg-red-50/20',
              urgent: 'border-amber-200 bg-amber-50/20',
              normal: 'border-slate-200 bg-white'
            }[deadlineState];

            return (
              <div 
                key={task.id} 
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all shadow-sm ${cardBorder}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Проект: {project?.title || 'Общий'}
                    </span>
                    
                    {deadlineState === 'overdue' && (
                      <span className="text-[10px] text-red-600 flex items-center gap-1 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Срок пропущен
                      </span>
                    )}
                    {deadlineState === 'urgent' && (
                      <span className="text-[10px] text-amber-600 flex items-center gap-1 font-bold">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        Дедлайн близко
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-slate-900 text-xs">{task.title}</h4>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-300" />
                    До: {new Date(task.deadline).toLocaleDateString('ru-RU')}
                  </div>

                  {task.status === 'pending' && (
                    <button
                      onClick={() => handleAcceptTask(task.id)}
                      disabled={deadlineState === 'overdue'}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Принять в работу
                    </button>
                  )}
                  {task.status === 'accepted' && (
                    <div className="flex gap-2">
                      {!activeCheckIn ? (
                        <button
                          onClick={() => handleStartCheckIn(task.project_id!)}
                          disabled={isCheckingIn || deadlineState === 'overdue'}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          📍 Начать смену
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveCheckInId(activeCheckIn.id);
                            setReportingTask(task);
                          }}
                          disabled={deadlineState === 'overdue'}
                          className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          🏁 Завершить смену
                        </button>
                      )}
                    </div>
                  )}
                  {task.status === 'completed' && (
                    <span className="text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg text-[9px] font-bold">
                      Выполнено
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Check-in Reporting Modal */}
      {reportingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Сдать отчет о задаче</h3>
              <p className="text-[10px] text-slate-500">Тема: "{reportingTask.title}"</p>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4">
              {/* Question 1: Logged hours */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs text-slate-700 font-bold block">
                  Затрачено времени (в часах)
                </label>
                <input
                  type="number"
                  required
                  step="0.5"
                  min="0.5"
                  max="24"
                  value={reportHours}
                  onChange={(e) => setReportHours(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>

              {/* Question 2: Report details */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs text-slate-700 font-bold block">
                  Что было сделано? (Текст отчета)
                </label>
                <textarea
                  required
                  placeholder="Например: что сделали, где были сложности, какой результат передали координатору..."
                  rows={4}
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 resize-none"
                />
                <div className={`p-2 rounded-lg border text-[10px] ${
                  reportQuality === 'strong' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                  reportQuality === 'ok' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                  'bg-slate-50 border-slate-100 text-slate-500'
                }`}>
                  {reportQuality === 'strong'
                    ? 'Отличный отчет: координатору будет легко оценить результат.'
                    : reportQuality === 'ok'
                      ? 'Неплохо. Добавьте результат или проблему, если она была.'
                      : 'Сделайте отчет полезнее: действие, результат, следующая потребность.'}
                </div>
                <button
                  type="button"
                  onClick={() => setReportText('Выполнил задачу на месте. Основной результат: . Сложности/риски: . Что нужно дальше: .')}
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600 hover:text-slate-900"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Вставить структуру отчета
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setReportingTask(null);
                    setReportText('');
                    setReportHours('1');
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-all"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={reportText.trim().length < 5 || !reportHours || isSubmittingReport}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:text-slate-400"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmittingReport ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
