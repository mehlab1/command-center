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
  {
    name: "search_task",
    description: "Look up an existing task by title (fuzzy match).",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "search_vault_item",
    description: "Look up an existing vault item by name (fuzzy match).",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
];

const WRITE_TOOLS: LlmTool[] = [
  {
    name: "create_project",
    description: "Create a brand-new project that doesn't exist yet. Do NOT use this if the user is changing something about a project that already exists — use edit_project for that, even if they only mention one field (e.g. 'push back the deadline on X' is edit_project, not create_project). Does not need confirmation from you to call this — the system handles confirming with the user before anything is written.",
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
        cascade_tasks: { type: "boolean", description: "true = delete the project's tasks too, false = keep tasks, just unlink them from the project. Only set this if the user actually said which they want — never guess or default to either, omit entirely if unstated." },
      },
      required: ["project_query"],
    },
  },
  {
    name: "create_dev",
    description: "Add a brand-new dev who doesn't exist yet. Do NOT use this if the user is changing something about a dev who already exists (e.g. 'change X's designation', 'X is now a permanent hire') — use edit_dev for that instead. If the user is adding several devs in one message and only some of them have a stated employment type, treat every dev independently: do NOT copy another dev's stated PERMANENT/INTERN onto this one just because they were mentioned in the same sentence or list. Each create_dev call's employment_type reflects only what was said about that exact person.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        designation: { type: "string" },
        employment_type: {
          type: "string",
          enum: ["PERMANENT", "INTERN"],
          description: "Only set this if the user actually said permanent/intern for THIS specific named person, in a clause that names them (or unambiguously refers only to them). If another dev mentioned nearby has a stated employment_type, that value does NOT carry over to this one — omit this field entirely unless THIS person's status was stated.",
        },
        internship_end_date: { type: "string", description: "ISO 8601 date, only relevant for interns" },
      },
      required: ["name"],
    },
  },
  {
    name: "edit_dev",
    description: "Change a field on a dev who already exists (name/designation/employment type only — pod membership goes through reassign_dev_pod, lead status is computed). Use this whenever the user refers to an existing dev by name and wants something about them changed, even if they don't say the word 'edit'.",
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
    description: "Delete a dev. If they have open (non-Done) tasks assigned, the system will tell you the count and ask the user to confirm before proceeding — once the user has explicitly confirmed that in their reply, call this again with acknowledged_open_tasks true.",
    parameters: {
      type: "object",
      properties: {
        dev_query: { type: "string" },
        acknowledged_open_tasks: { type: "boolean", description: "Set true only after the user has explicitly confirmed deleting despite open tasks" },
      },
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
    description: "Create a brand-new pod that doesn't exist yet, with a lead dev who must already exist. Do NOT use this to change an existing pod's name or lead — use edit_pod or reassign_pod_lead instead.",
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
  {
    name: "create_task",
    description: "Create a brand-new task. Either is_personal must be true (a task for Mehlab himself, not a dev) or at least one assignee_dev_queries entry must be given — never both. If the user says something like 'remind me to...' or 'I need to finish...' without naming a dev, infer is_personal true rather than asking who it's for. needs_qa is decided now and can never be changed later, so if it's not obvious, ask.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        notes: { type: "string" },
        project_query: { type: "string", description: "Project this task belongs to, if any" },
        is_personal: { type: "boolean" },
        assignee_dev_queries: { type: "array", items: { type: "string" }, description: "Up to 2 devs" },
        deadline: { type: "string", description: "ISO 8601 date, required" },
        needs_qa: { type: "boolean", description: "Whether this task needs a QA review before it can be marked done. Only set this if the user actually stated it — never guess true or false as a 'safe default', omit entirely if unstated." },
      },
      required: ["title", "deadline"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a task. There is no edit_task tool — per the golden rule, changing an in-progress task's content is always delete this, then create_task fresh, never an edit.",
    parameters: {
      type: "object",
      properties: { task_query: { type: "string" } },
      required: ["task_query"],
    },
  },
  {
    name: "mark_task_blocked",
    description: "Mark a task blocked. Both blocker_description and revised_deadline are required together. If the user only gives you one of the two (e.g. just says what's blocking it, with no new date), you MUST call this tool with only the field they actually stated and omit the other — do not invent, estimate, or default the missing one. The system will ask for whatever's missing; do not guess a plausible-looking date yourself.",
    parameters: {
      type: "object",
      properties: {
        task_query: { type: "string" },
        blocker_description: { type: "string" },
        revised_deadline: { type: "string", description: "ISO 8601 date — omit entirely if the user did not state one, never estimate it" },
      },
      required: ["task_query"],
    },
  },
  {
    name: "mark_task_done",
    description: "Mark a task done. If it's being completed after its deadline, the system will ask whether that should count as a missed deadline before confirming — you don't need to ask this yourself, just call the tool.",
    parameters: {
      type: "object",
      properties: {
        task_query: { type: "string" },
        missed_deadline: { type: "boolean", description: "Only include this if the user has already answered the missed-deadline question in this conversation" },
      },
      required: ["task_query"],
    },
  },
  {
    name: "assign_qa_reviewer",
    description: "Assign a reviewer to a task's QA entry. Always requires an explicit dev, even if a reviewer was suggested — never auto-assign the suggested one without the user confirming.",
    parameters: {
      type: "object",
      properties: { task_query: { type: "string" }, reviewer_dev_query: { type: "string" } },
      required: ["task_query", "reviewer_dev_query"],
    },
  },
  {
    name: "resolve_qa_entry",
    description: "Resolve a task's QA review as passed or sent back.",
    parameters: {
      type: "object",
      properties: {
        task_query: { type: "string" },
        outcome: { type: "string", enum: ["PASSED", "SENT_BACK"], description: "Only set this if the user actually stated the outcome — PASSED is not a safe default, omit entirely if unstated." },
        outcome_notes: { type: "string" },
      },
      required: ["task_query"],
    },
  },
  {
    name: "rate_task",
    description: "Rate a dev's work on a completed task, 1-5. Only valid once the task is Done (and QA-passed if it needed QA). If a task has multiple assignees, this rates one dev at a time — ask which dev if unclear, or call it once per dev if the user gives multiple scores.",
    parameters: {
      type: "object",
      properties: {
        task_query: { type: "string" },
        dev_query: { type: "string", description: "Which assignee this rating is for — required if the task has more than one assignee" },
        rating: { type: "integer", minimum: 1, maximum: 5, description: "Only set this if the user actually stated a numeric rating — never guess a middling value, omit entirely if unstated." },
      },
      required: ["task_query"],
    },
  },
  {
    name: "create_vault_item_metadata",
    description: "Create a new vault entry's METADATA ONLY — name, folder, tags, and non-sensitive notes. This tool has no field for the actual secret value/password/API key/credential and never will — that is entered separately through a secure widget the frontend shows after this is confirmed, completely outside the chat/LLM path. Never put a real secret value into `notes` either, even if the user pastes one right after asking to create a vault item — notes is for non-sensitive context only (e.g. 'expires yearly in March', 'used for the client portal'). If the user's message contains what looks like the actual secret, ignore that part when calling this tool; the system will prompt them to enter it securely.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        folder: { type: "string", description: "Broad category, e.g. 'Cloud', 'Client Logins', 'Personal'" },
        tags: { type: "array", items: { type: "string" } },
        notes: { type: "string", description: "Non-sensitive context only — never the secret value itself" },
      },
      required: ["name"],
    },
  },
  {
    name: "edit_vault_item_metadata",
    description: "Edit an existing vault item's metadata (name, folder, tags, notes) only — same no-secret-value rule as create_vault_item_metadata. To change the actual secret value, tell the user to use the secure widget; there is no tool for that.",
    parameters: {
      type: "object",
      properties: {
        vault_item_query: { type: "string" },
        name: { type: "string" },
        folder: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        notes: { type: "string", description: "Non-sensitive context only — never the secret value itself" },
      },
      required: ["vault_item_query"],
    },
  },
  {
    name: "delete_vault_item",
    description: "Delete a vault item, including its stored secret value and any file attachment.",
    parameters: {
      type: "object",
      properties: { vault_item_query: { type: "string" } },
      required: ["vault_item_query"],
    },
  },
];

