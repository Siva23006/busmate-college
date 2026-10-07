"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";
import { Logo } from "@/components/Logo";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="anim-fade-in flex flex-col items-center gap-3">
          <Logo size={40} />
          <div className="progress-indeterminate h-1 w-28 rounded-full bg-[var(--surface-3)]" />
          <Loader2 className="sr-only" aria-label="Loading" />
        </div>
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}
