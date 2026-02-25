"use client";

import { useSession } from "next-auth/react";
import { NotificationBell } from "../notifications/NotificationBell";
import { CapacityToggle } from "./CapacityToggle";

export function TopBar() {
  const { data: session } = useSession();

  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-medium text-slate-800">Task Manager</h1>
      </div>

      <div className="flex items-center gap-4">
        <CapacityToggle />
        <NotificationBell />

        {/* User avatar */}
        {session?.user && (
          <div className="flex items-center gap-2">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || ""}
                className="w-7 h-7 rounded-full"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                <span className="text-xs font-medium text-slate-600">
                  {session.user.name?.charAt(0) || "?"}
                </span>
              </div>
            )}
            <span className="text-sm text-slate-600 hidden lg:block">
              {session.user.name}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
