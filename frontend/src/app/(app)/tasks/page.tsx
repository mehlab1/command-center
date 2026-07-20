// Minimal, functional-not-polished per Phase 3 — enough to verify task state
// changes visually. Full dashboard polish is Phase 4.
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { StatusTag } from "@/components/StatusTag";
import { TaskDTO, TaskStatus } from "@/lib/types";

const COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];

function TaskRow({ task }: { task: TaskDTO }) {
  const who = task.isPersonal ? "personal" : task.assignees.map((a) => a.dev.name).join(", ") || "unassigned";
  const overdue = task.status !== "DONE" && new Date(task.deadline) < new Date();

  return (
    <div className="rounded-md border border-line bg-paper p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <StatusTag kind={task.status} />
        {task.needsQa && (
          <span className="text-xs text-text-muted">
            {task.qaQueueEntry ? `QA: ${task.qaQueueEntry.status}` : "QA required"}
          </span>
        )}
      </div>
      <p className="text-sm text-text font-medium">{task.title}</p>
      <p className={`text-xs ${overdue ? "text-blocked" : "text-text-muted"}`}>
        {who} · due {new Date(task.deadline).toLocaleDateString()}
        {task.project ? ` · ${task.project.name}` : ""}
        {overdue ? " · overdue" : ""}
      </p>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskDTO[] | null>(null);
  const [view, setView] = useState<"kanban" | "table">("kanban");

  useEffect(() => {
    apiFetch("/api/tasks")
      .then((res) => (res.ok ? res.json() : []))
      .then(setTasks);
  }, []);

  return (
    <div className="flex-1 p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-heading text-xl text-text">Tasks</h1>
        <div className="flex rounded-sm border border-line overflow-hidden">
          <button
            onClick={() => setView("kanban")}
            className={`px-3 py-1.5 text-xs font-heading ${view === "kanban" ? "bg-signal text-signal-contrast" : "text-text-muted"}`}
          >
            BOARD
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1.5 text-xs font-heading ${view === "table" ? "bg-signal text-signal-contrast" : "text-text-muted"}`}
          >
            LIST
          </button>
        </div>
      </div>

      {tasks === null && <p className="text-sm text-text-muted">Loading…</p>}
      {tasks?.length === 0 && (
        <p className="text-sm text-text-muted">No tasks yet — tell the agent about your first one.</p>
      )}

      {tasks && tasks.length > 0 && view === "table" && (
        <div className="flex flex-col gap-2">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      )}

      {tasks && tasks.length > 0 && view === "kanban" && (
        <div className="flex flex-col gap-4">
          {COLUMNS.map((status) => {
            const inColumn = tasks.filter((t) => t.status === status);
            if (inColumn.length === 0) return null;
            return (
              <div key={status}>
                <div className="mb-1.5">
                  <StatusTag kind={status} />
                </div>
                <div className="flex flex-col gap-2">
                  {inColumn.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
