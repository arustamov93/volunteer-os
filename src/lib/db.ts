import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { encryptSecret } from './security';

const USE_PRISMA = true;
// DB Types (exported for codebase compatibility)
export interface User {
  id: string;
  role: 'admin' | 'manager' | 'coordinator' | 'volunteer';
  full_name: string;
  login?: string | null;
  password_hash?: string | null;
  telegram_id?: number | null;
  phone?: string | null;
  rating: number;
  created_at: string;
  xp?: number;
  level?: number;
  badges?: string[];
  interests?: string[];
  skills?: string[];
  latitude?: number;
  longitude?: number;
  avatar_url?: string | null;
  availability_status?: 'offline' | 'available' | 'busy';
  available_until?: string | null;
  availability_note?: string | null;
  is_physically_ready?: boolean;
  is_senior?: boolean;
  system_role_id?: string | null;
  systemRole?: any;
}

export interface VolunteerApplication {
  id: string;
  telegram_id: number;
  language_pref: string;
  full_name: string;
  date_of_birth?: string;
  phone: string;
  projects: string[];
  spoken_languages: string[];
  has_disability: boolean;
  disability_info?: string | null;
  is_physically_ready: boolean;
  referral_info?: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  status: 'planning' | 'active' | 'completed';
  start_date?: string | null;
  end_date?: string | null;
  org_id?: string | null;
  coordinator_id?: string | null;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  allowed_radius_km?: number;
}

export interface Task {
  id: string;
  project_id: string;
  assigned_to?: string | null;
  title: string;
  deadline: string;
  status: 'pending' | 'accepted' | 'completed';
  is_overdue: boolean;
  created_at: string;
}

export interface CheckIn {
  id: string;
  user_id: string;
  project_id?: string | null;
  check_in_at: string;
  check_out_at?: string;
  check_in_lat?: number;
  check_in_lng?: number;
  check_out_lat?: number;
  check_out_lng?: number;
  text_report?: string;
  hours?: number;
  created_at: string;
  kpi_score?: number;
  feedback?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  scheduled_at: string;
  link?: string;
  project_id?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface KnowledgeBase {
  id: string;
  category: string;
  title: string;
  content: string;
  file_url?: string | null;
  media_type?: string | null;
  source_link?: string | null;
  created_at: string;
  resources?: KBResource[];
}

export interface KBResource {
  id: string;
  article_id: string;
  title: string;
  url: string;
  type: 'link' | 'video' | 'document' | 'form';
  created_at: string;
}

export interface Chat {
  id: string;
  type: 'management' | 'organization' | 'project';
  title: string;
  project_id?: string | null;
  volunteer_id?: string | null;
  target_org_id?: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'admin' | 'manager' | 'coordinator' | 'volunteer';
  text: string;
  created_at: string;
}

export interface VolunteerOrganization {
  id: string;
  name: string;
  description: string;
  category: 'Экология' | 'Защита животных' | 'Социальная помощь' | 'Здравоохранение' | 'Образование';
  avatar_url?: string | null;
  contacts: string;
  created_at: string;
  goals?: string;
  leader_name?: string;
  org_structure?: string;
}

export interface OrganizationNews {
  id: string;
  org_id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface OrganizationMembership {
  id: string;
  org_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  cover_letter?: string;
  created_at: string;
}

export interface TelegramSession {
  telegram_id: number;
  state: string;
  data: any;
  updated_at: string;
}

export interface MockMessage {
  id: string;
  telegram_id: number;
  sender: 'user' | 'bot';
  text: string;
  keyboard?: any;
  created_at: string;
}

export interface BotConfig {
  bot_token?: string;
  webhook_url?: string;
  is_simulator_enabled: boolean;
}

export interface ResourceItem {
  id: string;
  name: string;
  category: string;
  total_qty: number;
  allocated_qty: number;
  unit: string;
  location: string;
  created_at: string;
}

export interface ResourceAllocation {
  id: string;
  resource_id: string;
  project_id: string;
  task_id?: string | null;
  qty: number;
  status: 'allocated' | 'returned';
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp_required: number;
}

export interface GeneratedDoc {
  id: string;
  template_type: 'appreciation' | 'hours_summary' | 'regional_report';
  title: string;
  volunteer_id?: string | null;
  project_id?: string | null;
  created_at: string;
}

export interface AccessKey {
  id: string;
  name: string;
  category: 'social' | 'grant' | 'website' | 'server';
  username: string;
  password_encrypted: string;
  notes?: string;
  created_at: string;
}

export interface ArchiveItem {
  id: string;
  chat_title: string;
  file_name: string;
  file_type: 'image' | 'document' | 'audio' | 'video';
  file_size: number;
  file_url: string;
  extracted_at: string;
}

export interface Partner {
  id: string;
  name: string;
  category: 'donor' | 'sponsor' | 'ministry' | 'partner';
  anniversary_date: string;
  contact_person: string;
  email?: string;
  phone?: string;
  auto_greet_enabled: boolean;
  created_at: string;
}

export interface HrDocument {
  id: string;
  employee_name: string;
  doc_type: 'leave' | 'hiring' | 'travel';
  details: string;
  created_at: string;
}

export interface DidoxInvoice {
  id: string;
  supplier_name: string;
  item_name: string;
  price: number;
  qty: number;
  avg_historic_price: number;
  flagged_reason?: string | null;
  created_at: string;
}

export interface EmployeeReview {
  id: string;
  employee_name: string;
  kpi_score: number;
  feedback: string;
  created_by: string;
  created_at: string;
}

export interface EmergencyAlert {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  required_skills: string[];
  radius_km: number;
  status: 'active' | 'resolved';
  notified_volunteer_ids: string[];
  attending_volunteer_ids: string[];
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string | null;
  created_at: string;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  title: string;
  bodyText: string;
  signature: string;
  primaryColor: string;
  accentColor: string;
  orgId?: string | null;
  createdAt: string;
}

export interface Award {
  id: string;
  templateId: string;
  volunteerId: string;
  projectId?: string | null;
  issuedBy: string;
  issuedAt: string;
}


// Setup connection pool and adapter for Prisma 7
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres?schema=public";
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Local JSON File Database fallback configuration
const DB_FILE_PATH = path.join(process.cwd(), 'volunteer_os_db.json');

function getFallbackData(): any {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const fileContent = fs.readFileSync(DB_FILE_PATH, 'utf8');
      return JSON.parse(fileContent);
    }
  } catch (e) {
    console.error('Failed to read fallback database:', e);
  }
  return {};
}

function saveFallbackData(data: any) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save fallback database:', e);
  }
}

const isJsonFallbackEnabled = process.env.ENABLE_JSON_DB_FALLBACK !== 'false';

async function runQuery<T>(prismaQuery: () => Promise<T>, fallbackQuery: (data: any) => T): Promise<T> {
  try {
    return await prismaQuery();
  } catch (e: any) {
    console.error('Prisma query failed, utilizing fallback data safely:', e);
    try {
      const data = getFallbackData();
      return fallbackQuery(data);
    } catch (fallbackErr) {
      console.error('Fallback query error:', fallbackErr);
      throw e;
    }
  }
}

// Type Mapping Helpers
function mapUser(u: any): User {
  let name = u.fullName || u.full_name || '';
  const login = (u.login || '').toLowerCase();
  if (name.includes('Алексей') || login.includes('rustamov') || login === 'alexey' || login === 'coordinator') {
    name = 'Акмал Рустамов';
  }

  return {
    id: u.id,
    role: u.role as any,
    full_name: name,
    login: u.login || null,
    password_hash: u.passwordHash || u.password_hash || null,
    telegram_id: u.telegramId !== undefined ? (u.telegramId !== null ? Number(u.telegramId) : null) : (u.telegram_id || null),
    phone: u.phone,
    rating: u.rating,
    created_at: u.createdAt instanceof Date ? u.createdAt.toISOString() : (u.created_at || new Date().toISOString()),
    xp: u.xp,
    level: u.level,
    badges: u.badges || [],
    interests: u.interests || [],
    skills: u.skills || [],
    latitude: u.latitude ?? undefined,
    longitude: u.longitude ?? undefined,
    avatar_url: u.avatarUrl || u.avatar_url || null,
    availability_status: u.availabilityStatus || u.availability_status || 'offline',
    available_until: u.availableUntil
      ? (u.availableUntil instanceof Date ? u.availableUntil.toISOString() : u.availableUntil)
      : (u.available_until || null),
    availability_note: u.availabilityNote || u.availability_note || null,
    is_physically_ready: u.isPhysicallyReady ?? u.is_physically_ready ?? false,
    is_senior: u.isSenior ?? u.is_senior ?? false,
    system_role_id: u.systemRoleId || u.system_role_id || null,
    systemRole: u.systemRole || null
  };
}

function mapProject(p: any): Project {
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? undefined,
    status: p.status as any,
    start_date: p.startDate ? (p.startDate instanceof Date ? p.startDate.toISOString() : p.startDate) : (p.start_date || null),
    end_date: p.endDate ? (p.endDate instanceof Date ? p.endDate.toISOString() : p.endDate) : (p.end_date || null),
    org_id: p.orgId || p.org_id || null,
    coordinator_id: p.coordinatorId || p.coordinator_id || null,
    created_at: p.createdAt instanceof Date ? p.createdAt.toISOString() : (p.created_at || new Date().toISOString()),
    latitude: p.latitude ?? undefined,
    longitude: p.longitude ?? undefined,
    allowed_radius_km: p.allowedRadiusKm ?? p.allowed_radius_km ?? 0.5
  };
}

function mapTask(t: any): Task {
  return {
    id: t.id,
    project_id: t.projectId || t.project_id,
    assigned_to: t.assignedTo || t.assigned_to,
    title: t.title,
    deadline: t.deadline instanceof Date ? t.deadline.toISOString() : t.deadline,
    status: t.status as any,
    is_overdue: t.isOverdue ?? t.is_overdue ?? false,
    created_at: t.createdAt instanceof Date ? t.createdAt.toISOString() : (t.created_at || new Date().toISOString())
  };
}

function mapCheckIn(c: any): CheckIn {
  return {
    id: c.id,
    user_id: c.userId || c.user_id,
    project_id: c.projectId || c.project_id,
    check_in_at: c.checkInAt instanceof Date ? c.checkInAt.toISOString() : (c.check_in_at || new Date().toISOString()),
    check_out_at: c.checkOutAt ? (c.checkOutAt instanceof Date ? c.checkOutAt.toISOString() : c.check_out_at) : undefined,
    check_in_lat: c.checkInLat ?? c.check_in_lat ?? undefined,
    check_in_lng: c.checkInLng ?? c.check_in_lng ?? undefined,
    check_out_lat: c.checkOutLat ?? c.check_out_lat ?? undefined,
    check_out_lng: c.checkOutLng ?? c.check_out_lng ?? undefined,
    text_report: c.textReport || c.text_report,
    hours: c.hours,
    created_at: c.createdAt instanceof Date ? c.createdAt.toISOString() : (c.created_at || new Date().toISOString()),
    kpi_score: c.kpiScore ?? c.kpi_score ?? undefined,
    feedback: c.feedback ?? undefined,
    reviewed_by: c.reviewedBy || c.reviewed_by || undefined,
    reviewed_at: c.reviewedAt ? (c.reviewedAt instanceof Date ? c.reviewedAt.toISOString() : c.reviewedAt) : (c.reviewed_at || undefined)
  };
}

