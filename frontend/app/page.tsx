"use client";

import { useState } from "react";
import { useAuth } from "./auth-context";
import KanbanBoard from "./components/kanban-board";
import ChatSidebar from "./components/chat-sidebar";
import Backlog from "./components/backlog";
import LoginPage from "./login/page";

function KanbanIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

export default function Home() {
  const { authenticated, username, loading, logout } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState<"board" | "backlog">("board");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--gray-text)]">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 animate-spin text-[var(--blue-primary)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      <header className="flex items-center justify-between border-b border-[var(--accent-yellow)]/60 bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--dark-navy)]">
              <svg className="h-4 w-4 text-[var(--accent-yellow)]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2 4a2 2 0 012-2h4a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm8 0a2 2 0 012-2h4a2 2 0 012 2v8a2 2 0 01-2 2h-4a2 2 0 01-2-2V4zm8 0a2 2 0 012-2h0a2 2 0 012 2v4a2 2 0 01-2 2h0a2 2 0 01-2-2V4z" />
              </svg>
            </div>
            <h1 className="text-base font-bold text-[var(--dark-navy)]">
              Project Manager
            </h1>
          </div>
          <nav className="flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setView("board")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                view === "board"
                  ? "bg-white text-[var(--dark-navy)] shadow-sm"
                  : "text-[var(--gray-text)] hover:text-[var(--dark-navy)]"
              }`}
            >
              <KanbanIcon />
              Board
            </button>
            <button
              onClick={() => setView("backlog")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                view === "backlog"
                  ? "bg-white text-[var(--dark-navy)] shadow-sm"
                  : "text-[var(--gray-text)] hover:text-[var(--dark-navy)]"
              }`}
            >
              <ListIcon />
              Backlog
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-[var(--gray-text)]">
            <UserIcon />
            <span>{username}</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-[var(--gray-text)] hover:bg-gray-100 hover:text-[var(--dark-navy)] transition-colors"
          >
            <LogoutIcon />
            Sign Out
          </button>
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden">
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
