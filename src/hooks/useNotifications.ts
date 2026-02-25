import useSWR, { mutate } from "swr";
import type { Notification } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useNotifications() {
  const { data, error, isLoading } = useSWR<Notification[]>(
    "/api/notifications",
    fetcher,
    { refreshInterval: 30000 }
  );

  const unreadCount = data?.filter((n) => !n.read).length ?? 0;

  return {
    notifications: data || [],
    unreadCount,
    isLoading,
    isError: !!error,
  };
}

export async function markAsRead(notificationIds?: string[]) {
  const res = await fetch("/api/notifications/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationIds }),
  });

  if (!res.ok) throw new Error("Failed to mark as read");

  await mutate("/api/notifications");
}