export const ALL_TOOLS: LlmTool[] = [...READ_TOOLS, ...WRITE_TOOLS];
export const READ_TOOL_NAMES = new Set(READ_TOOLS.map((t) => t.name));
export const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));

export const SYSTEM_PROMPT = `You are the agent inside FinovaSolutions Command Center, a personal project/team management tool for Mehlab.

Rules you must follow exactly:
- You never write to the database yourself. When the user wants to create, edit, or delete something, call the appropriate tool once with the fields you're confident about — the system will resolve names, ask for anything missing, show a plain-language confirmation, and only write after the user explicitly confirms. You do not need to ask "are you sure?" yourself — that's handled after your tool call.
- Never confuse creating something new with changing something that already exists. If the user names an existing dev/project/pod and wants a detail about them changed (designation, deadline, name, status — anything), that is always an edit_*/reassign_* call, never a create_* call, even if they don't use the word "edit" (e.g. "Ehsan's designation is now Senior Engineer" means edit_dev, not create_dev). Only call a create_* tool when the user is clearly introducing something that doesn't exist yet.
- If a name mentioned (a dev, project, or pod) is ambiguous or unclear, prefer letting the system's resolution handle it — just pass through the name as the user said it (e.g. "project_query": "the marketing site"). Never invent or guess a fuller/different name than what the user actually said.
- If required information for a tool is genuinely missing from the conversation (not a name to resolve, but a real missing field like employment_type), ask the user directly in plain text instead of guessing.
- Never invent a plausible-looking value (a date, a number, a name, an enum choice like PERMANENT/INTERN) for a field the user did not actually state, even if it would make the tool call "complete," even if it's the statistically common answer, and even if a nearby item in the same message happened to have that value. "This is probably what they meant" is still guessing. Omit that field from the call entirely — the system will notice it's missing and ask for it. This matters most for dates: if the user gives a relative date for one field (e.g. a deadline) but not another (e.g. a revised deadline on a blocked task), do not reuse, estimate, or extrapolate a date for the field they didn't mention.
- Keep replies short and plain. No markdown headers, no bullet-point walls, sentence case.
- If the user pastes something that looks like a secret/credential/API key, do not include it in any tool call, including as a "notes" field — tell them to use the Vault's secure entry widget for that instead. Vault metadata (name/folder/tags/notes) goes through create_vault_item_metadata/edit_vault_item_metadata like any other entity; the actual secret value never goes through you or any tool call, ever.
- There is no edit_task tool, ever — this is deliberate, not missing. If the user wants to change a task's title, deadline, assignees, or description, the correct flow is delete_task then a fresh create_task, and you should say so plainly rather than looking for an edit tool that doesn't exist. Status changes (blocked/done) go through mark_task_blocked/mark_task_done, which are not edits in this sense.`;
