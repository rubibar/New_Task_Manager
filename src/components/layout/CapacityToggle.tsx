"use client";

import { useSession } from "next-auth/react";
import { useState, useCallback } from "react";
import useSWR, { mutate } from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function CapacityToggle() {
  const { data: session } = useSession();
  const { data: users } = useSWR("/api/users", fetcher);
  const [loading, setLoading] = useState(false);

  const userId = (session as unknown as Record<string, unknown>)?.userId as
    | string
    | undefined;
  const currentUser = users?.find(
    (u: { id: string }) => u.id === userId
  );

  const handleToggle = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await fetch(`/api/users/${userId}/capacity`, { method: "PATCH" });
      await mutate("/api/users");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  if (!currentUser) return null;

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`
        flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        transition-all duration-150
        ${
          currentUser.atCapacity
            ? "bg-amber-100 text-amber-700 border border-amber-200"
            : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
        }
      `}
      title={
        currentUser.atCapacity
          ? "You're at capacity — click to toggle off"
          : "Toggle capacity mode"
      }
    >
      {currentUser.atCapacity && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z" />
        </svg>
      )}
      {currentUser.atCapacity ? "At Capacity" : "Available"}
    </button>
  );
}
