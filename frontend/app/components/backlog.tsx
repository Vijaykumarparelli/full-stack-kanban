"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { Card, Board, PRIORITIES, CARD_TYPES, PRIORITY_COLORS, TYPE_LABELS, CardType, safePriority } from "../types";
import CardModal from "./card-modal";

export default function Backlog() {
  const [cards, setCards] = useState<Card[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [cardsData, boardData] = await Promise.all([
        api.getAllCards(),
        api.getBoard(),
      ]);
      setCards(cardsData);
      setBoard(boardData);
      setError(null);
    } catch (err) {
      console.error("Failed to load backlog:", err);
      setError("Failed to load cards. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveCard = async (card: Card) => {
    try {
      await api.updateCard(card.id, {
        title: card.title,
        description: card.description,
        priority: card.priority,
        card_type: card.card_type,
        points: card.points,
      });
      setEditingCard(null);
      await fetchData();
    } catch (err) {
      console.error("Failed to update card:", err);
    }
  };

  const handleDeleteCard = async (id: number) => {
    try {
      await api.deleteCard(id);
      setEditingCard(null);
      await fetchData();
    } catch (err) {
      console.error("Failed to delete card:", err);
    }
  };

  const handleAddCard = async () => {
    if (!board || board.columns.length === 0) return;
    const firstCol = [...board.columns].sort((a, b) => a.position - b.position)[0];
    try {
      await api.createCard(firstCol.id, "New Card");
      await fetchData();
    } catch (err) {
      console.error("Failed to create card:", err);
    }
  };

  const s = search.toLowerCase();
  const filtered = cards.filter((card) => {
    if (filterType !== "all" && card.card_type !== filterType) return false;
    if (filterPriority !== "all" && card.priority !== filterPriority) return false;
    if (search && !(
      card.title.toLowerCase().includes(s) ||
      (card.description || "").toLowerCase().includes(s) ||
      (card.column_name || "").toLowerCase().includes(s)
    )) return false;
    return true;
  });

  const totalPoints = filtered.reduce((sum, c) => sum + (c.points || 0), 0);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-[var(--gray-text)]">
        Loading backlog...
      </div>
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {error && (
        <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search cards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search cards"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-[var(--blue-primary)] focus:outline-none w-56"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
          >
            <option value="all">All Types</option>
            {CARD_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
          >
            <option value="all">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--gray-text)]">
            {filtered.length} cards | {totalPoints} pts
          </span>
          <button
            onClick={handleAddCard}
            className="rounded bg-[var(--purple-secondary)] px-3 py-1.5 text-sm text-white hover:opacity-90"
          >
            + Add Card
          </button>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-[var(--gray-text)]">
            <th className="py-2 pr-3 font-medium w-8"></th>
            <th className="py-2 pr-3 font-medium">Title</th>
            <th className="py-2 pr-3 font-medium w-24">Type</th>
            <th className="py-2 pr-3 font-medium w-24">Priority</th>
            <th className="py-2 pr-3 font-medium w-16 text-center">Points</th>
            <th className="py-2 font-medium w-28">Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((card) => (
            <tr
              key={card.id}
              onClick={() => setEditingCard(card)}
              className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <td className="py-2.5 pr-3">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: PRIORITY_COLORS[safePriority(card.priority)] }}
                />
              </td>
              <td className="py-2.5 pr-3">
                <span className="font-medium text-[var(--dark-navy)]">{card.title}</span>
                {card.description && (
                  <p className="text-xs text-[var(--gray-text)] line-clamp-1 mt-0.5">{card.description}</p>
                )}
              </td>
              <td className="py-2.5 pr-3">
                <span className="text-xs font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-[var(--gray-text)]">
                  {TYPE_LABELS[(card.card_type as CardType)] || "Task"}
                </span>
              </td>
              <td className="py-2.5 pr-3">
                <span
                  className="text-xs font-medium capitalize"
                  style={{ color: PRIORITY_COLORS[safePriority(card.priority)] }}
                >
                  {card.priority || "medium"}
                </span>
              </td>
              <td className="py-2.5 pr-3 text-center">
                {card.points > 0 ? (
                  <span className="text-xs font-bold rounded-full bg-[var(--blue-primary)] text-white inline-flex w-5 h-5 items-center justify-center">
                    {card.points}
                  </span>
                ) : (
                  <span className="text-xs text-gray-300">-</span>
                )}
              </td>
              <td className="py-2.5">
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-[var(--gray-text)]">
                  {card.column_name || "Unknown"}
                </span>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-[var(--gray-text)]">
                No cards found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editingCard && (
        <CardModal
          card={editingCard}
          onSave={handleSaveCard}
          onDelete={handleDeleteCard}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
}
