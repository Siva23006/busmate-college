"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Plus, Route as RouteIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAsync } from "@/hooks/useAsync";
import { routeApi } from "@/services/busmate";
import { errorMessage } from "@/lib/api";
import { Badge, Button, Card, DemoBadge, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Table, TableSkeleton, Td } from "@/components/ui";

export default function RoutesPage() {
  const routes = useAsync(() => routeApi.list().then((r) => r.routes));
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ route_name: "", description: "", start_location: "", destination: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setSaving(true); setError(null);
    try {
      const { route } = await routeApi.create({
        route_name: form.route_name.trim(), description: form.description.trim() || null,
        start_location: form.start_location.trim() || null, destination: form.destination.trim() || null,
      });
      router.push(`/routes/${route.id}`);
    } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
  }
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader title="Routes" subtitle="A route is the path a bus follows. Create one, then click the map to add its stops in morning order."
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create route</Button>} />
      {routes.error && <div className="mb-4"><ErrorBox message={routes.error} onRetry={routes.reload} /></div>}
      <Card>
        {routes.loading ? <TableSkeleton /> : !routes.data?.length ? (
          <EmptyState icon={RouteIcon} title="No routes yet" text="Create your first route, add its stops on the map, then assign it to a bus on the Buses page." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create route</Button>} />
        ) : (
          <Table head={["Route", "From → To", "Stops", "Buses", "Status", ""]}>
            {routes.data.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-[var(--surface-2)]" onClick={() => router.push(`/routes/${r.id}`)}>
                <Td className="font-semibold"><span className="flex items-center gap-2">{r.route_name}{r.is_demo && <DemoBadge />}</span></Td>
                <Td className="text-muted">{r.start_location ?? "-"} → {r.destination ?? "-"}</Td>
                <Td>{r.stop_count ?? 0}</Td>
                <Td>{r.buses?.map((b) => b.bus_number).join(", ") || <span className="text-muted">None</span>}</Td>
                <Td><Badge tone={r.active ? "green" : "slate"} dot>{r.active ? "Active" : "Disabled"}</Badge></Td>
                <Td><Link href={`/routes/${r.id}`} onClick={(e) => e.stopPropagation()}><ChevronRight className="text-muted h-4 w-4" /></Link></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal open={open} title="Create route" onClose={() => setOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={create} disabled={!form.route_name.trim()}>Create & add stops</Button></>}>
        {error && <ErrorBox message={error} />}
        <Field label="Route name"><Input value={form.route_name} onChange={set("route_name")} placeholder="Route A" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Home area" hint="Morning start / evening end"><Input value={form.start_location} onChange={set("start_location")} placeholder="Redhills" /></Field>
          <Field label="College" hint="Morning end / evening start"><Input value={form.destination} onChange={set("destination")} placeholder="Dr. MGR University" /></Field>
        </div>
        <Field label="Description"><Input value={form.description} onChange={set("description")} /></Field>
      </Modal>
    </>
  );
}
