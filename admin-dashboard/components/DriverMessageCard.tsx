"use client";
// Latest message the driver sent for the running trip ("Heavy traffic · about 10 min late").
// Loaded from GET /buses/:id/messages when a bus is picked, then kept fresh by the bus:message socket event.
import { useEffect, useState } from "react";
import { MessageSquare, Wrench } from "lucide-react";
import type { LiveBus } from "@/hooks/useLiveBuses";
import { busApi } from "@/services/busmate";
import { timeAgo } from "@/lib/format";
import type { DriverMessage } from "@/types";
import { cn } from "./ui";

/** Newest driver message for this bus's running trip (REST snapshot or live event, whichever is newer). */
export function useDriverMessage(bus: LiveBus | null): DriverMessage | null {
  const busId = bus?.id ?? null;
  const tripId = bus?.active_trip_id ?? null;
  const [fetched, setFetched] = useState<{ tripId: number; msg: DriverMessage } | null>(null);

  useEffect(() => {
    setFetched(null);
    if (!busId || !tripId) return;
    let cancelled = false;
    busApi.messages(busId)
      .then(({ messages }) => { if (!cancelled && messages[0]) setFetched({ tripId, msg: messages[0] }); })
      .catch(() => { /* optional info: ignore */ });
    return () => { cancelled = true; };
  }, [busId, tripId]);

  if (!tripId) return null;
  const rest = fetched && fetched.tripId === tripId ? fetched.msg : null;
  const live = bus?.message ?? null;
  if (!rest) return live;
  if (!live) return rest;
  return new Date(live.created_at).getTime() >= new Date(rest.created_at).getTime() ? live : rest;
}

export function DriverMessageCard({ message, className }: { message: DriverMessage | null; className?: string }) {
  if (!message) return null;
  const breakdown = message.kind === "BREAKDOWN";
  const Icon = breakdown ? Wrench : MessageSquare;
  return (
    <div className={cn("anim-fade-in flex items-start gap-2.5 rounded-xl border p-3 text-[13px]",
      breakdown
        ? "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
        : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100", className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="font-semibold">Driver:</span> {message.message}
        <span className="opacity-70"> · {timeAgo(message.created_at)}</span>
      </div>
    </div>
  );
}
