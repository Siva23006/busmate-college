"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/** Light / dark switch. Light is the default; the choice is remembered in localStorage. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("busmate_theme", next ? "dark" : "light"); } catch { /* ignore */ }
  };
  return (
    <button onClick={toggle} role="switch" aria-checked={dark} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className="relative inline-flex h-8 w-[58px] shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--surface-3)] px-1 transition-colors">
      <Sun className={`absolute left-[9px] h-3.5 w-3.5 transition-opacity ${dark ? "text-muted opacity-60" : "opacity-0"}`} />
      <Moon className={`absolute right-[9px] h-3.5 w-3.5 transition-opacity ${dark ? "opacity-0" : "text-muted opacity-60"}`} />
      <span className={`relative z-10 grid h-6 w-6 place-items-center rounded-full bg-[var(--surface)] shadow-[0_1px_3px_rgba(15,23,42,0.2)] transition-transform duration-300 ${dark ? "translate-x-[24px]" : "translate-x-0"}`}>
        {dark ? <Moon className="h-3.5 w-3.5 text-primary-text" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
      </span>
    </button>
  );
}

/**
 * Inline script for <head>: applies the saved theme before first paint (no flash).
 * Light is the default: dark is used only when the admin chose it with the switch.
 */
export const themeInitScript = `try{if(localStorage.getItem('busmate_theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;
