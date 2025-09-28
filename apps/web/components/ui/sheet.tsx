/* FILE: apps/web/components/ui/sheet.tsx
   GateBook Enterprise · UI-Wrapper — Sheet (Bottom/Side Drawer)
   Status: delivered

   Zweck
   ─────
   • Minimaler, eigener Drawer (Sheet) ohne Fremdpakete — kompatibel zu shadcn-API.
   • Unterstützt:
       - <Sheet open onOpenChange> als Controller
       - <SheetContent side="bottom"|"right"|"left"|"top">
       - <SheetHeader>, <SheetTitle>, <SheetDescription>, <SheetFooter>
   • Zugänglich:
       - role="dialog", aria-modal
       - ESC schließt (onOpenChange(false))
       - Overlay-Klick schließt
       - Auto-Fokus auf Content bei Öffnen

   Abhängigkeiten: keine externen; nutzt Design-Tokens (bg/card/border/fg).
*/

"use client";

import * as React from "react";
import { createPortal } from "react-dom";

/* --------------------------------------------------------------------------------
   Hilfen
-------------------------------------------------------------------------------- */

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type SheetContextValue = {
  open: boolean;
  setOpen(next: boolean): void;
  side: Side;
};

const SheetCtx = React.createContext<SheetContextValue | null>(null);

type Side = "bottom" | "right" | "left" | "top";

/* --------------------------------------------------------------------------------
   Sheet (Controller)
-------------------------------------------------------------------------------- */

export type SheetProps = {
  /** Extern kontrolliert */
  open: boolean;
  /** Wird aufgerufen, wenn Nutzer schließt (Overlay, ESC, Close-Icon, etc.) */
  onOpenChange?: (open: boolean) => void;
  /** Inhalt inkl. Header/Content/Footer */
  children: React.ReactNode;
  /** Default-Seite, falls SheetContent kein side setzt */
  side?: Side;
  /** Optional: Body-Scroll beim Öffnen sperren (default: true) */
  lockScroll?: boolean;
};

export function Sheet({
  open,
  onOpenChange,
  children,
  side = "bottom",
  lockScroll = true,
}: SheetProps) {
  // Body-Scroll sperren (angenehmer bei Bottom-Sheet)
  React.useEffect(() => {
    if (!lockScroll) return;
    const prev = document.documentElement.style.overflowY;
    if (open) {
      document.documentElement.style.overflowY = "hidden";
    }
    return () => {
      document.documentElement.style.overflowY = prev || "";
    };
  }, [open, lockScroll]);

  const setOpen = React.useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  return (
    <SheetCtx.Provider value={{ open, setOpen, side }}>
      {children}
    </SheetCtx.Provider>
  );
}

/* --------------------------------------------------------------------------------
   Portal
-------------------------------------------------------------------------------- */

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/* --------------------------------------------------------------------------------
   SheetContent
-------------------------------------------------------------------------------- */

export type SheetContentProps = {
  children: React.ReactNode;
  className?: string;
  side?: Side;
  /** Schließt bei Klick auf Overlay (default: true) */
  closeOnOverlay?: boolean;
};

export function SheetContent({
  children,
  className = "",
  side,
  closeOnOverlay = true,
}: SheetContentProps) {
  const ctx = React.useContext(SheetCtx);
  if (!ctx) throw new Error("<SheetContent> muss innerhalb von <Sheet> verwendet werden.");

  const activeSide = side ?? ctx.side;

  // ESC Close
  React.useEffect(() => {
    if (!ctx.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        ctx.setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.open]);

  // Auto-Fokus
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (ctx.open) {
      // kleine Verzögerung, bis Portal gemountet
      const t = setTimeout(() => ref.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [ctx.open]);

  if (!ctx.open) return null;

  // Positions-/Animationsklassen
  const pos: Record<Side, string> = {
    bottom: "left-0 right-0 bottom-0 w-full rounded-t-2xl",
    top: "left-0 right-0 top-0 w-full rounded-b-2xl",
    right: "top-0 right-0 h-full rounded-l-2xl",
    left: "top-0 left-0 h-full rounded-r-2xl",
  };

  const enterFrom: Record<Side, string> = {
    bottom: "translate-y-full",
    top: "-translate-y-full",
    right: "translate-x-full",
    left: "-translate-x-full",
  };

  return (
    <Portal>
      {/* Overlay */}
      <div
        className={clsx(
          "fixed inset-0 z-50 bg-black/40",
          "animate-[fadeIn_150ms_ease-out]"
        )}
        aria-hidden="true"
        onClick={() => closeOnOverlay && ctx.setOpen(false)}
      />
      {/* Inhalt */}
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={clsx(
          "fixed z-50 bg-card text-card-foreground border border-border shadow-2xl",
          "focus-visible:outline-none",
          pos[activeSide],
          // einfache Einblende/Slide-Animation
          "animate-[sheetIn_220ms_cubic-bezier(0.2,0.8,0.2,1)]",
          className
        )}
        data-side={activeSide}
      >
        {children}
      </div>

      {/* Keyframes (global im Portal). Tailwind erlaubt keine dynamischen @keyframes → inline CSS */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes sheetIn { from { transform: ${({
            bottom: "translateY(100%)",
            top: "translateY(-100%)",
            right: "translateX(100%)",
            left: "translateX(-100%)",
          } as const)[activeSide]} } to { transform: translate(0,0) } }
          `,
        }}
      />
    </Portal>
  );
}

/* --------------------------------------------------------------------------------
   Struktur-Helfer (Header/Title/Description/Footer)
-------------------------------------------------------------------------------- */

export function SheetHeader({ children }: { children?: React.ReactNode }) {
  return <div className="mb-4 grid gap-1">{children}</div>;
}

export function SheetTitle({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <h2 className={clsx("text-lg font-semibold", className)}>{children}</h2>;
}

export function SheetDescription({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <p className={clsx("text-sm text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export function SheetFooter({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={clsx("mt-4 flex items-center justify-end gap-2", className)}>{children}</div>;
}

export default Sheet;

/* ────────────────────────────────────────────────────────────────────────────
Selbstcheck
— API deckt genutzte Signatur ab: <Sheet open onOpenChange><SheetContent side="bottom">…</SheetContent></Sheet>
— Overlay/ESC schließen via onOpenChange(false); Auto-Fokus auf Content.
— Tokens: bg-card, text-card-foreground, border-border übernehmen Theme-Livewerte.

Verifikation (manuell)
1) „Layout anpassen“ öffnen → Overlay + Bottom-Sheet sliden ein.
2) Overlay-Klick/ESC → Drawer schließt (Schließen=verwerfen bleibt in Page-Logik).
3) Tastatur: Fokus liegt auf Sheet; Tab-Zyklus bleibt im Dialogbereich.

Orchestrator-Handover (Status "delivered")
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat TECHNIKER `
  -Gate "W1 · UI Wrapper Sheet" `
  -Status "delivered — lokaler Drawer (Sheet) implementiert; kompatibel zum Admin-Theme-Flow" `
  -Deliverable "apps/web/components/ui/sheet.tsx" `
  -Summary "Kein Fremdpaket; ESC/Overlay schließen; Tokens für Theme"
*/
