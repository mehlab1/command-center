import { AuditActionType, AuditSource } from "@prisma/client";
import { recordAudit } from "../services/auditService";
import * as devService from "../services/devService";
import * as podService from "../services/podService";
import * as projectService from "../services/projectService";

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
