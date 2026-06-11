"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import clsx from "clsx";
import { sendChat, type ChatTurn } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

type ChatSidebarProps = {
  onBoardUpdate: (board: BoardData) => void;
};

export const ChatSidebar = ({ onBoardUpdate }: ChatSidebarProps) => {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [turns, pending]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || pending) {
      return;
    }
    const history = turns;
    setInput("");
    setFailed(false);
    setTurns([...history, { role: "user", content: message }]);
    setPending(true);
    try {
      const result = await sendChat(message, history);
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: result.reply },
      ]);
      if (result.board) {
        onBoardUpdate(result.board);
      }
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-20 rounded-full bg-[var(--secondary-purple)] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-[var(--shadow)] transition hover:brightness-110"
      >
        AI Assistant
      </button>
    );
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-20 flex w-full max-w-[400px] flex-col border-l-4 border-[var(--accent-yellow)] bg-white/95 shadow-[var(--shadow)] backdrop-blur">
      <header className="flex items-start justify-between border-b border-[var(--stroke)] px-6 py-5">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--navy-dark)]">
            Board Assistant
          </h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Ask me to manage your cards
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close assistant"
          className="rounded-full border border-[var(--stroke)] px-3 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
        >
          Close
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
        {turns.length === 0 && (
          <p className="text-sm leading-6 text-[var(--gray-text)]">
            Try &quot;Add a card to Backlog for renewing the SSL certs&quot; or
            &quot;Move the analytics card to Review&quot;.
          </p>
        )}
        {turns.map((turn, index) => (
          <div
            key={index}
            className={clsx(
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap",
              turn.role === "user"
                ? "ml-auto bg-[var(--primary-blue)] text-white"
                : "border border-[var(--stroke)] bg-white text-[var(--navy-dark)]"
            )}
            data-testid={`chat-${turn.role}`}
          >
            {turn.content}
          </div>
        ))}
        {pending && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Thinking...
          </p>
        )}
        {failed && (
          <p role="alert" className="text-sm font-medium text-red-600">
            Something went wrong. Try again.
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-[var(--stroke)] px-6 py-4"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask the assistant..."
          className="w-full rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[var(--secondary-purple)] px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </aside>
  );
};
