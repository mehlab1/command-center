import { resolveEntity, ResolutionResult } from "./disambiguation";
import { checkDeleteDev } from "../services/devService";
import { checkDeleteProject } from "../services/projectService";

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
  type: "dev" | "pod" | "project",
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
  const summary = `Create project "${name}"${args.category ? ` (${args.category})` : ""}${deadline ? `, deadline ${deadline}` : ""}.`;
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

  const changes: string[] = [];
  if (args.name) changes.push(`name → "${args.name}"`);
  if (args.status) changes.push(`status → ${args.status}`);
  if (args.deadline) changes.push(`deadline → ${args.deadline}`);
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

  const { openTaskCount } = await checkDeleteDev(resolved.id);
  if (openTaskCount > 0 && args.acknowledged_open_tasks !== true) {
    return {
      status: "need_field",
      message: `"${resolved.name}" has ${openTaskCount} open task(s) assigned. Delete anyway? Those tasks will keep their assignee reference removed — let me know if you'd rather reassign them first.`,
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

  return {
    status: "ready",
    resolvedArgs: { podId: pod.id, newLeadDevId: newLead.id },
    summary: `Make ${newLead.name} the lead of ${pod.name}.`,
  };
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
};
