"use client";

import { useEffect, useState } from "react";
import { isThursdayMeetingMode, isSundayRDTime } from "@/lib/business-hours";
import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function StatusBanner() {
  const [thursdayMode, setThursdayMode] = useState(false);
  const [sundayRD, setSundayRD] = useState(false);

  const { data: users } = useSWR("/api/users", fetcher);
  const capacityUsers = (users || []).filter(
    (u: { atCapacity: boolean }) => u.atCapacity
  );

  useEffect(() => {
    setThursdayMode(isThursdayMeetingMode());
    setSundayRD(isSundayRDTime());

    const interval = setInterval(() => {
      setThursdayMode(isThursdayMeetingMode());
      setSundayRD(isSundayRDTime());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2">
      {thursdayMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-lg">&#128203;</span>
          <div>
            <p className="text-sm font-semibold text-blue-800">
              Thursday Planning Mode
            </p>
            <p className="text-xs text-blue-600">
              Scores frozen for weekly review
            </p>
          </div>
        </div>
      )}

      {sundayRD && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-lg">&#128300;</span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              R&D Focus Time
            </p>
            <p className="text-xs text-emerald-600">
              Research tasks boosted until 13:00
            </p>
          </div>
        </div>
      )}

      {capacityUsers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-amber-500"
          >
            <path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z" />
          </svg>
          <p className="text-sm text-amber-800">
            <span className="font-semibold">At Capacity:</span>{" "}
            {capacityUsers
              .map((u: { name: string }) => u.name)
              .join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
