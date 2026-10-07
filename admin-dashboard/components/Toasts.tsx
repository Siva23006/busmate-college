"use client";
import { useCallback, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { Alert } from "@/types";
import { cn } from "./ui";
import { alertTitle } from "@/lib/format";

/** Shows incoming admin:alert events as toasts in the corner. */
export function useAlertToasts() {
  const [toasts, setToasts] = useState<Alert[]>([]);
  const push = useCallback((a: Alert) => {
    setToasts((t) => [a, ...t].slice(0, 4));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== a.id)), 8000);
  }, []);
  const view = (
    <div className="fixed bottom-4 right-4 z-50 w-80 space-y-2" aria-live="polite">
      {toasts.map((a) => (
        <div key={a.id} className={cn("anim-scale-in flex gap-3 rounded-xl border border-[var(--border)] border-l-4 bg-[var(--surface)] p-3 shadow-[var(--shadow-lg)]",
          a.severity === "CRITICAL" ? "border-l-red-600" : a.severity === "WARNING" ? "border-l-amber-500" : "border-l-blue-500")}>
          <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", a.severity === "CRITICAL" ? "text-red-600" : a.severity === "WARNING" ? "text-amber-500" : "text-blue-500")} />
          <div className="min-w-0 flex-1 text-[13px]">
            <div className="font-semibold">{a.bus_number ?? "Alert"} · {alertTitle(a.type)}</div>
            <div className="text-muted text-xs">{a.message}</div>
          </div>
          <button onClick={() => setToasts((t) => t.filter((x) => x.id !== a.id))} aria-label="Dismiss" className="self-start rounded p-0.5 hover:bg-[var(--surface-3)]"><X className="text-muted h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
  return { push, view };
}
