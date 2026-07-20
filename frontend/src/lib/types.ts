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
