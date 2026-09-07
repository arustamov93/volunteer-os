import { db, User, Task, prisma } from './db';
import { hashPassword } from './security';
import crypto from 'crypto';
import { t } from './bot-i18n';
import { logSystemEvent } from './logger';
import { isWithinRadius } from './geo';

export interface BotResponse {
  text: string;
  keyboard?: {
    text: string;
    callback_data?: string;
    request_contact?: boolean;
    request_location?: boolean;
  }[][];
}

/**
 * Handles incoming messages/actions for the Telegram bot.
 * Returns a response with text and optional inline buttons.
 */
export async function handleBotUpdate(
  telegramId: number,
  text: string,
  username?: string,
  phone?: string | null,
  firstName?: string,
  lastName?: string
): Promise<BotResponse> {
  const cleanText = text.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://volunteer-os-zeta.vercel.app';
  
  // 1. Check if user is registered, their session, and any existing application concurrently
  let [user, session, existingApp] = await Promise.all([
    db.getUserByTelegramId(telegramId),
    db.getTelegramSession(telegramId),
    db.getVolunteerApplicationByTelegramId(telegramId)
  ]);
  
  if (!user) {
    if (existingApp) {
      if (existingApp.status === 'pending') {
        return { text: 'Ваша заявка уже отправлена на рассмотрение. Пожалуйста, ожидайте решения администратора.' };
      }
      if (existingApp.status === 'rejected') {
        return { text: 'К сожалению, ваша заявка была отклонена.' };
      }
    }

    // ── /start command ─────────────────────────────────────────────────────
    if (cleanText === '/start') {
      await db.setTelegramSession(telegramId, 'reg_lang', {});
      return {
        text: t('reg_welcome', 'RUS'),
        keyboard: [
          [
            { text: "O'zbekcha 🇺🇿", callback_data: 'lang_UZB' },
            { text: 'Русский 🇷🇺',   callback_data: 'lang_RUS' },
            { text: 'English 🇬🇧',   callback_data: 'lang_ENG' }
          ]
        ]
      };
    }

    if (session) {
      const state = session.state;
      const data  = session.data;
      const lang  = data.lang || 'RUS';

      // ── STEP 1: Language ────────────────────────────────────────────────
      if (state === 'reg_lang') {
        if (cleanText.startsWith('lang_')) {
          data.lang = cleanText.replace('lang_', '');
          await db.setTelegramSession(telegramId, 'reg_name', data);
          return { text: t('reg_name', data.lang) };
        }
        return { text: t('reg_choose_lang', lang) };
      }

      // ── STEP 2: Full name (passport) ───────────────────────────────────
      if (state === 'reg_name') {
        if (cleanText.length < 3) {
          return { text: t('reg_name', lang) };
        }
        data.fullName = cleanText;
        await db.setTelegramSession(telegramId, 'reg_contact', data);
        return {
          text: t('reg_contact', lang),
          keyboard: [[{ text: t('reg_contact_btn', lang), request_contact: true }]]
        };
      }

      // ── STEP 3: Contact sharing / STEP 4: manual phone ─────────────────
      if (state === 'reg_contact') {
        const isDirectPhone = cleanText.match(/^\+?[0-9]{9,15}$/);
        const phoneToUse = phone || (isDirectPhone ? cleanText : null);
        if (phoneToUse) {
          data.phone = phoneToUse.replace(/[^\d+]/g, '');
          data.projects = [];
          await db.setTelegramSession(telegramId, 'reg_projects', data);
          return {
            text: t('reg_projects', lang),
            keyboard: buildProjectsKeyboard(lang, data.projects)
          };
        }
        // Ask manual phone
        await db.setTelegramSession(telegramId, 'reg_phone_manual', data);
        return { text: t('reg_phone', lang) };
      }

      if (state === 'reg_phone_manual') {
        const isDirectPhone = cleanText.match(/^\+?[0-9]{9,15}$/);
        const phoneToUse = phone || (isDirectPhone ? cleanText : null);
        if (!phoneToUse) {
          return { text: t('reg_contact_error', lang) };
        }
        data.phone = phoneToUse.replace(/[^\d+]/g, '');
        data.projects = [];
        await db.setTelegramSession(telegramId, 'reg_projects', data);
        return {
          text: t('reg_projects', lang),
          keyboard: buildProjectsKeyboard(lang, data.projects)
        };
      }

      // ── STEP 5: Projects (multi-select) ────────────────────────────────
      if (state === 'reg_projects') {
        data.projects = data.projects || [];
        if (cleanText === 'proj_next') {
          if (data.projects.length === 0) {
            return { text: t('reg_projects_empty', lang), keyboard: buildProjectsKeyboard(lang, data.projects) };
          }
          data.languages = [];
          await db.setTelegramSession(telegramId, 'reg_languages', data);
          return { text: t('reg_skills', lang), keyboard: buildLanguagesKeyboard(lang, data.languages) };
        }
        if (cleanText.startsWith('proj_')) {
          const projectMap: Record<string, string> = {
            proj_1:  'Первый слет медиков волонтеров (Ташкент)',
            proj_2:  '«Солнышко»',
            proj_3:  '"Hamsa charity"',
            proj_4:  '«Делай добро»',
            proj_5:  '«Olimpic volunteers»',
            proj_6:  'Волонтёры «Inson»',
            proj_7:  'Волонтеры ЦГУ',
            proj_8:  'Волонтеры Олимпиады по шахматам (Самарканд)',
            proj_9:  'Триатлон волонтеры (Самарканд)',
            proj_10: 'Школа волонтеров',
            proj_11: 'UVA main team',
            proj_12: 'UVA media'
          };
          const selected = projectMap[cleanText];
          if (selected) {
            if (!data.projects.includes(selected)) {
              data.projects.push(selected);
            } else {
              data.projects = data.projects.filter((p: string) => p !== selected);
            }
            await db.setTelegramSession(telegramId, 'reg_projects', data);
            return { text: t('reg_projects_added', lang, selected), keyboard: buildProjectsKeyboard(lang, data.projects) };
          }
        }
        return { text: t('reg_projects', lang), keyboard: buildProjectsKeyboard(lang, data.projects) };
      }

      // ── STEP 6: Languages (multi-select) ───────────────────────────────
      if (state === 'reg_languages') {
        data.languages = data.languages || [];
        if (cleanText === 'lang_next') {
          if (data.languages.length === 0) {
            return { text: t('reg_skills_empty', lang), keyboard: buildLanguagesKeyboard(lang, data.languages) };
          }
          data.health = [];
          await db.setTelegramSession(telegramId, 'reg_health', data);
          return { text: t('reg_health', lang), keyboard: buildHealthKeyboard(lang, data.health) };
        }
        if (cleanText.startsWith('lang_skill_')) {
          const langMap: Record<string, string> = {
            lang_skill_uzb: 'Узбекский',
            lang_skill_rus: 'Русский',
            lang_skill_eng: 'Английский',
            lang_skill_deu: 'Немецкий',
            lang_skill_tur: 'Турецкий',
            lang_skill_zho: 'Китайский'
          };
          const selected = langMap[cleanText];
          if (selected) {
            if (!data.languages.includes(selected)) {
              data.languages.push(selected);
            } else {
              data.languages = data.languages.filter((l: string) => l !== selected);
            }
            await db.setTelegramSession(telegramId, 'reg_languages', data);
            return { text: t('reg_skills_added', lang, selected), keyboard: buildLanguagesKeyboard(lang, data.languages) };
          }
        }
        // Free text = other language
        if (cleanText.length >= 2) {
          if (!data.languages.includes(cleanText)) data.languages.push(cleanText);
          await db.setTelegramSession(telegramId, 'reg_languages', data);
          return { text: t('reg_skills_added', lang, cleanText), keyboard: buildLanguagesKeyboard(lang, data.languages) };
        }
        return { text: t('reg_skills', lang), keyboard: buildLanguagesKeyboard(lang, data.languages) };
      }

      // ── STEP 7: Health conditions (multi-select + free text) ───────────
      if (state === 'reg_health') {
        data.health = data.health || [];
        if (cleanText === 'health_next') {
          if (data.health.length === 0) {
            return { text: t('reg_health_empty', lang), keyboard: buildHealthKeyboard(lang, data.health) };
          }
          await db.setTelegramSession(telegramId, 'reg_referral', data);
          return { text: t('reg_referral', lang) };
        }
        if (cleanText === 'health_other_btn') {
          await db.setTelegramSession(telegramId, 'reg_health_other', data);
          return { text: t('reg_health_other_prompt', lang) };
        }
        const healthMap: Record<string, string> = {
          health_vision:    'Нарушение зрения',
          health_hearing:   'Нарушение слуха',
          health_mobility:  'Сложности в передвижении',
          health_speech:    'Сложности в речи',
          health_chronic:   'Хроническое заболевание',
          health_allergy:   'Аллергия',
          health_barrier:   'Необходима безбарьерная среда',
          health_assistant: 'Необходим сопровождающий',
          health_sensory:   'Повышенная чувствительность к шуму/свету',
          health_temporary: 'Временные ограничения здоровья',
          health_none:      'Дополнительные условия не требуются',
          health_no:        'Нет'
        };
        if (cleanText in healthMap) {
          const selected = healthMap[cleanText];
          if (cleanText === 'health_none' || cleanText === 'health_no') {
            data.health = [selected];
          } else {
            data.health = data.health.filter((h: string) => h !== 'Дополнительные условия не требуются' && h !== 'Нет');
            if (!data.health.includes(selected)) {
              data.health.push(selected);
            } else {
              data.health = data.health.filter((h: string) => h !== selected);
            }
          }
          await db.setTelegramSession(telegramId, 'reg_health', data);
          return { text: t('reg_health_added', lang, selected), keyboard: buildHealthKeyboard(lang, data.health) };
        }
        return { text: t('reg_health', lang), keyboard: buildHealthKeyboard(lang, data.health) };
      }

      if (state === 'reg_health_other') {
        data.health = data.health || [];
        if (cleanText.length >= 2) data.health.push(cleanText);
        await db.setTelegramSession(telegramId, 'reg_health', data);
        return { text: t('reg_health_added', lang, cleanText), keyboard: buildHealthKeyboard(lang, data.health) };
      }

      // ── STEP 8: Referral ───────────────────────────────────────────────
      if (state === 'reg_referral') {
        data.referralInfo = cleanText;
        const hasDisability = data.health && data.health.length > 0 &&
          !data.health.every((h: string) => h === 'Дополнительные условия не требуются');

        await db.createVolunteerApplication({
          telegram_id:       telegramId,
          language_pref:     lang,
          full_name:         data.fullName,
          date_of_birth:     '',
          phone:             data.phone,
          projects:          data.projects || [],
          spoken_languages:  data.languages || [],
          has_disability:    hasDisability,
          disability_info:   hasDisability ? (data.health || []).join('; ') : null,
          is_physically_ready: false,
          referral_info:     data.referralInfo,
          status:            'pending'
        });

        await logSystemEvent(
          'INFO',
          `Новая заявка волонтера в Telegram-боте: ${data.fullName}`,
          { section: 'bot', telegram_id: telegramId, phone: data.phone, full_name: data.fullName, event: 'bot_registration' },
          'bot'
        );

        await db.clearTelegramSession(telegramId);
        return { text: t('reg_success', lang) };
      }
    }

    return { text: "Пожалуйста, отправьте команду /start для регистрации. / Please send /start to register. / Ro'yxatdan o'tish uchun /start ni yuboring." };
  }


  // 2. User is authenticated. Check bot state machine (session)
  session = await db.getTelegramSession(telegramId);

  if (session) {
    if (session.state === 'awaiting_checkin') {
      if (cleanText === 'Отмена' || cleanText.startsWith('/') || cleanText.startsWith('cmd_')) {
        await db.clearTelegramSession(telegramId);
        if (cleanText === 'Отмена') {
          return {
            text: '❌ Действие отменено.',
            keyboard: [[{ text: '📋 Мои Задачи', callback_data: 'cmd_tasks' }]]
          };
        }
      } else {
        if (cleanText.length < 5) {
          return {
            text: '⚠️ Описание работы слишком короткое. Пожалуйста, опишите проделанную работу подробнее (минимум 5 символов):'
          };
        }

        const taskId = session.data.task_id;
        const task = await db.getTask(taskId);
        if (!task) {
          await db.clearTelegramSession(telegramId);
          return { text: '⚠️ Ошибка: задача не найдена.' };
        }

        // Voice simulation check: if text is a mock voice message
        let reportText = cleanText;
        let isVoice = false;
        if (cleanText.startsWith('[Голосовое сообщение]')) {
          isVoice = true;
          reportText = cleanText.replace('[Голосовое сообщение]', '').trim() || 'Выполнена закупка и доставка необходимых материалов согласно списку задач проекта.';
        }

        // Create check-in record directly in check_ins table
        await db.createCheckIn({
          user_id: user.id,
          project_id: task.project_id,
          text_report: isVoice ? `🎤 [ИИ-Расшифровка]: ${reportText}` : reportText,
          hours: 2.0, // default hours registered
          check_in_at: new Date().toISOString()
        });

        // Update task status to completed
        await db.updateTask(taskId, {
          status: 'completed'
        });

        // Clear session
        await db.clearTelegramSession(telegramId);

        return {
          text: `🎉 *Чек-ин успешно сохранен!*\n\n${isVoice ? `🎤 *ИИ-Расшифровка голосового сообщения:*\n_"${reportText}"_\n\n` : ''}Задача переведена в статус *Выполнена*. Запись добавлена в таблицу Check_ins (Засчитано часов: 2.0). Рейтинг волонтера обновлен! 🌟`,
          keyboard: [[{ text: '📋 Мои Задачи', callback_data: 'cmd_tasks' }]]
        };
      }
    }
    
    if (session.state === 'awaiting_location_checkin' || session.state === 'awaiting_location_checkout') {
      if (cleanText === 'Отмена' || cleanText.startsWith('/') || cleanText.startsWith('cmd_')) {
        await db.clearTelegramSession(telegramId);
        if (cleanText === 'Отмена') {
          return {
            text: '❌ Действие отменено.',
            keyboard: [[{ text: '📋 Мои Задачи', callback_data: 'cmd_tasks' }]]
          };
        }
      } else if (!cleanText.startsWith('[Локация]')) {
        return {
          text: '⚠️ Пожалуйста, используйте кнопку "📍 Отправить локацию" внизу экрана, чтобы поделиться своим местоположением.\n\nНажмите "Отмена", чтобы выйти.',
          keyboard: [
            [{ text: '📍 Отправить локацию', request_location: true }],
            [{ text: 'Отмена' }]
          ]
        };
      }

      const coordsStr = cleanText.replace('[Локация]', '').trim();
      const [latStr, lonStr] = coordsStr.split(',');
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      const taskId = session.data.task_id;
      const isCheckin = session.state === 'awaiting_location_checkin';

      try {
        const task = await db.getTask(taskId);
        if (!task) {
          await db.clearTelegramSession(telegramId);
          return { text: '⚠️ Задача не найдена.' };
        }

        const project = await db.getProject(task.project_id);
        if (!project) {
          await db.clearTelegramSession(telegramId);
          return { text: '⚠️ Проект не найден.' };
        }

        // Validate distance if project has geolocation set
        if (project.latitude && project.longitude) {
          const allowedRadius = (project as any).allowedRadiusKm || 0.5;
          const { valid, distanceKm } = isWithinRadius(lat, lon, project.latitude, project.longitude, allowedRadius);
          if (!valid) {
            return {
              text: `❌ *Вы находитесь слишком далеко от места проведения!*\n\nВаше расстояние: *${(distanceKm * 1000).toFixed(0)}м*\nРазрешенный радиус: *${(allowedRadius * 1000).toFixed(0)}м*\n\nПожалуйста, подойдите ближе и отправьте локацию еще раз.`,
              keyboard: [
                [{ text: '📍 Отправить локацию', request_location: true }],
                [{ text: 'Отмена' }]
              ]
            };
          }
        }

        // Handle Check-in / Check-out directly in DB
        const activeCheckIn = await prisma.checkIn.findFirst({
          where: {
            userId: user.id,
            projectId: task.project_id,
            checkOutAt: null
          }
        });

        if (isCheckin) {
          if (activeCheckIn) {
            await db.clearTelegramSession(telegramId);
            return {
              text: '⚠️ У вас уже есть активная смена на этом проекте.',
              keyboard: [[{ text: '📋 Мои Задачи', callback_data: 'cmd_tasks' }]]
            };
          }

          await prisma.checkIn.create({
            data: {
              userId: user.id,
              projectId: task.project_id,
              checkInAt: new Date(),
              checkInLat: lat,
              checkInLng: lon
            }
          });

          await db.clearTelegramSession(telegramId);
          return {
            text: `✅ *Успешный Чекин!*\nВы находитесь в разрешенной зоне.\nЖелаем продуктивной смены! 🚀`,
            keyboard: [[{ text: '📋 Мои Задачи', callback_data: 'cmd_tasks' }]]
          };
        } else {
          // Checkout
          if (!activeCheckIn) {
            await db.clearTelegramSession(telegramId);
            return {
              text: '⚠️ У вас нет активной смены для завершения.',
              keyboard: [[{ text: '📋 Мои Задачи', callback_data: 'cmd_tasks' }]]
            };
          }

          const checkOutAt = new Date();
          const checkInAt = new Date(activeCheckIn.checkInAt);
          const diffMs = checkOutAt.getTime() - checkInAt.getTime();
          const hours = Math.max(0.1, Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100);

          await prisma.checkIn.update({
            where: { id: activeCheckIn.id },
            data: {
              checkOutAt,
              checkOutLat: lat,
              checkOutLng: lon,
              hours
            }
          });

          try {
            await db.addXpToVolunteer(user.id, Math.round(hours * 15));
          } catch (e) {
            console.error('Failed to reward XP for check-out:', e);
          }

          await db.clearTelegramSession(telegramId);
          return {
            text: `🏁 *Успешный Чекаут!*\nСмена завершена. Засчитано часов: *${hours} ч*.\nОтличная работа! 🌟`,
            keyboard: [[{ text: '📋 Мои Задачи', callback_data: 'cmd_tasks' }]]
          };
        }
      } catch (e) {
        console.error('Bot Checkin Error:', e);
        return { text: '⚠️ Ошибка при обработке гео-чекина. Попробуйте еще раз.' };
      }
    }
  }

  // 3. Main Command Processor
  if (cleanText === '/start') {
    return {
      text: `👋 Приветствуем снова, *${user.full_name}*!\n\nВы авторизованы в системе как *Волонтер*.\nТекущий рейтинг: ${user.rating.toFixed(2)} / 5.0\n\nДоступные команды:\n/tasks — Список ваших задач\n/status — Информация о вашем профиле`,
      keyboard: [
        [{ text: '📋 Мои Задачи', callback_data: 'cmd_tasks' }],
        [{ text: '👤 Мой Профиль', callback_data: 'cmd_profile' }]
      ]
    };
  }

  if (cleanText === '/status' || cleanText === 'cmd_profile') {
    const allTasks = await db.getTasks();
    const userTasks = allTasks.filter(t => t.assigned_to === user!.id);
    const pendingTasks = userTasks.filter(t => t.status !== 'completed');
    const completedTasks = userTasks.filter(t => t.status === 'completed');
    const autoLoginUrl = `${appUrl}/api/auth/auto-login?tg_id=${telegramId}`;

    return {
      text: `👤 *Ваш профиль волонтера*\n\n🔹 *Имя:* ${user.full_name}\n🔹 *Телефон:* ${user.phone || 'Не указан'}\n🔹 *Рейтинг:* ${user.rating.toFixed(2)} / 5.0\n\n🌐 *Вход на сайт в 1 клик:* [Войти в кабинет](${autoLoginUrl})\n\n📊 *Статистика задач:*\n— Выполнено: ${completedTasks.length}\n— Активно: ${pendingTasks.length}`,
      keyboard: [
        [{ text: '📋 Мои Задачи', callback_data: 'cmd_tasks' }],
        [{ text: '❓ Справка', callback_data: 'cmd_help' }]
      ]
    };
  }

  if (cleanText === '/tasks' || cleanText === 'cmd_tasks') {
    const allTasks = await db.getTasks();
    const userTasks = allTasks.filter(t => t.assigned_to === user!.id && t.status !== 'completed');

    if (userTasks.length === 0) {
      const allProjects = await db.getProjects();
      const activeProjects = allProjects.filter(p => p.status === 'active' || p.status === 'in_progress' || !p.status);

      if (activeProjects.length === 0) {
        return {
          text: '🎉 У вас нет активных задач, и сейчас нет доступных проектов.\n\nКогда менеджеры назначат на вас новую задачу, вы получите уведомление здесь.',
          keyboard: [[{ text: '👤 Мой Профиль', callback_data: 'cmd_profile' }]]
        };
      }

      const keyboard: { text: string; callback_data: string }[][] = [];
      activeProjects.forEach(proj => {
        keyboard.push([{ text: `📍 Начать смену: ${proj.title.slice(0, 22)}`, callback_data: `quick_checkin_${proj.id}` }]);
      });
      keyboard.push([{ text: '👤 Мой Профиль', callback_data: 'cmd_profile' }]);

      return {
        text: '📋 *Доступные проекты для смены:*\n\nВыберите ваш проект ниже, чтобы мгновенно начать смену:',
        keyboard
      };
    }

    let responseText = '📋 *Ваши активные задачи:*\n\n';
    const keyboard: { text: string; callback_data: string }[][] = [];

    for (let idx = 0; idx < userTasks.length; idx++) {
      const task = userTasks[idx];
      const proj = await db.getProject(task.project_id);
      const statusEmoji = task.status === 'accepted' ? '⚡' : '⏳';
      const statusText = task.status === 'accepted' ? 'Принята' : 'Ожидает решения';
      const warningEmoji = task.is_overdue ? '🔴 ' : '';
      
      responseText += `${idx + 1}. ${warningEmoji}*${task.title}*\n`;
      responseText += `└ Проект: ${proj ? proj.title : 'Не указан'}\n`;
      responseText += `└ Статус: ${statusEmoji} ${statusText}\n`;
      responseText += `└ Сдать до: ${new Date(task.deadline).toLocaleDateString('ru-RU')}\n\n`;

      if (task.status === 'pending') {
        keyboard.push([{ text: `▶️ Принять задачу: ${task.title.slice(0, 15)}...`, callback_data: `start_${task.id}` }]);
      } else if (task.status === 'accepted') {
        // Find if user has an active checkin for this project
        const activeCheckIn = await prisma.checkIn.findFirst({
          where: {
            userId: user.id,
            projectId: task.project_id,
            checkOutAt: null
          }
        });
        
        if (!activeCheckIn) {
          keyboard.push([{ text: `📍 Начать смену: ${task.title.slice(0, 15)}...`, callback_data: `checkin_${task.id}` }]);
        } else {
          keyboard.push([{ text: `🏁 Завершить смену: ${task.title.slice(0, 15)}...`, callback_data: `checkout_${task.id}` }]);
        }
      }
    }

    keyboard.push([{ text: '👤 Мой Профиль', callback_data: 'cmd_profile' }]);

    return {
      text: responseText,
      keyboard
    };
  }

  // Handle RSVP Responses (Yes / No)
  if (cleanText.startsWith('rsvp_yes_') || cleanText.startsWith('rsvp_no_')) {
    const isYes = cleanText.startsWith('rsvp_yes_');
    const projectId = cleanText.replace('rsvp_yes_', '').replace('rsvp_no_', '');
    
    try {
      const project = await db.getProject(projectId);
      if (!project) return { text: '⚠️ Проект не найден.' };

      // Find or create RSVP Task entry for user tracking
      const existingTask = await prisma.task.findFirst({
        where: {
          projectId,
          assignedTo: user.id,
          title: { startsWith: 'RSVP:' }
        }
      });

      const newStatus = isYes ? 'accepted' : 'rejected';
      const deadlineDate = project.end_date
        ? new Date(project.end_date)
        : project.start_date
        ? new Date(new Date(project.start_date).getTime() + 7 * 24 * 3600 * 1000)
        : new Date(Date.now() + 7 * 24 * 3600 * 1000);

      if (existingTask) {
        await prisma.task.update({
          where: { id: existingTask.id },
          data: { status: newStatus, deadline: deadlineDate, isOverdue: false }
        });
      } else {
        await prisma.task.create({
          data: {
            projectId,
            assignedTo: user.id,
            title: `RSVP: ${user.full_name || 'Волонтер'}`,
            deadline: deadlineDate,
            status: newStatus
          }
        });
      }

      if (isYes) {
        return {
          text: `🎉 *Отлично! Вы подтвердили участие!*\n\nМероприятие: *${project.title}*\n\nНапоминаем, что в день мероприятия нужно будет сделать Гео-Чекин при входе на локацию.`
        };
      } else {
        return {
          text: `Принято. Спасибо за ответ! Ждем вас на следующих мероприятиях.`
        };
      }
    } catch (e) {
      console.error('RSVP response error:', e);
      return { text: '⚠️ Ошибка при сохранении ответа.' };
    }
  }

  // Handle Quick Check-in for volunteers without pre-assigned tasks
  if (cleanText.startsWith('quick_checkin_')) {
    const projectId = cleanText.replace('quick_checkin_', '');
    try {
      const project = await db.getProject(projectId);
      if (!project) return { text: '⚠️ Проект не найден.' };

      let task = await prisma.task.findFirst({
        where: {
          projectId,
          assignedTo: user.id
        }
      });

      if (!task) {
        // Shift deadline: 12 hours from shift start, preventing expired project dates from triggering false alarms
        const taskDeadline = new Date(Date.now() + 12 * 3600 * 1000);

        task = await prisma.task.create({
          data: {
            projectId,
            assignedTo: user.id,
            title: `Смена: ${user.full_name || 'Волонтер'}`,
            deadline: taskDeadline,
            status: 'accepted'
          }
        });
      }

      await db.setTelegramSession(telegramId, 'awaiting_location_checkin', { task_id: task.id });

      return {
        text: `📍 *Начало смены по проекту:* ${project.title}\n\nДля подтверждения местоположения, нажмите кнопку *📍 Отправить локацию* внизу экрана.`,
        keyboard: [
          [{ text: '📍 Отправить локацию', request_location: true }],
          [{ text: 'Отмена' }]
        ]
      };
    } catch (e) {
      console.error('Quick checkin error:', e);
      return { text: '⚠️ Ошибка при начале смены.' };
    }
  }

  // Handle Action: Accept Task
  if (cleanText.startsWith('start_')) {
    const taskId = cleanText.split('_')[1];
    try {
      const task = await db.updateTask(taskId, { status: 'accepted' });
      return {
        text: `⚡ Вы приняли задачу в работу:\n*${task.title}*.\n\nПроект использует гео-локацию? Следуйте инструкциям бота для чек-ина.`,
        keyboard: [
          [{ text: '📋 К списку задач', callback_data: 'cmd_tasks' }]
        ]
      };
    } catch {
      return { text: '⚠️ Ошибка: задача не найдена.' };
    }
  }

  // Handle Action: Initiate Check-in
  if (cleanText.startsWith('report_')) {
    const taskId = cleanText.split('_')[1];
    const task = await db.getTask(taskId);

    if (!task) {
      return { text: '⚠️ Ошибка: задача не найдена.' };
    }

    // Set bot state session to awaiting check-in text/voice
    await db.setTelegramSession(telegramId, 'awaiting_checkin', { task_id: taskId });

    return {
      text: `✍️ *Сдача отчета по задаче:* ${task.title}\n\nПожалуйста, отправьте текстовый отчет или запишите голосовое сообщение с подробностями о проделанной работе:`,
      keyboard: [
        [{ text: '📋 Отмена', callback_data: 'cmd_tasks' }]
      ]
    };
  }

  // Handle Location Checkin requests
  if (cleanText.startsWith('checkin_') || cleanText.startsWith('checkout_')) {
    const isCheckin = cleanText.startsWith('checkin_');
    const taskId = cleanText.split('_')[1];
    
    await db.setTelegramSession(telegramId, isCheckin ? 'awaiting_location_checkin' : 'awaiting_location_checkout', { task_id: taskId });

    return {
      text: `Для подтверждения ${isCheckin ? 'начала' : 'завершения'} смены, нам нужно сверить вашу гео-локацию с местом проведения проекта.\n\nНажмите кнопку *📍 Отправить локацию* внизу экрана.`,
      keyboard: [
        [{ text: '📍 Отправить локацию', request_location: true }],
        [{ text: 'Отмена' }]
      ]
    };
  }
  
  if (cleanText === 'Отмена') {
    await db.clearTelegramSession(telegramId);
    return {
      text: 'Действие отменено.',
      keyboard: [[{ text: '📋 Мои Задачи', callback_data: 'cmd_tasks' }]]
    };
  }

  if (cleanText === '/help' || cleanText === 'cmd_help') {
    return {
      text: '🤖 *Справка по боту Volunteer OS*\n\nКоманды:\n/tasks — список назначенных задач и чек-ин.\n/status — статистика и рейтинг.\n/start — перезапуск бота.\n\nВы можете отправлять текстовые или голосовые сообщения при сдаче отчета — система автоматически расшифрует аудиозапись.',
      keyboard: [[{ text: '📋 Мои Задачи', callback_data: 'cmd_tasks' }]]
    };
  }

  // 4. Smart Command & Message Parser (Telegram-Tasker, Digital Archive, AI Gatekeeper)
  const lowerText = cleanText.toLowerCase();

  // Telegram-Tasker parsing
  if (lowerText.includes('назначь') || lowerText.includes('поручи')) {
    const users = await db.getUsers();
    let assignedUser = null;
    
    // Find if any user matches the name in the text
    for (const u of users) {
      const parts = u.full_name.split(' ');
      const firstName = parts[0] || '';
      const lastName = parts[1] || '';
      
      if (
        (firstName && firstName.length > 2 && lowerText.includes(firstName.toLowerCase().slice(0, -1))) ||
        (lastName && lastName.length > 2 && lowerText.includes(lastName.toLowerCase().slice(0, -1)))
      ) {
        assignedUser = u;
        break;
      }
    }

    // Extract task title
    let taskTitle = 'Новое поручение';
    const matchTitle = cleanText.match(/(?:назначь|надо|поручи)\s+(?:[а-яА-Яa-zA-Z]+\s+)?([^до]+)(?:\s+до\s+|$)/i);
    if (matchTitle && matchTitle[1]) {
      taskTitle = matchTitle[1].trim();
    }

    // Extract deadline
    let deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 3); // Default to 3 days
    if (lowerText.includes('завтра')) {
      deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() + 1);
    } else if (lowerText.includes('пятниц')) {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 Sunday, 5 Friday
      let daysToAdd = (5 - dayOfWeek + 7) % 7;
      if (daysToAdd === 0) daysToAdd = 7;
      deadlineDate.setDate(today.getDate() + daysToAdd);
    } else if (lowerText.includes('воскрес')) {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 Sunday
      let daysToAdd = (0 - dayOfWeek + 7) % 7;
      if (daysToAdd === 0) daysToAdd = 7;
      deadlineDate.setDate(today.getDate() + daysToAdd);
    }

    // Assign to first active project
    const projects = await db.getProjects();
    const activeProj = projects.find(p => p.status === 'active');
    const projId = activeProj ? activeProj.id : 'p1111111-1111-1111-1111-111111111111';

    const newTask = await db.createTask({
      project_id: projId,
      assigned_to: assignedUser ? assignedUser.id : null,
      title: taskTitle,
      deadline: deadlineDate.toISOString(),
      status: 'pending'
    });

    return {
      text: `✅ *ИИ-Создание задачи из чата (Telegram-Tasker):*\n\n📋 *Задача:* ${newTask.title}\n👤 *Исполнитель:* ${assignedUser ? assignedUser.full_name : 'Не назначен (свободная задача)'}\n📅 *Срок сдачи:* ${deadlineDate.toLocaleDateString('ru-RU')}\n\nЗадача успешно добавлена в канбан-панель проекта!`,
      keyboard: [
        [{ text: '📋 Мои Задачи', callback_data: 'cmd_tasks' }],
        [{ text: '👤 Мой Профиль', callback_data: 'cmd_profile' }]
      ]
    };
  }

  // Digital Archive extraction
  if (
    lowerText.includes('файл:') || 
    lowerText.includes('документ:') || 
    cleanText.match(/\.(jpg|pdf|mp4|png|doc|zip|xlsx)/i)
  ) {
    let fileName = 'doc_extracted.pdf';
    const parts = cleanText.split(/[\s:]+/);
    const filePart = parts.find(p => p.match(/\.(jpg|pdf|mp4|png|doc|zip|xlsx)/i));
    if (filePart) {
      fileName = filePart.replace(/[^a-zA-Z0-9_.-]/g, '');
    }

    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const fileType = (ext === 'jpg' || ext === 'png') ? 'image' : 
                     (ext === 'mp4') ? 'video' : 'document';
    
    await db.createArchiveItem({
      chat_title: `Telegram-чат (@${username || telegramId})`,
      file_name: fileName,
      file_type: fileType,
      file_size: Math.floor(Math.random() * 3200) + 120, // simulated size
      file_url: `/archive/${fileName}`
    });

    return {
      text: `📂 *Цифровой Архив Ассоциации:*\n\nОбнаружен важный медиа-файл/документ *${fileName}*.\nОн автоматически извлечен, оптимизирован и помещен в архив волонтерских чатов!`,
      keyboard: [[{ text: '📋 Мои Задачи', callback_data: 'cmd_tasks' }]]
    };
  }

  // AI Gatekeeper - Message classification and redirect
  const allChats = await db.getChats();
  let chat = allChats.find(c => c.type === 'management' && c.volunteer_id === user.id);
  if (!chat) {
    chat = await db.createChat({
      type: 'management',
      title: `Руководство Ассоциации: ${user.full_name}`,
      volunteer_id: user.id,
      target_org_id: null,
      project_id: null
    });
  }

  // Save original message in the CRM chats
  await db.createChatMessage({
    chat_id: chat.id,
    sender_id: user.id,
    sender_name: user.full_name,
    sender_role: 'volunteer',
    text: cleanText
  });

  let classification: 'faq' | 'team' | 'shirin' = 'team';
  let summary = '';
  let replyText = '';

  if (lowerText.includes('ширин') || lowerText.includes('директор') || lowerText.includes('руковод')) {
    classification = 'shirin';
    summary = `Личное обращение руководителю Ширин от ${user.full_name}`;
    replyText = `🤖 *ИИ-Секретарь (Лично Ширин):* Ваше сообщение классифицировано как личное/срочное обращение к Ширин. Оно сохранено в её закрытую личную папку в CRM, руководитель свяжется с вами лично.`;
  } else if (
    lowerText.includes('как стать') || 
    lowerText.includes('кодекс') || 
    lowerText.includes('правила') || 
    lowerText.includes('инструкц')
  ) {
    classification = 'faq';
    summary = `Вопрос по правилам/инструкциям от ${user.full_name}`;
    replyText = `🤖 *ИИ-Секретарь (FAQ):* Вопросы о правилах описаны в Кодексе волонтера. Основные ценности: уважение, равенство и ответственность. Пожалуйста, изучите Базу Знаний на платформе.`;
  } else {
    classification = 'team';
    summary = `Запрос к координаторам от ${user.full_name}: "${cleanText.substring(0, 40)}..."`;
    replyText = `🤖 *ИИ-Секретарь (Команде):* Ваше сообщение перенаправлено дежурным координаторам. Координатор свяжется с вами в чате руководства.`;
  }

  // Save assistant classification log in CRM chat
  await db.createChatMessage({
    chat_id: chat.id,
    sender_id: 'bot_secretary',
    sender_name: 'ИИ-Секретарь (Gatekeeper)',
    sender_role: 'admin',
    text: `[Классификация: ${classification.toUpperCase()} | Выжимка: ${summary}]\n\n${replyText}`
  });

  return {
    text: replyText,
    keyboard: [
      [{ text: '📋 Мои Задачи', callback_data: 'cmd_tasks' }],
      [{ text: '👤 Мой Профиль', callback_data: 'cmd_profile' }]
    ]
  };
}

