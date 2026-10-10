"use client";
import Link from "next/link";
import { useAsync } from "@/hooks/useAsync";
import { api } from "@/lib/api";
import { API_URL, GOOGLE_MAPS_API_KEY } from "@/lib/config";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChangePasswordForm } from "@/components/PasswordForms";
import { Badge, Button, Card, Credit, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const health = useAsync(() => api<{ status: string; database: string }>("/health"));
  return (
    <>
      <PageHeader title="Settings" subtitle="Check the connection to the BusMate server, see your account and switch between light and dark theme." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card delay={0} className="space-y-3 p-5 text-[13px]">
          <h3 className="text-[15px] font-semibold">Connection</h3>
          <div className="flex justify-between"><span className="text-muted">Backend URL</span><code className="rounded bg-[var(--surface-3)] px-1.5 py-0.5 text-xs">{API_URL}</code></div>
          <div className="flex justify-between"><span className="text-muted">Backend</span>
            {health.loading ? <Badge>checking</Badge> : health.data ? <Badge tone="green" dot>Online</Badge> : <Badge tone="red" dot>Unreachable</Badge>}</div>
          <div className="flex justify-between"><span className="text-muted">Database</span>
            <Badge tone={health.data?.database === "ok" ? "green" : "red"} dot>{health.data?.database ?? "unknown"}</Badge></div>
          <div className="flex justify-between"><span className="text-muted">Google Maps key</span>
            <Badge tone={GOOGLE_MAPS_API_KEY ? "green" : "amber"}>{GOOGLE_MAPS_API_KEY ? "Configured" : "Missing"}</Badge></div>
          <Button variant="secondary" onClick={health.reload}>Re-check</Button>
        </Card>
        <Card delay={1} className="space-y-3 p-5 text-[13px]">
          <h3 className="text-[15px] font-semibold">Account</h3>
          <div className="flex justify-between"><span className="text-muted">Name</span><span>{user?.name}</span></div>
          <div className="flex justify-between"><span className="text-muted">Email</span><span>{user?.email}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted">Theme</span><ThemeToggle /></div>
          <div className="flex flex-wrap gap-2">
            <Link href="/profile" className="inline-flex items-center rounded-lg border border-[var(--border)] px-3.5 py-2 text-[13px] font-semibold transition hover:bg-[var(--surface-2)]">Edit my profile</Link>
            <Button variant="danger" onClick={logout}>Logout</Button>
          </div>
        </Card>
        <Card delay={2} className="space-y-3 p-5 text-[13px]">
          <h3 className="text-[15px] font-semibold">Change password</h3>
          <p className="text-muted">Forgot it? Log out and use "Forgot password?" on the sign-in page.</p>
          <ChangePasswordForm />
        </Card>
        <Card delay={3} className="p-5 text-[13px]">
          <h3 className="mb-2 text-[15px] font-semibold">About</h3>
          <p className="text-muted">BusMate is a college transportation technology prototype. Arrival times are estimates, not guarantees. Data labeled DEMO / SIMULATION is never mixed with real tracking.</p>
          <Credit className="text-subtle mt-3" />
        </Card>
      </div>
    </>
  );
}
