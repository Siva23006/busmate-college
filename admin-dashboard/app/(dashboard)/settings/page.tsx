"use client";
import { useAsync } from "@/hooks/useAsync";
import { api } from "@/lib/api";
import { API_URL, GOOGLE_MAPS_API_KEY } from "@/lib/config";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const health = useAsync(() => api<{ status: string; database: string }>("/health"));
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5 text-sm">
          <h3 className="text-base font-bold">Connection</h3>
          <div className="flex justify-between"><span className="text-muted">Backend URL</span><code>{API_URL}</code></div>
          <div className="flex justify-between"><span className="text-muted">Backend</span>
            {health.loading ? <Badge>checking</Badge> : health.data ? <Badge tone="green" dot>Online</Badge> : <Badge tone="red" dot>Unreachable</Badge>}</div>
          <div className="flex justify-between"><span className="text-muted">Database</span>
            <Badge tone={health.data?.database === "ok" ? "green" : "red"} dot>{health.data?.database ?? "unknown"}</Badge></div>
          <div className="flex justify-between"><span className="text-muted">Google Maps key</span>
            <Badge tone={GOOGLE_MAPS_API_KEY ? "green" : "amber"}>{GOOGLE_MAPS_API_KEY ? "Configured" : "Missing"}</Badge></div>
          <Button variant="secondary" onClick={health.reload}>Re-check</Button>
        </Card>
        <Card className="space-y-3 p-5 text-sm">
          <h3 className="text-base font-bold">Account</h3>
          <div className="flex justify-between"><span className="text-muted">Name</span><span>{user?.name}</span></div>
          <div className="flex justify-between"><span className="text-muted">Email</span><span>{user?.email}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted">Theme</span><ThemeToggle /></div>
          <Button variant="danger" onClick={logout}>Logout</Button>
        </Card>
        <Card className="p-5 text-sm lg:col-span-2">
          <h3 className="mb-2 text-base font-bold">About</h3>
          <p className="text-muted">BusMate is a college transportation technology prototype. Arrival times are estimates, not guarantees. Data labeled DEMO / SIMULATION is never mixed with real tracking.</p>
        </Card>
      </div>
    </>
  );
}
