import useSWR, { mutate } from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useInvoices(params?: { status?: string; clientId?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.clientId) searchParams.set("clientId", params.clientId);
  const qs = searchParams.toString();
  const url = `/api/invoices${qs ? `?${qs}` : ""}`;

  const { data, error, isLoading } = useSWR(url, fetcher);
  return { invoices: data || [], isLoading, isError: !!error };
}

export async function createInvoice(input: Record<string, unknown>) {
  const res = await fetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create invoice");
  await mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/invoices"));
  return res.json();
}

export async function updateInvoice(id: string, input: Record<string, unknown>) {
  const res = await fetch(`/api/invoices/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to update invoice");
  await mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/invoices"));
  return res.json();
}

export async function deleteInvoice(id: string) {
  const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete invoice");
  await mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/invoices"));
}
