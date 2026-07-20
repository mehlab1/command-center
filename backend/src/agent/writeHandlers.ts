import { resolveEntity, ResolutionResult, EntityType } from "./disambiguation";
import { checkDeleteDev, getDevById } from "../services/devService";
import { checkDeleteProject } from "../services/projectService";
import { getPodLedBy } from "../services/podService";
import { getTaskById } from "../services/taskService";
import { assertRatable, NotRatableError } from "../services/ratingService";
import { getVaultItemById } from "../services/vaultService";
import { listScheduledOccurrencesForTask, findCancellableRemindersByQuery } from "../services/reminderService";
import { isValidDigestTime, isValidWhatsAppNumber } from "../services/settingsService";
import { prisma } from "../lib/prisma";
import { formatDeadline } from "../lib/dateFormat";

// See PendingClarification in schema.prisma for why this exists.
async function setPendingClarification(taskId: string, field: string): Promise<void> {
  await prisma.pendingClarification.deleteMany({ where: { taskId, field } });
  await prisma.pendingClarification.create({ data: { taskId, field } });
}

async function consumePendingClarification(taskId: string, field: string): Promise<boolean> {
  const row = await prisma.pendingClarification.findFirst({ where: { taskId, field } });
  if (!row) return false;
  await prisma.pendingClarification.delete({ where: { id: row.id } });
  return true;
}

// Defense in depth: the tool schema declares these as enums, but a malformed
// LLM output would otherwise reach Prisma as a raw, unhandled enum-mismatch
// error instead of a clear message.
const PROJECT_STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];
const EMPLOYMENT_TYPES = ["PERMANENT", "INTERN"];

export type PrepareResult =
  | { status: "need_field"; message: string }
  | { status: "unresolved"; message: string }
  | { status: "ready"; resolvedArgs: Record<string, unknown>; summary: string };

type UnresolvedResult = Exclude<ResolutionResult, { status: "resolved" }>;

function describeUnresolved(result: UnresolvedResult, label: string, query: string): string {
  if (result.status === "not_found") {
    return `I couldn't find a ${label} matching "${query}". Can you check the name?`;
  }
  const names = result.candidates.map((c) => c.name).join(", ");
  return `That could match more than one ${label}: ${names}. Which one did you mean?`;
}

async function resolveOrNull(
  query: string | undefined,
  type: EntityType,
  label: string
): Promise<{ id: string; name: string } | { error: string } | undefined> {
  if (!query) return undefined;
  const result = await resolveEntity(query, type);
  if (result.status === "resolved") return { id: result.id, name: result.name };
  return { error: describeUnresolved(result, label, query) };
}

export async function prepareCreateProject(args: Record<string, unknown>): Promise<PrepareResult> {
  const name = args.name as string | undefined;
  if (!name) return { status: "need_field", message: "What should the project be called?" };

  const deadline = args.deadline as string | undefined;
  const summary = `Create project "${name}"${args.category ? ` (${args.category})` : ""}${deadline ? `, deadline ${formatDeadline(deadline)}` : ""}.`;
  return {
    status: "ready",
    resolvedArgs: { name, description: args.description, category: args.category, deadline },
    summary,
  };
}

export async function prepareEditProject(args: Record<string, unknown>): Promise<PrepareResult> {
  const query = args.project_query as string | undefined;
  if (!query) return { status: "need_field", message: "Which project do you want to edit?" };

  const resolved = await resolveOrNull(query, "project", "project");
  if (resolved && "error" in resolved) return { status: "unresolved", message: resolved.error };
  if (!resolved) return { status: "unresolved", message: "Which project do you want to edit?" };

  if (args.status && !PROJECT_STATUSES.includes(args.status as string)) {
    return {
      status: "need_field",
      message: `Status has to be one of ${PROJECT_STATUSES.join(", ")} — which did you mean?`,
    };
  }

  const changes: string[] = [];
  if (args.name) changes.push(`name → "${args.name}"`);
  if (args.status) changes.push(`status → ${args.status}`);
  if (args.deadline) changes.push(`deadline → ${formatDeadline(args.deadline as string)}`);
  if (args.description) changes.push("description updated");
  if (args.category) changes.push(`category → "${args.category}"`);

  if (changes.length === 0) {
    return { status: "need_field", message: "What would you like to change on that project?" };
  }

  return {
    status: "ready",
    resolvedArgs: {
      id: resolved.id,
      name: args.name,
      description: args.description,
      category: args.category,
      status: args.status,
      deadline: args.deadline,
    },
    summary: `Edit project "${resolved.name}": ${changes.join(", ")}.`,
  };
}

