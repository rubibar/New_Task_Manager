"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { NotificationBell } from "../notifications/NotificationBell";
import { CapacityToggle } from "./CapacityToggle";

export function TopBar() {
  const { data: session } = useSession();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  function openSearch() {
    // Dispatch a keyboard event to trigger GlobalSearch's Cmd+K listener
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
      })
    );
  }

  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-medium text-slate-800">Task Manager</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Search shortcut button */}
        <button
          onClick={openSearch}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-500 hover:border-slate-300 transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span>Search</span>
          <kbd className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-white border border-slate-200 rounded text-slate-400">
            {isMac ? "\u2318K" : "Ctrl+K"}
          </kbd>
        </button>

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
