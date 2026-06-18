async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(path, { ...options, headers, credentials: "include" });
  if (res.status === 401) {
    // Don't dispatch for the session-check call itself (would trigger logout on every page load)
    if (path !== "/api/auth/me") {
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
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
    request<{ username: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<{ username: string }>("/api/auth/me"),

  logout: (): Promise<void> =>
    request<void>("/api/auth/logout", { method: "POST" }),

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
