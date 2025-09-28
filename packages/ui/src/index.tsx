// packages/ui/src/index.tsx
import * as React from "react";

/**
 * GateBook UI (Minimal-Wrapper, Option A)
 * Zweck: Sofortige Auflösbarkeit der Imports (@gatebook/ui) und konsistente, neutrale
 * Basiskomponenten für Welle 1. Später ersetz-/erweiterbar durch shadcn/ui-Kompositionen.
 *
 * Design-Leitplanken (SSOT):
 * - Neutrale, zurückhaltende Optik (AA-Kontrast erreichbar über Tokens/Theming).
 * - Keine Inline-Magie: einfache Tailwind-Klassen, klare Props.
 * - Komponenten sind unkontrolliert, stylen nur via className-Merger.
 */

// ----------------------------------------------------------------------------
// Utils
// ----------------------------------------------------------------------------
function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

// ----------------------------------------------------------------------------
// Card
// ----------------------------------------------------------------------------
export type CardProps = React.HTMLAttributes<HTMLDivElement>;
export function Card({ className, ...rest }: CardProps) {
  return <div {...rest} className={cx("rounded-2xl border p-4 shadow-sm bg-white", className)} />;
}

export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;
export function CardHeader({ className, ...rest }: CardHeaderProps) {
  return <div {...rest} className={cx("mb-2", className)} />;
}

export type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;
export function CardTitle({ className, ...rest }: CardTitleProps) {
  return <h2 {...rest} className={cx("text-xl font-semibold tracking-tight", className)} />;
}

export type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;
export function CardDescription({ className, ...rest }: CardDescriptionProps) {
  return <p {...rest} className={cx("text-sm opacity-80", className)} />;
}

export type CardContentProps = React.HTMLAttributes<HTMLDivElement>;
export function CardContent({ className, ...rest }: CardContentProps) {
  return <div {...rest} className={cx("grid gap-4", className)} />;
}

export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;
export function CardFooter({ className, ...rest }: CardFooterProps) {
  return <div {...rest} className={cx("mt-4 flex items-center gap-2", className)} />;
}

// ----------------------------------------------------------------------------
// Form: Input / Label
// ----------------------------------------------------------------------------
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
export function Input({ className, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={cx(
        "h-10 w-full rounded-xl border px-3 outline-none bg-white",
        "focus:ring-2 focus:ring-offset-0 focus:ring-black/20",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    />
  );
}

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;
export function Label({ className, ...rest }: LabelProps) {
  return <label {...rest} className={cx("text-sm font-medium", className)} />;
}

// ----------------------------------------------------------------------------
// Button (mit asChild-Unterstützung)
// ----------------------------------------------------------------------------
export type ButtonProps = {
  variant?: "default" | "ghost";
  size?: "sm" | "md";
  asChild?: boolean;
  className?: string;
  children?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "default",
  size = "md",
  asChild = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  const base = "inline-flex items-center justify-center transition select-none";
  const v =
    variant === "ghost"
      ? "bg-transparent hover:bg-black/5 text-current"
      : "bg-black text-white hover:bg-black/90";
  const s = size === "sm" ? "h-9 px-3 text-sm rounded-xl" : "h-10 px-4 rounded-xl";
  const classes = cx(base, v, s, "disabled:opacity-50 disabled:cursor-not-allowed", className);

  if (asChild && React.isValidElement(children)) {
    // Klont das Kind (z. B. <Link><a/></Link> → <a className="...">)
    // und überträgt ARIA/disabled soweit sinnvoll. Minimal, Option A.
    const child: any = children;
    const mergedClass = cx(child.props?.className, classes);
    const cloned = React.cloneElement(child, {
      ...rest,
      className: mergedClass,
      role: child.props?.role ?? "button",
      "aria-disabled": rest.disabled ?? child.props?.["aria-disabled"],
      tabIndex: child.props?.tabIndex ?? (rest.disabled ? -1 : undefined),
    });
    return <>{cloned}</>;
  }

  return (
    <button {...rest} className={classes}>
      {children}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Alert
// ----------------------------------------------------------------------------
export type AlertProps = React.HTMLAttributes<HTMLDivElement>;
export function Alert({ className, ...rest }: AlertProps) {
  return <div role="alert" {...rest} className={cx("rounded-xl border p-3 bg-white", className)} />;
}

export type AlertTitleProps = React.HTMLAttributes<HTMLParagraphElement>;
export function AlertTitle({ className, ...rest }: AlertTitleProps) {
  return <p {...rest} className={cx("font-semibold", className)} />;
}

export type AlertDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;
export function AlertDescription({ className, ...rest }: AlertDescriptionProps) {
  return <p {...rest} className={cx("text-sm opacity-85", className)} />;
}

/*
[Referenzblock – Kap. 17.4]
- Design/Theme/Tokens & AA-Kontrast: Kap. 15.6, 18.8
- MVP-UI-Komponenten (klare, minimale UIs): Kap. 21.2
- Arbeitsweise/Transparenz: Kap. 17 (Option A minimal; asChild zur Vermeidung von <button><a/></button>-Nesting)

[Orchestrator-Handover – Einzeiler]
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/orch/update_handover.ps1 `
  -Chat WEB `
  -Gate "Gate A" `
  -Status "delivered — @gatebook/ui Button asChild implementiert; VSCode-Squiggles beseitigt" `
  -Deliverable "packages/ui/src/index.tsx" `
  -Summary "asChild-Klonlogik aktiv; Register-Link-Button validiert"
*/