function mapMeeting(m: any): Meeting {
  return {
    id: m.id,
    title: m.title,
    description: m.description ?? undefined,
    scheduled_at: m.scheduledAt instanceof Date ? m.scheduledAt.toISOString() : m.scheduled_at,
    link: m.link ?? undefined,
    project_id: m.projectId || m.project_id,
    created_by: m.createdBy || m.created_by,
    created_at: m.createdAt instanceof Date ? m.createdAt.toISOString() : (m.created_at || new Date().toISOString())
  };
}

function mapKBArticle(kb: any): KnowledgeBase {
  return {
    id: kb.id,
    category: kb.category,
    title: kb.title,
    content: kb.content,
    file_url: kb.fileUrl || kb.file_url || null,
    media_type: kb.mediaType || kb.media_type || null,
    source_link: kb.sourceLink || kb.source_link || null,
    created_at: kb.createdAt instanceof Date ? kb.createdAt.toISOString() : (kb.created_at || new Date().toISOString())
  };
}

function mapKBResource(r: any): KBResource {
  return {
    id: r.id,
    article_id: r.articleId || r.article_id,
    title: r.title,
    url: r.url,
    type: (r.type || 'link') as KBResource['type'],
    created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.created_at || new Date().toISOString())
  };
}

function mapChat(ch: any): Chat {
  return {
    id: ch.id,
    type: ch.type as any,
    title: ch.title,
    project_id: ch.projectId || ch.project_id,
    volunteer_id: ch.volunteerId || ch.volunteer_id,
    target_org_id: ch.targetOrgId || ch.target_org_id,
    created_at: ch.createdAt instanceof Date ? ch.createdAt.toISOString() : (ch.created_at || new Date().toISOString())
  };
}

function mapChatMessage(msg: any): ChatMessage {
  return {
    id: msg.id,
    chat_id: msg.chatId || msg.chat_id,
    sender_id: msg.senderId || msg.sender_id,
    sender_name: msg.senderName || msg.sender_name,
    sender_role: (msg.senderRole || msg.sender_role) as any,
    text: msg.text,
    created_at: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : (msg.created_at || new Date().toISOString())
  };
}

function mapOrganization(org: any): VolunteerOrganization {
  return {
    id: org.id,
    name: org.name,
    description: org.description,
    category: org.category as any,
    avatar_url: org.avatarUrl || org.avatar_url || null,
    contacts: org.contacts,
    created_at: org.createdAt instanceof Date ? org.createdAt.toISOString() : (org.created_at || new Date().toISOString()),
    goals: org.goals ?? undefined,
    leader_name: org.leaderName || org.leader_name || undefined,
    org_structure: org.orgStructure || org.org_structure || undefined
  };
}

function mapOrgNews(n: any): OrganizationNews {
  return {
    id: n.id,
    org_id: n.orgId || n.org_id,
    title: n.title,
    content: n.content,
    created_at: n.createdAt instanceof Date ? n.createdAt.toISOString() : (n.created_at || new Date().toISOString())
  };
}

function mapMembership(m: any): OrganizationMembership {
  return {
    id: m.id,
    org_id: m.orgId || m.org_id,
    user_id: m.userId || m.user_id,
    status: m.status as any,
    cover_letter: m.coverLetter || m.cover_letter || undefined,
    created_at: m.createdAt instanceof Date ? m.createdAt.toISOString() : (m.created_at || new Date().toISOString())
  };
}

function mapTelegramSession(ts: any): TelegramSession {
  return {
    telegram_id: Number(ts.telegramId || ts.telegram_id),
    state: ts.state,
    data: ts.data,
    updated_at: ts.updatedAt instanceof Date ? ts.updatedAt.toISOString() : (ts.updated_at || new Date().toISOString())
  };
}

function mapMockMessage(mm: any): MockMessage {
  return {
    id: mm.id,
    telegram_id: Number(mm.telegramId || mm.telegram_id),
    sender: mm.sender as any,
    text: mm.text,
    keyboard: mm.keyboard || undefined,
    created_at: mm.createdAt instanceof Date ? mm.createdAt.toISOString() : (mm.created_at || new Date().toISOString())
  };
}

function mapBotConfig(bc: any): BotConfig {
  return {
    bot_token: bc.botToken || bc.bot_token || undefined,
    webhook_url: bc.webhookUrl || bc.webhook_url || undefined,
    is_simulator_enabled: bc.isSimulatorEnabled ?? bc.is_simulator_enabled ?? true
  };
}

function mapResource(res: any): ResourceItem {
  return {
    id: res.id,
    name: res.name,
    category: res.category,
    total_qty: res.totalQty ?? res.total_qty,
    allocated_qty: res.allocatedQty ?? res.allocated_qty ?? 0,
    unit: res.unit,
    location: res.location,
    created_at: res.createdAt instanceof Date ? res.createdAt.toISOString() : (res.created_at || new Date().toISOString())
  };
}

function mapAllocation(al: any): ResourceAllocation {
  return {
    id: al.id,
    resource_id: al.resourceId || al.resource_id,
    project_id: al.projectId || al.project_id,
    task_id: al.taskId || al.task_id,
    qty: al.qty,
    status: al.status as any,
    created_at: al.createdAt instanceof Date ? al.createdAt.toISOString() : (al.created_at || new Date().toISOString())
  };
}

function mapBadge(b: any): Badge {
  return {
    id: b.id,
    name: b.name,
    description: b.description,
    icon: b.icon,
    xp_required: b.xpRequired ?? b.xp_required
  };
}

function mapGeneratedDoc(doc: any): GeneratedDoc {
  return {
    id: doc.id,
    template_type: (doc.templateType || doc.template_type) as any,
    title: doc.title,
    volunteer_id: doc.volunteerId || doc.volunteer_id,
    project_id: doc.projectId || doc.project_id,
    created_at: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : (doc.created_at || new Date().toISOString())
  };
}

function mapAccessKey(ak: any): AccessKey {
  return {
    id: ak.id,
    name: ak.name,
    category: ak.category as any,
    username: ak.username,
    password_encrypted: ak.passwordEncrypted || ak.password_encrypted,
    notes: ak.notes ?? undefined,
    created_at: ak.createdAt instanceof Date ? ak.createdAt.toISOString() : (ak.created_at || new Date().toISOString())
  };
}

function mapArchiveItem(ai: any): ArchiveItem {
  return {
    id: ai.id,
    chat_title: ai.chatTitle || ai.chat_title,
    file_name: ai.fileName || ai.file_name,
    file_type: (ai.fileType || ai.file_type) as any,
    file_size: ai.fileSize || ai.file_size,
    file_url: ai.fileUrl || ai.file_url,
    extracted_at: ai.extractedAt instanceof Date ? ai.extractedAt.toISOString() : (ai.extracted_at || new Date().toISOString())
  };
}

function mapPartner(p: any): Partner {
  return {
    id: p.id,
    name: p.name,
    category: p.category as any,
    anniversary_date: p.anniversaryDate || p.anniversary_date,
    contact_person: p.contactPerson || p.contact_person,
    email: p.email ?? undefined,
    phone: p.phone ?? undefined,
    auto_greet_enabled: p.autoGreetEnabled ?? p.auto_greet_enabled ?? false,
    created_at: p.createdAt instanceof Date ? p.createdAt.toISOString() : (p.created_at || new Date().toISOString())
  };
}

function mapHrDocument(hr: any): HrDocument {
  return {
    id: hr.id,
    employee_name: hr.employeeName || hr.employee_name,
    doc_type: (hr.docType || hr.doc_type) as any,
    details: hr.details,
    created_at: hr.createdAt instanceof Date ? hr.createdAt.toISOString() : (hr.created_at || new Date().toISOString())
  };
}

function mapInvoice(inv: any): DidoxInvoice {
  return {
    id: inv.id,
    supplier_name: inv.supplierName || inv.supplier_name,
    item_name: inv.itemName || inv.item_name,
    price: inv.price,
    qty: inv.qty,
    avg_historic_price: inv.avgHistoricPrice || inv.avg_historic_price,
    flagged_reason: inv.flaggedReason || inv.flagged_reason,
    created_at: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : (inv.created_at || new Date().toISOString())
  };
}

function mapReview(er: any): EmployeeReview {
  return {
    id: er.id,
    employee_name: er.employeeName || er.employee_name,
    kpi_score: er.kpiScore || er.kpi_score,
    feedback: er.feedback,
    created_by: er.createdBy || er.created_by,
    created_at: er.createdAt instanceof Date ? er.createdAt.toISOString() : (er.created_at || new Date().toISOString())
  };
}

function mapAlert(ea: any): EmergencyAlert {
  return {
    id: ea.id,
    title: ea.title,
    description: ea.description,
    latitude: ea.latitude,
    longitude: ea.longitude,
    required_skills: ea.requiredSkills || ea.required_skills || [],
    radius_km: ea.radiusKm || ea.radius_km,
    status: (ea.status || 'active') as any,
    notified_volunteer_ids: ea.notifiedVolunteerIds || ea.notified_volunteer_ids || [],
    attending_volunteer_ids: ea.attendingVolunteerIds || ea.attending_volunteer_ids || [],
    created_at: ea.createdAt instanceof Date ? ea.createdAt.toISOString() : (ea.created_at || new Date().toISOString())
  };
}

function mapNotification(n: any): Notification {
  return {
    id: n.id,
    user_id: n.userId || n.user_id,
    title: n.title,
    message: n.message,
    is_read: n.isRead ?? n.is_read ?? false,
    type: (n.type || 'info') as any,
    link: n.link ?? null,
    created_at: n.createdAt instanceof Date ? n.createdAt.toISOString() : (n.created_at || new Date().toISOString())
  };
}

function mapCertificateTemplate(t: any): CertificateTemplate {
  return {
    id: t.id,
    name: t.name,
    title: t.title,
    bodyText: t.bodyText,
    signature: t.signature,
    primaryColor: t.primaryColor,
    accentColor: t.accentColor,
    orgId: t.orgId || null,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : (t.created_at || new Date().toISOString())
  };
}

function mapAward(a: any): Award {
  return {
    id: a.id,
    templateId: a.templateId,
    volunteerId: a.volunteerId,
    projectId: a.projectId || null,
    issuedBy: a.issuedBy,
    issuedAt: a.issuedAt instanceof Date ? a.issuedAt.toISOString() : (a.issued_at || new Date().toISOString())
  };
}


// Asynchronous DB Class implementing the exact schema methods with fallbacks
class PrismaDBAdapter {
  // Users
  async getUsers(): Promise<User[]> {
    return runQuery(
      async () => {
        const list = await prisma.user.findMany({ 
          orderBy: { fullName: 'asc' },
          include: { systemRole: true }
        });
        return list.map(mapUser);
      },
      (data) => {
        const list = data.users || [];
        return list.map(mapUser).sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
      }
    );
  }

  async getUser(id: string): Promise<User | undefined> {
    return runQuery(
      async () => {
        const user = await prisma.user.findUnique({ where: { id } });
        return user ? mapUser(user) : undefined;
      },
      (data) => {
        const u = (data.users || []).find((x: any) => x.id === id);
        return u ? mapUser(u) : undefined;
      }
    );
  }

  async getUserByTelegramId(tgId: number): Promise<User | undefined> {
    return runQuery(
      async () => {
        const user = await prisma.user.findFirst({ where: { telegramId: BigInt(tgId) } });
        return user ? mapUser(user) : undefined;
      },
      (data) => {
        const u = (data.users || []).find((x: any) => Number(x.telegram_id) === tgId);
        return u ? mapUser(u) : undefined;
      }
    );
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    return runQuery(
      async () => {
        const users = await prisma.user.findMany();
        const matched = users.find(u => {
          if (!u.phone) return false;
          const uClean = u.phone.replace(/[^\d+]/g, '');
          return uClean === cleanPhone;
        });
        return matched ? mapUser(matched) : undefined;
      },
      (data) => {
        const matched = (data.users || []).find((u: any) => {
          if (!u.phone) return false;
          const uClean = u.phone.replace(/[^\d+]/g, '');
          return uClean === cleanPhone;
        });
        return matched ? mapUser(matched) : undefined;
      }
    );
  }

