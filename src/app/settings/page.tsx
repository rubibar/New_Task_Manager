"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { CapacityToggle } from "@/components/layout/CapacityToggle";

export default function SettingsPage() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 text-sm">Please sign in to view settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-800">Settings</h1>

      {/* Profile */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
          Profile
        </h2>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-4">
            {session.user?.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || ""}
                className="w-14 h-14 rounded-full"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center">
                <span className="text-lg font-bold text-slate-500">
                  {session.user?.name?.charAt(0) || "?"}
                </span>
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-800">
                {session.user?.name}
              </p>
              <p className="text-sm text-slate-500">{session.user?.email}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Capacity */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
          Capacity
        </h2>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">
                At Capacity Mode
              </p>
              <p className="text-xs text-slate-500 mt-1">
                When active, incoming Admin tasks for you receive a -20 point
                penalty. Other team members will see an &ldquo;At Capacity&rdquo;
                badge next to your name.
              </p>
            </div>
            <CapacityToggle />
          </div>
        </div>
      </section>

      {/* Calendar Sync */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
          Calendar Sync
        </h2>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-sm text-slate-700">
              Google Calendar sync is active
            </p>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Tasks are synced bidirectionally with the shared Replica calendar
            every 10 minutes.
          </p>
        </div>
      </section>

      {/* Timezone */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
          Timezone
        </h2>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-sm text-slate-700">Asia/Jerusalem (IST)</p>
          <p className="text-xs text-slate-500 mt-1">
            Work week: Sunday-Thursday, 10:00-18:00
          </p>
        </div>
      </section>

      {/* Sign Out */}
      <section>
        <Button
          variant="secondary"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign Out
        </Button>
      </section>
    </div>
  );
}