export async function prepareDeleteProject(args: Record<string, unknown>): Promise<PrepareResult> {
  const query = args.project_query as string | undefined;
  if (!query) return { status: "need_field", message: "Which project do you want to delete?" };

  const resolved = await resolveOrNull(query, "project", "project");
  if (resolved && "error" in resolved) return { status: "unresolved", message: resolved.error };
  if (!resolved) return { status: "unresolved", message: "Which project do you want to delete?" };

  if (typeof args.cascade_tasks !== "boolean") {
    const { taskCount } = await checkDeleteProject(resolved.id);
    return {
      status: "need_field",
      message:
        taskCount > 0
          ? `"${resolved.name}" has ${taskCount} task(s). Delete the project and all its tasks, or keep the tasks and just unlink them from the project?`
          : `Delete the project "${resolved.name}"? (It has no tasks, so this only affects the project itself.)`,
    };
  }

  const { taskCount } = await checkDeleteProject(resolved.id);
  const summary = args.cascade_tasks
    ? `Delete project "${resolved.name}" AND its ${taskCount} task(s).`
    : `Delete project "${resolved.name}", keeping its ${taskCount} task(s) as standalone (unlinked).`;

  return {
    status: "ready",
    resolvedArgs: { id: resolved.id, cascadeTasks: args.cascade_tasks },
    summary,
  };
}

export async function prepareCreateDev(args: Record<string, unknown>): Promise<PrepareResult> {
  const name = args.name as string | undefined;
  const employmentType = args.employment_type as string | undefined;
  if (!name) return { status: "need_field", message: "What's the dev's name?" };
  if (!employmentType) {
    return { status: "need_field", message: "Is this dev permanent or an intern?" };
  }
  if (!EMPLOYMENT_TYPES.includes(employmentType)) {
    return { status: "need_field", message: "Is this dev permanent or an intern?" };
  }

  const summary = `Add dev "${name}"${args.designation ? `, ${args.designation}` : ""} (${employmentType}).`;
  return {
    status: "ready",
    resolvedArgs: {
      name,
      designation: args.designation,
      employmentType,
      internshipEndDate: args.internship_end_date,
    },
    summary,
  };
}

export async function prepareEditDev(args: Record<string, unknown>): Promise<PrepareResult> {
  const query = args.dev_query as string | undefined;
  if (!query) return { status: "need_field", message: "Which dev do you want to edit?" };

  const resolved = await resolveOrNull(query, "dev", "dev");
  if (resolved && "error" in resolved) return { status: "unresolved", message: resolved.error };
  if (!resolved) return { status: "unresolved", message: "Which dev do you want to edit?" };

  if (args.employment_type && !EMPLOYMENT_TYPES.includes(args.employment_type as string)) {
    return { status: "need_field", message: "Is this dev permanent or an intern?" };
  }

  const changes: string[] = [];
  if (args.name) changes.push(`name → "${args.name}"`);
  if (args.designation) changes.push(`designation → "${args.designation}"`);
  if (args.employment_type) changes.push(`employment type → ${args.employment_type}`);
  if (args.internship_end_date) changes.push(`internship end date → ${args.internship_end_date}`);

  if (changes.length === 0) {
    return { status: "need_field", message: "What would you like to change on that dev?" };
  }

  return {
    status: "ready",
    resolvedArgs: {
      id: resolved.id,
      name: args.name,
      designation: args.designation,
      employmentType: args.employment_type,
      internshipEndDate: args.internship_end_date,
    },
    summary: `Edit dev "${resolved.name}": ${changes.join(", ")}.`,
  };
}

