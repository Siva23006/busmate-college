"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

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
    <button onClick={toggle} className="text-muted rounded-xl p-2 hover:bg-[var(--surface-2)]" aria-label="Toggle theme">
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

/** Inline script for <head>: applies the saved theme before first paint (no flash). */
export const themeInitScript = `try{var t=localStorage.getItem('busmate_theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;
