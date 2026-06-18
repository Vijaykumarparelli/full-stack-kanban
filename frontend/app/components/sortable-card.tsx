"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, PRIORITY_COLORS, TYPE_LABELS, safePriority, safeCardType, CardType } from "../types";

const TYPE_STYLES: Record<CardType, string> = {
  task: "bg-blue-50 text-blue-600",
  bug: "bg-red-50 text-red-600",
  issue: "bg-orange-50 text-orange-600",
  feature: "bg-green-50 text-green-600",
  improvement: "bg-purple-50 text-purple-600",
};

const TYPE_ICONS: Record<CardType, React.ReactNode> = {
  task: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  bug: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  issue: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  feature: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  improvement: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
};

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
    opacity: isDragging ? 0.35 : 1,
  };

  const cardType = safeCardType(card.card_type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
      }}
      className="mb-2 cursor-grab active:cursor-grabbing rounded-lg bg-white p-3 shadow-sm border-l-[3px] border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${TYPE_STYLES[cardType]}`}>
          {TYPE_ICONS[cardType]}
          {TYPE_LABELS[cardType]}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {card.points > 0 && (
            <span className="text-[10px] font-bold rounded-full bg-[var(--blue-primary)] text-white w-5 h-5 flex items-center justify-center">
              {card.points}
            </span>
          )}
          <svg
            className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-400 transition-colors"
            fill="currentColor" viewBox="0 0 24 24"
          >
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </div>
      </div>
      <p className="text-sm font-medium text-[var(--dark-navy)] leading-snug">
        {card.title}
      </p>
      {card.description && (
        <p className="mt-1.5 text-xs text-[var(--gray-text)] line-clamp-2 leading-relaxed">
          {card.description}
        </p>
      )}
      <div className="mt-2 flex items-center gap-1.5">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: PRIORITY_COLORS[safePriority(card.priority)] }}
          title={`Priority: ${card.priority}`}
        />
        <span className="text-[10px] text-gray-400 capitalize">{card.priority}</span>
      </div>
    </div>
  );
}