export async function prepareDeleteDev(args: Record<string, unknown>): Promise<PrepareResult> {
  const query = args.dev_query as string | undefined;
  if (!query) return { status: "need_field", message: "Which dev do you want to delete?" };

  const resolved = await resolveOrNull(query, "dev", "dev");
  if (resolved && "error" in resolved) return { status: "unresolved", message: resolved.error };
  if (!resolved) return { status: "unresolved", message: "Which dev do you want to delete?" };

  const { openTaskCount, ratingsHistoryCount, ledPodNames } = await checkDeleteDev(resolved.id);

  // Hard blocks — a pod always needs exactly one lead, and rating history is
  // deliberately never destroyed by a dev deletion (see schema.prisma).
  // Neither has an "acknowledge and proceed anyway" path.
  if (ledPodNames.length > 0) {
    return {
      status: "unresolved",
      message: `"${resolved.name}" leads ${ledPodNames.length > 1 ? "pods" : "pod"} ${ledPodNames.join(", ")} — reassign the lead first (e.g. "make someone else the lead of ${ledPodNames[0]}"), then delete ${resolved.name}.`,
    };
  }
  if (ratingsHistoryCount > 0) {
    return {
      status: "unresolved",
      message: `"${resolved.name}" has ${ratingsHistoryCount} rating(s) on record. Deleting them would also require deciding what happens to that history, which isn't supported from chat — this needs a manual decision, not something to do casually.`,
    };
  }

  if (openTaskCount > 0 && args.acknowledged_open_tasks !== true) {
    return {
      status: "need_field",
      message: `"${resolved.name}" has ${openTaskCount} open task(s) assigned. Delete anyway? Those tasks will lose this assignee (they'll stay as-is otherwise, just unassigned from ${resolved.name}).`,
    };
  }

  return {
    status: "ready",
    resolvedArgs: { id: resolved.id },
    summary: `Delete dev "${resolved.name}".${openTaskCount > 0 ? ` (${openTaskCount} open task(s) will lose this assignee.)` : ""}`,
  };
}

export async function prepareReassignDevPod(args: Record<string, unknown>): Promise<PrepareResult> {
  const devQuery = args.dev_query as string | undefined;
  const podQuery = args.pod_query as string | undefined;
  if (!devQuery) return { status: "need_field", message: "Which dev do you want to move?" };
  if (!podQuery) return { status: "need_field", message: "Which pod should they move to?" };

  const dev = await resolveOrNull(devQuery, "dev", "dev");
  if (dev && "error" in dev) return { status: "unresolved", message: dev.error };
  const pod = await resolveOrNull(podQuery, "pod", "pod");
  if (pod && "error" in pod) return { status: "unresolved", message: pod.error };
  if (!dev || !pod) return { status: "unresolved", message: "I need both a dev and a pod to do this." };

  return {
    status: "ready",
    resolvedArgs: { devId: dev.id, podId: pod.id },
    summary: `Move ${dev.name} to ${pod.name}.`,
  };
}

export async function prepareCreatePod(args: Record<string, unknown>): Promise<PrepareResult> {
  const name = args.name as string | undefined;
  const leadQuery = args.lead_dev_query as string | undefined;
  if (!name) return { status: "need_field", message: "What should the pod be called?" };
  if (!leadQuery) return { status: "need_field", message: "Who's leading this pod?" };

  const lead = await resolveOrNull(leadQuery, "dev", "dev");
  if (lead && "error" in lead) return { status: "unresolved", message: lead.error };
  if (!lead) return { status: "unresolved", message: "Who's leading this pod?" };

  const existingLead = await getPodLedBy(lead.id);
  if (existingLead) {
    return {
      status: "unresolved",
      message: `${lead.name} already leads pod "${existingLead.name}" — a dev can only lead one pod at a time. Reassign them off that pod first if you want them to lead a new one.`,
    };
  }

  return {
    status: "ready",
    resolvedArgs: { name, leadDevId: lead.id },
    summary: `Create pod "${name}" led by ${lead.name}.`,
  };
}

export async function prepareEditPod(args: Record<string, unknown>): Promise<PrepareResult> {
  const query = args.pod_query as string | undefined;
  const name = args.name as string | undefined;
  if (!query) return { status: "need_field", message: "Which pod do you want to rename?" };
  if (!name) return { status: "need_field", message: "What should the new name be?" };

  const pod = await resolveOrNull(query, "pod", "pod");
  if (pod && "error" in pod) return { status: "unresolved", message: pod.error };
  if (!pod) return { status: "unresolved", message: "Which pod do you want to rename?" };

  return {
    status: "ready",
    resolvedArgs: { id: pod.id, name },
    summary: `Rename pod "${pod.name}" to "${name}".`,
  };
}

export async function prepareReassignPodLead(args: Record<string, unknown>): Promise<PrepareResult> {
  const podQuery = args.pod_query as string | undefined;
  const newLeadQuery = args.new_lead_dev_query as string | undefined;
  if (!podQuery) return { status: "need_field", message: "Which pod's lead do you want to change?" };
  if (!newLeadQuery) return { status: "need_field", message: "Who should the new lead be?" };

  const pod = await resolveOrNull(podQuery, "pod", "pod");
  if (pod && "error" in pod) return { status: "unresolved", message: pod.error };
  const newLead = await resolveOrNull(newLeadQuery, "dev", "dev");
  if (newLead && "error" in newLead) return { status: "unresolved", message: newLead.error };
  if (!pod || !newLead) return { status: "unresolved", message: "I need both the pod and the new lead's name." };

  const existingLead = await getPodLedBy(newLead.id);
  if (existingLead && existingLead.id !== pod.id) {
    return {
      status: "unresolved",
      message: `${newLead.name} already leads pod "${existingLead.name}" — a dev can only lead one pod at a time. Reassign them off that pod first.`,
    };
  }

  return {
    status: "ready",
    resolvedArgs: { podId: pod.id, newLeadDevId: newLead.id },
    summary: `Make ${newLead.name} the lead of ${pod.name}.`,
  };
}

