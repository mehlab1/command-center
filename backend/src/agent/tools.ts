import { LlmTool } from "../llm/types";

const READ_TOOLS: LlmTool[] = [
  {
    name: "search_dev",
    description: "Look up an existing dev by name (fuzzy match). Rarely needed — write tools already resolve dev_query names automatically. Only call this if you need to know the answer yourself before deciding what to say (e.g. answering 'who is on X').",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "search_project",
    description: "Look up an existing project by name. Rarely needed — write tools resolve project_query automatically; only call this if you need the answer yourself before replying.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "search_pod",
    description: "Look up an existing pod by name. Rarely needed — write tools resolve pod_query automatically; only call this if you need the answer yourself before replying.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "search_task",
    description: "Look up an existing task by title. Rarely needed — write tools resolve task_query automatically; only call this if you need the answer yourself before replying.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "search_vault_item",
    description: "Look up an existing vault item by name. Rarely needed — write tools resolve vault_item_query automatically; only call this if you need the answer yourself before replying.",
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
    description: "Add a brand-new dev. For changing an existing dev (e.g. 'X is now a permanent hire'), use edit_dev instead. When adding several devs in one message, treat each independently — never copy one dev's stated PERMANENT/INTERN onto another just because they're in the same sentence/list.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        designation: { type: "string" },
        employment_type: {
          type: "string",
          enum: ["PERMANENT", "INTERN"],
          description: "Only if THIS specific named person's status was stated. Never inherited from a nearby dev's stated status — omit if unstated for this person.",
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
    description: "Create a brand-new task. Either is_personal=true (for Mehlab himself) or at least one assignee_dev_queries entry — never both. 'remind me to...'/'I need to finish...' with no dev named → infer is_personal true. needs_qa can never change later, so ask if not obvious.",
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
    description: "Mark a task blocked. blocker_description and revised_deadline are required together — if the user only gave one, call with only that field and omit the other; never invent/estimate the missing one. The system asks for whatever's missing.",
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
    description: "Mark a task done. The system separately asks (one at a time, as needed) whether a late completion counts as missed-deadline, and whether to cancel the task's upcoming reminders — just call the tool, don't ask these yourself.",
    parameters: {
      type: "object",
      properties: {
        task_query: { type: "string" },
        missed_deadline: { type: "boolean", description: "Only include this if the user has already answered the missed-deadline question in this conversation" },
        cancel_reminders: { type: "boolean", description: "Only include this if the user has already answered the 'cancel upcoming reminders on this task too?' question in this conversation" },
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
    description: "Create a vault entry's METADATA ONLY (name, folder, tags, non-sensitive notes) — no field for the actual secret value/password/key, ever. It's entered later via a secure widget outside the chat path. Never put a real secret into notes; if the user's message contains one, ignore that part — the system prompts them to enter it securely.",
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
  {
    name: "create_reminder",
    description: "Create a reminder, standalone or linked to a task/project. Fire time is exactly ONE of: fire_time alone; fire_time + recurring_interval_days + recurring_count (recurring, fire_time = first occurrence); or fire_times (explicit irregular list). Never combine these.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "Required if standalone. If linked, only set when the user gave specific wording — otherwise omit, system auto-generates from the linked task/project." },
        task_query: { type: "string", description: "Link to an existing task, if stated" },
        project_query: { type: "string", description: "Link to an existing project, if stated" },
        channel: { type: "string", enum: ["PUSH", "WHATSAPP"], description: "Only if the user asked for WhatsApp — PUSH is default." },
        fire_time: { type: "string", description: "ISO 8601 datetime — single occurrence, or first occurrence if recurring fields set" },
        recurring_interval_days: { type: "integer", description: "Days between occurrences — only with recurring_count + fire_time" },
        recurring_count: { type: "integer", description: "Total occurrences — only with recurring_interval_days + fire_time" },
        fire_times: { type: "array", items: { type: "string" }, description: "Explicit irregular ISO 8601 datetimes — don't combine with fire_time/recurring fields" },
      },
      required: [],
    },
  },
  {
    name: "cancel_reminder",
    description: "Cancel reminders — either every still-scheduled reminder linked to a specific task (task_query), or a specific standalone/linked reminder matched by wording (reminder_query, fuzzy match against the reminder's message). Give exactly one of these.",
    parameters: {
      type: "object",
      properties: {
        task_query: { type: "string", description: "Cancels every upcoming reminder linked to this task" },
        reminder_query: { type: "string", description: "Free text matched against a reminder's message, e.g. 'my Friday reminder about the report'" },
      },
      required: [],
    },
  },
  {
    name: "update_setting",
    description: "Change an app setting. Only two settings are editable this way: the daily digest time and the WhatsApp reminder number.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", enum: ["daily_digest_time", "whatsapp_number"] },
        value: { type: "string", description: "For daily_digest_time: 24-hour HH:mm, e.g. '08:00'. For whatsapp_number: digits with country code, e.g. '923001234567'." },
      },
      required: ["key", "value"],
    },
  },
];

export const ALL_TOOLS: LlmTool[] = [...READ_TOOLS, ...WRITE_TOOLS];
export const READ_TOOL_NAMES = new Set(READ_TOOLS.map((t) => t.name));
export const WRITE_TOOL_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));

export const SYSTEM_PROMPT = `You are the agent inside FinovaSolutions Command Center, a personal project/team management tool for Mehlab.

Rules you must follow exactly:
- Never write to the database yourself. Call the right tool once with the fields you're confident about — the system resolves names, asks for anything missing, confirms in plain language, and writes only after explicit user confirmation. Don't ask "are you sure?" yourself.
- Changing an existing dev/project/pod (designation, deadline, name, status — anything) is always edit_*/reassign_*, never create_*, even without the word "edit" (e.g. "Ehsan's designation is now Senior Engineer" → edit_dev). Only create_* for something that doesn't exist yet.
- An ambiguous/unclear name (dev, project, pod) — pass it through as-is (e.g. "project_query": "the marketing site"); never invent a fuller/different name.
- A genuinely missing required field (not a name to resolve, e.g. employment_type) — ask the user directly instead of guessing.
- Never invent a plausible value (date, number, name, enum like PERMANENT/INTERN) for a field the user didn't state, even if it'd complete the call, even if it's the common answer, even if a nearby item in the same message had that value — omit it, the system will ask. Matters most for dates: a stated deadline never implies a revised_deadline or any other unstated date field.
- Keep replies short, plain, sentence case — no markdown headers, no bullet walls.
- A pasted secret/credential/API key never goes in any tool call (including "notes") — tell the user to use the Vault's secure entry widget. Vault metadata (name/folder/tags/notes) goes through create_vault_item_metadata/edit_vault_item_metadata; the secret value itself never touches you or any tool call.
- No edit_task tool, ever — deliberate. Changing a task's title/deadline/assignees/description is delete_task then fresh create_task; say so plainly. Status changes (blocked/done) go through mark_task_blocked/mark_task_done instead.`;
