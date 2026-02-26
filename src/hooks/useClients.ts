import useSWR, { mutate } from "swr";
import type { ClientWithRelations } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useClients(params?: { search?: string; status?: string; tags?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.tags) searchParams.set("tags", params.tags);
  const qs = searchParams.toString();
  const url = `/api/clients${qs ? `?${qs}` : ""}`;

  const { data, error, isLoading } = useSWR<ClientWithRelations[]>(url, fetcher);
  return { clients: data || [], isLoading, isError: !!error };
}

export function useClient(id: string | null) {
  const { data, error, isLoading } = useSWR<ClientWithRelations>(
    id ? `/api/clients/${id}` : null,
    fetcher
  );
  return { client: data || null, isLoading, isError: !!error };
}

export async function createClient(input: Record<string, unknown>) {
  const res = await fetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create client");
  await mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/clients"));
  return res.json();
}

export async function updateClient(id: string, input: Record<string, unknown>) {
  const res = await fetch(`/api/clients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to update client");
  await mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/clients"));
  return res.json();
}

export async function deleteClient(id: string) {
  const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete client");
  }
  await mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/clients"));
}