export async function prepareCreateTask(args: Record<string, unknown>): Promise<PrepareResult> {
  const title = args.title as string | undefined;
  const deadline = args.deadline as string | undefined;
  const needsQa = args.needs_qa;
  if (!title) return { status: "need_field", message: "What should the task be called?" };
  if (!deadline) return { status: "need_field", message: "What's the deadline for this task?" };
  if (typeof needsQa !== "boolean") {
    return { status: "need_field", message: "Does this task need a QA review before it's considered fully done?" };
  }

  const isPersonal = args.is_personal === true;
  const assigneeQueries = Array.isArray(args.assignee_dev_queries)
    ? (args.assignee_dev_queries as string[]).filter(Boolean)
    : [];

  if (!isPersonal && assigneeQueries.length === 0) {
    return {
      status: "need_field",
      message: "Who is this task for — a specific dev, or is this personal (just for you)?",
    };
  }

  const assignees: { id: string; name: string }[] = [];
  if (!isPersonal) {
    for (const q of assigneeQueries) {
      const resolved = await resolveOrNull(q, "dev", "dev");
      if (resolved && "error" in resolved) return { status: "unresolved", message: resolved.error };
      if (resolved) assignees.push(resolved);
    }
  }

  const project = await resolveOrNull(args.project_query as string | undefined, "project", "project");
  if (project && "error" in project) return { status: "unresolved", message: project.error };

  const who = isPersonal ? "personal" : assignees.map((a) => a.name).join(", ");
  const summary = `Create task "${title}" (${who}), due ${formatDeadline(deadline)}${
    project ? ` in ${project.name}` : ""
  }${needsQa ? ", needs QA" : ""}.`;

  return {
    status: "ready",
    resolvedArgs: {
      title,
      description: args.description,
      notes: args.notes,
      projectId: project?.id,
      isPersonal,
      assigneeDevIds: assignees.map((a) => a.id),
      deadline,
      needsQa,
    },
    summary,
  };
}

export async function prepareDeleteTask(args: Record<string, unknown>): Promise<PrepareResult> {
  const query = args.task_query as string | undefined;
  if (!query) return { status: "need_field", message: "Which task do you want to delete?" };

  const resolved = await resolveOrNull(query, "task", "task");
  if (resolved && "error" in resolved) return { status: "unresolved", message: resolved.error };
  if (!resolved) return { status: "unresolved", message: "Which task do you want to delete?" };

  return {
    status: "ready",
    resolvedArgs: { id: resolved.id },
    summary: `Delete task "${resolved.name}".`,
  };
}

export async function prepareMarkTaskBlocked(args: Record<string, unknown>): Promise<PrepareResult> {
  const query = args.task_query as string | undefined;
  if (!query) return { status: "need_field", message: "Which task is blocked?" };

  const resolved = await resolveOrNull(query, "task", "task");
  if (resolved && "error" in resolved) return { status: "unresolved", message: resolved.error };
  if (!resolved) return { status: "unresolved", message: "Which task is blocked?" };

  const blockerDescription = args.blocker_description as string | undefined;
  const revisedDeadline = args.revised_deadline as string | undefined;
  if (!blockerDescription || !revisedDeadline) {
    return {
      status: "need_field",
      message: "Marking a task blocked needs both what's blocking it and a revised deadline — what are those?",
    };
  }

  return {
    status: "ready",
    resolvedArgs: { id: resolved.id, blockerDescription, revisedDeadline },
    summary: `Mark "${resolved.name}" blocked: ${blockerDescription} (revised deadline ${formatDeadline(revisedDeadline)}).`,
  };
}

