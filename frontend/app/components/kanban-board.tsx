"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { api } from "../api";
import { Board, Card, Column, PRIORITY_COLORS, TYPE_LABELS, Priority } from "../types";
import KanbanColumn from "./kanban-column";
import SortableCard from "./sortable-card";
import CardModal from "./card-modal";

interface Props {
  onBoardUpdate?: () => void;
  refreshKey?: number;
}

export default function KanbanBoard({ refreshKey }: Props) {
  const [board, setBoard] = useState<Board | null>(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchBoard = useCallback(async () => {
    try {
      const data = await api.getBoard();
      setBoard(data);
    } catch (err) {
      console.error("Failed to load board:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard, refreshKey]);

  const findCard = (id: string): Card | undefined => {
    if (!board) return undefined;
    for (const col of board.columns) {
      const card = col.cards.find((c) => String(c.id) === id);
      if (card) return card;
    }
    return undefined;
  };

  const findColumnByCardId = (cardId: string): Column | undefined => {
    if (!board) return undefined;
    return board.columns.find((col) =>
      col.cards.some((c) => String(c.id) === cardId)
    );
  };

  const onDragStart = (event: DragStartEvent) => {
    const card = findCard(String(event.active.id));
    setActiveCard(card || null);
  };

  const onDragOver = (event: DragOverEvent) => {
    if (!board) return;
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeCol = findColumnByCardId(activeId);
    // over could be a card or a column
    let overCol = findColumnByCardId(overId);
    if (!overCol) {
      // over is a column id
      overCol = board.columns.find((c) => String(c.id) === overId);
    }

    if (!activeCol || !overCol || activeCol.id === overCol.id) return;

    // Move card between columns (optimistic)
    setBoard((prev) => {
      if (!prev) return prev;
      const newColumns = prev.columns.map((col) => ({
        ...col,
        cards: [...col.cards],
      }));
      const srcCol = newColumns.find((c) => c.id === activeCol.id)!;
      const destCol = newColumns.find((c) => c.id === overCol.id)!;
      const cardIndex = srcCol.cards.findIndex((c) => String(c.id) === activeId);
      if (cardIndex === -1) return prev;
      const [moved] = srcCol.cards.splice(cardIndex, 1);
      moved.column_id = destCol.id;

      const overCardIndex = destCol.cards.findIndex((c) => String(c.id) === overId);
      if (overCardIndex >= 0) {
        destCol.cards.splice(overCardIndex, 0, moved);
      } else {
        destCol.cards.push(moved);
      }
      return { ...prev, columns: newColumns };
    });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null);
    if (!board) return;
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeCol = findColumnByCardId(activeId);
    let overCol = findColumnByCardId(overId);
    if (!overCol) {
      overCol = board.columns.find((c) => String(c.id) === overId);
    }
    if (!activeCol || !overCol) return;

    const overCardIndex = overCol.cards.findIndex((c) => String(c.id) === overId);
    const destIndex = overCardIndex >= 0 ? overCardIndex : overCol.cards.length;

    try {
      await api.moveCard(parseInt(activeId), overCol.id, destIndex);
      await fetchBoard();
    } catch {
      await fetchBoard();
    }
  };

  const handleAddCard = async (columnId: number) => {
    try {
      await api.createCard(columnId, "New Card");
      await fetchBoard();
    } catch (err) {
      console.error("Failed to create card:", err);
    }
  };

  const handleRenameColumn = async (columnId: number, name: string) => {
    try {
      await api.renameColumn(columnId, name);
      await fetchBoard();
    } catch (err) {
      console.error("Failed to rename column:", err);
    }
  };

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
      await fetchBoard();
    } catch (err) {
      console.error("Failed to update card:", err);
    }
  };

  const handleDeleteCard = async (cardId: number) => {
    try {
      await api.deleteCard(cardId);
      setEditingCard(null);
      await fetchBoard();
    } catch (err) {
      console.error("Failed to delete card:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-[var(--gray-text)]">
        Loading board...
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex h-64 items-center justify-center text-red-500">
        Failed to load board
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto p-4">
          {board.columns
            .sort((a, b) => a.position - b.position)
            .map((column: Column) => (
              <div key={column.id} className="w-72 shrink-0">
                <KanbanColumn
                  column={column}
                  onRename={(name) => handleRenameColumn(column.id, name)}
                  onAddCard={() => handleAddCard(column.id)}
                >
                  <SortableContext
                    items={column.cards.map((c) => String(c.id))}
                    strategy={verticalListSortingStrategy}
                    id={String(column.id)}
                  >
                    {column.cards
                      .sort((a, b) => a.position - b.position)
                      .map((card: Card) => (
                        <SortableCard
                          key={card.id}
                          card={card}
                          onClick={() => setEditingCard(card)}
                        />
                      ))}
                  </SortableContext>
                </KanbanColumn>
              </div>
            ))}
        </div>

        <DragOverlay>
          {activeCard && (
            <div
              className="w-72 rounded bg-white p-3 shadow-lg border-l-[3px] border border-gray-100 opacity-90"
              style={{ borderLeftColor: PRIORITY_COLORS[(activeCard.priority || "medium") as Priority] }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-[var(--gray-text)]">
                  {TYPE_LABELS[(activeCard.card_type as keyof typeof TYPE_LABELS)] || "Task"}
                </span>
                {activeCard.points > 0 && (
                  <span className="text-[10px] font-bold rounded-full bg-[var(--blue-primary)] text-white w-5 h-5 flex items-center justify-center">
                    {activeCard.points}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-[var(--dark-navy)]">
                {activeCard.title}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {editingCard && (
        <CardModal
          card={editingCard}
          onSave={handleSaveCard}
          onDelete={handleDeleteCard}
          onClose={() => setEditingCard(null)}
        />
      )}
    </>
  );
}
