// apps/web/app/components/LogoutLink.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_BASE_URL ??
    "http://localhost:4000"
  );
}

export default function LogoutLink({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function onLogout(e: React.MouseEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`${apiBase()}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignorieren – wir leiten trotzdem um
    } finally {
      setBusy(false);
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      onClick={onLogout}
      className={
        "inline-flex items-center rounded-xl border border-border bg-card/60 px-3 py-1.5 text-sm " +
        "backdrop-blur hover:bg-card " +
        className
      }
      aria-label="Abmelden"
    >
      {busy ? "…" : "Abmelden"}
    </button>
  );
}
