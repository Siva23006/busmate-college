"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from its previous value to `target` (ease-out). Returns null until the
 * first value arrives. Jumps straight to the value when the user prefers reduced motion.
 */
export function useCountUp(target: number | null | undefined, durationMs = 900): number | null {
  const [value, setValue] = useState<number | null>(null);
  const fromRef = useRef<number>(0);

  useEffect(() => {
    if (target == null) return;
    const from = fromRef.current;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from === target) { fromRef.current = target; setValue(target); return; }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      fromRef.current = t < 1 ? v : target;
      setValue(t < 1 ? Math.round(v) : target);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
