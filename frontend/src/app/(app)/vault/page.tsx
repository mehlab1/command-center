"use client";

import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVaultItems } from "@/lib/queries";
import { useColdStartBanner } from "@/lib/useColdStartBanner";
import { apiFetch } from "@/lib/api";
import { VaultItemDTO } from "@/lib/types";
import { VaultSecretWidget } from "@/components/VaultSecretWidget";
import { CreateVaultItemModal } from "@/components/CreateVaultItemModal";

function VaultItemRow({ item, onOpen }: { item: VaultItemDTO; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-md border border-line bg-paper p-3 flex flex-col gap-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-text font-medium">{item.name}</p>
        <span
          className="tag-led inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap"
          style={{
            color: item.hasSecret ? "var(--done)" : "var(--text-muted)",
            borderColor: item.hasSecret ? "var(--done)" : "var(--line)",
            backgroundColor: item.hasSecret ? "color-mix(in srgb, var(--done) 12%, transparent)" : "transparent",
          }}
        >
          [ {item.hasSecret ? "SECURED" : "NO VALUE"} ]
        </span>
      </div>
      <p className="text-xs text-text-muted">
        {item.folder ?? "No folder"}
        {item.tags.length > 0 ? ` · ${item.tags.join(", ")}` : ""}
        {item.fileName ? " · has file" : ""}
      </p>
    </button>
  );
}

