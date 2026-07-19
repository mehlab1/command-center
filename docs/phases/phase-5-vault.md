# Phase 5 — Vault

**Goal:** secure credential/file storage, fully integrated with chat for metadata but with
secret values strictly bypassing the LLM, per `docs/05-vault-and-security.md`.

## Prerequisites
- Phase 4 test gate passed.
- Read `docs/05-vault-and-security.md` fully and completely before starting — this phase has
  the tightest security requirements in the whole project.

## Tasks

1. **Encryption utility.** AES-256-GCM helper functions (encrypt/decrypt), keyed from
   `VAULT_ENCRYPTION_KEY` (Render env var, generated during setup, never in git or DB).

2. **`create_vault_item_metadata` tool.** Chat-driven creation of name/folder/tags/notes only —
   verify this tool's schema has no field for the actual secret value.

3. **Secure inline capture widget.** A dedicated frontend component (modal or inline form),
   separate from the chat interface, that POSTs the secret value/file directly to
   `POST /api/vault/:id/secret` — a plain authenticated REST endpoint never touched by the LLM
   router.

4. **Chat redirect heuristic.** If a user pastes what looks like a secret directly into the
   chat box during a vault flow, redirect to the secure widget instead of forwarding it as a
   tool argument — per the heuristic described in `docs/05-vault-and-security.md`.

5. **File storage.** Encrypted file bytes stored in Postgres (`bytea`) per the storage decision
   in `docs/05-vault-and-security.md`, unless real friction is hit during this phase — if so,
   flag it rather than silently introducing a second storage provider.

6. **Vault browser UI.** Folder + tag browsing, search, mobile-first per the design system doc.
   Standard confirm-before-delete flow for vault items, same as every other entity.

7. **Audit log discipline.** Verify vault audit log entries never contain plaintext or
   ciphertext secret values — only metadata-level diffs and a generic "[updated]" marker for
   secret value changes.

## Test Gate — must all pass before Phase 6

- [ ] Create a vault item via chat (metadata only) → confirm the LLM API request payload (log
      it during testing, then remove the log) never contains a secret value at any point.
- [ ] Submit a secret value via the secure widget → correctly encrypted at rest in Neon
      (verify by inspecting the raw DB column directly — it must not be human-readable
      plaintext).
- [ ] Retrieve and decrypt a stored secret correctly through the app UI.
- [ ] Paste a secret-looking string directly into the chat box during a vault flow → agent
      redirects to the secure widget rather than treating it as a tool argument.
- [ ] Delete a vault item → standard confirm-before-delete flow triggers, audit log entry
      created without leaking the secret value.
- [ ] Search/filter by folder and by tag both work correctly.
- [ ] Upload and later retrieve a file attachment, confirm it round-trips correctly through
      encryption/decryption.
