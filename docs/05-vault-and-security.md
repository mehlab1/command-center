# Vault & Security Architecture

## Threat model (keep this narrow and honest)

This is a single-user personal tool, not a multi-tenant SaaS handling client data under a
compliance regime. The security bar is: (1) secrets aren't sitting in the DB as plaintext,
(2) secrets never leave Mehlab's own infrastructure via a third-party LLM API call, (3) normal
web app hygiene (HTTPS everywhere, no secrets in git, no secrets in logs). Do not over-engineer
beyond this — e.g. no need for HSMs, no need for per-item access control since there's only one
user.

## Encryption at rest

- Use AES-256-GCM at the application layer, in the backend service, before any vault secret
  value is written to Neon.
- The encryption key is a single symmetric key stored as a Render environment variable
  (`VAULT_ENCRYPTION_KEY`), generated once during setup (e.g. `openssl rand -base64 32`) and
  never committed to git, never stored in the database itself.
- Store ciphertext + IV/nonce + auth tag in the `vault_items.secret_value_encrypted` column
  (concatenate or use a structured format — document whichever you choose in code comments).
- File attachments: encrypt the file content the same way before storing (or before uploading
  to wherever files are persisted — see storage decision below), not just the text fields.

## File storage decision

Free-tier constraint: Neon is a database, not a file store, and storing large encrypted
blobs directly in Postgres works but isn't ideal at scale. For a personal vault with modest
file sizes this is acceptable — store encrypted file bytes as `bytea` in Postgres directly,
keeping the architecture to a single free service (Neon) rather than adding a second free-tier
file storage provider and its own credential/quota management. If file sizes turn out to be
large enough that this becomes impractical during actual use, that's a legitimate reason to
introduce a dedicated object storage free tier later — flag it if you hit real friction here,
don't preemptively add a second storage system for a personal tool.

## The LLM-bypass mechanism (critical, do not skip)

This was a deliberate design decision after evaluating the risk: if vault secrets were entered
purely through chat, the raw secret value would necessarily appear in the prompt sent to
Gemini/Groq, leaving Mehlab's infrastructure even though it's encrypted afterward at rest.
Instead:

1. **The chat agent handles only metadata** — name, folder, tags, and (optionally) non-
   sensitive notes. This goes through `create_vault_item_metadata`, a normal LLM tool call,
   exactly like any other entity creation, including the standard confirm-before-commit step.
2. **The secret value/file never appears in any LLM prompt, response, or tool-call argument.**
   When the agent's metadata-collection flow reaches the point where the actual secret is
   needed, it should respond with something like: "Got it — tap below to securely enter the
   value" and the frontend renders a dedicated, small, non-chat input widget (a modal or inline
   form) tied to the `vault_items.id` just created (or a draft ID if metadata isn't committed
   yet — implementation detail, use judgment).
3. **That widget POSTs directly to a dedicated backend endpoint** (e.g.
   `POST /api/vault/:id/secret`) that performs the encryption and write. This endpoint is
   never touched by the LLM router — it's a plain authenticated REST call from the frontend.
4. **If the user pastes a secret directly into the chat box anyway** (they might, out of
   habit), the agent must recognize this isn't the intended path and redirect them to the
   secure widget rather than forwarding the pasted value as a tool argument. A simple heuristic
   (e.g. detecting the vault-creation context plus a long/high-entropy string) is enough —
   don't over-build a secret-scanning system for a single-user app, just don't blindly forward
   whatever's in the message as a tool call parameter during a vault flow.

## Audit log

Every vault create/edit/delete goes through the same universal confirm-before-commit +
`audit_log` write as everything else (see `docs/04-workflows.md`). The audit log's `diff`
field must NEVER contain the plaintext or ciphertext secret value itself — log only the
metadata change (name/folder/tags changed from X to Y) and, for the secret value specifically,
log only that it changed (e.g. `{"secret_value": "[updated]"}`), never the actual before/after
values.

## Access to the app itself

Single-user login (see `docs/phases/phase-1-foundation.md` for the specific auth approach —
simple email+password or a magic-link style login is sufficient; no need for OAuth/SSO
complexity for one user). No separate "vault PIN" beyond the normal app login was ultimately
scoped as strictly required, but if implementation time allows, a lightweight secondary PIN
gate specifically in front of the Vault section is a reasonable nice-to-have — not a hard
requirement, use judgment on whether it fits the phase timeline.
