"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, PRIORITY_COLORS, TYPE_LABELS, safePriority, safeCardType } from "../types";

interface Props {
  card: Card;
  onClick: () => void;
}

export default function SortableCard({ card, onClick }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(card.id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftColor: PRIORITY_COLORS[safePriority(card.priority)],
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className="mb-2 cursor-pointer rounded bg-white p-3 shadow-sm border-l-[3px] border border-gray-100 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-[var(--gray-text)]">
          {TYPE_LABELS[safeCardType(card.card_type)] || "Task"}
        </span>
        {card.points > 0 && (
          <span className="text-[10px] font-bold rounded-full bg-[var(--blue-primary)] text-white w-5 h-5 flex items-center justify-center">
            {card.points}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-[var(--dark-navy)]">
        {card.title}
      </p>
      {card.description && (
        <p className="mt-1 text-xs text-[var(--gray-text)] line-clamp-2">
          {card.description}
        </p>
      )}
    </div>
  );
}