// ─── Keyboard builders for registration multi-select steps ────────────────────

function buildProjectsKeyboard(lang: string, selected: string[]) {
  const projects = [
    { key: 'proj_1',  name: 'Первый слет медиков волонтеров (Ташкент)' },
    { key: 'proj_2',  name: '«Солнышко»' },
    { key: 'proj_3',  name: '"Hamsa charity"' },
    { key: 'proj_4',  name: '«Делай добро»' },
    { key: 'proj_5',  name: '«Olimpic volunteers»' },
    { key: 'proj_6',  name: 'Волонтёры «Inson»' },
    { key: 'proj_7',  name: 'Волонтеры ЦГУ' },
    { key: 'proj_8',  name: 'Волонтеры Олимпиады по шахматам (Самарканд)' },
    { key: 'proj_9',  name: 'Триатлон волонтеры (Самарканд)' },
    { key: 'proj_10', name: 'Школа волонтеров' },
    { key: 'proj_11', name: 'UVA main team' },
    { key: 'proj_12', name: 'UVA media' },
  ];
  const nextLabels: Record<string, string> = { RUS: '➡️ Далее', UZB: '➡️ Keyingisi', ENG: '➡️ Next' };
  return [
    ...projects.map(p => [{ text: `${selected.includes(p.name) ? '✅ ' : ''}${p.name}`, callback_data: p.key }]),
    [{ text: nextLabels[lang] || nextLabels.RUS, callback_data: 'proj_next' }]
  ];
}

