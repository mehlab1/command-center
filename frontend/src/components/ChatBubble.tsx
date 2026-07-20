import { ChatMessageDTO } from "@/lib/types";
import { APP_TIMEZONE } from "@/lib/dateFormat";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" });
}

export function ChatBubble({ message }: { message: ChatMessageDTO }) {
  if (message.role === "USER") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg rounded-br-sm bg-signal text-signal-contrast px-3.5 py-2.5 text-base shadow-[0_2px_0_0_var(--signal-shadow)]">
          {message.content}
        </div>
      </div>
    );
  }

  // Agent messages render as a console line, not a second bubble color —
  // "you" vs "the system" the way a terminal distinguishes input from
  // output (DESIGN_TOKENS.md signature element notes).
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] border-l-2 border-signal pl-3 py-0.5">
        <p className="font-heading text-xs text-text-muted">
          agent · {formatTime(message.createdAt)}
        </p>
        <p className="text-base text-text mt-0.5">{message.content}</p>
      </div>
    </div>
  );
}
