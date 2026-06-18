"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "../api";
import { ChatMessage } from "../types";

interface MessageWithId extends ChatMessage {
  id: number;
}

interface Props {
  onBoardUpdated: () => void;
}

export default function ChatSidebar({ onBoardUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<MessageWithId[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgIdRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: MessageWithId = { id: ++msgIdRef.current, role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const history: ChatMessage[] = updated.map(({ role, content }) => ({ role, content }));
      const res = await api.chat(text, history);
      setMessages((prev) => [
        ...prev,
        { id: ++msgIdRef.current, role: "assistant", content: res.message },
      ]);
      if (res.actions && res.actions.length > 0) {
        onBoardUpdated();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: ++msgIdRef.current, role: "assistant", content: "Sorry, something went wrong." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--purple-secondary)] text-white shadow-lg hover:opacity-90"
          title="Open AI Chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {open && (
        <div className="fixed right-0 top-0 z-40 flex h-full w-80 flex-col border-l border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3 bg-[var(--dark-navy)]">
            <h2 className="text-sm font-semibold text-white">AI Assistant</h2>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close AI Assistant"
              className="text-white/70 hover:text-white text-lg"
            >
              x
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-xs text-[var(--gray-text)] mt-8">
                Ask the AI to create, move, or edit cards on your board.
              </p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "ml-auto bg-[var(--blue-primary)] text-white"
                    : "bg-gray-100 text-[var(--foreground)]"
                }`}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="max-w-[85%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-[var(--gray-text)]">
                Thinking...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask the AI..."
                className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-[var(--blue-primary)] focus:outline-none"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="rounded bg-[var(--purple-secondary)] px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
