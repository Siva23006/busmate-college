"use client";
import { useState } from "react";
import { Pencil, Plus, Search, UserRound } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { busApi, driverApi } from "@/services/busmate";
import { errorMessage } from "@/lib/api";
import type { Driver } from "@/types";
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Select, Table, TableSkeleton, Td, Toolbar } from "@/components/ui";

type Form = { name: string; email: string; phone: string; password: string; employee_id: string; license_number: string; status: "ACTIVE" | "INACTIVE"; bus_id: string };
const empty: Form = { name: "", email: "", phone: "", password: "", employee_id: "", license_number: "", status: "ACTIVE", bus_id: "" };

export default function DriversPage() {
  const drivers = useAsync(() => driverApi.list().then((r) => r.drivers));
  const buses = useAsync(() => busApi.list().then((r) => r.buses));
  const [editing, setEditing] = useState<Driver | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const openNew = () => { setEditing(null); setForm(empty); setFormError(null); setOpen(true); };
  const openEdit = (d: Driver) => {
    setEditing(d);
    setForm({ name: d.name, email: d.email ?? "", phone: d.phone ?? "", password: "", employee_id: d.employee_id,
      license_number: d.license_number ?? "", status: d.status, bus_id: d.bus_id?.toString() ?? "" });
    setFormError(null);
    setOpen(true);
  };

  async function save() {
    setSaving(true);
    setFormError(null);
    const body: Record<string, unknown> = {
      name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null,
      employee_id: form.employee_id.trim(), license_number: form.license_number.trim() || null,
      status: form.status, bus_id: form.bus_id ? Number(form.bus_id) : null,
    };
    if (form.password) body.password = form.password;
    try {
      if (editing) await driverApi.update(editing.id, body); else await driverApi.create(body);
      setOpen(false);
      drivers.reload();
      buses.reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(d: Driver) {
    const next = d.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (next === "INACTIVE" && !confirm(`Disable ${d.name}? They will not be able to log in.`)) return;
    try { await driverApi.update(d.id, { status: next }); drivers.reload(); } catch (err) { alert(errorMessage(err)); }
  }

  const list = (drivers.data ?? []).filter((d) =>
    `${d.name} ${d.employee_id} ${d.phone ?? ""} ${d.email ?? ""} ${d.bus_number ?? ""}`.toLowerCase().includes(search.toLowerCase())
    && (!statusFilter || (statusFilter === "ON_TRIP" ? !!d.active_trip_id : d.status === statusFilter)));
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader title="Drivers" subtitle="Driver accounts. Drivers sign in to the BusMate Driver app with their Employee ID or email, then start trips."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> Add driver</Button>} />
      {drivers.error && <div className="mb-4"><ErrorBox message={drivers.error} onRetry={drivers.reload} /></div>}
      <Card>
        <Toolbar right={<span className="text-muted text-xs">{list.length} of {drivers.data?.length ?? 0} drivers</span>}>
          <div className="relative w-full sm:w-64">
            <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input placeholder="Search name, ID, phone or bus" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-44" aria-label="Filter by status">
            <option value="">All drivers</option>
            <option value="ON_TRIP">On a trip now</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Disabled</option>
          </Select>
        </Toolbar>
        {drivers.loading ? <TableSkeleton /> : !list.length ? (
          drivers.data?.length
            ? <EmptyState icon={Search} title="No drivers match" text="Try a different search or choose “All drivers”." />
            : <EmptyState icon={UserRound} title="No drivers yet" text="Add a driver account, then assign them a bus. They can then sign in to the Driver app." action={<Button onClick={openNew}><Plus className="h-4 w-4" /> Add driver</Button>} />
        ) : (
          <Table head={["Driver name", "Employee ID", "Phone", "Assigned bus", "Status", "Trip status", "Actions"]}>
            {list.map((d) => (
              <tr key={d.id} className="hover:bg-[var(--surface-2)]">
                <Td className="font-semibold">{d.name}</Td>
                <Td>{d.employee_id}</Td>
                <Td>{d.phone ?? "-"}</Td>
                <Td>{d.bus_number ?? <span className="text-muted">None</span>}</Td>
                <Td><Badge tone={d.status === "ACTIVE" ? "green" : "slate"} dot>{d.status === "ACTIVE" ? "Active" : "Disabled"}</Badge></Td>
                <Td>{d.active_trip_id ? <Badge tone="blue" dot pulse>On trip</Badge> : <span className="text-muted">Idle</span>}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Button variant="ghost" className="px-2 py-1.5" onClick={() => openEdit(d)} aria-label="Edit" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" className="px-2 py-1.5 text-xs" onClick={() => toggle(d)}>{d.status === "ACTIVE" ? "Disable" : "Enable"}</Button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={open} title={editing ? `Edit ${editing.name}` : "Add driver"} onClose={() => setOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={saving} onClick={save} disabled={!form.name.trim() || !form.employee_id.trim() || (!editing && form.password.length < 8)}>Save driver</Button></>}>
        {formError && <ErrorBox message={formError} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><Input value={form.name} onChange={set("name")} /></Field>
          <Field label="Employee ID" hint="Used to log in"><Input value={form.employee_id} onChange={set("employee_id")} placeholder="DRV-001" /></Field>
          <Field label="Email (optional)"><Input type="email" value={form.email} onChange={set("email")} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
          <Field label="License number"><Input value={form.license_number} onChange={set("license_number")} /></Field>
          <Field label="Assigned bus">
            <Select value={form.bus_id} onChange={set("bus_id")}>
              <option value="">None</option>
              {buses.data?.map((b) => <option key={b.id} value={b.id}>{b.bus_number}{b.driver_name && b.driver_id !== editing?.id ? ` (now: ${b.driver_name})` : ""}</option>)}
            </Select>
          </Field>
          <Field label={editing ? "New password (leave empty to keep)" : "Password"} hint="At least 8 characters">
            <Input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}><option>ACTIVE</option><option>INACTIVE</option></Select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
