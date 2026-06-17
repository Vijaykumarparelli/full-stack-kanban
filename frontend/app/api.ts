const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem("token");
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<{ id: number; username: string }>("/api/auth/me"),

  getBoard: () => request<import("./types").Board>("/api/board"),

  renameColumn: (id: number, name: string) =>
    request<import("./types").Column>(`/api/columns/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),

  getAllCards: () => request<import("./types").Card[]>("/api/cards"),

  createCard: (column_id: number, title: string, description = "", priority = "medium", card_type = "task", points = 0) =>
    request<import("./types").Card>("/api/cards", {
      method: "POST",
      body: JSON.stringify({ column_id, title, description, priority, card_type, points }),
    }),

  updateCard: (id: number, data: { title?: string; description?: string; priority?: string; card_type?: string; points?: number }) =>
    request<import("./types").Card>(`/api/cards/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  moveCard: (id: number, column_id: number, position: number) =>
    request<import("./types").Card>(`/api/cards/${id}/move`, {
      method: "PUT",
      body: JSON.stringify({ column_id, position }),
    }),

  deleteCard: (id: number) =>
    request<void>(`/api/cards/${id}`, { method: "DELETE" }),

  chat: (message: string, history: import("./types").ChatMessage[]) =>
    request<import("./types").AIResponse>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, history }),
    }),
};
