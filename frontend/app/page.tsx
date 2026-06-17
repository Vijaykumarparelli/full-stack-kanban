"use client";

import { useState } from "react";
import { useAuth } from "./auth-context";
import KanbanBoard from "./components/kanban-board";
import ChatSidebar from "./components/chat-sidebar";
import Backlog from "./components/backlog";
import LoginPage from "./login/page";

export default function Home() {
  const { authenticated, username, loading, logout } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState<"board" | "backlog">("board");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--gray-text)]">
        Loading...
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-[var(--accent-yellow)] bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold text-[var(--dark-navy)]">
            Project Manager
          </h1>
          <nav className="flex gap-1">
            <button
              onClick={() => setView("board")}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                view === "board"
                  ? "bg-[var(--blue-primary)] text-white"
                  : "text-[var(--gray-text)] hover:bg-gray-100"
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setView("backlog")}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                view === "backlog"
                  ? "bg-[var(--blue-primary)] text-white"
                  : "text-[var(--gray-text)] hover:bg-gray-100"
              }`}
            >
              Backlog
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--gray-text)]">{username}</span>
          <button
            onClick={logout}
            className="rounded px-3 py-1 text-sm text-[var(--gray-text)] hover:bg-gray-100"
          >
            Sign Out
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {view === "board" ? (
          <KanbanBoard refreshKey={refreshKey} />
        ) : (
          <Backlog />
        )}
      </main>
      <ChatSidebar onBoardUpdated={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
