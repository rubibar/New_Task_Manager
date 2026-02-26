"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface TaskResult {
  id: string;
  title: string;
  status: string;
  project: { name: string; color: string } | null;
}

interface ProjectResult {
  id: string;
  name: string;
  color: string;
  clientName: string | null;
  status: string;
}

interface ClientResult {
  id: string;
  name: string;
  status: string;
  email: string | null;
}

interface SearchResults {
  tasks: TaskResult[];
  projects: ProjectResult[];
  clients: ClientResult[];
}

type FlatItem =
  | { type: "task"; data: TaskResult }
  | { type: "project"; data: ProjectResult }
  | { type: "client"; data: ClientResult };

const statusColors: Record<string, string> = {
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-blue-500",
  IN_REVIEW: "bg-amber-500",
  DONE: "bg-emerald-500",
  ACTIVE: "bg-emerald-500",
  NOT_STARTED: "bg-slate-400",
  ON_HOLD: "bg-amber-500",
  COMPLETED: "bg-emerald-500",
  ARCHIVED: "bg-slate-300",
  INACTIVE: "bg-slate-300",
  PROSPECTIVE: "bg-blue-400",
};

function getStatusDot(status: string) {
  const color = statusColors[status] || "bg-slate-400";
  return <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />;
}

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flatten results for keyboard navigation
  const flatItems: FlatItem[] = [];
  if (results) {
    for (const task of results.tasks) {
      flatItems.push({ type: "task", data: task });
    }
    for (const project of results.projects) {
      flatItems.push({ type: "project", data: project });
    }
    for (const client of results.clients) {
      flatItems.push({ type: "client", data: client });
    }
  }

  // Open/Close with Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      // Small delay so the animation can start before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      // Reset state when closing
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
      setLoading(false);
    }
  }, [open]);

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      if (!res.ok) throw new Error("Search failed");
      const data: SearchResults = await res.json();
      setResults(data);
      setSelectedIndex(0);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (query.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Navigate to selected item
  const navigateTo = useCallback(
    (item: FlatItem) => {
      setOpen(false);
      switch (item.type) {
        case "task":
          router.push(`/?task=${item.data.id}`);
          break;
        case "project":
          router.push("/projects");
          break;
        case "client":
          router.push(`/clients/${item.data.id}`);
          break;
      }
    },
    [router]
  );

  // Keyboard navigation inside modal
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        flatItems.length === 0 ? 0 : (prev + 1) % flatItems.length
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        flatItems.length === 0
          ? 0
          : (prev - 1 + flatItems.length) % flatItems.length
      );
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (flatItems.length > 0 && flatItems[selectedIndex]) {
        navigateTo(flatItems[selectedIndex]);
      }
      return;
    }
  }

  // Track the global index for rendering
  let globalIdx = 0;

  const hasResults =
    results &&
    (results.tasks.length > 0 ||
      results.projects.length > 0 ||
      results.clients.length > 0);
  const hasNoResults =
    results &&
    results.tasks.length === 0 &&
    results.projects.length === 0 &&
    results.clients.length === 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="max-w-xl w-full mx-auto mt-[15vh]"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200"
              onKeyDown={handleKeyDown}
            >
              {/* Search input */}
              <div className="relative flex items-center border-b border-slate-200">
                {/* Search icon */}
                <div className="pl-4 text-slate-400">
                  <svg
                    width="20"
                    height="20"
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
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tasks, projects, clients..."
                  className="flex-1 text-lg px-3 py-3.5 bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                />
                <button
                  onClick={() => setOpen(false)}
                  className="mr-3 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                  ESC
                </button>
              </div>

              {/* Results area */}
              <div className="max-h-[50vh] overflow-y-auto">
                {/* Loading */}
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <svg
                      className="animate-spin h-5 w-5 text-slate-400"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    <span className="ml-2 text-sm text-slate-400">
                      Searching...
                    </span>
                  </div>
                )}

                {/* Empty state - no query */}
                {!loading && !results && query.trim().length < 2 && (
                  <div className="py-10 text-center">
                    <p className="text-sm text-slate-400">
                      Type to search...
                    </p>
                    <p className="text-xs text-slate-300 mt-1">
                      Search across tasks, projects, and clients
                    </p>
                  </div>
                )}

                {/* No results */}
                {!loading && hasNoResults && (
                  <div className="py-10 text-center">
                    <p className="text-sm text-slate-500">No results found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try a different search term
                    </p>
                  </div>
                )}

                {/* Results */}
                {!loading && hasResults && (
                  <div className="py-2">
                    {/* Tasks */}
                    {results.tasks.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-2">
                          Tasks
                        </div>
                        {results.tasks.map((task) => {
                          const idx = globalIdx++;
                          return (
                            <button
                              key={task.id}
                              className={`w-full text-left px-4 py-2.5 cursor-pointer flex items-center gap-3 transition-colors ${
                                idx === selectedIndex
                                  ? "bg-[#C8FF00]/10"
                                  : "hover:bg-slate-50"
                              }`}
                              onClick={() =>
                                navigateTo({ type: "task", data: task })
                              }
                              onMouseEnter={() => setSelectedIndex(idx)}
                            >
                              {getStatusDot(task.status)}
                              <span className="text-sm text-slate-800 truncate flex-1">
                                {task.title}
                              </span>
                              {task.project && (
                                <span
                                  className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                                  style={{
                                    backgroundColor:
                                      task.project.color + "20",
                                    color: task.project.color === "#C8FF00" ? "#6B7000" : task.project.color,
                                  }}
                                >
                                  {task.project.name}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Projects */}
                    {results.projects.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-2 mt-1">
                          Projects
                        </div>
                        {results.projects.map((project) => {
                          const idx = globalIdx++;
                          return (
                            <button
                              key={project.id}
                              className={`w-full text-left px-4 py-2.5 cursor-pointer flex items-center gap-3 transition-colors ${
                                idx === selectedIndex
                                  ? "bg-[#C8FF00]/10"
                                  : "hover:bg-slate-50"
                              }`}
                              onClick={() =>
                                navigateTo({
                                  type: "project",
                                  data: project,
                                })
                              }
                              onMouseEnter={() => setSelectedIndex(idx)}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: project.color }}
                              />
                              <span className="text-sm text-slate-800 truncate flex-1">
                                {project.name}
                              </span>
                              {project.clientName && (
                                <span className="text-xs text-slate-400 flex-shrink-0">
                                  {project.clientName}
                                </span>
                              )}
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium flex-shrink-0">
                                {formatStatus(project.status)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Clients */}
                    {results.clients.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-2 mt-1">
                          Clients
                        </div>
                        {results.clients.map((client) => {
                          const idx = globalIdx++;
                          return (
                            <button
                              key={client.id}
                              className={`w-full text-left px-4 py-2.5 cursor-pointer flex items-center gap-3 transition-colors ${
                                idx === selectedIndex
                                  ? "bg-[#C8FF00]/10"
                                  : "hover:bg-slate-50"
                              }`}
                              onClick={() =>
                                navigateTo({
                                  type: "client",
                                  data: client,
                                })
                              }
                              onMouseEnter={() => setSelectedIndex(idx)}
                            >
                              {/* Person icon */}
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="text-slate-400 flex-shrink-0"
                              >
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                              <span className="text-sm text-slate-800 truncate flex-1">
                                {client.name}
                              </span>
                              {client.email && (
                                <span className="text-xs text-slate-400 truncate flex-shrink-0 max-w-[150px]">
                                  {client.email}
                                </span>
                              )}
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                  client.status === "ACTIVE"
                                    ? "bg-emerald-50 text-emerald-600"
                                    : client.status === "PROSPECTIVE"
                                    ? "bg-blue-50 text-blue-600"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {formatStatus(client.status)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer hint */}
              {hasResults && !loading && (
                <div className="border-t border-slate-100 px-4 py-2 flex items-center gap-4">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono border border-slate-200">
                      &uarr;
                    </kbd>
                    <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono border border-slate-200">
                      &darr;
                    </kbd>
                    navigate
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono border border-slate-200">
                      &crarr;
                    </kbd>
                    open
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono border border-slate-200">
                      esc
                    </kbd>
                    close
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
