"use client";

import { useState, ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";

interface Props {
  column: { id: number; name: string };
  onRename: (name: string) => void;
  onAddCard: () => void;
  children: ReactNode;
}

export default function KanbanColumn({ column, onRename, onAddCard, children }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);

  const { setNodeRef, isOver } = useDroppable({
    id: String(column.id),
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
    <div className={`rounded-lg bg-gray-100 p-3 transition-colors ${isOver ? "bg-blue-50" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full rounded border px-2 py-1 text-sm font-semibold text-[var(--dark-navy)] focus:outline-none focus:border-[var(--blue-primary)]"
            autoFocus
          />
        ) : (
          <h3
            onClick={() => setEditing(true)}
            className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-[var(--dark-navy)]"
          >
            {column.name}
          </h3>
        )}
        <button
          onClick={onAddCard}
          className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--blue-primary)] text-white text-sm hover:opacity-90"
          title="Add card"
        >
          +
        </button>
      </div>
      <div ref={setNodeRef} className="min-h-[40px]">{children}</div>
    </div>
  );
}
