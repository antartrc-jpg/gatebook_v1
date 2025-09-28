// apps/web/components/ui/button.tsx
// GateBook Enterprise · Token-gebundener Button (shadcn-kompatibel light, mit asChild)

import * as React from "react";

/* kleine Hilfsfunktion zum Mergen von Klassen */
function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";
export type ButtonSize = "sm" | "md";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Rendert die Klassen/Props auf das einzige Kind (z. B. <Link>) */
  asChild?: boolean;
}

/**
 * Token-gebundene Varianten:
 *  - primary      → bg-[--brand] / text-[--brand-foreground] / border-[--brand]
 *  - secondary    → bg-muted / text-foreground / border-[--border]
 *  - outline      → bg-transparent / text-foreground / border-[--border]
 *  - ghost        → bg-transparent / text-foreground / border-transparent
 *  - destructive  → bg-[--destructive] / text-[--destructive-foreground]
 *
 * Alle Farben hängen ausschließlich an CSS-Variablen
 * (z. B. --brand, --brand-foreground, --border, --muted, --foreground, --destructive).
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", asChild = false, children, ...props },
    ref
  ) => {
    const base =
      "inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-colors " +
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
      "disabled:pointer-events-none disabled:opacity-50 select-none ring-offset-background";

    const sizes = {
      sm: "h-9 px-3 text-sm",
      md: "h-10 px-4 text-sm", // h-10 = Next/shadcn-Standardhöhe
    } as const;

    const variants: Record<ButtonVariant, string> = {
      primary:
        "border text-[hsl(var(--brand-foreground))] bg-[hsl(var(--brand))] border-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))]/90",
      secondary:
        "border bg-muted text-foreground border-[hsl(var(--border))] hover:bg-muted/80",
      outline:
        "border bg-transparent text-foreground border-[hsl(var(--border))] hover:bg-muted",
      ghost:
        "bg-transparent text-foreground hover:bg-muted border border-transparent",

      // ⬇️ Fallback: wenn --destructive* nicht gesetzt ist, nimm --brand*
      destructive:
        "border bg-[hsl(var(--destructive,var(--brand)))] " +
        "text-[hsl(var(--destructive-foreground,var(--brand-foreground)))] " +
        "border-[hsl(var(--destructive,var(--brand)))] " +
        "hover:bg-[hsl(var(--destructive,var(--brand)))]/90",
    };

    const classes = cn(base, sizes[size], variants[variant], className);

    // asChild: übertrage Klassen/Props auf das einzige Kind (z. B. <Link>)
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        className: cn(classes, (children as any).props?.className),
        // keine Button-spezifischen Props wie "type" erzwingen
        ...props,
      });
    }

    // Default: echtes <button>
    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
