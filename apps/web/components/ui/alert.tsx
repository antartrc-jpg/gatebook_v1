import * as React from "react";
import { cn } from "../../app/lib/utils";

type Variant = "default" | "success" | "warning" | "destructive";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

export function Alert({ className, variant = "default", ...props }: AlertProps) {
  const tone =
    variant === "success"
      ? "border-green-600/30"
      : variant === "warning"
      ? "border-amber-600/30"
      : variant === "destructive"
      ? "border-red-600/30"
      : "border-border";
  return (
    <div
      role="alert"
      className={cn("rounded-lg border p-4 bg-card/30 text-card-foreground", tone, className)}
      {...props}
    />
  );
}

export const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
  )
);
AlertTitle.displayName = "AlertTitle";

export const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
AlertDescription.displayName = "AlertDescription";