function VaultItemDetail({ item, onClose }: { item: VaultItemDTO; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["vault"] });
  }

  async function handleDelete() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await apiFetch(`/api/vault/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't delete this entry.");
      }
      refetch();
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete this entry.");
      setDeleteBusy(false);
    }
  }

  async function handleReveal() {
    setRevealing(true);
    setRevealError(null);
    try {
      const res = await apiFetch(`/api/vault/${item.id}/secret`);
      if (!res.ok) throw new Error("no secret");
      const data = await res.json();
      setRevealedValue(data.value);
    } catch {
      setRevealError("Couldn't retrieve that value.");
    } finally {
      setRevealing(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const buffer = await file.arrayBuffer();
      const dataBase64 = btoa(
        Array.from(new Uint8Array(buffer))
          .map((b) => String.fromCharCode(b))
          .join("")
      );
      const res = await apiFetch(`/api/vault/${item.id}/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type || "application/octet-stream", dataBase64 }),
      });
      if (!res.ok) throw new Error("upload failed");
      refetch();
    } catch {
      setUploadError("Couldn't upload that file — try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-md border-2 border-signal bg-paper p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-base text-text font-medium">{item.name}</p>
        <button onClick={onClose} className="text-xs text-text-muted font-heading">
          CLOSE
        </button>
      </div>

      <p className="text-xs text-text-muted">
        {item.folder ?? "No folder"}
        {item.tags.length > 0 ? ` · ${item.tags.join(", ")}` : ""}
      </p>

      {item.notes && <p className="text-sm text-text">{item.notes}</p>}

      <div className="flex flex-col gap-1.5">
        <p className="tag-led inline-block text-xs font-semibold text-text-muted self-start">[ SECRET VALUE ]</p>
        {revealedValue !== null ? (
          <p className="rounded-sm border border-line bg-ink px-3 py-2 text-sm text-text font-mono break-all">
            {revealedValue}
          </p>
        ) : (
          <div className="flex gap-2">
            {item.hasSecret && (
              <button
                onClick={handleReveal}
                disabled={revealing}
                className="btn-tactile flex-1 rounded-sm border border-line bg-ink py-2 text-sm font-medium text-text disabled:opacity-60"
              >
                {revealing ? "Retrieving…" : "Reveal"}
              </button>
            )}
            <button
              onClick={() => setWidgetOpen(true)}
              className="btn-tactile btn-tactile-signal flex-1 rounded-sm bg-signal text-signal-contrast py-2 text-sm font-semibold"
            >
              {item.hasSecret ? "Replace value" : "Add secret value"}
            </button>
          </div>
        )}
        {revealError && <p className="text-xs text-blocked">{revealError}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="tag-led inline-block text-xs font-semibold text-text-muted self-start">[ FILE ]</p>
        {item.fileName ? (
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/vault/${item.id}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-signal underline"
          >
            Download {item.fileName}
          </a>
        ) : (
          <p className="text-xs text-text-muted">No file attached.</p>
        )}
        <input ref={fileInputRef} type="file" onChange={handleFileChange} disabled={uploading} className="text-xs text-text-muted" />
        {uploadError && <p className="text-xs text-blocked">{uploadError}</p>}
      </div>

      <div className="pt-1">
        {!deleteConfirming ? (
          <button onClick={() => setDeleteConfirming(true)} className="text-xs text-blocked underline">
            Delete this entry
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-blocked p-3">
            <p className="text-xs text-text">Delete "{item.name}" and its stored secret/file for good?</p>
            {deleteError && <p className="text-xs text-blocked">{deleteError}</p>}
            <div className="flex items-center gap-2">
              <button onClick={handleDelete} disabled={deleteBusy} className="text-xs text-blocked font-semibold">
                {deleteBusy ? "Deleting…" : "Yes, delete"}
              </button>
              <button onClick={() => setDeleteConfirming(false)} className="text-xs text-text-muted">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {widgetOpen && (
        <VaultSecretWidget
          vaultItemId={item.id}
          itemName={item.name}
          hasSecret={item.hasSecret}
          onClose={() => setWidgetOpen(false)}
          onSaved={() => {
            setWidgetOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

export default function VaultPage() {
  const [folder, setFolder] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const vaultQuery = useVaultItems({ q: search || undefined });
  const waking = useColdStartBanner([vaultQuery]);
  const items = vaultQuery.data;

  const folders = useMemo(() => {
    if (!items) return [];
    return Array.from(new Set(items.map((i) => i.folder).filter((f): f is string => !!f))).sort();
  }, [items]);

  const tags = useMemo(() => {
    if (!items) return [];
    return Array.from(new Set(items.flatMap((i) => i.tags))).sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items
      .filter((i) => folder === "all" || i.folder === folder)
      .filter((i) => tag === "all" || i.tags.includes(tag));
  }, [items, folder, tag]);

  const openItem = items?.find((i) => i.id === openId) ?? null;

  return (
    <div className="flex-1 p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-heading text-xl text-text">Vault</h1>
        <button
          onClick={() => setCreating(true)}
          className="btn-tactile btn-tactile-signal rounded-sm bg-signal text-signal-contrast px-3 py-1.5 text-xs font-semibold"
        >
          + Add entry
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="flex-1 rounded-sm border border-line bg-paper px-3 py-1.5 text-xs text-text outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          className="rounded-sm border border-line bg-paper px-2 py-1.5 text-xs text-text"
        >
          <option value="all">All folders</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="rounded-sm border border-line bg-paper px-2 py-1.5 text-xs text-text"
        >
          <option value="all">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {waking && (
        <p role="status" className="text-sm text-text-muted mb-2">
          Waking things up — this happens after a bit of inactivity, just a few more seconds.
        </p>
      )}

      {vaultQuery.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
      {items?.length === 0 && (
        <p className="text-sm text-text-muted">
          No vault entries yet — tell the agent about a credential to store, then enter its value securely.
        </p>
      )}
      {items && items.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-text-muted">No entries match this filter.</p>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((item) =>
          openItem?.id === item.id ? (
            <VaultItemDetail key={item.id} item={openItem} onClose={() => setOpenId(null)} />
          ) : (
            <VaultItemRow key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
          )
        )}
      </div>

      {creating && <CreateVaultItemModal onClose={() => setCreating(false)} onCreated={() => setCreating(false)} />}
    </div>
  );
}
