"use client";
// Listens for driver SOS (admin:sos) on every dashboard page: shows a red banner at the top
// and sounds a short alarm. "Acknowledge" resolves the matching SOS alert.
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { CheckCircle2, ExternalLink, Phone, Siren, X } from "lucide-react";
import { API_URL } from "@/lib/config";
import { errorMessage, tokenStore } from "@/lib/api";
import { alertApi } from "@/services/busmate";
import { clock, timeAgo } from "@/lib/format";
import type { SosEvent } from "@/types";
import { Button } from "./ui";

type AudioCtor = typeof AudioContext;
let audioCtx: AudioContext | null = null;

/** One shared AudioContext, created lazily (browsers only allow sound after a user gesture). */
function getAudio(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctor: AudioCtor | undefined = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => undefined);
    return audioCtx;
  } catch {
    return null;
  }
}

/** Siren-like beeps: 3 bursts of 3 high/low tones. Fails silently if audio is blocked. */
function playAlarm() {
  const ctx = getAudio();
  if (!ctx) return;
  try {
    const start = ctx.currentTime + 0.05;
    for (let burst = 0; burst < 3; burst++) {
      for (let i = 0; i < 3; i++) {
        const t = start + burst * 1.2 + i * 0.28;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(i % 2 ? 660 : 880, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.24);
      }
    }
  } catch { /* audio not available */ }
}

export function SosAlarm() {
  const [items, setItems] = useState<SosEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Unlock audio on the first click/tap so a later SOS can sound.
    const unlock = () => { getAudio(); window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    const socket: Socket = io(API_URL, { auth: { token: tokenStore.get() }, transports: ["websocket", "polling"], reconnectionDelayMax: 5000 });
    socket.on("admin:sos", (ev: SosEvent) => {
      setItems((prev) => [ev, ...prev.filter((p) => !(p.alertId != null && p.alertId === ev.alertId))].slice(0, 5));
      playAlarm();
    });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      socket.close();
    };
  }, []);

  // Ring again every 20 s while an SOS is waiting for acknowledgement.
  useEffect(() => {
    if (!items.length) return;
    const t = setInterval(playAlarm, 20000);
    return () => clearInterval(t);
  }, [items.length]);

  const keyOf = (s: SosEvent) => `${s.alertId ?? "x"}-${s.at}`;
  const remove = (s: SosEvent) => setItems((prev) => prev.filter((p) => keyOf(p) !== keyOf(s)));

  async function acknowledge(s: SosEvent) {
    setError(null);
    if (s.alertId == null) { remove(s); return; }
    setBusy(keyOf(s));
    try {
      await alertApi.resolve(s.alertId);
      remove(s);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (!items.length) return null;
  return (
    <div className="no-print fixed inset-x-0 top-0 z-[70] space-y-1 p-2" role="alert" aria-live="assertive">
      {items.map((s) => (
        <div key={keyOf(s)} className="anim-scale-in mx-auto flex max-w-5xl flex-wrap items-center gap-3 rounded-xl bg-red-600 px-4 py-3 text-white shadow-[0_10px_30px_-8px_rgba(220,38,38,0.7)] ring-2 ring-red-300">
          <span className="pulse-dot grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 text-white"><Siren className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1 text-[13px]">
            <div className="text-[15px] font-bold tracking-tight">
              SOS — {s.busNumber} · Driver {s.driverName}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-red-50">
              {s.driverPhone && (
                <a href={`tel:${s.driverPhone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                  <Phone className="h-3.5 w-3.5" /> {s.driverPhone}
                </a>
              )}
              {s.note && <span className="font-medium">“{s.note}”</span>}
              {s.mapLink ? (
                <a href={s.mapLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                  <ExternalLink className="h-3.5 w-3.5" /> Open location
                </a>
              ) : <span className="opacity-80">Location unknown</span>}
              <span className="opacity-80" title={clock(s.at)}>{timeAgo(s.at)}</span>
            </div>
            {error && busy === null && <div className="mt-1 text-xs text-red-100">{error}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="ghost" className="bg-white !text-red-700 hover:!bg-red-50" loading={busy === keyOf(s)} onClick={() => acknowledge(s)}>
              <CheckCircle2 className="h-4 w-4" /> Acknowledge
            </Button>
            <button onClick={() => remove(s)} className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Hide (keeps the alert open)" title="Hide (keeps the alert open)">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
