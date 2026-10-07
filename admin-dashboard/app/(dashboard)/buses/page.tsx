"use client";
import Link from "next/link";
import { useState } from "react";
import { Bus as BusIcon, Crosshair, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { busApi, driverApi, routeApi } from "@/services/busmate";
import { errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Bus } from "@/types";
import { Badge, Button, Card, DemoBadge, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Select, Table, TableSkeleton, Td, Toolbar, busStatusLabel, busStatusTone } from "@/components/ui";

type Form = { bus_number: string; registration_number: string; capacity: string; status: Bus["status"]; driver_id: string; route_id: string };
const empty: Form = { bus_number: "", registration_number: "", capacity: "", status: "INACTIVE", driver_id: "", route_id: "" };

export default function BusesPage() {
  const buses = useAsync(() => busApi.list().then((r) => r.buses));
  const drivers = useAsync(() => driverApi.list().then((r) => r.drivers));
  const routes = useAsync(() => routeApi.list().then((r) => r.routes));
  const [editing, setEditing] = useState<Bus | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const openNew = () => { setEditing(null); setForm(empty); setFormError(null); setOpen(true); };
  const openEdit = (b: Bus) => {
    setEditing(b);
    setForm({ bus_number: b.bus_number, registration_number: b.registration_number ?? "", capacity: b.capacity?.toString() ?? "",
      status: b.status, driver_id: b.driver_id?.toString() ?? "", route_id: b.route_id?.toString() ?? "" });
    setFormError(null);
    setOpen(true);
  };

  async function save() {
    setSaving(true);
    setFormError(null);
    const body = {
      bus_number: form.bus_number.trim(),
      registration_number: form.registration_number.trim() || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      status: form.status,
      driver_id: form.driver_id ? Number(form.driver_id) : null,
      route_id: form.route_id ? Number(form.route_id) : null,
    };
    try {
      if (editing) await busApi.update(editing.id, body); else await busApi.create(body);
      setOpen(false);
      buses.reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(b: Bus) {
    if (!confirm(`Delete ${b.bus_number}? Its trip history will also be deleted. Consider setting it INACTIVE instead.`)) return;
    try { await busApi.remove(b.id); buses.reload(); } catch (err) { alert(errorMessage(err)); }
  }

  const list = (buses.data ?? []).filter((b) =>
    `${b.bus_number} ${b.registration_number ?? ""} ${b.driver_name ?? ""} ${b.route_name ?? ""}`.toLowerCase().includes(search.toLowerCase())
    && (!statusFilter || (statusFilter === "ON_TRIP" ? !!b.active_trip_id : b.status === statusFilter)));
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader title="Buses" subtitle="Every college bus. Add a bus, then assign its driver and route so it can be tracked."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> Add bus</Button>} />
      {buses.error && <div className="mb-4"><ErrorBox message={buses.error} onRetry={buses.reload} /></div>}
      <Card>
        <Toolbar right={<span className="text-muted text-xs">{list.length} of {buses.data?.length ?? 0} buses</span>}>
          <div className="relative w-full sm:w-64">
            <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input placeholder="Search bus, driver or route" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-44" aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="ON_TRIP">On a trip now</option>
            {["ACTIVE", "INACTIVE", "MAINTENANCE", "OFFLINE"].map((s) => <option key={s} value={s}>{busStatusLabel(s)}</option>)}
          </Select>
        </Toolbar>
        {buses.loading ? <TableSkeleton /> : !list.length ? (
          buses.data?.length
            ? <EmptyState icon={Search} title="No buses match" text="Try a different search or set the status filter to “All statuses”." />
            : <EmptyState icon={BusIcon} title="No buses yet" text="Add your first college bus, then assign a driver and a route so it shows up on the live map." action={<Button onClick={openNew}><Plus className="h-4 w-4" /> Add bus</Button>} />
        ) : (
          <Table head={["Bus number", "Registration", "Driver", "Route", "Status", "Current speed", "Last update", "Actions"]}>
            {list.map((b) => (
              <tr key={b.id} className="hover:bg-[var(--surface-2)]">
                <Td className="font-semibold"><span className="flex items-center gap-2">{b.bus_number}{b.is_demo && <DemoBadge />}</span></Td>
                <Td>{b.registration_number ?? "-"}</Td>
                <Td>{b.driver_name ?? <span className="text-muted">Unassigned</span>}</Td>
                <Td>{b.route_name ?? <span className="text-muted">Unassigned</span>}</Td>
                <Td><span className="flex items-center gap-1.5"><Badge tone={busStatusTone(b.status)} dot>{busStatusLabel(b.status)}</Badge>{b.active_trip_id && <Badge tone="blue" dot pulse>On trip</Badge>}</span></Td>
                <Td>{b.active_trip_id && b.speed != null ? `${Math.round(b.speed * 3.6)} km/h` : "-"}</Td>
                <Td>{timeAgo(b.location_time)}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Link href={`/track?bus=${b.id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary-text transition hover:bg-primary-soft" title="Track this bus"><Crosshair className="h-3.5 w-3.5" /> Track</Link>
                    <Button variant="ghost" className="px-2 py-1.5" onClick={() => openEdit(b)} aria-label="Edit" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" className="px-2 py-1.5 !text-red-600" onClick={() => remove(b)} aria-label="Delete" title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={open} title={editing ? `Edit ${editing.bus_number}` : "Add bus"} onClose={() => setOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={save} disabled={!form.bus_number.trim()}>Save bus</Button></>}>
        {formError && <ErrorBox message={formError} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bus number"><Input value={form.bus_number} onChange={set("bus_number")} placeholder="BUS 01" /></Field>
          <Field label="Registration number"><Input value={form.registration_number} onChange={set("registration_number")} placeholder="TN 00 AB 1234" /></Field>
          <Field label="Capacity"><Input type="number" min={1} value={form.capacity} onChange={set("capacity")} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              {["ACTIVE", "INACTIVE", "MAINTENANCE", "OFFLINE"].map((s) => <option key={s} value={s}>{busStatusLabel(s)}</option>)}
            </Select>
          </Field>
          <Field label="Driver">
            <Select value={form.driver_id} onChange={set("driver_id")}>
              <option value="">Unassigned</option>
              {drivers.data?.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.employee_id})</option>)}
            </Select>
          </Field>
          <Field label="Route">
            <Select value={form.route_id} onChange={set("route_id")}>
              <option value="">Unassigned</option>
              {routes.data?.map((r) => <option key={r.id} value={r.id}>{r.route_name}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
