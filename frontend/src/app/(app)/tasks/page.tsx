// Board/list toggle functional since Phase 3; filter + sort added in Phase 4
// per docs/phases/phase-4-dashboard.md task 3.
"use client";

import { useMemo, useState } from "react";
import { useTasks, useDevs } from "@/lib/queries";
import { useColdStartBanner } from "@/lib/useColdStartBanner";
import { StatusTag } from "@/components/StatusTag";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { TaskDTO, TaskStatus } from "@/lib/types";
import { formatDeadline } from "@/lib/dateFormat";

const COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];
type SortKey = "deadline" | "status";

function TaskRow({ task }: { task: TaskDTO }) {
  const who = task.isPersonal ? "personal" : task.assignees.map((a) => a.dev.name).join(", ") || "unassigned";
  const overdue = task.status !== "DONE" && new Date(task.deadline) < new Date();

  return (
    <a href={`/tasks/${task.id}`} className="block rounded-md border border-line bg-paper p-3 flex flex-col gap-1.5">
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
        {who} · due {formatDeadline(task.deadline)}
        {task.project ? ` · ${task.project.name}` : ""}
        {overdue ? " · overdue" : ""}
      </p>
    </a>
  );
}

export default function TasksPage() {
  const tasksQuery = useTasks();
  const devsQuery = useDevs();
  const waking = useColdStartBanner([tasksQuery, devsQuery]);

  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("deadline");
  const [creating, setCreating] = useState(false);

  const tasks = tasksQuery.data;
  const devs = devsQuery.data;

  const filtered = useMemo(() => {
    if (!tasks) return [];
    let result = tasks;
    if (assigneeFilter === "personal") {
      result = result.filter((t) => t.isPersonal);
    } else if (assigneeFilter !== "all") {
      result = result.filter((t) => t.assignees.some((a) => a.dev.id === assigneeFilter));
    }
    return [...result].sort((a, b) => {
      if (sortKey === "deadline") return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      return COLUMNS.indexOf(a.status) - COLUMNS.indexOf(b.status);
    });
  }, [tasks, assigneeFilter, sortKey]);

  return (
    <div className="flex-1 p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h1 className="font-heading text-xl text-text">Tasks</h1>
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => setCreating(true)}
            className="btn-tactile btn-tactile-signal rounded-sm bg-signal text-signal-contrast px-3 py-1.5 text-xs font-semibold"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="flex-1 rounded-sm border border-line bg-paper px-2 py-1.5 text-xs text-text"
        >
          <option value="all">All assignees</option>
          <option value="personal">Personal</option>
          {devs?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-sm border border-line bg-paper px-2 py-1.5 text-xs text-text"
        >
          <option value="deadline">Sort: deadline</option>
          <option value="status">Sort: status</option>
        </select>
      </div>

      {waking && (
        <p role="status" className="text-sm text-text-muted mb-2">
          Waking things up — this happens after a bit of inactivity, just a few more seconds.
        </p>
      )}

      {tasksQuery.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
      {tasks?.length === 0 && (
        <p className="text-sm text-text-muted">No tasks yet — tell the agent about your first one.</p>
      )}
      {tasks && tasks.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-text-muted">No tasks match this filter.</p>
      )}

      {filtered.length > 0 && view === "table" && (
        <div className="flex flex-col gap-2">
          {filtered.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      )}

      {filtered.length > 0 && view === "kanban" && (
        <div className="flex flex-col gap-4">
          {COLUMNS.map((status) => {
            const inColumn = filtered.filter((t) => t.status === status);
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

      {creating && <CreateTaskModal onClose={() => setCreating(false)} onCreated={() => setCreating(false)} />}
    </div>
  );
}
