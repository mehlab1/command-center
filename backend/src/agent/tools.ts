import { LlmTool } from "../llm/types";

const READ_TOOLS: LlmTool[] = [
  {
    name: "search_dev",
    description: "Look up an existing dev by name (fuzzy match). Use this to resolve a name mentioned in conversation before proposing a write that references a dev.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "search_project",
    description: "Look up an existing project by name (fuzzy match).",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "search_pod",
    description: "Look up an existing pod by name (fuzzy match).",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
];

const WRITE_TOOLS: LlmTool[] = [
  {
    name: "create_project",
    description: "Create a new project. Does not need confirmation from you to call this — the system handles confirming with the user before anything is written.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        category: { type: "string", description: "Free text, e.g. 'Client — X', 'Internal', 'Personal'" },
        deadline: { type: "string", description: "ISO 8601 date, optional" },
      },
      required: ["name"],
    },
  },
  {
    name: "edit_project",
    description: "Edit an existing project's fields.",
    parameters: {
      type: "object",
      properties: {
        project_query: { type: "string", description: "Name of the project to edit, as mentioned by the user" },
        name: { type: "string" },
        description: { type: "string" },
        category: { type: "string" },
        status: { type: "string", enum: ["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] },
        deadline: { type: "string", description: "ISO 8601 date" },
      },
      required: ["project_query"],
    },
  },
  {
    name: "delete_project",
    description: "Delete a project. You MUST ask the user whether to also delete its tasks (cascade) or keep the tasks and just unlink them, if they haven't already said which — never assume.",
    parameters: {
      type: "object",
      properties: {
        project_query: { type: "string" },
        cascade_tasks: { type: "boolean", description: "true = delete the project's tasks too, false = keep tasks, just unlink them from the project" },
      },
      required: ["project_query", "cascade_tasks"],
    },
  },
  {
    name: "create_dev",
    description: "Add a new dev.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        designation: { type: "string" },
        employment_type: { type: "string", enum: ["PERMANENT", "INTERN"] },
        internship_end_date: { type: "string", description: "ISO 8601 date, only relevant for interns" },
      },
      required: ["name", "employment_type"],
    },
  },
  {
    name: "edit_dev",
    description: "Edit an existing dev's fields (name/designation/employment type only — pod membership goes through reassign_dev_pod, lead status is computed).",
    parameters: {
      type: "object",
      properties: {
        dev_query: { type: "string" },
        name: { type: "string" },
        designation: { type: "string" },
        employment_type: { type: "string", enum: ["PERMANENT", "INTERN"] },
        internship_end_date: { type: "string" },
      },
      required: ["dev_query"],
    },
  },
  {
    name: "delete_dev",
    description: "Delete a dev. If they have open (non-Done) tasks assigned, you must warn the user and ask what to do before proceeding — the system will surface the open task count to you.",
    parameters: {
      type: "object",
      properties: { dev_query: { type: "string" } },
      required: ["dev_query"],
    },
  },
  {
    name: "reassign_dev_pod",
    description: "Move a dev to a (different) pod.",
    parameters: {
      type: "object",
      properties: { dev_query: { type: "string" }, pod_query: { type: "string" } },
      required: ["dev_query", "pod_query"],
    },
  },
  {
    name: "create_pod",
    description: "Create a new pod with a lead dev. The lead dev must already exist.",
    parameters: {
      type: "object",
      properties: { name: { type: "string" }, lead_dev_query: { type: "string" } },
      required: ["name", "lead_dev_query"],
    },
  },
  {
    name: "edit_pod",
    description: "Rename a pod. Use reassign_pod_lead to change the lead, not this tool.",
    parameters: {
      type: "object",
      properties: { pod_query: { type: "string" }, name: { type: "string" } },
      required: ["pod_query", "name"],
    },
  },
  {
    name: "reassign_pod_lead",
    description: "Change who leads a pod. The old lead automatically stops being a lead (computed) and is removed from the pod unless separately reassigned.",
    parameters: {
      type: "object",
      properties: { pod_query: { type: "string" }, new_lead_dev_query: { type: "string" } },
      required: ["pod_query", "new_lead_dev_query"],
    },
  },
];

export const ALL_TOOLS: LlmTool[] = [...READ_TOOLS, ...WRITE_TOOLS];
export const READ_TOOL_NAMES = new Set(READ_TOOLS.map((t) => t.name));
export const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));

export const SYSTEM_PROMPT = `You are the agent inside FinovaSolutions Command Center, a personal project/team management tool for Mehlab.

Rules you must follow exactly:
- You never write to the database yourself. When the user wants to create, edit, or delete something, call the appropriate tool once with the fields you're confident about — the system will resolve names, ask for anything missing, show a plain-language confirmation, and only write after the user explicitly confirms. You do not need to ask "are you sure?" yourself — that's handled after your tool call.
- If a name mentioned (a dev, project, or pod) is ambiguous or unclear, prefer letting the system's resolution handle it — just pass through the name as the user said it (e.g. "project_query": "the marketing site").
- If required information for a tool is genuinely missing from the conversation (not a name to resolve, but a real missing field like employment_type), ask the user directly in plain text instead of guessing.
- Keep replies short and plain. No markdown headers, no bullet-point walls, sentence case.
- If the user pastes something that looks like a secret/credential/API key, do not include it in any tool call — tell them the Vault has a secure entry path for that instead (not available yet in this phase).`;
