"use client";
import { useCallback, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { Alert } from "@/types";
import { cn } from "./ui";

/** Shows incoming admin:alert events as toasts in the corner. */
export function useAlertToasts() {
  const [toasts, setToasts] = useState<Alert[]>([]);
  const push = useCallback((a: Alert) => {
    setToasts((t) => [a, ...t].slice(0, 4));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== a.id)), 8000);
  }, []);
  const view = (
    <div className="fixed bottom-4 right-4 z-50 w-80 space-y-2">
      {toasts.map((a) => (
        <div key={a.id} className={cn("surface flex gap-3 rounded-2xl border-l-4 p-3 shadow-xl",
          a.severity === "CRITICAL" ? "border-l-red-600" : a.severity === "WARNING" ? "border-l-amber-500" : "border-l-blue-500")}>
          <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", a.severity === "CRITICAL" ? "text-red-600" : "text-amber-500")} />
          <div className="flex-1 text-sm">
            <div className="font-bold">{a.bus_number ?? "Alert"} · {a.type.replace(/_/g, " ")}</div>
            <div className="text-muted">{a.message}</div>
          </div>
          <button onClick={() => setToasts((t) => t.filter((x) => x.id !== a.id))} aria-label="Dismiss"><X className="text-muted h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
  return { push, view };
}
