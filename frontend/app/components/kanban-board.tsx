"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { Board, Card, Column, PRIORITY_COLORS, TYPE_LABELS, safePriority, safeCardType } from "../types";
import KanbanColumn from "./kanban-column";
import SortableCard from "./sortable-card";
import CardModal from "./card-modal";

interface Props {
  refreshKey?: number;
}

export default function KanbanBoard({ refreshKey }: Props) {
  const [board, setBoard] = useState<Board | null>(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const boardSnapshot = useRef<Board | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchBoard = useCallback(async () => {
    try {
      const data = await api.getBoard();
      setBoard(data);
      setFetchError(null);
    } catch (err) {
      console.error("Failed to load board:", err);
      setFetchError("Failed to load board. Please refresh.");
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard, refreshKey]);

  const findCard = useCallback((id: string): Card | undefined => {
    if (!board) return undefined;
    for (const col of board.columns) {
      const card = col.cards.find((c) => String(c.id) === id);
      if (card) return card;
    }
    return undefined;
  }, [board]);

  const findColumnByCardId = useCallback((cardId: string): Column | undefined => {
    if (!board) return undefined;
    return board.columns.find((col) =>
      col.cards.some((c) => String(c.id) === cardId)
    );
  }, [board]);

  const onDragStart = useCallback((event: DragStartEvent) => {
    boardSnapshot.current = board;
    const card = findCard(String(event.active.id));
    setActiveCard(card || null);
  }, [board, findCard]);

  const onDragOver = useCallback((event: DragOverEvent) => {
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

    if (!activeCol || !overCol || activeCol.id === overCol.id) return;

    setBoard((prev) => {
      if (!prev) return prev;
      const newColumns = prev.columns.map((col) => ({
        ...col,
        cards: [...col.cards],
      }));
      const srcCol = newColumns.find((c) => c.id === activeCol.id);
      const destCol = newColumns.find((c) => c.id === overCol!.id);
      if (!srcCol || !destCol) return prev;
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
  }, [board, findColumnByCardId]);

  const onDragEnd = useCallback(async (event: DragEndEvent) => {
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
      await api.moveCard(parseInt(activeId, 10), overCol.id, destIndex);
      await fetchBoard();
    } catch {
      setBoard(boardSnapshot.current);
      await fetchBoard();
    }
  }, [board, findColumnByCardId, fetchBoard]);

  const handleAddCard = async (columnId: number) => {
    try {
      await api.createCard(columnId, "New Card");
      setMutationError(null);
      await fetchBoard();
    } catch {
      setMutationError("Failed to add card. Please try again.");
    }
  };

  const handleRenameColumn = async (columnId: number, name: string) => {
    try {
      await api.renameColumn(columnId, name);
      setMutationError(null);
      await fetchBoard();
    } catch {
      setMutationError("Failed to rename column. Please try again.");
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
      setMutationError(null);
      await fetchBoard();
    } catch {
      setMutationError("Failed to save card. Please try again.");
    }
  };

  const handleDeleteCard = async (cardId: number) => {
    try {
      await api.deleteCard(cardId);
      setEditingCard(null);
      setMutationError(null);
      await fetchBoard();
    } catch {
      setMutationError("Failed to delete card. Please try again.");
    }
  };

  const sortedColumns = useMemo(
    () => [...(board?.columns ?? [])].sort((a, b) => a.position - b.position),
    [board]
  );

  if (loading && initialLoad) {
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
      {fetchError && board && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 mx-4 mt-4 rounded">
          <span>{fetchError}</span>
          <button onClick={() => setFetchError(null)} className="ml-4 font-bold hover:opacity-70">×</button>
        </div>
      )}
      {mutationError && (
        <div className="flex items-center justify-between bg-orange-50 border border-orange-200 text-orange-700 text-sm px-4 py-2 mx-4 mt-2 rounded">
          <span>{mutationError}</span>
          <button onClick={() => setMutationError(null)} className="ml-4 font-bold hover:opacity-70">×</button>
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto p-4">
          {sortedColumns.map((column: Column) => (
            <div key={column.id} className="w-72 shrink-0">
              <KanbanColumn
                column={column}
                onRename={(name) => handleRenameColumn(column.id, name)}
                onAddCard={() => handleAddCard(column.id)}
              >
                <SortableContext
                  items={[...column.cards].sort((a, b) => a.position - b.position).map((c) => String(c.id))}
                  strategy={verticalListSortingStrategy}
                  id={String(column.id)}
                >
                  {[...column.cards]
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
              style={{ borderLeftColor: PRIORITY_COLORS[safePriority(activeCard.priority)] }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-[var(--gray-text)]">
                  {TYPE_LABELS[safeCardType(activeCard.card_type)] || "Task"}
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