export async function prepareMarkTaskDone(args: Record<string, unknown>): Promise<PrepareResult> {
  const query = args.task_query as string | undefined;
  if (!query) return { status: "need_field", message: "Which task is done?" };

  const resolved = await resolveEntity(query, "task");
  if (resolved.status !== "resolved") return { status: "unresolved", message: describeUnresolved(resolved, "task", query) };

  const task = await getTaskById(resolved.id);
  if (!task) return { status: "unresolved", message: "Which task is done?" };

  const isLate = new Date() > task.deadline;
  let missedDeadline = false;
  let deadlineNote = "on time";

  if (isLate) {
    // Deterministic guard, not just a tool-description request: only trust a
    // missed_deadline value if the system actually asked this question for
    // THIS task and hasn't gotten an answer yet — otherwise the model can
    // pattern-match a boolean from an unrelated prior exchange in history and
    // skip asking (observed in testing). docs/03-agent-and-llm.md: never left
    // to LLM judgment alone.
    const wasAsked = await consumePendingClarification(task.id, "missed_deadline");
    if (typeof args.missed_deadline !== "boolean" || !wasAsked) {
      await setPendingClarification(task.id, "missed_deadline");
      return {
        status: "need_field",
        message: "This was completed after the deadline — should this count as a missed deadline?",
      };
    }
    missedDeadline = args.missed_deadline;
    deadlineNote = `completed after deadline; missed deadline: ${missedDeadline ? "yes" : "no"}`;
  }

  // Checked only once missed_deadline has resolved either way, so the two
  // questions are asked one at a time rather than both at once
  // (docs/04-workflows.md "task completion interaction").
  const upcoming = await listScheduledOccurrencesForTask(task.id);
  let cancelReminders: boolean | undefined;
  if (upcoming.length > 0) {
    const remindersWereAsked = await consumePendingClarification(task.id, "cancel_reminders");
    if (typeof args.cancel_reminders !== "boolean" || !remindersWereAsked) {
      await setPendingClarification(task.id, "cancel_reminders");
      return {
        status: "need_field",
        message: `This task has ${upcoming.length} upcoming reminder${upcoming.length === 1 ? "" : "s"} — cancel ${upcoming.length === 1 ? "it" : "those"} too?`,
      };
    }
    cancelReminders = args.cancel_reminders;
  }

  const summary = `Mark "${task.title}" done (${deadlineNote})${cancelReminders ? ", cancelling its upcoming reminders" : ""}.`;

  return {
    status: "ready",
    resolvedArgs: { id: task.id, missedDeadline, cancelReminders },
    summary,
  };
}

export async function prepareAssignQaReviewer(args: Record<string, unknown>): Promise<PrepareResult> {
  const taskQuery = args.task_query as string | undefined;
  const reviewerQuery = args.reviewer_dev_query as string | undefined;
  if (!taskQuery) return { status: "need_field", message: "Which task's QA review is this for?" };
  if (!reviewerQuery) return { status: "need_field", message: "Who should review it?" };

  const taskResolved = await resolveOrNull(taskQuery, "task", "task");
  if (taskResolved && "error" in taskResolved) return { status: "unresolved", message: taskResolved.error };
  if (!taskResolved) return { status: "unresolved", message: "Which task's QA review is this for?" };

  const task = await getTaskById(taskResolved.id);
  if (!task?.qaQueueEntry) {
    return { status: "unresolved", message: `"${taskResolved.name}" doesn't have a QA review pending.` };
  }

  const reviewer = await resolveOrNull(reviewerQuery, "dev", "dev");
  if (reviewer && "error" in reviewer) return { status: "unresolved", message: reviewer.error };
  if (!reviewer) return { status: "unresolved", message: "Who should review it?" };

  return {
    status: "ready",
    resolvedArgs: { qaEntryId: task.qaQueueEntry.id, reviewerDevId: reviewer.id },
    summary: `Assign ${reviewer.name} to review "${taskResolved.name}".`,
  };
}

export async function prepareResolveQaEntry(args: Record<string, unknown>): Promise<PrepareResult> {
  const taskQuery = args.task_query as string | undefined;
  const outcome = args.outcome as string | undefined;
  if (!taskQuery) return { status: "need_field", message: "Which task's QA review are you resolving?" };
  if (outcome !== "PASSED" && outcome !== "SENT_BACK") {
    return { status: "need_field", message: "Did it pass QA, or does it need to be sent back?" };
  }

  const taskResolved = await resolveOrNull(taskQuery, "task", "task");
  if (taskResolved && "error" in taskResolved) return { status: "unresolved", message: taskResolved.error };
  if (!taskResolved) return { status: "unresolved", message: "Which task's QA review are you resolving?" };

  const task = await getTaskById(taskResolved.id);
  if (!task?.qaQueueEntry) {
    return { status: "unresolved", message: `"${taskResolved.name}" doesn't have a QA review pending.` };
  }

  const outcomeNotes = args.outcome_notes as string | undefined;
  const summary =
    outcome === "PASSED"
      ? `Mark QA for "${taskResolved.name}" as passed.`
      : `Send "${taskResolved.name}" back from QA${outcomeNotes ? `: ${outcomeNotes}` : ""} — you'll create the replacement task next.`;

  return {
    status: "ready",
    resolvedArgs: { qaEntryId: task.qaQueueEntry.id, taskId: task.id, outcome, outcomeNotes },
    summary,
  };
}

