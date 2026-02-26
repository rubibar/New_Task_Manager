"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { AIAssistant } from "@/components/ai/AIAssistant";
import { GlobalSearch } from "@/components/search/GlobalSearch";

const publicPaths = ["/login", "/unauthorized"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();

  const isPublicPage = publicPaths.includes(pathname);

  // On public pages or when not authenticated, render children without shell
  if (isPublicPage || status !== "authenticated") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
      <MobileNav />
      <AIAssistant />
      <GlobalSearch />
    </div>
  );
}
