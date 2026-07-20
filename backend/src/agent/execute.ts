import { AuditActionType, AuditSource } from "@prisma/client";
import { recordAudit } from "../services/auditService";
import * as devService from "../services/devService";
import * as podService from "../services/podService";
import * as projectService from "../services/projectService";
import * as taskService from "../services/taskService";
import * as qaService from "../services/qaService";
import * as ratingService from "../services/ratingService";
import * as vaultService from "../services/vaultService";

// Runs only after the user has explicitly confirmed — this is the single
// place a write tool's resolved args actually touch the database.
export async function executeWrite(
  toolName: string,
  args: Record<string, unknown>,
  summary: string
): Promise<{ entityType: string; entityId: string }> {
  switch (toolName) {
    case "create_project": {
      const project = await projectService.createProject({
        name: args.name as string,
        description: args.description as string | undefined,
        category: args.category as string | undefined,
        deadline: args.deadline ? new Date(args.deadline as string) : undefined,
      });
      await recordAudit({
        actionType: AuditActionType.CREATE,
        entityType: "project",
        entityId: project.id,
        summary,
        source: AuditSource.CHAT,
      });
      return { entityType: "project", entityId: project.id };
    }

    case "edit_project": {
      const id = args.id as string;
      const before = await projectService.getProjectById(id);
      const project = await projectService.editProject(id, {
        name: args.name as string | undefined,
        description: args.description as string | undefined,
        category: args.category as string | undefined,
        status: args.status as never,
        deadline: args.deadline ? new Date(args.deadline as string) : undefined,
      });
      await recordAudit({
        actionType: AuditActionType.EDIT,
        entityType: "project",
        entityId: project.id,
        summary,
        diff: { before, after: project },
        source: AuditSource.CHAT,
      });
      return { entityType: "project", entityId: project.id };
    }

    case "delete_project": {
      const id = args.id as string;
      const project = await projectService.deleteProject(id, args.cascadeTasks as boolean);
      await recordAudit({
        actionType: AuditActionType.DELETE,
        entityType: "project",
        entityId: id,
        summary,
        diff: { before: project },
        source: AuditSource.CHAT,
      });
      return { entityType: "project", entityId: id };
    }

    case "create_dev": {
      const dev = await devService.createDev({
        name: args.name as string,
        designation: args.designation as string | undefined,
        employmentType: args.employmentType as never,
        internshipEndDate: args.internshipEndDate ? new Date(args.internshipEndDate as string) : undefined,
      });
      await recordAudit({
        actionType: AuditActionType.CREATE,
        entityType: "dev",
        entityId: dev.id,
        summary,
        source: AuditSource.CHAT,
      });
      return { entityType: "dev", entityId: dev.id };
    }

    case "edit_dev": {
      const id = args.id as string;
      const before = await devService.getDevById(id);
      const dev = await devService.editDev(id, {
        name: args.name as string | undefined,
        designation: args.designation as string | undefined,
        employmentType: args.employmentType as never,
        internshipEndDate: args.internshipEndDate ? new Date(args.internshipEndDate as string) : undefined,
      });
      await recordAudit({
        actionType: AuditActionType.EDIT,
        entityType: "dev",
        entityId: dev.id,
        summary,
        diff: { before, after: dev },
        source: AuditSource.CHAT,
      });
      return { entityType: "dev", entityId: dev.id };
    }

    case "delete_dev": {
      const id = args.id as string;
      const dev = await devService.deleteDev(id);
      await recordAudit({
        actionType: AuditActionType.DELETE,
        entityType: "dev",
        entityId: id,
        summary,
        diff: { before: dev },
        source: AuditSource.CHAT,
      });
      return { entityType: "dev", entityId: id };
    }

    case "reassign_dev_pod": {
      const devId = args.devId as string;
      const before = await devService.getDevById(devId);
      return await reassignDevPod(devId, args.podId as string, summary, before);
    }

    case "create_pod": {
      const pod = await podService.createPod({
        name: args.name as string,
        leadDevId: args.leadDevId as string,
      });
      await recordAudit({
        actionType: AuditActionType.CREATE,
        entityType: "pod",
        entityId: pod.id,
        summary,
        source: AuditSource.CHAT,
      });
      return { entityType: "pod", entityId: pod.id };
    }

    case "edit_pod": {
      const id = args.id as string;
      const before = await podService.getPodById(id);
      const pod = await podService.editPod(id, { name: args.name as string });
      await recordAudit({
        actionType: AuditActionType.EDIT,
        entityType: "pod",
        entityId: pod.id,
        summary,
        diff: { before, after: pod },
        source: AuditSource.CHAT,
      });
      return { entityType: "pod", entityId: pod.id };
    }

    case "reassign_pod_lead": {
      const podId = args.podId as string;
      const before = await podService.getPodById(podId);
      const pod = await podService.reassignPodLead(podId, args.newLeadDevId as string);
      await recordAudit({
        actionType: AuditActionType.EDIT,
        entityType: "pod",
        entityId: pod.id,
        summary,
        diff: { before, after: pod },
        source: AuditSource.CHAT,
      });
      return { entityType: "pod", entityId: pod.id };
    }

    case "create_task": {
      const task = await taskService.createTask({
        title: args.title as string,
        description: args.description as string | undefined,
        notes: args.notes as string | undefined,
        projectId: args.projectId as string | undefined,
        isPersonal: args.isPersonal as boolean,
        deadline: new Date(args.deadline as string),
        needsQa: args.needsQa as boolean,
        assigneeDevIds: (args.assigneeDevIds as string[]) ?? [],
      });
      // Consumes a pending QA send-back if one exists — same create_task
      // code path either way (docs/04-workflows.md "Sent Back" flow).
      await taskService.linkPendingSupersessionIfAny(task.id);
      await recordAudit({
        actionType: AuditActionType.CREATE,
        entityType: "task",
        entityId: task.id,
        summary,
        source: AuditSource.CHAT,
      });
      return { entityType: "task", entityId: task.id };
    }

    case "delete_task": {
      const id = args.id as string;
      const task = await taskService.deleteTask(id);
      await recordAudit({
        actionType: AuditActionType.DELETE,
        entityType: "task",
        entityId: id,
        summary,
        diff: { before: task },
        source: AuditSource.CHAT,
      });
      return { entityType: "task", entityId: id };
    }

    case "mark_task_blocked": {
      const id = args.id as string;
      const before = await taskService.getTaskById(id);
      const task = await taskService.markTaskBlocked(
        id,
        args.blockerDescription as string,
        new Date(args.revisedDeadline as string)
      );
      await recordAudit({
        actionType: AuditActionType.EDIT,
        entityType: "task",
        entityId: task.id,
        summary,
        diff: { before, after: task },
        source: AuditSource.CHAT,
      });
      return { entityType: "task", entityId: task.id };
    }

    case "mark_task_done": {
      const id = args.id as string;
      const before = await taskService.getTaskById(id);
      const task = await taskService.markTaskDone(id, args.missedDeadline as boolean);

      // System-triggered QA entry creation — same execution, not a separate
      // confirm step (docs/03-agent-and-llm.md).
      if (task.needsQa) {
        await qaService.createQaEntryForTask(task.id);
      }

      await recordAudit({
        actionType: AuditActionType.EDIT,
        entityType: "task",
        entityId: task.id,
        summary,
        diff: { before, after: task },
        source: AuditSource.CHAT,
      });
      return { entityType: "task", entityId: task.id };
    }

    case "assign_qa_reviewer": {
      const qaEntryId = args.qaEntryId as string;
      const entry = await qaService.assignQaReviewer(qaEntryId, args.reviewerDevId as string);
      await recordAudit({
        actionType: AuditActionType.EDIT,
        entityType: "qa_queue_entry",
        entityId: entry.id,
        summary,
        source: AuditSource.CHAT,
      });
      return { entityType: "qa_queue_entry", entityId: entry.id };
    }

    case "resolve_qa_entry": {
      const qaEntryId = args.qaEntryId as string;
      const outcomeNotes = args.outcomeNotes as string | undefined;
      const entry =
        args.outcome === "PASSED"
          ? await qaService.resolveQaEntryPassed(qaEntryId, outcomeNotes)
          : await qaService.resolveQaEntrySentBack(qaEntryId, args.taskId as string, outcomeNotes);
      await recordAudit({
        actionType: AuditActionType.EDIT,
        entityType: "qa_queue_entry",
        entityId: entry.id,
        summary,
        source: AuditSource.CHAT,
      });
      return { entityType: "qa_queue_entry", entityId: entry.id };
    }

    case "rate_task": {
      const taskId = args.taskId as string;
      const devId = args.devId as string;
      const rating = args.rating as number;
      await ratingService.rateTask(taskId, devId, rating);
      await recordAudit({
        actionType: AuditActionType.CREATE,
        entityType: "ratings_history",
        entityId: taskId,
        summary,
        source: AuditSource.CHAT,
      });
      return { entityType: "ratings_history", entityId: taskId };
    }

    case "create_vault_item_metadata": {
      const item = await vaultService.createVaultItemMetadata({
        name: args.name as string,
        folder: args.folder as string | undefined,
        tags: args.tags as string[] | undefined,
        notes: args.notes as string | undefined,
      });
      await recordAudit({
        actionType: AuditActionType.CREATE,
        entityType: "vault_item",
        entityId: item.id,
        summary,
        source: AuditSource.CHAT,
      });
      return { entityType: "vault_item", entityId: item.id };
    }

    case "edit_vault_item_metadata": {
      const id = args.id as string;
      // Metadata-only diff, per docs/05-vault-and-security.md — this tool
      // never touches secretValueEncrypted/fileBytesEncrypted, so "before"
      // here can never contain a secret value, only name/folder/tags/notes.
      const before = await vaultService.getVaultItemMetadata(id);
      const item = await vaultService.editVaultItemMetadata(id, {
        name: args.name as string | undefined,
        folder: args.folder as string | undefined,
        tags: args.tags as string[] | undefined,
        notes: args.notes as string | undefined,
      });
      const after = await vaultService.getVaultItemMetadata(id);
      await recordAudit({
        actionType: AuditActionType.EDIT,
        entityType: "vault_item",
        entityId: item.id,
        summary,
        diff: { before, after },
        source: AuditSource.CHAT,
      });
      return { entityType: "vault_item", entityId: item.id };
    }

    case "delete_vault_item": {
      const id = args.id as string;
      const before = await vaultService.getVaultItemMetadata(id);
      await vaultService.deleteVaultItem(id);
      await recordAudit({
        actionType: AuditActionType.DELETE,
        entityType: "vault_item",
        entityId: id,
        summary,
        // before is already the sanitized metadata-only view (hasSecret
        // boolean, never the value) from vaultService.getVaultItemMetadata.
        diff: { before },
        source: AuditSource.CHAT,
      });
      return { entityType: "vault_item", entityId: id };
    }

    default:
      throw new Error(`Unknown write tool: ${toolName}`);
  }
}

async function reassignDevPod(
  devId: string,
  podId: string,
  summary: string,
  before: unknown
): Promise<{ entityType: string; entityId: string }> {
  const dev = await devService.reassignDevPod(devId, podId);
  await recordAudit({
    actionType: AuditActionType.EDIT,
    entityType: "dev",
    entityId: dev.id,
    summary,
    diff: { before, after: dev },
    source: AuditSource.CHAT,
  });
  return { entityType: "dev", entityId: dev.id };
}
