"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="text-muted h-6 w-6 animate-spin" /></div>;
  }
  return <AppShell>{children}</AppShell>;
}
