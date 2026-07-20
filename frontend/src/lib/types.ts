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
  status: TaskStatus;
  deadline: string;
  isPersonal: boolean;
  needsQa: boolean;
  missedDeadline: boolean | null;
  assignees: { dev: { id: string; name: string } }[];
  project: { id: string; name: string } | null;
  qaQueueEntry: { status: "UNASSIGNED" | "ASSIGNED" | "PASSED" | "SENT_BACK" } | null;
}