export async function prepareRateTask(args: Record<string, unknown>): Promise<PrepareResult> {
  const taskQuery = args.task_query as string | undefined;
  const rating = args.rating as number | undefined;
  if (!taskQuery) return { status: "need_field", message: "Which task are you rating?" };
  if (!rating || rating < 1 || rating > 5) {
    return { status: "need_field", message: "What rating, 1 to 5?" };
  }

  const taskResolved = await resolveOrNull(taskQuery, "task", "task");
  if (taskResolved && "error" in taskResolved) return { status: "unresolved", message: taskResolved.error };
  if (!taskResolved) return { status: "unresolved", message: "Which task are you rating?" };

  const task = await getTaskById(taskResolved.id);
  if (!task) return { status: "unresolved", message: "Which task are you rating?" };

  try {
    await assertRatable(task.id);
  } catch (err) {
    if (err instanceof NotRatableError) return { status: "unresolved", message: err.message };
    throw err;
  }

  if (task.assignees.length === 0) {
    return {
      status: "unresolved",
      message: "Personal tasks assigned to you aren't rated — ratings track dev performance, not your own work.",
    };
  }

  let devId: string;
  let devName: string;
  const devQuery = args.dev_query as string | undefined;

  if (task.assignees.length === 1) {
    const only = await getDevNameOrFallback(task.assignees[0].devId);
    devId = task.assignees[0].devId;
    devName = only;
  } else if (devQuery) {
    const resolved = await resolveOrNull(devQuery, "dev", "dev");
    if (resolved && "error" in resolved) return { status: "unresolved", message: resolved.error };
    if (!resolved) return { status: "unresolved", message: "Which dev's work are you rating?" };
    if (!task.assignees.some((a) => a.devId === resolved.id)) {
      return { status: "unresolved", message: `${resolved.name} isn't assigned to "${taskResolved.name}".` };
    }
    devId = resolved.id;
    devName = resolved.name;
  } else {
    const names = await Promise.all(task.assignees.map((a) => getDevNameOrFallback(a.devId)));
    return { status: "need_field", message: `Which dev's work are you rating — ${names.join(", ")}?` };
  }

  return {
    status: "ready",
    resolvedArgs: { taskId: task.id, devId, rating },
    summary: `Rate ${devName}'s work on "${taskResolved.name}": ${rating}/5.`,
  };
}

async function getDevNameOrFallback(devId: string): Promise<string> {
  const dev = await getDevById(devId);
  return dev?.name ?? "that dev";
}

function cleanTags(tags: unknown): string[] | undefined {
  if (!Array.isArray(tags)) return undefined;
  return (tags as string[]).filter(Boolean);
}

export async function prepareCreateVaultItemMetadata(args: Record<string, unknown>): Promise<PrepareResult> {
  const name = args.name as string | undefined;
  if (!name) return { status: "need_field", message: "What should this vault entry be called?" };

  const folder = args.folder as string | undefined;
  const tags = cleanTags(args.tags);
  const notes = args.notes as string | undefined;

  const summary = `Add vault entry "${name}"${folder ? ` (${folder})` : ""}. You'll enter the actual secret value next, through the secure widget.`;
  return {
    status: "ready",
    resolvedArgs: { name, folder, tags, notes },
    summary,
  };
}

export async function prepareEditVaultItemMetadata(args: Record<string, unknown>): Promise<PrepareResult> {
  const query = args.vault_item_query as string | undefined;
  if (!query) return { status: "need_field", message: "Which vault entry do you want to edit?" };

  const resolved = await resolveOrNull(query, "vault_item", "vault item");
  if (resolved && "error" in resolved) return { status: "unresolved", message: resolved.error };
  if (!resolved) return { status: "unresolved", message: "Which vault entry do you want to edit?" };

  const tags = cleanTags(args.tags);
  const changes: string[] = [];
  if (args.name) changes.push(`name → "${args.name}"`);
  if (args.folder) changes.push(`folder → "${args.folder}"`);
  if (tags) changes.push(`tags → ${tags.join(", ")}`);
  if (args.notes) changes.push("notes updated");

  if (changes.length === 0) {
    return { status: "need_field", message: "What would you like to change on that vault entry?" };
  }

  return {
    status: "ready",
    resolvedArgs: {
      id: resolved.id,
      name: args.name,
      folder: args.folder,
      tags,
      notes: args.notes,
    },
    summary: `Edit vault entry "${resolved.name}": ${changes.join(", ")}.`,
  };
}