function buildLanguagesKeyboard(lang: string, selected: string[]) {
  const langs = [
    { key: 'lang_skill_uzb', name: 'Узбекский',  labelRUS: 'Узбекский язык',  labelUZB: "O'zbek tili",   labelENG: 'Uzbek' },
    { key: 'lang_skill_rus', name: 'Русский',    labelRUS: 'Русский язык',    labelUZB: 'Rus tili',      labelENG: 'Russian' },
    { key: 'lang_skill_eng', name: 'Английский', labelRUS: 'Английский язык', labelUZB: 'Ingliz tili',   labelENG: 'English' },
    { key: 'lang_skill_deu', name: 'Немецкий',   labelRUS: 'Немецкий язык',   labelUZB: 'Nemis tili',    labelENG: 'German' },
    { key: 'lang_skill_tur', name: 'Турецкий',   labelRUS: 'Турецкий язык',   labelUZB: 'Turk tili',     labelENG: 'Turkish' },
    { key: 'lang_skill_zho', name: 'Китайский',  labelRUS: 'Китайский язык',  labelUZB: 'Xitoy tili',    labelENG: 'Chinese' },
  ];
  const getLabel = (l: typeof langs[0]) => lang === 'UZB' ? l.labelUZB : lang === 'ENG' ? l.labelENG : l.labelRUS;
  const nextLabels: Record<string, string> = { RUS: '➡️ Далее', UZB: '➡️ Keyingisi', ENG: '➡️ Next' };
  const otherLabel: Record<string, string> = { RUS: 'Другой (укажите)', UZB: "Boshqa (ko'rsating)", ENG: 'Other (specify)' };
  return [
    ...langs.map(l => [{ text: `${selected.includes(l.name) ? '✅ ' : ''}${getLabel(l)}`, callback_data: l.key }]),
    [{ text: otherLabel[lang] || otherLabel.RUS, callback_data: 'lang_other_hint' }],
    [{ text: nextLabels[lang] || nextLabels.RUS, callback_data: 'lang_next' }]
  ];
}

