"use client";

import { useState, ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";

interface Props {
  column: { id: number; name: string };
  cardCount: number;
  onRename: (name: string) => void;
  onAddCard: () => void;
  children: ReactNode;
}

export default function KanbanColumn({ column, cardCount, onRename, onAddCard, children }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);

  const { setNodeRef, isOver } = useDroppable({
    id: "col-" + String(column.id),
  });

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== column.name) {
      onRename(trimmed);
    } else {
      setName(column.name);
    }
    setEditing(false);
  };

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden bg-[#edf0f5]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#edf0f5]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") { setName(column.name); setEditing(false); }
              }}
              aria-label="Column name"
              className="flex-1 rounded border border-[var(--blue-primary)] px-2 py-0.5 text-sm font-bold text-[var(--dark-navy)] focus:outline-none"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 group min-w-0"
              title="Click to rename column"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--dark-navy)] truncate">
                {column.name}
              </span>
              <svg
                className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          <span className="shrink-0 text-[10px] font-bold rounded-full bg-gray-300/80 text-gray-500 w-5 h-5 flex items-center justify-center">
            {cardCount}
          </span>
        </div>
        <button
          onClick={onAddCard}
          className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-[var(--blue-primary)] shadow-sm hover:bg-[var(--blue-primary)] hover:text-white transition-colors"
          title="Add card"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto px-2 pb-2 pt-0.5 transition-colors min-h-[120px] ${
          isOver ? "bg-blue-100/70" : ""
        }`}
      >
        {cardCount === 0 && (
          <div className={`flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed transition-colors ${
            isOver
              ? "border-[var(--blue-primary)] bg-blue-50"
              : "border-gray-300/60"
          }`}>
            {isOver ? (
              <svg className="h-5 w-5 text-[var(--blue-primary)] mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-gray-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            <p className="text-[11px] text-gray-400">
              {isOver ? "Drop here" : "No cards"}
            </p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
