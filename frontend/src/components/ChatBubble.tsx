import { ChatMessageDTO } from "@/lib/types";

export function ChatBubble({ message }: { message: ChatMessageDTO }) {
  const isUser = message.role === "USER";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-base ${
          isUser
            ? "bg-accent text-accent-contrast rounded-br-sm"
            : "bg-surface-raised border border-border text-ink rounded-bl-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