export async function prepareDeleteVaultItem(args: Record<string, unknown>): Promise<PrepareResult> {
  const query = args.vault_item_query as string | undefined;
  if (!query) return { status: "need_field", message: "Which vault entry do you want to delete?" };

  const resolved = await resolveOrNull(query, "vault_item", "vault item");
  if (resolved && "error" in resolved) return { status: "unresolved", message: resolved.error };
  if (!resolved) return { status: "unresolved", message: "Which vault entry do you want to delete?" };

  const item = await getVaultItemById(resolved.id);
  const extra = item?.fileName ? " and its file attachment" : "";

  return {
    status: "ready",
    resolvedArgs: { id: resolved.id },
    summary: `Delete vault entry "${resolved.name}"${extra}.`,
  };
}

const MAX_RECURRING_COUNT = 52;

export async function prepareCreateReminder(args: Record<string, unknown>): Promise<PrepareResult> {
  const taskQuery = args.task_query as string | undefined;
  const projectQuery = args.project_query as string | undefined;

  let linkedTask: { id: string; name: string } | undefined;
  if (taskQuery) {
    const resolved = await resolveOrNull(taskQuery, "task", "task");
    if (resolved && "error" in resolved) return { status: "unresolved", message: resolved.error };
    if (!resolved) return { status: "unresolved", message: "Which task should this be linked to?" };
    linkedTask = resolved;
  }

  let linkedProject: { id: string; name: string } | undefined;
  if (projectQuery) {
    const resolved = await resolveOrNull(projectQuery, "project", "project");
    if (resolved && "error" in resolved) return { status: "unresolved", message: resolved.error };
    if (!resolved) return { status: "unresolved", message: "Which project should this be linked to?" };
    linkedProject = resolved;
  }

  const isStandalone = !linkedTask && !linkedProject;
  let message = args.message as string | undefined;
  if (!message) {
    if (isStandalone) return { status: "need_field", message: "What should the reminder say?" };
    message = `Reminder: ${linkedTask ? linkedTask.name : linkedProject!.name}`;
  }

  const channelRaw = args.channel as string | undefined;
  if (channelRaw && channelRaw !== "PUSH" && channelRaw !== "WHATSAPP") {
    return { status: "need_field", message: "Should this go via push or WhatsApp?" };
  }
  const channel = channelRaw === "WHATSAPP" ? "WHATSAPP" : "PUSH";

  const explicitList = Array.isArray(args.fire_times) ? (args.fire_times as string[]).filter(Boolean) : [];
  const fireTimeRaw = args.fire_time as string | undefined;
  const intervalDays = args.recurring_interval_days as number | undefined;
  const count = args.recurring_count as number | undefined;

  let fireTimes: Date[];
  let cadenceNote = "";
  if (explicitList.length > 0) {
    fireTimes = explicitList.map((s) => new Date(s));
  } else if (fireTimeRaw && intervalDays && count) {
    if (count < 1 || count > MAX_RECURRING_COUNT) {
      return { status: "need_field", message: `How many occurrences (1–${MAX_RECURRING_COUNT})?` };
    }
    const base = new Date(fireTimeRaw);
    fireTimes = Array.from(
      { length: count },
      (_, i) => new Date(base.getTime() + i * intervalDays * 24 * 60 * 60 * 1000)
    );
    cadenceNote = `, every ${intervalDays} day${intervalDays === 1 ? "" : "s"}`;
  } else if (fireTimeRaw) {
    fireTimes = [new Date(fireTimeRaw)];
  } else {
    return { status: "need_field", message: "When should this fire?" };
  }

  if (fireTimes.length === 0 || fireTimes.some((d) => Number.isNaN(d.getTime()))) {
    return { status: "need_field", message: "When should this fire?" };
  }

  const linkDesc = linkedTask ? ` on "${linkedTask.name}"` : linkedProject ? ` on "${linkedProject.name}"` : "";
  const timesDesc =
    fireTimes.length === 1
      ? formatDeadline(fireTimes[0])
      : `${fireTimes.length} times, starting ${formatDeadline(fireTimes[0])}${cadenceNote}`;

  return {
    status: "ready",
    resolvedArgs: {
      message,
      linkedTaskId: linkedTask?.id,
      linkedProjectId: linkedProject?.id,
      channel,
      fireTimes: fireTimes.map((d) => d.toISOString()),
    },
    summary: `Create reminder${linkDesc}: "${message}" — ${timesDesc}${channel === "WHATSAPP" ? " via WhatsApp" : ""}.`,
  };
}

