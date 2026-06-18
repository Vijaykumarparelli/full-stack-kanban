"use client";

import { useState, useRef, useEffect } from "react";
import { PRIORITIES, CARD_TYPES, PRIORITY_COLORS, TYPE_LABELS, Priority, CardType } from "../types";

interface Props {
  columnName: string;
  onAdd: (data: { title: string; description: string; priority: Priority; card_type: CardType; points: number }) => Promise<void>;
  onClose: () => void;
}

export default function AddCardModal({ columnName, onAdd, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [cardType, setCardType] = useState<CardType>("task");
  const [points, setPoints] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required.");
      titleRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await onAdd({ title: trimmed, description: description.trim(), priority, card_type: cardType, points });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-card-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 id="add-card-title" className="text-lg font-bold text-[var(--dark-navy)]">
              New Card
            </h2>
            <p className="text-xs text-[var(--gray-text)] mt-0.5">Adding to <span className="font-medium">{columnName}</span></p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <label className="mb-1 block text-sm font-medium text-[var(--dark-navy)]">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="What needs to be done?"
          className={`mb-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--blue-primary)]/30 ${
            error ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-[var(--blue-primary)]"
          }`}
        />
        {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
        {!error && <div className="mb-3" />}

        {/* Description */}
        <label className="mb-1 block text-sm font-medium text-[var(--dark-navy)]">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Optional description..."
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--blue-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-primary)]/30 resize-none"
        />

        {/* Type / Priority / Points */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--gray-text)] uppercase tracking-wide">Type</label>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value as CardType)}
              className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-[var(--blue-primary)] focus:outline-none"
            >
              {CARD_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--gray-text)] uppercase tracking-wide">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-[var(--blue-primary)] focus:outline-none"
              style={{ borderLeftColor: PRIORITY_COLORS[priority], borderLeftWidth: 3 }}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--gray-text)] uppercase tracking-wide">Points</label>
            <input
              type="number"
              min={0}
              max={100}
              value={points}
              onChange={(e) => setPoints(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-[var(--blue-primary)] focus:outline-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--gray-text)] hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--blue-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Adding...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Card
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
