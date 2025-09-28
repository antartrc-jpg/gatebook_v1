// apps/web/app/(protected)/admin/_components/SlidePage.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export default function SlidePage({
  title,
  children,
  top = 64, // px Abstand nach oben
}: {
  title: string;
  children: React.ReactNode;
  top?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(true);

  function close() {
    setOpen(false);
    setTimeout(() => router.back(), 180);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? close() : setOpen(o))}>
      <SheetContent side="bottom" className="h-[92vh] max-w-4xl p-0">
        <div
          className="mx-auto max-w-4xl px-6 pb-6 h-full flex flex-col"
          style={{ paddingTop: top }}
        >
          {/* Header (kein className direkt am SheetHeader) */}
          <div className="shrink-0">
            <SheetHeader>
              <SheetTitle className="text-xl">{title}</SheetTitle>
            </SheetHeader>
          </div>

          {/* Scrollbarer Inhalt */}
          <div className="grow overflow-auto pt-2">
            {children}
          </div>

          {/* Footer (kein className direkt am SheetFooter) */}
          <div className="shrink-0">
            <SheetFooter>
              <Button variant="secondary" onClick={close}>
                Schließen
              </Button>
            </SheetFooter>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
