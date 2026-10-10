"use client";
import { useMemo, useState } from "react";
import { FileSpreadsheet, GraduationCap, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { busApi, routeApi, studentApi } from "@/services/busmate";
import { errorMessage } from "@/lib/api";
import type { Student } from "@/types";
import { StudentImportModal } from "@/components/StudentImport";
import { Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Select, Table, TableSkeleton, Td } from "@/components/ui";

type Form = { name: string; email: string; phone: string; password: string; student_id: string; department: string; year: string; assigned_route_id: string; assigned_stop_id: string; assigned_bus_id: string };
const empty: Form = { name: "", email: "", phone: "", password: "", student_id: "", department: "", year: "", assigned_route_id: "", assigned_stop_id: "", assigned_bus_id: "" };

export default function StudentsPage() {
  const [filters, setFilters] = useState({ search: "", department: "", year: "", routeId: "" });
  const [applied, setApplied] = useState(filters);
  const students = useAsync(() => studentApi.list(applied).then((r) => r.students), [applied]);
  const routes = useAsync(() => routeApi.list().then((r) => r.routes));
  const buses = useAsync(() => busApi.list().then((r) => r.buses));
  const [editing, setEditing] = useState<Student | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const routeStops = useAsync(async () => (form.assigned_route_id ? (await routeApi.get(Number(form.assigned_route_id))).route.stops ?? [] : []), [form.assigned_route_id]);

  const openNew = () => { setEditing(null); setForm(empty); setError(null); setOpen(true); };
  const openEdit = (s: Student) => {
    setEditing(s);
    setForm({ name: s.name, email: s.email ?? "", phone: s.phone ?? "", password: "", student_id: s.student_id,
      department: s.department ?? "", year: s.year?.toString() ?? "", assigned_route_id: s.assigned_route_id?.toString() ?? "",
      assigned_stop_id: s.assigned_stop_id?.toString() ?? "", assigned_bus_id: s.assigned_bus_id?.toString() ?? "" });
    setError(null); setOpen(true);
  };

  async function save() {
    setSaving(true); setError(null);
    const num = (v: string) => (v ? Number(v) : null);
    const body: Record<string, unknown> = {
      name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null,
      student_id: form.student_id.trim(), department: form.department.trim() || null, year: num(form.year),
      assigned_route_id: num(form.assigned_route_id), assigned_stop_id: num(form.assigned_stop_id), assigned_bus_id: num(form.assigned_bus_id),
    };
    if (form.password) body.password = form.password;
    try {
      if (editing) await studentApi.update(editing.id, body); else await studentApi.create(body);
      setOpen(false); students.reload();
    } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
  }

  async function remove(s: Student) {
    if (!confirm(`Delete student ${s.name}? Their login will be removed.`)) return;
    try { await studentApi.remove(s.id); students.reload(); } catch (err) { alert(errorMessage(err)); }
  }

  const departments = useMemo(() => [...new Set((students.data ?? []).map((s) => s.department).filter(Boolean))] as string[], [students.data]);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value, ...(k === "assigned_route_id" ? { assigned_stop_id: "" } : {}) }));

  return (
    <>
      <PageHeader title="Students" subtitle="Student accounts. Assign each student a route and stop so the Student app shows their bus and arrival time."
        actions={<>
          <Button variant="secondary" onClick={() => setImportOpen(true)}><FileSpreadsheet className="h-4 w-4" /> Import from Excel/CSV</Button>
          <Button onClick={openNew}><Plus className="h-4 w-4" /> Add student</Button>
        </>} />
      <Card className="mb-4 p-3">
        <form className="grid gap-2 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); setApplied(filters); }}>
          <div className="relative sm:col-span-2">
            <Search className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input placeholder="Search name, ID, email" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} className="pl-9" />
          </div>
          <Select value={filters.department} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}>
            <option value="">All departments</option>{departments.map((d) => <option key={d}>{d}</option>)}
          </Select>
          <Select value={filters.year} onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}>
            <option value="">All years</option>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </Select>
          <div className="flex gap-2">
            <Select value={filters.routeId} onChange={(e) => setFilters((f) => ({ ...f, routeId: e.target.value }))}>
              <option value="">All routes</option>{routes.data?.map((r) => <option key={r.id} value={r.id}>{r.route_name}</option>)}
            </Select>
            <Button type="submit" variant="secondary">Filter</Button>
          </div>
        </form>
      </Card>
      {students.error && <div className="mb-4"><ErrorBox message={students.error} onRetry={students.reload} /></div>}
      <Card>
        {students.loading ? <TableSkeleton /> : !students.data?.length ? <EmptyState icon={GraduationCap} title="No students found" text="Add a student, or change the filters above and press Filter." action={<Button onClick={openNew}><Plus className="h-4 w-4" /> Add student</Button>} /> : (
          <Table head={["Name", "Student ID", "Department", "Year", "Route", "Stop", "Bus", "Actions"]}>
            {students.data.map((s) => (
              <tr key={s.id} className="hover:bg-[var(--surface-2)]">
                <Td className="font-semibold">{s.name}</Td>
                <Td>{s.student_id}</Td>
                <Td>{s.department ?? "-"}</Td>
                <Td>{s.year ?? "-"}</Td>
                <Td>{s.route_name ?? "-"}</Td>
                <Td>{s.assigned_stop_name ?? "-"}</Td>
                <Td>{s.bus_number ?? "-"}</Td>
                <Td><div className="flex gap-1">
                  <Button variant="ghost" className="px-2 py-1.5" onClick={() => openEdit(s)} aria-label="Edit" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" className="px-2 py-1.5 !text-red-600" onClick={() => remove(s)} aria-label="Delete" title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <StudentImportModal open={importOpen} onClose={() => setImportOpen(false)} buses={buses.data ?? []} onImported={students.reload} />

      <Modal wide open={open} title={editing ? `Edit ${editing.name}` : "Add student"} onClose={() => setOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={saving} onClick={save} disabled={!form.name.trim() || !form.student_id.trim() || (!editing && form.password.length < 8)}>Save student</Button></>}>
        {error && <ErrorBox message={error} />}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Full name"><Input value={form.name} onChange={set("name")} /></Field>
          <Field label="Student ID" hint="Used to log in"><Input value={form.student_id} onChange={set("student_id")} /></Field>
          <Field label="Email" hint="Needed for &quot;Forgot password&quot; reset emails"><Input type="email" value={form.email} onChange={set("email")} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
          <Field label="Department"><Input value={form.department} onChange={set("department")} /></Field>
          <Field label="Year"><Select value={form.year} onChange={set("year")}><option value="">-</option>{[1, 2, 3, 4, 5].map((y) => <option key={y}>{y}</option>)}</Select></Field>
          <Field label="Route">
            <Select value={form.assigned_route_id} onChange={set("assigned_route_id")}>
              <option value="">None</option>{routes.data?.map((r) => <option key={r.id} value={r.id}>{r.route_name}</option>)}
            </Select>
          </Field>
          <Field label="Stop">
            <Select value={form.assigned_stop_id} onChange={set("assigned_stop_id")} disabled={!form.assigned_route_id}>
              <option value="">None</option>{routeStops.data?.map((s) => <option key={s.id} value={s.id}>{s.stop_order}. {s.stop_name}</option>)}
            </Select>
          </Field>
          <Field label="Bus" hint="Empty = first bus on the route">
            <Select value={form.assigned_bus_id} onChange={set("assigned_bus_id")}>
              <option value="">Automatic</option>{buses.data?.map((b) => <option key={b.id} value={b.id}>{b.bus_number}</option>)}
            </Select>
          </Field>
          <Field label={editing ? "New password (leave empty to keep)" : "Password"} hint="At least 8 characters">
            <Input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
