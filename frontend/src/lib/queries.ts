import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api";
import {
  DeadlineRadarDTO,
  DevDTO,
  DevPerformanceDTO,
  PodDTO,
  ProjectDTO,
  QaEntryDTO,
  ReminderDTO,
  SettingsDTO,
  TaskDTO,
  VaultItemDTO,
} from "./types";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: () => fetchJson<ProjectDTO[]>("/api/projects") });
}

export function useDevs() {
  return useQuery({ queryKey: ["devs"], queryFn: () => fetchJson<DevDTO[]>("/api/devs") });
}

export function usePods() {
  return useQuery({ queryKey: ["pods"], queryFn: () => fetchJson<PodDTO[]>("/api/pods") });
}

export function useTasks() {
  return useQuery({ queryKey: ["tasks"], queryFn: () => fetchJson<TaskDTO[]>("/api/tasks") });
}

export function useQaQueue() {
  return useQuery({ queryKey: ["dashboard", "qa"], queryFn: () => fetchJson<QaEntryDTO[]>("/api/dashboard/qa") });
}

export function useDeadlineRadar() {
  return useQuery({
    queryKey: ["dashboard", "deadlines"],
    queryFn: () => fetchJson<DeadlineRadarDTO>("/api/dashboard/deadlines"),
  });
}

export function usePerformance() {
  return useQuery({
    queryKey: ["dashboard", "performance"],
    queryFn: () => fetchJson<DevPerformanceDTO[]>("/api/dashboard/performance"),
  });
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => fetchJson<SettingsDTO>("/api/settings") });
}

export function useStandaloneReminders() {
  return useQuery({ queryKey: ["reminders"], queryFn: () => fetchJson<ReminderDTO[]>("/api/reminders") });
}

export function useVaultItems(filter: { folder?: string; tag?: string; q?: string } = {}) {
  const params = new URLSearchParams();
  if (filter.folder) params.set("folder", filter.folder);
  if (filter.tag) params.set("tag", filter.tag);
  if (filter.q) params.set("q", filter.q);
  const qs = params.toString();
  return useQuery({
    queryKey: ["vault", filter],
    queryFn: () => fetchJson<VaultItemDTO[]>(`/api/vault${qs ? `?${qs}` : ""}`),
  });
}
