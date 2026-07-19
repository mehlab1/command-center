# Chat Agent & LLM Architecture

## Provider routing

- **Primary:** Google Gemini free tier (a current Gemini Flash-class model — check what's
  actually available on the free tier at build time, since model names/availability shift;
  don't hardcode a specific model string without verifying it's still on the free tier).
- **Fallback:** Groq free tier, triggered on Gemini error or rate-limit (HTTP 429 or
  equivalent). Groq's speed also makes it suitable for any lightweight internal classification
  steps (e.g. "is this message a create, edit, delete, or a plain question") if you choose to
  split that out as a separate fast pre-step — optional, use judgment.
- **Never call Anthropic's API for this** (see CLAUDE.md — Mehlab's Claude access is a Max
  seat, not a billable API key, and using it here would break the zero-cost requirement).
- Implement routing as a thin abstraction (`llmRouter.chat(messages, tools)`) so the actual
  provider is swappable later without touching call sites.

## Tool-calling design

The agent's job is: turn a natural-language message into one or more structured tool calls
against the backend's own service layer (not raw SQL — go through the same service functions
the REST/dashboard endpoints use, so business rules like "blocked requires both fields" are
enforced in exactly one place).

Design one tool per entity-action pair, e.g.:
- `create_project`, `edit_project`, `delete_project`
- `create_dev`, `edit_dev`, `delete_dev`, `reassign_dev_pod`
- `create_pod`, `edit_pod`, `reassign_pod_lead`
- `create_task`, `delete_task` (no `edit_task` — in-progress tasks are never edited, see
  golden rule; "editing" a task from the user's perspective is delete+recreate)
- `mark_task_blocked` (requires both `blocker_description` and `revised_deadline` in the same
  call — reject at the tool layer if either is missing)
- `mark_task_done` (triggers the deadline-miss hybrid check — see `docs/04-workflows.md`)
- `create_qa_entry` (system-triggered, not user-invoked directly)
- `assign_qa_reviewer`, `resolve_qa_entry` (pass/send-back)
- `rate_task`
- `create_reminder`, `cancel_reminder`
- `create_vault_item_metadata` (name/folder/tags only — see `docs/05-vault-and-security.md`,
  the actual secret never goes through this path)
- `update_setting` (e.g. digest time)
- `search_*` / `get_*` read tools for anything the agent needs to look up before acting
  (e.g. fuzzy-matching a dev name against existing records)

Each tool's parameters should mirror the fields in `docs/01-data-model.md` as closely as
possible so the LLM's structured output maps directly to the service-layer function signature.

## The confirm-before-commit loop (implement exactly this shape)

```
1. User message arrives.
2. LLM call #1: extract intent + entities + fields, OR determine a lookup is needed first
   (e.g. resolve "Ehsan" to a dev_id) and call a read tool.
3. If any referenced entity name doesn't confidently resolve to exactly one existing record:
   STOP. Respond asking the user to disambiguate. Do not proceed, do not guess, do not
   auto-create.
4. If required fields for the target tool are missing: STOP. Ask specifically for those
   fields. Do not ask about optional fields.
5. Once all required fields are present and all entity references are resolved: generate a
   plain-language summary of the exact write about to happen (this summary text is what gets
   stored in audit_log.summary later) and present it to the user with an explicit
   confirm/cancel choice. Do NOT call the actual write tool yet.
6. On user confirmation: call the write tool. On write success: insert the audit_log row
   (source = CHAT), insert the chat_messages rows for this exchange, return a short
   confirmation to the user.
7. On user cancellation or correction: do not write anything; incorporate the correction and
   loop back to step 2/3 as needed.
```

This loop is identical regardless of entity type — implement it once as a general
orchestration layer, not once per entity.

## Disambiguation matching

Use a simple, explainable matching strategy rather than pure LLM judgment for entity
resolution — e.g. exact match → case-insensitive match → fuzzy/trigram match above a
confidence threshold → otherwise treat as ambiguous/unresolved. This keeps "ask, don't guess"
deterministic and debuggable rather than depending on the LLM's mood that day. Postgres
`pg_trgm` similarity is a reasonable, free, in-database option for the fuzzy step.

## Personal-task detection

When the user says something like "remind me to..." or "I need to finish..." without naming a
dev, the agent should infer `is_personal = true` rather than asking "who is this for?" — but
if it's ambiguous whether a name mentioned is the assignee or just context, ask rather than
guess (per the standing rule).

## Vault exception (read this before wiring vault chat flows)

The chat agent handles vault item *metadata* conversationally (name, folder, tags) via
`create_vault_item_metadata`, but the actual secret value or file is captured through a
separate, non-LLM code path — see `docs/05-vault-and-security.md`. Never construct a tool call
that passes a raw secret string as an LLM function argument, even if the user pastes it
directly into the chat box; if that happens, the agent should redirect them to the secure
inline capture widget instead of forwarding the value to the LLM at all.

## Chat transcript storage

Every user/agent message pair gets stored in `chat_messages`, independent of whether it
resulted in a DB write — this is what powers "what did I tell you about Project X last week."
Store this regardless of confirm/cancel outcome, since even a cancelled attempt is part of the
real conversation history.
