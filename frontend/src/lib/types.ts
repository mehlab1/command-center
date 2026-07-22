export interface ChatMessageDTO {
  id: string;
  role: "USER" | "AGENT";
  content: string;
  createdAt: string;
}

export type ChatSendResult =
  | { type: "message"; message: string }
  | { type: "confirm"; message: string; pendingActionId: string };

export interface PendingActionDTO {
  id: string;
  toolName: string;
  summary: string;
  createdAt: string;
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";

export interface TaskDTO {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: TaskStatus;
  deadline: string;
  isPersonal: boolean;
  needsQa: boolean;
  missedDeadline: boolean | null;
  blockerDescription: string | null;
  revisedDeadline: string | null;
  rating: number | null;
  completedAt: string | null;
  assignees: { dev: { id: string; name: string } }[];
  project: { id: string; name: string } | null;
  qaQueueEntry: { status: "UNASSIGNED" | "ASSIGNED" | "PASSED" | "SENT_BACK" } | null;
}

export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

export interface ProjectDTO {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: ProjectStatus;
  deadline: string | null;
  taskCount: number;
  assignedTaskCount: number;
}

export interface DevDTO {
  id: string;
  name: string;
  designation: string | null;
  employmentType: "PERMANENT" | "INTERN";
  podId: string | null;
  isLead: boolean;
  isAssigned: boolean;
  openTaskCount: number;
}

export interface PodDTO {
  id: string;
  name: string;
  leadDevId: string;
  lead: DevDTO;
  members: DevDTO[];
}

export type QaStatus = "UNASSIGNED" | "ASSIGNED" | "PASSED" | "SENT_BACK";

export interface QaEntryDTO {
  id: string;
  status: QaStatus;
  outcomeNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  task: { id: string; title: string; deadline: string };
  suggestedReviewer: { id: string; name: string } | null;
  assignedReviewer: { id: string; name: string } | null;
}

export interface DeadlineRadarItem {
  kind: "task" | "project";
  id: string;
  title: string;
  deadline: string;
}

export interface DeadlineRadarDTO {
  overdue: DeadlineRadarItem[];
  dueWithin1h: DeadlineRadarItem[];
  dueWithin24h: DeadlineRadarItem[];
}

export interface DevPerformanceDTO {
  devId: string;
  devName: string;
  avgRating: number | null;
  onTimePercent: number | null;
  history: { rating: number; onTime: boolean; createdAt: string; taskTitle: string }[];
}

export type WhatsAppTargetType = "number" | "group";

export interface SettingsDTO {
  dailyDigestTime: string;
  whatsappTargetType: WhatsAppTargetType;
  whatsappCountryCode: string;
  whatsappLocalNumber: string;
  whatsappGroupId: string | null;
  whatsappGroupName: string | null;
}

export interface WhatsAppGroupMatchDTO {
  id: string;
  name: string;
  score: number;
}

export type ReminderOccurrenceStatus = "SCHEDULED" | "SENT" | "CANCELLED";

export interface ReminderDTO {
  id: string;
  message: string;
  channel: "PUSH" | "WHATSAPP";
  linkedTaskId: string | null;
  linkedProjectId: string | null;
  occurrences: { id: string; fireTime: string; status: ReminderOccurrenceStatus }[];
}

export interface VaultItemDTO {
  id: string;
  name: string;
  folder: string | null;
  tags: string[];
  notes: string | null;
  hasSecret: boolean;
  fileName: string | null;
  fileMimeType: string | null;
  createdAt: string;
  updatedAt: string;
}
