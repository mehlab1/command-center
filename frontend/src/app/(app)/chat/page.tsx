"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ChatMessageDTO, ChatSendResult, PendingActionDTO } from "@/lib/types";
import { ChatBubble } from "@/components/ChatBubble";
import { ConfirmationCard } from "@/components/ConfirmationCard";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [pending, setPending] = useState<PendingActionDTO | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const [historyRes, pendingRes] = await Promise.all([
        apiFetch("/api/chat/messages", { onSlow: () => setWaking(true) }),
        apiFetch("/api/chat/pending"),
      ]);
      if (historyRes.ok) setMessages(await historyRes.json());
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPending(data ?? null);
      }
      setWaking(false);
      setLoaded(true);
    }
    load();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const content = inputValue.trim();
    if (!content || sending) return;

    setInputValue("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "USER", content, createdAt: new Date().toISOString() },
    ]);
    setSending(true);

    try {
      const res = await apiFetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        onSlow: () => setWaking(true),
      });

      if (!res.ok) throw new Error("request failed");
      const data: ChatSendResult = await res.json();

      if (data.type === "confirm") {
        setPending({ id: data.pendingActionId, toolName: "", summary: data.message, createdAt: new Date().toISOString() });
      } else {
        setMessages((prev) => [
          ...prev,
          { id: `local-agent-${Date.now()}`, role: "AGENT", content: data.message, createdAt: new Date().toISOString() },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-error-${Date.now()}`,
          role: "AGENT",
          content: "Something went wrong reaching the agent. Try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      setWaking(false);
    }
  }

  async function handleConfirm() {
    if (!pending) return;
    setConfirmBusy(true);
    try {
      const res = await apiFetch("/api/chat/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingActionId: pending.id }),
      });
      const data = res.ok ? await res.json() : null;
      setMessages((prev) => [
        ...prev,
        {
          id: `local-confirm-${Date.now()}`,
          role: "AGENT",
          content: data?.message ?? "That confirmation already expired.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setPending(null);
      setConfirmBusy(false);
    }
  }

  async function handleCancel() {
    if (!pending) return;
    setConfirmBusy(true);
    try {
      await apiFetch("/api/chat/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingActionId: pending.id }),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `local-cancel-${Date.now()}`,
          role: "AGENT",
          content: "Okay, cancelled — nothing was changed.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setPending(null);
      setConfirmBusy(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {loaded && messages.length === 0 && !pending && (
          <p className="text-sm text-text-muted text-center mt-8">
            No messages yet — tell the agent about a project, dev, or pod to get started.
          </p>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
        {pending && (
          <ConfirmationCard
            summary={pending.summary}
            busy={confirmBusy}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        )}
        {waking && (
          <p className="text-sm text-text-muted text-center">
            Waking things up — this happens after a bit of inactivity, just a few more seconds.
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="sticky bottom-16 bg-ink border-t border-line px-3 py-2.5 flex gap-2"
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Message the agent…"
          disabled={sending || !!pending}
          className="flex-1 rounded-sm border border-line bg-paper px-3 py-2.5 text-base text-text outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:border-signal disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={sending || !inputValue.trim() || !!pending}
          className="btn-tactile btn-tactile-signal rounded-sm bg-signal text-signal-contrast font-semibold px-4 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}
