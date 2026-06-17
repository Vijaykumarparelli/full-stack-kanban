export type Priority = "low" | "medium" | "high" | "critical";
export type CardType = "task" | "bug" | "issue" | "feature" | "improvement";

export const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];
export const CARD_TYPES: CardType[] = ["task", "bug", "issue", "feature", "improvement"];

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: "#22c55e",
  medium: "#ecad0a",
  high: "#f97316",
  critical: "#ef4444",
};

export const TYPE_LABELS: Record<CardType, string> = {
  task: "Task",
  bug: "Bug",
  issue: "Issue",
  feature: "Feature",
  improvement: "Improvement",
};

export interface Card {
  id: number;
  column_id: number;
  title: string;
  description: string;
  priority: Priority;
  card_type: CardType;
  points: number;
  position: number;
  column_name?: string;
}

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  cards: Card[];
}

export interface Board {
  id: number;
  user_id: number;
  name: string;
  columns: Column[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIAction {
  type: "create_card" | "move_card" | "edit_card" | "delete_card" | "rename_column";
  params: Record<string, unknown>;
}

export interface AIResponse {
  message: string;
  actions: AIAction[];
  board: Board;
}