function buildHealthKeyboard(lang: string, selected: string[]) {
  const items = [
    { key: 'health_vision',    label: { RUS: 'Нарушение зрения', UZB: 'Ko\'rish buzilishi', ENG: 'Vision impairment' } },
    { key: 'health_hearing',   label: { RUS: 'Нарушение слуха', UZB: 'Eshitish buzilishi', ENG: 'Hearing impairment' } },
    { key: 'health_mobility',  label: { RUS: 'Сложности в передвижении', UZB: 'Harakatlanishda qiyinchiliklar', ENG: 'Mobility difficulties' } },
    { key: 'health_speech',    label: { RUS: 'Сложности в речи', UZB: 'Nutqda qiyinchiliklar', ENG: 'Speech difficulties' } },
    { key: 'health_chronic',   label: { RUS: 'Хроническое заболевание (учитывать при организации)', UZB: 'Surunkali kasallik (faoliyatni tashkil etishda e\'tiborga olish)', ENG: 'Chronic illness (to be considered when organizing)' } },
    { key: 'health_allergy',   label: { RUS: 'Аллергия (еда, лекарства, укусы насекомых и др.)', UZB: 'Allergiya (ovqat, dori, hasharot chaqishi va boshq.)', ENG: 'Allergy (food, medicine, insect bites, etc.)' } },
    { key: 'health_barrier',   label: { RUS: 'Необходима безбарьерная среда (пандус, лифт и др.)', UZB: 'To\'siqlarsiz muhit kerak (pandus, lift va boshq.)', ENG: 'Barrier-free environment needed (ramp, elevator, etc.)' } },
    { key: 'health_assistant', label: { RUS: 'Необходим сопровождающий или помощь (ассистент, сурдопереводчик)', UZB: 'Hamroh yoki qo\'shimcha yordam kerak (assistent, surdo-tarjimon)', ENG: 'Assistant or additional help needed (aide, sign-language interpreter)' } },
    { key: 'health_sensory',   label: { RUS: 'Чувствительность к шуму, свету или скоплению людей', UZB: 'Shovqin, yorug\'lik yoki olomon sezgirligi', ENG: 'Sensitivity to loud sounds, bright light or crowds' } },
    { key: 'health_temporary', label: { RUS: 'Временные ограничения по здоровью (травма, операция и др.)', UZB: 'Vaqtinchalik sog\'liq cheklovlari (jarohat, operatsiya va boshq.)', ENG: 'Temporary health restrictions (injury, post-surgery, etc.)' } },
    { key: 'health_none',      label: { RUS: 'Дополнительные условия не требуются', UZB: 'Qo\'shimcha sharoitlar talab qilinmaydi', ENG: 'No additional conditions needed' } },
  ];
  const healthNamesRus: Record<string, string> = {
    health_vision: 'Нарушение зрения',
    health_hearing: 'Нарушение слуха',
    health_mobility: 'Сложности в передвижении',
    health_speech: 'Сложности в речи',
    health_chronic: 'Хроническое заболевание',
    health_allergy: 'Аллергия',
    health_barrier: 'Необходима безбарьерная среда',
    health_assistant: 'Необходим сопровождающий',
    health_sensory: 'Повышенная чувствительность к шуму/свету',
    health_temporary: 'Временные ограничения здоровья',
    health_none: 'Дополнительные условия не требуются'
  };
  const otherLabel: Record<string, string> = { RUS: 'Другое (укажите)…', UZB: 'Boshqa (ko\'rsating)…', ENG: 'Other (specify)…' };
  const nextLabels: Record<string, string> = { RUS: '➡️ Далее', UZB: '➡️ Keyingisi', ENG: '➡️ Next' };
  return [
    ...items.map(it => [{
      text: `${selected.includes(healthNamesRus[it.key]) ? '✅ ' : ''}${(it.label as any)[lang] || it.label.RUS}`,
      callback_data: it.key
    }]),
    [{ text: otherLabel[lang] || otherLabel.RUS, callback_data: 'health_other_btn' }],
    [{ text: nextLabels[lang] || nextLabels.RUS, callback_data: 'health_next' }]
  ];
}
