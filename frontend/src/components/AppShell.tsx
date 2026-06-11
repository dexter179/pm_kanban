"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { fetchMe, logout } from "@/lib/api";

export const AppShell = () => {
  const [user, setUser] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .finally(() => setChecking(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
        Loading...
      </main>
    );
  }

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  return <KanbanBoard user={user} onLogout={handleLogout} />;
};