export async function prepareCancelReminder(args: Record<string, unknown>): Promise<PrepareResult> {
  const taskQuery = args.task_query as string | undefined;
  const reminderQuery = args.reminder_query as string | undefined;

  if (taskQuery) {
    const resolved = await resolveOrNull(taskQuery, "task", "task");
    if (resolved && "error" in resolved) return { status: "unresolved", message: resolved.error };
    if (!resolved) return { status: "unresolved", message: "Which task's reminders do you want to cancel?" };

    const upcoming = await listScheduledOccurrencesForTask(resolved.id);
    if (upcoming.length === 0) {
      return { status: "unresolved", message: `"${resolved.name}" has no upcoming reminders to cancel.` };
    }

    return {
      status: "ready",
      resolvedArgs: { mode: "task", taskId: resolved.id },
      summary: `Cancel ${upcoming.length} upcoming reminder${upcoming.length === 1 ? "" : "s"} on "${resolved.name}".`,
    };
  }

  if (reminderQuery) {
    const candidates = await findCancellableRemindersByQuery(reminderQuery);
    if (candidates.length === 0) {
      return { status: "unresolved", message: `I couldn't find an upcoming reminder matching "${reminderQuery}".` };
    }
    if (candidates.length > 1) {
      const names = candidates.map((c) => `"${c.message}"`).join(", ");
      return { status: "unresolved", message: `That could match more than one reminder: ${names}. Which one did you mean?` };
    }

    const reminder = candidates[0];
    return {
      status: "ready",
      resolvedArgs: { mode: "reminder", reminderId: reminder.id },
      summary: `Cancel reminder: "${reminder.message}".`,
    };
  }

  return { status: "need_field", message: "Which reminder(s) do you want to cancel?" };
}

export async function prepareUpdateSetting(args: Record<string, unknown>): Promise<PrepareResult> {
  const key = args.key as string | undefined;
  const value = args.value as string | undefined;
  if (!key || !value) return { status: "need_field", message: "Which setting, and what value?" };

  if (key === "daily_digest_time") {
    if (!isValidDigestTime(value)) {
      return { status: "need_field", message: "What time should the daily digest fire? (24-hour, e.g. 08:00)" };
    }
    return { status: "ready", resolvedArgs: { key, value }, summary: `Set the daily digest time to ${value}.` };
  }

  if (key === "whatsapp_number") {
    if (!isValidWhatsAppNumber(value)) {
      return { status: "need_field", message: "What's the WhatsApp number, with country code?" };
    }
    return { status: "ready", resolvedArgs: { key, value }, summary: `Set the WhatsApp reminder number to ${value}.` };
  }

  return { status: "need_field", message: "That setting isn't editable this way." };
}

export const WRITE_PREPARERS: Record<string, (args: Record<string, unknown>) => Promise<PrepareResult>> = {
  create_project: prepareCreateProject,
  edit_project: prepareEditProject,
  delete_project: prepareDeleteProject,
  create_dev: prepareCreateDev,
  edit_dev: prepareEditDev,
  delete_dev: prepareDeleteDev,
  reassign_dev_pod: prepareReassignDevPod,
  create_pod: prepareCreatePod,
  edit_pod: prepareEditPod,
  reassign_pod_lead: prepareReassignPodLead,
  create_task: prepareCreateTask,
  delete_task: prepareDeleteTask,
  mark_task_blocked: prepareMarkTaskBlocked,
  mark_task_done: prepareMarkTaskDone,
  assign_qa_reviewer: prepareAssignQaReviewer,
  resolve_qa_entry: prepareResolveQaEntry,
  rate_task: prepareRateTask,
  create_vault_item_metadata: prepareCreateVaultItemMetadata,
  edit_vault_item_metadata: prepareEditVaultItemMetadata,
  delete_vault_item: prepareDeleteVaultItem,
  create_reminder: prepareCreateReminder,
  cancel_reminder: prepareCancelReminder,
  update_setting: prepareUpdateSetting,
};