  async getUserByLogin(login: string): Promise<User | undefined> {
    const normalizedLogin = login.trim().toLowerCase();
    return runQuery(
      async () => {
        const user = await prisma.user.findFirst({ where: { login: normalizedLogin } });
        return user ? mapUser(user) : undefined;
      },
      (data) => {
        const user = (data.users || []).find((u: any) => String(u.login || '').toLowerCase() === normalizedLogin);
        return user ? mapUser(user) : undefined;
      }
    );
  }

  async createUser(user: Omit<User, 'id' | 'rating' | 'created_at'>): Promise<User> {
    const id = `u_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.user.create({
          data: {
            id,
            role: user.role,
            fullName: user.full_name,
            login: user.login ? user.login.trim().toLowerCase() : null,
            passwordHash: user.password_hash || null,
            telegramId: user.telegram_id ? BigInt(user.telegram_id) : null,
            phone: user.phone || null,
            rating: 0.0,
            xp: user.xp || 0,
            level: user.level || 1,
            badges: user.badges || [],
            interests: user.interests || [],
            skills: user.skills || [],
            latitude: user.latitude || null,
            longitude: user.longitude || null,
            avatarUrl: user.avatar_url || null,
            availabilityStatus: user.availability_status || 'offline',
            availableUntil: user.available_until ? new Date(user.available_until) : null,
            availabilityNote: user.availability_note || null,
            systemRoleId: user.system_role_id || null,
          }
        });
        return mapUser(created);
      },
      (data) => {
        const newUser: User = {
          ...user,
          id,
          rating: 0.0,
          created_at: new Date().toISOString()
        };
        if (!data.users) data.users = [];
        data.users.push(newUser);
        saveFallbackData(data);
        return mapUser(newUser);
      }
    );
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    return runQuery(
      async () => {
        const data: any = {};
        if (updates.role !== undefined) data.role = updates.role;
        if (updates.full_name !== undefined) data.fullName = updates.full_name;
        if (updates.login !== undefined) data.login = updates.login ? updates.login.trim().toLowerCase() : null;
        if (updates.password_hash !== undefined) data.passwordHash = updates.password_hash;
        if (updates.telegram_id !== undefined) data.telegramId = updates.telegram_id ? BigInt(updates.telegram_id) : null;
        if (updates.phone !== undefined) data.phone = updates.phone;
        if (updates.rating !== undefined) data.rating = Number(updates.rating);
        if (updates.xp !== undefined) data.xp = updates.xp;
        if (updates.level !== undefined) data.level = updates.level;
        if (updates.badges !== undefined) data.badges = updates.badges;
        if (updates.interests !== undefined) data.interests = updates.interests;
        if (updates.skills !== undefined) data.skills = updates.skills;
        if (updates.latitude !== undefined) data.latitude = updates.latitude;
        if (updates.longitude !== undefined) data.longitude = updates.longitude;
        if (updates.avatar_url !== undefined) data.avatarUrl = updates.avatar_url;
        if (updates.availability_status !== undefined) data.availabilityStatus = updates.availability_status;
        if (updates.available_until !== undefined) data.availableUntil = updates.available_until ? new Date(updates.available_until) : null;
        if (updates.availability_note !== undefined) data.availabilityNote = updates.availability_note;
        if (updates.is_physically_ready !== undefined) data.isPhysicallyReady = updates.is_physically_ready;
        if (updates.is_senior !== undefined) data.isSenior = updates.is_senior;
        if (updates.system_role_id !== undefined) data.systemRoleId = updates.system_role_id;

        const updated = await prisma.user.update({ where: { id }, data });
        return mapUser(updated);
      },
      (data) => {
        const index = (data.users || []).findIndex((u: any) => u.id === id);
        if (index !== -1) {
          data.users[index] = { ...data.users[index], ...updates };
          saveFallbackData(data);
          return mapUser(data.users[index]);
        }
        throw new Error('User not found');
      }
    );
  }

  // Notifications
  async getNotifications(userId: string): Promise<Notification[]> {
    return runQuery(
      async () => {
        const list = await prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' }
        });
        return list.map(mapNotification);
      },
      (data) => {
        const list = (data.notifications || []).filter((n: any) => n.userId === userId || n.user_id === userId);
        return list.map(mapNotification).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    );
  }

  async getUnreadNotificationsCount(userId: string): Promise<number> {
    return runQuery(
      async () => {
        return await prisma.notification.count({
          where: { userId, isRead: false }
        });
      },
      (data) => {
        const list = (data.notifications || []).filter((n: any) => (n.userId === userId || n.user_id === userId) && !(n.isRead ?? n.is_read));
        return list.length;
      }
    );
  }

  async markNotificationAsRead(id: string): Promise<void> {
    return runQuery(
      async () => {
        await prisma.notification.update({
          where: { id },
          data: { isRead: true }
        });
      },
      (data) => {
        const index = (data.notifications || []).findIndex((n: any) => n.id === id);
        if (index !== -1) {
          data.notifications[index].isRead = true;
          data.notifications[index].is_read = true;
          saveFallbackData(data);
        }
      }
    );
  }

  async createNotification(notification: Omit<Notification, 'id' | 'created_at' | 'is_read'>): Promise<Notification> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.notification.create({
          data: {
            id,
            userId: notification.user_id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            link: notification.link || null,
          }
        });
        return mapNotification(created);
      },
      (data) => {
        const newNotif: Notification = {
          ...notification,
          id,
          is_read: false,
          created_at: new Date().toISOString()
        };
        if (!data.notifications) data.notifications = [];
        data.notifications.push(newNotif);
        saveFallbackData(data);
        return mapNotification(newNotif);
      }
    );
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return runQuery(
      async () => {
        const list = await prisma.project.findMany({ orderBy: { title: 'asc' } });
        return list.map(mapProject);
      },
      (data) => {
        const list = data.projects || [];
        return list.map(mapProject).sort((a: any, b: any) => a.title.localeCompare(b.title));
      }
    );
  }

  async getProject(id: string): Promise<Project | undefined> {
    return runQuery(
      async () => {
        const project = await prisma.project.findUnique({ where: { id } });
        return project ? mapProject(project) : undefined;
      },
      (data) => {
        const p = (data.projects || []).find((x: any) => x.id === id);
        return p ? mapProject(p) : undefined;
      }
    );
  }

  async createProject(project: Omit<Project, 'id' | 'created_at'>): Promise<Project> {
    const id = `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.project.create({
          data: {
            id,
            title: project.title,
            description: project.description || null,
            status: project.status,
            startDate: project.start_date ? new Date(project.start_date) : null,
            endDate: project.end_date ? new Date(project.end_date) : null,
            orgId: project.org_id || null,
            latitude: project.latitude || null,
            longitude: project.longitude || null,
            allowedRadiusKm: project.allowed_radius_km ?? 0.5,
          }
        });
        return mapProject(created);
      },
      (data) => {
        const newProject: Project = {
          ...project,
          id,
          created_at: new Date().toISOString()
        };
        if (!data.projects) data.projects = [];
        data.projects.push(newProject);
        saveFallbackData(data);
        return mapProject(newProject);
      }
    );
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    return runQuery(
      async () => {
        const data: any = {};
        if (updates.title !== undefined) data.title = updates.title;
        if (updates.description !== undefined) data.description = updates.description;
        if (updates.status !== undefined) data.status = updates.status;
        
        if (updates.start_date !== undefined) {
          data.startDate = updates.start_date ? new Date(updates.start_date) : null;
        } else if ((updates as any).startDate !== undefined) {
          data.startDate = (updates as any).startDate ? new Date((updates as any).startDate) : null;
        }

        if (updates.end_date !== undefined) {
          data.endDate = updates.end_date ? new Date(updates.end_date) : null;
        } else if ((updates as any).endDate !== undefined) {
          data.endDate = (updates as any).endDate ? new Date((updates as any).endDate) : null;
        }

        if (updates.org_id !== undefined) {
          data.orgId = updates.org_id;
        } else if ((updates as any).orgId !== undefined) {
          data.orgId = (updates as any).orgId;
        }

        if (updates.coordinator_id !== undefined) {
          data.coordinatorId = updates.coordinator_id || null;
        } else if ((updates as any).coordinatorId !== undefined) {
          data.coordinatorId = (updates as any).coordinatorId || null;
        }

        if (updates.latitude !== undefined) data.latitude = updates.latitude;
        if (updates.longitude !== undefined) data.longitude = updates.longitude;
        if (updates.allowed_radius_km !== undefined) {
          data.allowedRadiusKm = updates.allowed_radius_km;
        } else if ((updates as any).allowedRadiusKm !== undefined) {
          data.allowedRadiusKm = (updates as any).allowedRadiusKm;
        }

        const updated = await prisma.project.update({ where: { id }, data });
        return mapProject(updated);
      },
      (data) => {
        const index = (data.projects || []).findIndex((p: any) => p.id === id);
        if (index !== -1) {
          const prev = data.projects[index];
          const newStartDate = updates.start_date !== undefined 
            ? updates.start_date 
            : (updates as any).startDate !== undefined 
              ? (updates as any).startDate 
              : prev.start_date;
          const newEndDate = updates.end_date !== undefined 
            ? updates.end_date 
            : (updates as any).endDate !== undefined 
              ? (updates as any).endDate 
              : prev.end_date;

          data.projects[index] = { 
            ...prev, 
            ...updates,
            start_date: newStartDate,
            startDate: newStartDate,
            end_date: newEndDate,
            endDate: newEndDate
          };
          saveFallbackData(data);
          return mapProject(data.projects[index]);
        }
        throw new Error('Project not found');
      }
    );
  }

  async deleteProject(id: string): Promise<void> {
    await runQuery(
      async () => {
        try {
          await prisma.project.delete({ where: { id } });
        } catch (e) {
          console.error('Prisma delete project error:', e);
        }
      },
      (data) => {
        if (data.projects) {
          data.projects = data.projects.filter((p: any) => p.id !== id);
        }
        if (data.tasks) {
          data.tasks = data.tasks.filter((t: any) => t.project_id !== id);
        }
        saveFallbackData(data);
      }
    );
  }

  // Tasks
  async getTasks(): Promise<Task[]> {
    return runQuery(
      async () => {
        const list = await prisma.task.findMany({ orderBy: { deadline: 'asc' } });
        return list.map(mapTask);
      },
      (data) => {
        const list = data.tasks || [];
        return list.map(mapTask).sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
      }
    );
  }

  async getTask(id: string): Promise<Task | undefined> {
    return runQuery(
      async () => {
        const task = await prisma.task.findUnique({ where: { id } });
        return task ? mapTask(task) : undefined;
      },
      (data) => {
        const t = (data.tasks || []).find((x: any) => x.id === id);
        return t ? mapTask(t) : undefined;
      }
    );
  }

  async createTask(task: Omit<Task, 'id' | 'is_overdue' | 'created_at'>): Promise<Task> {
    const id = `t_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.task.create({
          data: {
            id,
            projectId: task.project_id,
            assignedTo: task.assigned_to || null,
            title: task.title,
            deadline: new Date(task.deadline),
            status: task.status,
            isOverdue: false
          }
        });
        return mapTask(created);
      },
      (data) => {
        const newTask: Task = {
          ...task,
          id,
          is_overdue: false,
          created_at: new Date().toISOString()
        };
        if (!data.tasks) data.tasks = [];
        data.tasks.push(newTask);
        saveFallbackData(data);
        return mapTask(newTask);
      }
    );
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    return runQuery(
      async () => {
        const data: any = {};
        if (updates.project_id !== undefined) data.projectId = updates.project_id;
        if (updates.assigned_to !== undefined) data.assignedTo = updates.assigned_to;
        if (updates.title !== undefined) data.title = updates.title;
        if (updates.deadline !== undefined) data.deadline = new Date(updates.deadline);
        if (updates.status !== undefined) data.status = updates.status;
        if (updates.is_overdue !== undefined) data.isOverdue = updates.is_overdue;

        const updated = await prisma.task.update({ where: { id }, data });
        return mapTask(updated);
      },
      (data) => {
        const index = (data.tasks || []).findIndex((t: any) => t.id === id);
        if (index !== -1) {
          data.tasks[index] = { ...data.tasks[index], ...updates };
          saveFallbackData(data);
          return mapTask(data.tasks[index]);
        }
        throw new Error('Task not found');
      }
    );
  }

  // Check-Ins
  async getCheckIns(): Promise<CheckIn[]> {
    return runQuery(
      async () => {
        const list = await prisma.checkIn.findMany({ orderBy: { createdAt: 'desc' } });
        return list.map(mapCheckIn);
      },
      (data) => {
        const list = data.check_ins || [];
        return list.map(mapCheckIn).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    );
  }

  async getCheckIn(id: string): Promise<CheckIn | undefined> {
    return runQuery(
      async () => {
        const checkin = await prisma.checkIn.findUnique({ where: { id } });
        return checkin ? mapCheckIn(checkin) : undefined;
      },
      (data) => {
        const c = (data.check_ins || []).find((x: any) => x.id === id);
        return c ? mapCheckIn(c) : undefined;
      }
    );
  }

  async createCheckIn(checkIn: Omit<CheckIn, 'id' | 'created_at'>): Promise<CheckIn> {
    if (USE_PRISMA) {
      try {
        const created = await prisma.checkIn.create({
          data: {
            userId: checkIn.user_id,
            projectId: checkIn.project_id || null,
            checkInAt: checkIn.check_in_at ? new Date(checkIn.check_in_at) : new Date(),
            checkOutAt: checkIn.check_out_at ? new Date(checkIn.check_out_at) : null,
            checkInLat: checkIn.check_in_lat || null,
            checkInLng: checkIn.check_in_lng || null,
            checkOutLat: checkIn.check_out_lat || null,
            checkOutLng: checkIn.check_out_lng || null,
            textReport: checkIn.text_report || null,
            hours: checkIn.hours ? Number(checkIn.hours) : null,
            kpiScore: checkIn.kpi_score || null,
            feedback: checkIn.feedback || null,
            reviewedBy: checkIn.reviewed_by || null,
            reviewedAt: checkIn.reviewed_at ? new Date(checkIn.reviewed_at) : null,
          }
        });
        return mapCheckIn(created);
      } catch (e) {
        console.error('Prisma createCheckIn failed', e);
      }
    }
    const id = `ci_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newCheckIn: CheckIn = {
      ...checkIn,
      id,
      created_at: new Date().toISOString()
    };
    return runQuery(
      async () => { /* Handled above */ throw new Error("Fallback used"); },
      (data) => {
        if (!data.check_ins) data.check_ins = [];
        data.check_ins.push(newCheckIn);
        saveFallbackData(data);
        return mapCheckIn(newCheckIn);
      }
    );
  }

  async updateCheckIn(id: string, updates: Partial<CheckIn>): Promise<CheckIn> {
    if (USE_PRISMA) {
      try {
        const data: any = {};
        if (updates.text_report !== undefined) data.textReport = updates.text_report;
        if (updates.hours !== undefined) data.hours = Number(updates.hours);
        if (updates.kpi_score !== undefined) data.kpiScore = updates.kpi_score;
        if (updates.feedback !== undefined) data.feedback = updates.feedback;
        if (updates.reviewed_by !== undefined) data.reviewedBy = updates.reviewed_by;
        if (updates.reviewed_at !== undefined) data.reviewedAt = updates.reviewed_at ? new Date(updates.reviewed_at) : null;
        if (updates.check_out_at !== undefined) data.checkOutAt = updates.check_out_at ? new Date(updates.check_out_at) : null;
        if (updates.check_out_lat !== undefined) data.checkOutLat = updates.check_out_lat;
        if (updates.check_out_lng !== undefined) data.checkOutLng = updates.check_out_lng;

        const updated = await prisma.checkIn.update({ where: { id }, data });
        return mapCheckIn(updated);
      } catch (e) {
        console.error('Prisma updateCheckIn failed', e);
      }
    }
    return runQuery(
      async () => { /* Handled above */ throw new Error("Fallback used"); },
      (data) => {
        const index = (data.check_ins || []).findIndex((c: any) => c.id === id);
        if (index !== -1) {
          data.check_ins[index] = { ...data.check_ins[index], ...updates };
          saveFallbackData(data);
          return mapCheckIn(data.check_ins[index]);
        }
        throw new Error('CheckIn not found');
      }
    );
  }

  // Knowledge Base
  async getKBArticles(): Promise<KnowledgeBase[]> {
    return runQuery(
      async () => {
        const list = await prisma.knowledgeBase.findMany({ orderBy: { category: 'asc' } });
        return list.map(mapKBArticle);
      },
      (data) => {
        const list = data.kb_articles || [];
        return list.map(mapKBArticle).sort((a: any, b: any) => a.category.localeCompare(b.category));
      }
    );
  }

  async getKBArticle(id: string): Promise<KnowledgeBase | undefined> {
    return runQuery(
      async () => {
        const kb = await prisma.knowledgeBase.findUnique({
          where: { id },
          include: { resources: { orderBy: { createdAt: 'asc' } } }
        });
        if (!kb) return undefined;
        const article = mapKBArticle(kb);
        article.resources = (kb.resources || []).map(mapKBResource);
        return article;
      },
      (data) => {
        const kb = (data.kb_articles || []).find((x: any) => x.id === id);
        if (!kb) return undefined;
        const article = mapKBArticle(kb);
        article.resources = (data.kb_resources || []).filter((r: any) => r.article_id === id).map(mapKBResource);
        return article;
      }
    );
  }

  async createKBArticle(article: Omit<KnowledgeBase, 'id' | 'created_at'>): Promise<KnowledgeBase> {
    const id = `kb_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.knowledgeBase.create({
          data: {
            id,
            category: article.category,
            title: article.title,
            content: article.content,
            fileUrl: article.file_url || null,
            mediaType: article.media_type || null,
            sourceLink: article.source_link || null,
          }
        });
        return mapKBArticle(created);
      },
      (data) => {
        const newKB: KnowledgeBase = {
          ...article,
          id,
          created_at: new Date().toISOString()
        };
        if (!data.kb_articles) data.kb_articles = [];
        data.kb_articles.push(newKB);
        saveFallbackData(data);
        return mapKBArticle(newKB);
      }
    );
  }

  async updateKBArticle(id: string, updates: Partial<KnowledgeBase>): Promise<KnowledgeBase> {
    return runQuery(
      async () => {
        const data: any = {};
        if (updates.category !== undefined) data.category = updates.category;
        if (updates.title !== undefined) data.title = updates.title;
        if (updates.content !== undefined) data.content = updates.content;
        if (updates.file_url !== undefined) data.fileUrl = updates.file_url;
        if (updates.media_type !== undefined) data.mediaType = updates.media_type;
        if (updates.source_link !== undefined) data.sourceLink = updates.source_link;

        const updated = await prisma.knowledgeBase.update({ where: { id }, data });
        return mapKBArticle(updated);
      },
      (data) => {
        const index = (data.kb_articles || []).findIndex((kb: any) => kb.id === id);
        if (index !== -1) {
          data.kb_articles[index] = { ...data.kb_articles[index], ...updates };
          saveFallbackData(data);
          return mapKBArticle(data.kb_articles[index]);
        }
        throw new Error('KnowledgeBase article not found');
      }
    );
  }

  // KB Resources
  async getKBResources(articleId: string): Promise<KBResource[]> {
    return runQuery(
      async () => {
        const list = await prisma.kBResource.findMany({
          where: { articleId },
          orderBy: { createdAt: 'asc' }
        });
        return list.map(mapKBResource);
      },
      (data) => {
        return (data.kb_resources || []).filter((r: any) => r.article_id === articleId).map(mapKBResource);
      }
    );
  }

  async createKBResource(resource: Omit<KBResource, 'id' | 'created_at'>): Promise<KBResource> {
    const id = `kbr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.kBResource.create({
          data: {
            id,
            articleId: resource.article_id,
            title: resource.title,
            url: resource.url,
            type: resource.type,
          }
        });
        return mapKBResource(created);
      },
      (data) => {
        const newResource: KBResource = { ...resource, id, created_at: new Date().toISOString() };
        if (!data.kb_resources) data.kb_resources = [];
        data.kb_resources.push(newResource);
        saveFallbackData(data);
        return mapKBResource(newResource);
      }
    );
  }

  async deleteKBResource(id: string): Promise<void> {
    await runQuery(
      async () => {
        try { await prisma.kBResource.delete({ where: { id } }); } catch {}
      },
      (data) => {
        if (data.kb_resources) {
          data.kb_resources = data.kb_resources.filter((r: any) => r.id !== id);
          saveFallbackData(data);
        }
      }
    );
  }

  // Meetings
  async getMeetings(): Promise<Meeting[]> {
    return runQuery(
      async () => {
        const list = await prisma.meeting.findMany({ orderBy: { scheduledAt: 'desc' } });
        return list.map(mapMeeting);
      },
      (data) => {
        const list = data.meetings || [];
        return list.map(mapMeeting).sort((a: any, b: any) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
      }
    );
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    return runQuery(
      async () => {
        const meeting = await prisma.meeting.findUnique({ where: { id } });
        return meeting ? mapMeeting(meeting) : undefined;
      },
      (data) => {
        const m = (data.meetings || []).find((x: any) => x.id === id);
        return m ? mapMeeting(m) : undefined;
      }
    );
  }

  async createMeeting(meeting: Omit<Meeting, 'id' | 'created_at'>): Promise<Meeting> {
    const id = `m_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.meeting.create({
          data: {
            id,
            title: meeting.title,
            description: meeting.description || null,
            scheduledAt: new Date(meeting.scheduled_at),
            link: meeting.link || null,
            projectId: meeting.project_id || null,
            createdBy: meeting.created_by || null,
          }
        });
        return mapMeeting(created);
      },
      (data) => {
        const newMeeting: Meeting = {
          ...meeting,
          id,
          created_at: new Date().toISOString()
        };
        if (!data.meetings) data.meetings = [];
        data.meetings.push(newMeeting);
        saveFallbackData(data);
        return mapMeeting(newMeeting);
      }
    );
  }

  // Telegram Sessions
  async getTelegramSession(tgId: number): Promise<TelegramSession | null> {
    return runQuery(
      async () => {
        const ts = await prisma.telegramSession.findUnique({ where: { telegramId: BigInt(tgId) } });
        return ts ? mapTelegramSession(ts) : null;
      },
      (data) => {
        const session = (data.telegramSessions || []).find((s: any) => Number(s.telegram_id) === tgId);
        return session ? mapTelegramSession(session) : null;
      }
    );
  }

  async setTelegramSession(tgId: number, state: string, data: any): Promise<TelegramSession> {
    return runQuery(
      async () => {
        const existing = await prisma.telegramSession.findUnique({ where: { telegramId: BigInt(tgId) } });
        if (existing) {
          const updated = await prisma.telegramSession.update({
            where: { telegramId: BigInt(tgId) },
            data: { state, data, updatedAt: new Date() }
          });
          return mapTelegramSession(updated);
        } else {
          const created = await prisma.telegramSession.create({
            data: { telegramId: BigInt(tgId), state, data }
          });
          return mapTelegramSession(created);
        }
      },
      (dbData) => {
        if (!dbData.telegramSessions) dbData.telegramSessions = [];
        const index = dbData.telegramSessions.findIndex((s: any) => Number(s.telegram_id) === tgId);
        const newSession: TelegramSession = {
          telegram_id: tgId,
          state,
          data,
          updated_at: new Date().toISOString()
        };
        if (index !== -1) {
          dbData.telegramSessions[index] = newSession;
        } else {
          dbData.telegramSessions.push(newSession);
        }
        saveFallbackData(dbData);
        return mapTelegramSession(newSession);
      }
    );
  }

  async clearTelegramSession(tgId: number): Promise<void> {
    await runQuery(
      async () => {
        try {
          await prisma.telegramSession.delete({ where: { telegramId: BigInt(tgId) } });
        } catch {}
      },
      (data) => {
        if (data.telegramSessions) {
          data.telegramSessions = data.telegramSessions.filter((s: any) => Number(s.telegram_id) !== tgId);
          saveFallbackData(data);
        }
      }
    );
  }

  // Mock Messages (Simulator Support)
  async getMockMessages(tgId: number): Promise<MockMessage[]> {
    return runQuery(
      async () => {
        const list = await prisma.mockMessage.findMany({
          where: { telegramId: BigInt(tgId) },
          orderBy: { createdAt: 'asc' }
        });
        return list.map(mapMockMessage);
      },
      (data) => {
        const list = (data.mockMessages || []).filter((m: any) => Number(m.telegram_id) === tgId);
        return list.map(mapMockMessage).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    );
  }

  async getAllMockMessages(): Promise<MockMessage[]> {
    return runQuery(
      async () => {
        const list = await prisma.mockMessage.findMany({
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        return list.map(mapMockMessage);
      },
      (data) => {
        return (data.mockMessages || [])
          .map(mapMockMessage)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 500);
      }
    );
  }

  async createMockMessage(tgId: number, sender: 'user' | 'bot', text: string, keyboard?: any): Promise<MockMessage> {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.mockMessage.create({
          data: {
            id,
            telegramId: BigInt(tgId),
            sender,
            text,
            keyboard: keyboard || null,
          }
        });
        return mapMockMessage(created);
      },
      (data) => {
        const newMsg: MockMessage = {
          id,
          telegram_id: tgId,
          sender,
          text,
          keyboard: keyboard || null,
          created_at: new Date().toISOString()
        };
        if (!data.mockMessages) data.mockMessages = [];
        data.mockMessages.push(newMsg);
        saveFallbackData(data);
        return mapMockMessage(newMsg);
      }
    );
  }

  async clearMockMessages(tgId: number): Promise<void> {
    await runQuery(
      async () => {
        await prisma.mockMessage.deleteMany({ where: { telegramId: BigInt(tgId) } });
      },
      (data) => {
        if (data.mockMessages) {
          data.mockMessages = data.mockMessages.filter((m: any) => Number(m.telegram_id) !== tgId);
          saveFallbackData(data);
        }
      }
    );
  }

  // Chats & Messages
  async getChats(): Promise<Chat[]> {
    return runQuery(
      async () => {
        const list = await prisma.chat.findMany({ orderBy: { createdAt: 'desc' } });
        return list.map(mapChat);
      },
      (data) => {
        return (data.chats || []).map(mapChat).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    );
  }

  async createChat(chat: Omit<Chat, 'id' | 'created_at'>): Promise<Chat> {
    const id = `c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.chat.create({
          data: {
            id,
            type: chat.type,
            title: chat.title,
            projectId: chat.project_id || null,
            volunteerId: chat.volunteer_id || null,
            targetOrgId: chat.target_org_id || null,
          }
        });
        return mapChat(created);
      },
      (data) => {
        const newChat: Chat = {
          ...chat,
          id,
          created_at: new Date().toISOString()
        };
        if (!data.chats) data.chats = [];
        data.chats.push(newChat);
        saveFallbackData(data);
        return mapChat(newChat);
      }
    );
  }

  async getChatMessages(chatId: string): Promise<ChatMessage[]> {
    return runQuery(
      async () => {
        const list = await prisma.chatMessage.findMany({
          where: { chatId },
          orderBy: { createdAt: 'asc' }
        });
        return list.map(mapChatMessage);
      },
      (data) => {
        const list = (data.chat_messages || []).filter((m: any) => m.chat_id === chatId);
        return list.map(mapChatMessage).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    );
  }

  async createChatMessage(msg: Omit<ChatMessage, 'id' | 'created_at'>): Promise<ChatMessage> {
    const id = `chmsg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.chatMessage.create({
          data: {
            id,
            chatId: msg.chat_id,
            senderId: msg.sender_id,
            senderName: msg.sender_name,
            senderRole: msg.sender_role,
            text: msg.text,
          }
        });
        return mapChatMessage(created);
      },
      (data) => {
        const newMsg: ChatMessage = {
          ...msg,
          id,
          created_at: new Date().toISOString()
        };
        if (!data.chat_messages) data.chat_messages = [];
        data.chat_messages.push(newMsg);
        saveFallbackData(data);
        return mapChatMessage(newMsg);
      }
    );
  }

  // Organizations & News & Memberships
  async getOrganizations(): Promise<VolunteerOrganization[]> {
    return runQuery(
      async () => {
        const list = await prisma.volunteerOrganization.findMany({ orderBy: { name: 'asc' } });
        return list.map(mapOrganization);
      },
      (data) => {
        return (data.organizations || []).map(mapOrganization).sort((a: any, b: any) => a.name.localeCompare(b.name));
      }
    );
  }

  async createOrganization(org: Omit<VolunteerOrganization, 'id' | 'created_at'>): Promise<VolunteerOrganization> {
    const id = `org_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.volunteerOrganization.create({
          data: {
            id,
            name: org.name,
            description: org.description,
            category: org.category,
            avatarUrl: org.avatar_url || null,
            contacts: org.contacts,
            goals: org.goals || null,
            leaderName: org.leader_name || null,
            orgStructure: org.org_structure || null,
          }
        });
        return mapOrganization(created);
      },
      (data) => {
        const newOrg: VolunteerOrganization = {
          ...org,
          id,
          created_at: new Date().toISOString()
        };
        if (!data.organizations) data.organizations = [];
        data.organizations.push(newOrg);
        saveFallbackData(data);
        return mapOrganization(newOrg);
      }
    );
  }

  async getOrganizationNews(): Promise<OrganizationNews[]> {
    return runQuery(
      async () => {
        const list = await prisma.organizationNews.findMany({ orderBy: { createdAt: 'desc' } });
        return list.map(mapOrgNews);
      },
      (data) => {
        return (data.org_news || []).map(mapOrgNews).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    );
  }

  async createOrganizationNews(news: Omit<OrganizationNews, 'id' | 'created_at'>): Promise<OrganizationNews> {
    const id = `news_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.organizationNews.create({
          data: {
            id,
            orgId: news.org_id,
            title: news.title,
            content: news.content,
          }
        });
        return mapOrgNews(created);
      },
      (data) => {
        const newNews: OrganizationNews = {
          ...news,
          id,
          created_at: new Date().toISOString()
        };
        if (!data.org_news) data.org_news = [];
        data.org_news.push(newNews);
        saveFallbackData(data);
        return mapOrgNews(newNews);
      }
    );
  }

  async getOrganizationMemberships(): Promise<OrganizationMembership[]> {
    return runQuery(
      async () => {
        const list = await prisma.organizationMembership.findMany({ orderBy: { createdAt: 'desc' } });
        return list.map(mapMembership);
      },
      (data) => {
        return (data.org_memberships || []).map(mapMembership).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    );
  }

  async createOrganizationMembership(membership: Omit<OrganizationMembership, 'id' | 'created_at'>): Promise<OrganizationMembership> {
    const id = `memb_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.organizationMembership.create({
          data: {
            id,
            orgId: membership.org_id,
            userId: membership.user_id,
            status: membership.status,
            coverLetter: membership.cover_letter || null,
          }
        });
        return mapMembership(created);
      },
      (data) => {
        const newMemb: OrganizationMembership = {
          ...membership,
          id,
          created_at: new Date().toISOString()
        };
        if (!data.org_memberships) data.org_memberships = [];
        data.org_memberships.push(newMemb);
        saveFallbackData(data);
        return mapMembership(newMemb);
      }
    );
  }

  async updateOrganizationMembership(id: string, status: 'approved' | 'rejected'): Promise<OrganizationMembership> {
    return runQuery(
      async () => {
        const updated = await prisma.organizationMembership.update({
          where: { id },
          data: { status }
        });
        return mapMembership(updated);
      },
      (data) => {
        const index = (data.org_memberships || []).findIndex((m: any) => m.id === id);
        if (index !== -1) {
          data.org_memberships[index].status = status;
          saveFallbackData(data);
          return mapMembership(data.org_memberships[index]);
        }
        throw new Error('Membership not found');
      }
    );
  }

  async deleteOrganizationMembership(id: string): Promise<boolean> {
    return runQuery(
      async () => {
        await prisma.organizationMembership.delete({ where: { id } });
        return true;
      },
      (data) => {
        if (data.org_memberships) {
          data.org_memberships = data.org_memberships.filter((m: any) => m.id !== id);
          saveFallbackData(data);
        }
        return true;
      }
    );
  }

  // Resources (Inventory)
  async getResources(): Promise<ResourceItem[]> {
    return runQuery(
      async () => {
        const list = await prisma.resourceItem.findMany({ orderBy: { name: 'asc' } });
        return list.map(mapResource);
      },
      (data) => {
        return (data.resources || []).map(mapResource).sort((a: any, b: any) => a.name.localeCompare(b.name));
      }
    );
  }

  async addResource(resource: Omit<ResourceItem, 'id' | 'created_at' | 'allocated_qty'>): Promise<ResourceItem> {
    const id = `res_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.resourceItem.create({
          data: {
            id,
            name: resource.name,
            category: resource.category,
            totalQty: Number(resource.total_qty),
            allocatedQty: 0,
            unit: resource.unit,
            location: resource.location,
          }
        });
        return mapResource(created);
      },
      (data) => {
        const newResource: ResourceItem = {
          ...resource,
          id,
          allocated_qty: 0,
          created_at: new Date().toISOString()
        };
        if (!data.resources) data.resources = [];
        data.resources.push(newResource);
        saveFallbackData(data);
        return mapResource(newResource);
      }
    );
  }

  async allocateResource(resourceId: string, projectId: string, taskId: string | null, qty: number): Promise<ResourceAllocation> {
    return runQuery(
      async () => {
        const resource = await prisma.resourceItem.findUnique({ where: { id: resourceId } });
        if (!resource) throw new Error('Resource not found');

        const newAllocated = resource.allocatedQty + qty;
        if (newAllocated > resource.totalQty) throw new Error('Insufficient resources available');

        const id = `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        const [allocation] = await prisma.$transaction([
          prisma.resourceAllocation.create({
            data: { id, resourceId, projectId, taskId: taskId || null, qty, status: 'allocated' }
          }),
          prisma.resourceItem.update({
            where: { id: resourceId },
            data: { allocatedQty: newAllocated }
          })
        ]);
        return mapAllocation(allocation);
      },
      (data) => {
        const resource = (data.resources || []).find((r: any) => r.id === resourceId);
        if (!resource) throw new Error('Resource not found');

        const newAllocated = (resource.allocated_qty || 0) + qty;
        if (newAllocated > resource.total_qty) throw new Error('Insufficient resources available');

        resource.allocated_qty = newAllocated;
        const id = `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        const newAlloc: ResourceAllocation = {
          id,
          resource_id: resourceId,
          project_id: projectId,
          task_id: taskId,
          qty,
          status: 'allocated',
          created_at: new Date().toISOString()
        };
        if (!data.allocations) data.allocations = [];
        data.allocations.push(newAlloc);
        saveFallbackData(data);
        return mapAllocation(newAlloc);
      }
    );
  }

  async returnResource(allocationId: string): Promise<ResourceAllocation> {
    return runQuery(
      async () => {
        const allocation = await prisma.resourceAllocation.findUnique({ where: { id: allocationId } });
        if (!allocation) throw new Error('Allocation not found');
        if (allocation.status === 'returned') return mapAllocation(allocation);

        const resource = await prisma.resourceItem.findUnique({ where: { id: allocation.resourceId } });
        if (!resource) throw new Error('Resource not found');

        const newAllocated = Math.max(0, resource.allocatedQty - allocation.qty);
        const [updatedAllocation] = await prisma.$transaction([
          prisma.resourceAllocation.update({
            where: { id: allocationId },
            data: { status: 'returned' }
          }),
          prisma.resourceItem.update({
            where: { id: allocation.resourceId },
            data: { allocatedQty: newAllocated }
          })
        ]);
        return mapAllocation(updatedAllocation);
      },
      (data) => {
        const allocation = (data.allocations || []).find((a: any) => a.id === allocationId);
        if (!allocation) throw new Error('Allocation not found');
        if (allocation.status === 'returned') return mapAllocation(allocation);

        const resource = (data.resources || []).find((r: any) => r.id === allocation.resource_id);
        if (resource) {
          resource.allocated_qty = Math.max(0, (resource.allocated_qty || 0) - allocation.qty);
        }
        allocation.status = 'returned';
        saveFallbackData(data);
        return mapAllocation(allocation);
      }
    );
  }

  async getAllocations(): Promise<ResourceAllocation[]> {
    return runQuery(
      async () => {
        const list = await prisma.resourceAllocation.findMany({ orderBy: { createdAt: 'desc' } });
        return list.map(mapAllocation);
      },
      (data) => {
        return (data.allocations || []).map(mapAllocation).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    );
  }

  // Badges
  async getBadges(): Promise<Badge[]> {
    return runQuery(
      async () => {
        const list = await prisma.badge.findMany({ orderBy: { xpRequired: 'asc' } });
        return list.map(mapBadge);
      },
      (data) => {
        return (data.badges || []).map(mapBadge).sort((a: any, b: any) => a.xp_required - b.xp_required);
      }
    );
  }

  async addXpToVolunteer(userId: string, amount: number): Promise<User> {
    return runQuery(
      async () => {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error('User not found');

        const newXp = (user.xp || 0) + amount;
        const newLevel = Math.floor(newXp / 100) + 1;

        const badgesList = await prisma.badge.findMany();
        const userBadges = user.badges || [];
        const newlyEarned: string[] = [];
        
        badgesList.forEach(b => {
          if (newXp >= b.xpRequired && !userBadges.includes(b.name)) {
            newlyEarned.push(b.name);
          }
        });

        const updatedBadges = [...userBadges, ...newlyEarned];
        const updated = await prisma.user.update({
          where: { id: userId },
          data: { xp: newXp, level: newLevel, badges: updatedBadges }
        });
        return mapUser(updated);
      },
      (data) => {
        const index = (data.users || []).findIndex((u: any) => u.id === userId);
        if (index === -1) throw new Error('User not found');

        const user = data.users[index];
        const newXp = (user.xp || 0) + amount;
        const newLevel = Math.floor(newXp / 100) + 1;

        const userBadges = user.badges || [];
        const newlyEarned: string[] = [];
        (data.badges || []).forEach((b: any) => {
          if (newXp >= b.xp_required && !userBadges.includes(b.name)) {
            newlyEarned.push(b.name);
          }
        });

        user.xp = newXp;
        user.level = newLevel;
        user.badges = [...userBadges, ...newlyEarned];
        
        saveFallbackData(data);
        return mapUser(user);
      }
    );
  }

  // Leaderboards
  async getLeaderboard(type: 'volunteers' | 'organizations'): Promise<any[]> {
    return runQuery(
      async () => {
        if (type === 'volunteers') {
          const list = await prisma.user.findMany({
            where: { role: 'volunteer' },
            orderBy: { xp: 'desc' }
          });
          return list.map(u => ({
            id: u.id,
            full_name: u.fullName,
            xp: u.xp || 0,
            level: u.level || 1,
            rating: u.rating || 5.0,
            badges_count: u.badges.length
          }));
        } else {
          const orgs = await prisma.volunteerOrganization.findMany();
          const checkins = await prisma.checkIn.findMany();
          const projects = await prisma.project.findMany();

          const orgHoursMap: Record<string, number> = {};
          const orgVolunteerCountMap: Record<string, Set<string>> = {};

          orgs.forEach(org => {
            orgHoursMap[org.id] = 0;
            orgVolunteerCountMap[org.id] = new Set<string>();
          });

          checkins.forEach(ci => {
            if (ci.projectId) {
              const project = projects.find(p => p.id === ci.projectId);
              if (project && project.orgId && orgHoursMap[project.orgId] !== undefined) {
                orgHoursMap[project.orgId] += ci.hours || 0;
                orgVolunteerCountMap[project.orgId].add(ci.userId);
              }
            }
          });

          return orgs.map(org => ({
            id: org.id,
            name: org.name,
            category: org.category,
            total_hours: Math.round(orgHoursMap[org.id] * 10) / 10,
            volunteers_count: orgVolunteerCountMap[org.id].size,
            projects_count: projects.filter(p => p.orgId === org.id).length
          })).sort((a: any, b: any) => b.total_hours - a.total_hours);
        }
      },
      (data) => {
        if (type === 'volunteers') {
          return (data.users || [])
            .filter((u: any) => u.role === 'volunteer')
            .map((u: any) => ({
              id: u.id,
              full_name: u.full_name,
              xp: u.xp || 0,
              level: u.level || 1,
              rating: u.rating || 5.0,
              badges_count: (u.badges || []).length
            }))
            .sort((a: any, b: any) => b.xp - a.xp);
        } else {
          const orgHoursMap: Record<string, number> = {};
          const orgVolunteerCountMap: Record<string, Set<string>> = {};

          (data.organizations || []).forEach((org: any) => {
            orgHoursMap[org.id] = 0;
            orgVolunteerCountMap[org.id] = new Set<string>();
          });

          (data.check_ins || []).forEach((ci: any) => {
            if (ci.project_id) {
              const project = (data.projects || []).find((p: any) => p.id === ci.project_id);
              if (project && project.org_id && orgHoursMap[project.org_id] !== undefined) {
                orgHoursMap[project.org_id] += ci.hours || 0;
                orgVolunteerCountMap[project.org_id].add(ci.user_id);
              }
            }
          });

          return (data.organizations || []).map((org: any) => ({
            id: org.id,
            name: org.name,
            category: org.category,
            total_hours: Math.round(orgHoursMap[org.id] * 10) / 10,
            volunteers_count: orgVolunteerCountMap[org.id].size,
            projects_count: (data.projects || []).filter((p: any) => p.org_id === org.id).length
          })).sort((a: any, b: any) => b.total_hours - a.total_hours);
        }
      }
    );
  }

  // Recommendations logic
  async getRecommendations(volunteerId: string): Promise<Task[]> {
    return runQuery(
      async () => {
        const volunteer = await prisma.user.findUnique({ where: { id: volunteerId } });
        if (!volunteer) return [];

        const interests = volunteer.interests || [];
        const unassignedTasks = await prisma.task.findMany({
          where: { assignedTo: null, status: 'pending' }
        });
        const projects = await prisma.project.findMany();
        const orgs = await prisma.volunteerOrganization.findMany();

        const scoredTasks = unassignedTasks.map(task => {
          const project = projects.find(p => p.id === task.projectId);
          let score = 0;
          if (project) {
            const org = orgs.find(o => o.id === project.orgId);
            if (org && interests.includes(org.category)) score += 10;
            if ((project as any).region && (volunteer as any).region && (project as any).region === (volunteer as any).region) score += 5;
          }
          return { task, score };
        });

        return scoredTasks.sort((a: any, b: any) => b.score - a.score).map((item: any) => mapTask(item.task));
      },
      (data) => {
        const volunteer = (data.users || []).find((u: any) => u.id === volunteerId);
        if (!volunteer) return [];

        const interests = volunteer.interests || [];
        const unassignedTasks = (data.tasks || []).filter((t: any) => !t.assigned_to && t.status === 'pending');
        
        const scoredTasks = unassignedTasks.map((task: any) => {
          const project = (data.projects || []).find((p: any) => p.id === task.project_id);
          let score = 0;
          if (project) {
            const org = (data.organizations || []).find((o: any) => o.id === project.org_id);
            if (org && interests.includes(org.category)) score += 10;
            if (project.region && volunteer.region && project.region === volunteer.region) score += 5;
          }
          return { task, score };
        });

        return scoredTasks.sort((a: any, b: any) => b.score - a.score).map((item: any) => mapTask(item.task));
      }
    );
  }

  // Documents
  async getDocuments(): Promise<GeneratedDoc[]> {
    return runQuery(
      async () => {
        const list = await prisma.generatedDoc.findMany({ orderBy: { createdAt: 'desc' } });
        return list.map(mapGeneratedDoc);
      },
      (data) => {
        return (data.documents || []).map(mapGeneratedDoc).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    );
  }

  async addDocument(doc: Omit<GeneratedDoc, 'id' | 'created_at'>): Promise<GeneratedDoc> {
    const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.generatedDoc.create({
          data: { id, templateType: doc.template_type, title: doc.title, volunteerId: doc.volunteer_id || null, projectId: doc.project_id || null }
        });
        return mapGeneratedDoc(created);
      },
      (data) => {
        const newDoc: GeneratedDoc = {
          ...doc,
          id,
          created_at: new Date().toISOString()
        };
        if (!data.documents) data.documents = [];
        data.documents.push(newDoc);
        saveFallbackData(data);
        return mapGeneratedDoc(newDoc);
      }
    );
  }

  // Bot Config
  async getBotConfig(): Promise<BotConfig> {
    return runQuery(
      async () => {
        const config = await prisma.botConfig.findUnique({ where: { id: 1 } });
        if (!config) {
          const created = await prisma.botConfig.create({
            data: { id: 1, botToken: '', webhookUrl: '', isSimulatorEnabled: true }
          });
          return mapBotConfig(created);
        }
        return mapBotConfig(config);
      },
      (data) => {
        const config = data.botConfig || { bot_token: '', webhook_url: '', is_simulator_enabled: true };
        return mapBotConfig(config);
      }
    );
  }

  async updateBotConfig(updates: Partial<BotConfig>): Promise<BotConfig> {
    return runQuery(
      async () => {
        await this.getBotConfig(); // Ensure initialized
        const data: any = {};
        if (updates.bot_token !== undefined) data.botToken = updates.bot_token;
        if (updates.webhook_url !== undefined) data.webhookUrl = updates.webhook_url;
        if (updates.is_simulator_enabled !== undefined) data.isSimulatorEnabled = updates.is_simulator_enabled;

        const updated = await prisma.botConfig.update({ where: { id: 1 }, data });
        return mapBotConfig(updated);
      },
      (data) => {
        if (!data.botConfig) {
          data.botConfig = { bot_token: '', webhook_url: '', is_simulator_enabled: true };
        }
        data.botConfig = {
          bot_token: updates.bot_token !== undefined ? updates.bot_token : data.botConfig.bot_token,
          webhook_url: updates.webhook_url !== undefined ? updates.webhook_url : data.botConfig.webhook_url,
          is_simulator_enabled: updates.is_simulator_enabled !== undefined ? updates.is_simulator_enabled : data.botConfig.is_simulator_enabled
        };
        saveFallbackData(data);
        return mapBotConfig(data.botConfig);
      }
    );
  }

  // Access Keys
  async getAccessKeys(): Promise<AccessKey[]> {
    return runQuery(
      async () => {
        const list = await prisma.accessKey.findMany({ orderBy: { createdAt: 'desc' } });
        return list.map(mapAccessKey);
      },
      (data) => {
        return (data.access_keys || []).map(mapAccessKey).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    );
  }

  async createAccessKey(key: Omit<AccessKey, 'id' | 'created_at'>): Promise<AccessKey> {
    const id = `ak_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const passwordEncrypted = encryptSecret(key.password_encrypted);
    return runQuery(
      async () => {
        const created = await prisma.accessKey.create({
          data: { id, name: key.name, category: key.category, username: key.username, passwordEncrypted, notes: key.notes || null }
        });
        return mapAccessKey(created);
      },
      (data) => {
        const newKey: AccessKey = {
          ...key,
          password_encrypted: passwordEncrypted,
          id,
          created_at: new Date().toISOString()
        };
        if (!data.access_keys) data.access_keys = [];
        data.access_keys.push(newKey);
        saveFallbackData(data);
        return mapAccessKey(newKey);
      }
    );
  }

  async updateAccessKey(id: string, updates: Partial<AccessKey>): Promise<AccessKey> {
    return runQuery(
      async () => {
        const data: any = {};
        if (updates.name !== undefined) data.name = updates.name;
        if (updates.category !== undefined) data.category = updates.category;
        if (updates.username !== undefined) data.username = updates.username;
        if (updates.password_encrypted !== undefined) data.passwordEncrypted = encryptSecret(updates.password_encrypted);
        if (updates.notes !== undefined) data.notes = updates.notes;

        const updated = await prisma.accessKey.update({ where: { id }, data });
        return mapAccessKey(updated);
      },
      (data) => {
        const index = (data.access_keys || []).findIndex((k: any) => k.id === id);
        if (index !== -1) {
          data.access_keys[index] = {
            ...data.access_keys[index],
            ...updates,
            ...(updates.password_encrypted !== undefined
              ? { password_encrypted: encryptSecret(updates.password_encrypted) }
              : {}),
          };
          saveFallbackData(data);
          return mapAccessKey(data.access_keys[index]);
        }
        throw new Error('AccessKey not found');
      }
    );
  }

  async deleteAccessKey(id: string): Promise<void> {
    await runQuery(
      async () => {
        try { await prisma.accessKey.delete({ where: { id } }); } catch {}
      },
      (data) => {
        if (data.access_keys) {
          data.access_keys = data.access_keys.filter((k: any) => k.id !== id);
          saveFallbackData(data);
        }
      }
    );
  }

  // Archive Items
  async getArchiveItems(): Promise<ArchiveItem[]> {
    return runQuery(
      async () => {
        const list = await prisma.archiveItem.findMany({ orderBy: { extractedAt: 'desc' } });
        return list.map(mapArchiveItem);
      },
      (data) => {
        return (data.archive_items || []).map(mapArchiveItem).sort((a: any, b: any) => new Date(b.extracted_at).getTime() - new Date(a.extracted_at).getTime());
      }
    );
  }

  async createArchiveItem(item: Omit<ArchiveItem, 'id' | 'extracted_at'>): Promise<ArchiveItem> {
    const id = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.archiveItem.create({
          data: { id, chatTitle: item.chat_title, fileName: item.file_name, fileType: item.file_type, fileSize: Number(item.file_size), fileUrl: item.file_url }
        });
        return mapArchiveItem(created);
      },
      (data) => {
        const newArchive: ArchiveItem = {
          ...item,
          id,
          extracted_at: new Date().toISOString()
        };
        if (!data.archive_items) data.archive_items = [];
        data.archive_items.push(newArchive);
        saveFallbackData(data);
        return mapArchiveItem(newArchive);
      }
    );
  }

  async deleteArchiveItem(id: string): Promise<void> {
    await runQuery(
      async () => {
        try { await prisma.archiveItem.delete({ where: { id } }); } catch {}
      },
      (data) => {
        if (data.archive_items) {
          data.archive_items = data.archive_items.filter((ai: any) => ai.id !== id);
          saveFallbackData(data);
        }
      }
    );
  }

  async clearArchive(): Promise<void> {
    await runQuery(
      async () => { await prisma.archiveItem.deleteMany(); },
      (data) => {
        data.archive_items = [];
        saveFallbackData(data);
      }
    );
  }

  // Partners
  async getPartners(): Promise<Partner[]> {
    return runQuery(
      async () => {
        const list = await prisma.partner.findMany({ orderBy: { name: 'asc' } });
        return list.map(mapPartner);
      },
      (data) => {
        return (data.partners || []).map(mapPartner).sort((a: any, b: any) => a.name.localeCompare(b.name));
      }
    );
  }

  async createPartner(partner: Omit<Partner, 'id' | 'created_at'>): Promise<Partner> {
    const id = `pt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.partner.create({
          data: { id, name: partner.name, category: partner.category, anniversaryDate: partner.anniversary_date, contactPerson: partner.contact_person, email: partner.email || null, phone: partner.phone || null, autoGreetEnabled: partner.auto_greet_enabled ?? false }
        });
        return mapPartner(created);
      },
      (data) => {
        const newPartner: Partner = {
          ...partner,
          id,
          created_at: new Date().toISOString()
        };
        if (!data.partners) data.partners = [];
        data.partners.push(newPartner);
        saveFallbackData(data);
        return mapPartner(newPartner);
      }
    );
  }

  async updatePartner(id: string, updates: Partial<Partner>): Promise<Partner> {
    return runQuery(
      async () => {
        const data: any = {};
        if (updates.name !== undefined) data.name = updates.name;
        if (updates.category !== undefined) data.category = updates.category;
        if (updates.anniversary_date !== undefined) data.anniversaryDate = updates.anniversary_date;
        if (updates.contact_person !== undefined) data.contactPerson = updates.contact_person;
        if (updates.email !== undefined) data.email = updates.email;
        if (updates.phone !== undefined) data.phone = updates.phone;
        if (updates.auto_greet_enabled !== undefined) data.autoGreetEnabled = updates.auto_greet_enabled;

        const updated = await prisma.partner.update({ where: { id }, data });
        return mapPartner(updated);
      },
      (data) => {
        const index = (data.partners || []).findIndex((p: any) => p.id === id);
        if (index !== -1) {
          data.partners[index] = { ...data.partners[index], ...updates };
          saveFallbackData(data);
          return mapPartner(data.partners[index]);
        }
        throw new Error('Partner not found');
      }
    );
  }

  async deletePartner(id: string): Promise<void> {
    await runQuery(
      async () => {
        try { await prisma.partner.delete({ where: { id } }); } catch {}
      },
      (data) => {
        if (data.partners) {
          data.partners = data.partners.filter((p: any) => p.id !== id);
          saveFallbackData(data);
        }
      }
    );
  }

  // HR Documents
  async getHrDocuments(): Promise<HrDocument[]> {
    return runQuery(
      async () => {
        const list = await prisma.hrDocument.findMany({ orderBy: { createdAt: 'desc' } });
        return list.map(mapHrDocument);
      },
      (data) => {
        return (data.hr_documents || []).map(mapHrDocument).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    );
  }

  async createHrDocument(doc: Omit<HrDocument, 'id' | 'created_at'>): Promise<HrDocument> {
    const id = `hrdoc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.hrDocument.create({
          data: { id, employeeName: doc.employee_name, docType: doc.doc_type, details: doc.details }
        });
        return mapHrDocument(created);
      },
      (data) => {
        const newDoc: HrDocument = {
          ...doc,
          id,
          created_at: new Date().toISOString()
        };
        if (!data.hr_documents) data.hr_documents = [];
        data.hr_documents.push(newDoc);
        saveFallbackData(data);
        return mapHrDocument(newDoc);
      }
    );
  }

  // Didox Invoices
  async getDidoxInvoices(): Promise<DidoxInvoice[]> {
    return runQuery(
      async () => {
        const list = await prisma.didoxInvoice.findMany({ orderBy: { createdAt: 'desc' } });
        return list.map(mapInvoice);
      },
      (data) => {
        return (data.didox_invoices || []).map(mapInvoice).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    );
  }

  async createDidoxInvoice(invoice: Omit<DidoxInvoice, 'id' | 'created_at'>): Promise<DidoxInvoice> {
    const id = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.didoxInvoice.create({
          data: { id, supplierName: invoice.supplier_name, itemName: invoice.item_name, price: Number(invoice.price), qty: Number(invoice.qty), avgHistoricPrice: Number(invoice.avg_historic_price), flaggedReason: invoice.flagged_reason || null }
        });
        return mapInvoice(created);
      },
      (data) => {
        const newInvoice: DidoxInvoice = {
          ...invoice,
          id,
          created_at: new Date().toISOString()
        };
        if (!data.didox_invoices) data.didox_invoices = [];
        data.didox_invoices.push(newInvoice);
        saveFallbackData(data);
        return mapInvoice(newInvoice);
      }
    );
  }

  async updateDidoxInvoice(id: string, updates: Partial<DidoxInvoice>): Promise<DidoxInvoice> {
    return runQuery(
      async () => {
        const data: any = {};
        if (updates.supplier_name !== undefined) data.supplierName = updates.supplier_name;
        if (updates.item_name !== undefined) data.itemName = updates.item_name;
        if (updates.price !== undefined) data.price = Number(updates.price);
        if (updates.qty !== undefined) data.qty = Number(updates.qty);
        if (updates.avg_historic_price !== undefined) data.avgHistoricPrice = Number(updates.avg_historic_price);
        if (updates.flagged_reason !== undefined) data.flaggedReason = updates.flagged_reason;

        const updated = await prisma.didoxInvoice.update({ where: { id }, data });
        return mapInvoice(updated);
      },
      (data) => {
        const index = (data.didox_invoices || []).findIndex((i: any) => i.id === id);
        if (index !== -1) {
          data.didox_invoices[index] = { ...data.didox_invoices[index], ...updates };
          saveFallbackData(data);
          return mapInvoice(data.didox_invoices[index]);
        }
        throw new Error('Invoice not found');
      }
    );
  }

  // Employee Reviews
  async getEmployeeReviews(): Promise<EmployeeReview[]> {
    return runQuery(
      async () => {
        const list = await prisma.employeeReview.findMany({ orderBy: { createdAt: 'desc' } });
        return list.map(mapReview);
      },
      (data) => {
        return (data.employee_reviews || []).map(mapReview).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    );
  }

  async createEmployeeReview(review: Omit<EmployeeReview, 'id' | 'created_at'>): Promise<EmployeeReview> {
    const id = `er_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.employeeReview.create({
          data: { id, employeeName: review.employee_name, kpiScore: Number(review.kpi_score), feedback: review.feedback, createdBy: review.created_by }
        });
        return mapReview(created);
      },
      (data) => {
        const newReview: EmployeeReview = {
          ...review,
          id,
          created_at: new Date().toISOString()
        };
        if (!data.employee_reviews) data.employee_reviews = [];
        data.employee_reviews.push(newReview);
        saveFallbackData(data);
        return mapReview(newReview);
      }
    );
  }

  // Emergency Alerts
  async getEmergencyAlerts(): Promise<EmergencyAlert[]> {
    return runQuery(
      async () => {
        const list = await prisma.emergencyAlert.findMany({ orderBy: { createdAt: 'desc' } });
        return list.map(mapAlert);
      },
      (data) => {
        return (data.emergencyAlerts || []).map(mapAlert).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    );
  }

  async createEmergencyAlert(alert: Omit<EmergencyAlert, 'id' | 'created_at' | 'status' | 'attending_volunteer_ids'>): Promise<EmergencyAlert> {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return runQuery(
      async () => {
        const created = await prisma.emergencyAlert.create({
          data: { id, title: alert.title, description: alert.description, latitude: Number(alert.latitude), longitude: Number(alert.longitude), requiredSkills: alert.required_skills || [], radiusKm: Number(alert.radius_km), status: 'active', notifiedVolunteerIds: alert.notified_volunteer_ids || [], attendingVolunteerIds: [] }
        });
        return mapAlert(created);
      },
      (data) => {
        const newAlert: EmergencyAlert = {
          ...alert,
          id,
          status: 'active',
          attending_volunteer_ids: [],
          created_at: new Date().toISOString()
        };
        if (!data.emergencyAlerts) data.emergencyAlerts = [];
        data.emergencyAlerts.push(newAlert);
        saveFallbackData(data);
        return mapAlert(newAlert);
      }
    );
  }

  async updateEmergencyAlert(id: string, updates: Partial<EmergencyAlert>): Promise<EmergencyAlert> {
    return runQuery(
      async () => {
        const data: any = {};
        if (updates.title !== undefined) data.title = updates.title;
        if (updates.description !== undefined) data.description = updates.description;
        if (updates.latitude !== undefined) data.latitude = Number(updates.latitude);
        if (updates.longitude !== undefined) data.longitude = Number(updates.longitude);
        if (updates.required_skills !== undefined) data.requiredSkills = updates.required_skills;
        if (updates.radius_km !== undefined) data.radiusKm = Number(updates.radius_km);
        if (updates.status !== undefined) data.status = updates.status;
        if (updates.notified_volunteer_ids !== undefined) data.notifiedVolunteerIds = updates.notified_volunteer_ids;
        if (updates.attending_volunteer_ids !== undefined) data.attendingVolunteerIds = updates.attending_volunteer_ids;

        const updated = await prisma.emergencyAlert.update({ where: { id }, data });
        return mapAlert(updated);
      },
      (data) => {
        const index = (data.emergencyAlerts || []).findIndex((ea: any) => ea.id === id);
        if (index !== -1) {
          data.emergencyAlerts[index] = { ...data.emergencyAlerts[index], ...updates };
          saveFallbackData(data);
          return mapAlert(data.emergencyAlerts[index]);
        }
        throw new Error('EmergencyAlert not found');
      }
    );
  }

  async deleteEmergencyAlert(id: string): Promise<void> {
    await runQuery(
      async () => {
        try { await prisma.emergencyAlert.delete({ where: { id } }); } catch {}
      },
      (data) => {
        if (data.emergencyAlerts) {
          data.emergencyAlerts = data.emergencyAlerts.filter((ea: any) => ea.id !== id);
          saveFallbackData(data);
        }
      }
    );
  }

  // --- Volunteer Applications ---
  async getVolunteerApplications(opts?: { status?: string }): Promise<VolunteerApplication[]> {
    return runQuery(
      async () => {
        const whereClause = opts?.status ? { status: opts.status } : {};
        const apps = await prisma.volunteerApplication.findMany({ where: whereClause, orderBy: { createdAt: 'desc' } });
        return apps.map((app: any) => ({
          id: app.id,
          telegram_id: Number(app.telegramId),
          language_pref: app.languagePref,
          full_name: app.fullName,
          date_of_birth: app.dateOfBirth || '',
          phone: app.phone,
          projects: app.projects || [],
          spoken_languages: app.spokenLanguages,
          has_disability: app.hasDisability,
          disability_info: app.disabilityInfo,
          is_physically_ready: app.isPhysicallyReady,
          referral_info: app.referralInfo,
          status: app.status as VolunteerApplication['status'],
          created_at: app.createdAt.toISOString()
        }));
      },
      (data) => data.volunteerApplications || []
    );
  }

  async getVolunteerApplicationByTelegramId(telegramId: number): Promise<VolunteerApplication | null> {
    return runQuery(
      async () => {
        const app = await prisma.volunteerApplication.findUnique({ where: { telegramId } });
        if (!app) return null;
        return {
          id: app.id,
          telegram_id: Number(app.telegramId),
          language_pref: app.languagePref,
          full_name: app.fullName,
          date_of_birth: app.dateOfBirth || '',
          phone: app.phone,
          projects: app.projects || [],
          spoken_languages: app.spokenLanguages,
          has_disability: app.hasDisability,
          disability_info: app.disabilityInfo,
          is_physically_ready: app.isPhysicallyReady,
          referral_info: app.referralInfo,
          status: app.status as VolunteerApplication['status'],
          created_at: app.createdAt.toISOString()
        };
      },
      (data) => (data.volunteerApplications || []).find((a: any) => Number(a.telegram_id) === telegramId) || null
    );
  }

  async createVolunteerApplication(appData: Omit<VolunteerApplication, 'id' | 'created_at'>): Promise<VolunteerApplication> {
    return runQuery(
      async () => {
        const app = await prisma.volunteerApplication.create({
          data: {
            telegramId:       appData.telegram_id,
            languagePref:     appData.language_pref,
            fullName:         appData.full_name,
            dateOfBirth:      appData.date_of_birth || '',
            phone:            appData.phone,
            projects:         appData.projects || [],
            spokenLanguages:  appData.spoken_languages,
            hasDisability:    appData.has_disability,
            disabilityInfo:   appData.disability_info,
            isPhysicallyReady: appData.is_physically_ready,
            referralInfo:     appData.referral_info,
            status:           appData.status
          }
        });
        return {
          id:                 app.id,
          telegram_id:        Number(app.telegramId),
          language_pref:      app.languagePref,
          full_name:          app.fullName,
          date_of_birth:      app.dateOfBirth || '',
          phone:              app.phone,
          projects:           app.projects || [],
          spoken_languages:   app.spokenLanguages,
          has_disability:     app.hasDisability,
          disability_info:    app.disabilityInfo,
          is_physically_ready: app.isPhysicallyReady,
          referral_info:      app.referralInfo,
          status:             app.status as VolunteerApplication['status'],
          created_at:         app.createdAt.toISOString()
        };
      },
      (data) => {
        const newApp = {
          id: `app_${Date.now()}`,
          ...appData,
          created_at: new Date().toISOString()
        };
        data.volunteerApplications = data.volunteerApplications || [];
        data.volunteerApplications.push(newApp);
        saveFallbackData(data);
        return newApp;
      }
    );
  }

  async updateVolunteerApplication(id: string, updates: Partial<VolunteerApplication>): Promise<VolunteerApplication> {
    return runQuery(
      async () => {
        const data: any = {};
        if (updates.status !== undefined) data.status = updates.status;
        const app = await prisma.volunteerApplication.update({
          where: { id },
          data
        });
        return {
          id: app.id,
          telegram_id: Number(app.telegramId),
          language_pref: app.languagePref,
          full_name: app.fullName,
          date_of_birth: app.dateOfBirth,
          phone: app.phone,
          spoken_languages: app.spokenLanguages,
          has_disability: app.hasDisability,
          disability_info: app.disabilityInfo,
          is_physically_ready: app.isPhysicallyReady,
          status: app.status as VolunteerApplication['status'],
          created_at: app.createdAt.toISOString()
        };
      },
      (data) => {
        const index = (data.volunteerApplications || []).findIndex((a: any) => a.id === id);
        if (index !== -1) {
          data.volunteerApplications[index] = { ...data.volunteerApplications[index], ...updates };
          saveFallbackData(data);
          return data.volunteerApplications[index];
        }
        throw new Error('Application not found');
      }
    );
  }
  // Templates
  async getCertificateTemplates(): Promise<CertificateTemplate[]> {
    return runQuery(
      async () => {
        const items = await prisma.certificateTemplate.findMany({ orderBy: { createdAt: 'desc' } });
        return items.map(mapCertificateTemplate);
      },
      (data) => {
        return (data.certificate_templates || []).map(mapCertificateTemplate);
      }
    );
  }

  async getCertificateTemplate(id: string): Promise<CertificateTemplate | null> {
    return runQuery(
      async () => {
        const item = await prisma.certificateTemplate.findUnique({ where: { id } });
        return item ? mapCertificateTemplate(item) : null;
      },
      (data) => {
        const item = (data.certificate_templates || []).find((t: any) => t.id === id);
        return item ? mapCertificateTemplate(item) : null;
      }
    );
  }

  async createCertificateTemplate(templateData: Omit<CertificateTemplate, 'id' | 'createdAt'>): Promise<CertificateTemplate> {
    return runQuery(
      async () => {
        const item = await prisma.certificateTemplate.create({
          data: {
            name: templateData.name,
            title: templateData.title,
            bodyText: templateData.bodyText,
            signature: templateData.signature,
            primaryColor: templateData.primaryColor,
            accentColor: templateData.accentColor,
            orgId: templateData.orgId
          }
        });
        return mapCertificateTemplate(item);
      },
      (data) => {
        const newItem = {
          id: Date.now().toString(),
          ...templateData,
          createdAt: new Date()
        };
        data.certificate_templates = data.certificate_templates || [];
        data.certificate_templates.push(newItem);
        saveFallbackData(data);
        return mapCertificateTemplate(newItem);
      }
    );
  }

  async updateCertificateTemplate(id: string, templateData: Partial<CertificateTemplate>): Promise<CertificateTemplate> {
    return runQuery(
      async () => {
        const item = await prisma.certificateTemplate.update({
          where: { id },
          data: templateData
        });
        return mapCertificateTemplate(item);
      },
      (data) => {
        const idx = (data.certificate_templates || []).findIndex((t: any) => t.id === id);
        if (idx !== -1) {
          data.certificate_templates[idx] = { ...data.certificate_templates[idx], ...templateData };
          saveFallbackData(data);
          return mapCertificateTemplate(data.certificate_templates[idx]);
        }
        throw new Error('Template not found');
      }
    );
  }

  async deleteCertificateTemplate(id: string): Promise<void> {
    return runQuery(
      async () => {
        await prisma.certificateTemplate.delete({ where: { id } });
      },
      (data) => {
        if (data.certificate_templates) {
          data.certificate_templates = data.certificate_templates.filter((t: any) => t.id !== id);
          saveFallbackData(data);
        }
      }
    );
  }

  // Awards
  async createAward(awardData: Omit<Award, 'id' | 'issuedAt'>): Promise<Award> {
    return runQuery(
      async () => {
        const item = await prisma.award.create({
          data: {
            templateId: awardData.templateId,
            volunteerId: awardData.volunteerId,
            projectId: awardData.projectId,
            issuedBy: awardData.issuedBy
          }
        });
        return mapAward(item);
      },
      (data) => {
        const newItem = {
          id: Date.now().toString(),
          ...awardData,
          issuedAt: new Date()
        };
        data.awards = data.awards || [];
        data.awards.push(newItem);
        saveFallbackData(data);
        return mapAward(newItem);
      }
    );
  }
}

export const db = new PrismaDBAdapter();
