// apps/web/components/AuthAwareLogout.tsx
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import LogoutLink from "./LogoutLink";

function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? "http://localhost:4000";
}

export default function AuthAwareLogout() {
  const pathname = usePathname();
  const [authed, setAuthed] = React.useState(false);

  const check = React.useCallback(async () => {
    try {
      const r = await fetch(`${apiBase()}/me`, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) return setAuthed(false);
      const j = (await r.json()) as { authenticated?: boolean };
      setAuthed(Boolean(j?.authenticated));
    } catch {
      setAuthed(false);
    }
  }, []);

  // bei Routenwechseln / Fokus / Sichtbarkeitswechsel nachprüfen
  React.useEffect(() => { check(); }, [check, pathname]);
  React.useEffect(() => {
    const onFocus = () => check();
    const onVis = () => document.visibilityState === "visible" && check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [check]);

  if (!authed) return null;
  return (
    <div className="fixed right-4 top-4 z-50">
      <LogoutLink />
    </div>
  );
}
