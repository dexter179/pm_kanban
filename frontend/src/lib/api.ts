import type { BoardData } from "@/lib/kanban";

export async function fetchMe(): Promise<string | null> {
  const response = await fetch("/api/me");
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data.username;
}

export async function login(
  username: string,
  password: string
): Promise<string> {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error("Invalid username or password");
  }
  const data = await response.json();
  return data.username;
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
}

export async function getBoard(): Promise<BoardData> {
  const response = await fetch("/api/board");
  if (!response.ok) {
    throw new Error("Failed to load board");
  }
  return response.json();
}

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export async function sendChat(
  message: string,
  history: ChatTurn[]
): Promise<{ reply: string; board: BoardData | null }> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!response.ok) {
    throw new Error("Chat request failed");
  }
  return response.json();
}

export async function saveBoard(board: BoardData): Promise<void> {
  const response = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw new Error("Failed to save board");
  }
}
