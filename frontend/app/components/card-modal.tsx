"use client";

import { useState } from "react";
import { Card, PRIORITIES, CARD_TYPES, PRIORITY_COLORS, TYPE_LABELS, Priority, CardType } from "../types";

interface Props {
  card: Card;
  onSave: (card: Card) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export default function CardModal({ card, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [priority, setPriority] = useState<Priority>(card.priority || "medium");
  const [cardType, setCardType] = useState<CardType>(card.card_type || "task");
  const [points, setPoints] = useState(card.points || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-[var(--dark-navy)]">
          Edit Card
        </h2>

        <label className="mb-1 block text-sm text-[var(--gray-text)]">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[var(--blue-primary)] focus:outline-none"
        />

        <label className="mb-1 block text-sm text-[var(--gray-text)]">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[var(--blue-primary)] focus:outline-none resize-none"
        />

        <div className="mb-3 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-sm text-[var(--gray-text)]">Type</label>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value as CardType)}
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-[var(--blue-primary)] focus:outline-none"
            >
              {CARD_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--gray-text)]">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-[var(--blue-primary)] focus:outline-none"
              style={{ borderLeftColor: PRIORITY_COLORS[priority], borderLeftWidth: 3 }}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--gray-text)]">Points</label>
            <input
              type="number"
              min={0}
              max={100}
              value={points}
              onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-[var(--blue-primary)] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <button
            onClick={() => onDelete(card.id)}
            className="rounded px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded px-4 py-2 text-sm text-[var(--gray-text)] hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                onSave({
                  ...card,
                  title: title.trim(),
                  description: description.trim(),
                  priority,
                  card_type: cardType,
                  points,
                })
              }
              className="rounded bg-[var(--purple-secondary)] px-4 py-2 text-sm text-white hover:opacity-90"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
