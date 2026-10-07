"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowLeft, MousePointerClick, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { routeApi, stopApi, type RoadRoute } from "@/services/busmate";
import { errorMessage } from "@/lib/api";
import type { Stop } from "@/types";
import { FitBounds, GeofenceCircle, MapView, PinMarker, Polyline, StopMarker, routeLine, type LatLng } from "@/components/MapView";
import { Badge, Button, Card, DemoBadge, ErrorBox, Field, Input, Modal, PageHeader, Skeleton } from "@/components/ui";

type StopForm = { stop_name: string; latitude: string; longitude: string; geofence_radius: string; estimated_time: string };
const emptyStop: StopForm = { stop_name: "", latitude: "", longitude: "", geofence_radius: "100", estimated_time: "" };

export default function RouteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const route = useAsync(() => routeApi.get(id).then((r) => r.route), [id]);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [stopOpen, setStopOpen] = useState(false);
  const [form, setForm] = useState<StopForm>(emptyStop);
  const [picked, setPicked] = useState<LatLng | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editRoute, setEditRoute] = useState(false);
  const [routeForm, setRouteForm] = useState({ route_name: "", start_location: "", destination: "", description: "" });
  const [regenerating, setRegenerating] = useState(false);
  // Shown when the road line could not be rebuilt (e.g. the routing service is unreachable).
  const [roadNote, setRoadNote] = useState<string | null>(null);
  const noteRoad = (roadRoute?: RoadRoute) => { if (roadRoute) setRoadNote(roadRoute.ok ? null : roadRoute.message); };

  const r = route.data;
  const stops = useMemo(() => [...(r?.stops ?? [])].sort((a, b) => a.stop_order - b.stop_order), [r]);
  const line = useMemo(() => routeLine(r?.path, stops), [r, stops]);
  const hasRoad = (r?.path?.length ?? 0) >= 2;

  function onMapClick(p: LatLng) {
    setPicked(p);
    setForm((f) => ({ ...f, latitude: p.lat.toFixed(6), longitude: p.lng.toFixed(6) }));
    if (!stopOpen) { setEditingStop(null); setForm({ ...emptyStop, latitude: p.lat.toFixed(6), longitude: p.lng.toFixed(6) }); setStopOpen(true); }
  }
  function openEdit(s: Stop) {
    setEditingStop(s);
    setForm({ stop_name: s.stop_name, latitude: String(s.latitude), longitude: String(s.longitude),
      geofence_radius: String(s.geofence_radius), estimated_time: s.estimated_time?.slice(0, 5) ?? "" });
    setStopOpen(true);
  }

  async function saveStop() {
    setBusy(true); setError(null);
    const body = {
      stop_name: form.stop_name.trim(), latitude: Number(form.latitude), longitude: Number(form.longitude),
      geofence_radius: Number(form.geofence_radius) || 100, estimated_time: form.estimated_time || null,
    };
    try {
      // The backend redraws the road line through the stops whenever a stop is added or moved.
      const saved = editingStop ? await stopApi.update(editingStop.id, body) : await stopApi.create({ ...body, route_id: id });
      noteRoad(saved.roadRoute);
      setStopOpen(false); setPicked(null);
      route.reload();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  async function removeStop(s: Stop) {
    if (!confirm(`Delete stop "${s.stop_name}"?`)) return;
    try { await stopApi.remove(s.id); route.reload(); } catch (err) { alert(errorMessage(err)); }
  }

  async function move(index: number, dir: -1 | 1) {
    const ids = stops.map((s) => s.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    try { noteRoad((await routeApi.reorder(id, ids)).roadRoute); route.reload(); } catch (err) { alert(errorMessage(err)); }
  }

  async function regenerateRoad() {
    setRegenerating(true);
    try { noteRoad((await routeApi.generatePath(id)).roadRoute); route.reload(); }
    catch (err) { setRoadNote(errorMessage(err)); }
    finally { setRegenerating(false); }
  }

  async function saveRoute(extra?: Record<string, unknown>) {
    try {
      await routeApi.update(id, extra ?? {
        route_name: routeForm.route_name.trim(), start_location: routeForm.start_location.trim() || null,
        destination: routeForm.destination.trim() || null, description: routeForm.description.trim() || null,
      });
      setEditRoute(false); route.reload();
    } catch (err) { alert(errorMessage(err)); }
  }

  async function deleteRoute() {
    if (!confirm("Delete this route and all its stops? Buses on it will become unassigned.")) return;
    try { await routeApi.remove(id); router.replace("/routes"); } catch (err) { alert(errorMessage(err)); }
  }

  const set = (k: keyof StopForm) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.stop_name.trim() && !Number.isNaN(parseFloat(form.latitude)) && !Number.isNaN(parseFloat(form.longitude));

  if (route.error) return <ErrorBox message={route.error} onRetry={route.reload} />;
  if (!r) return <Skeleton className="h-96" />;

  return (
    <>
      <Link href="/routes" className="text-muted mb-3 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="h-4 w-4" /> Routes</Link>
      <PageHeader title={r.route_name} subtitle={`${r.start_location ?? "Start"} → ${r.destination ?? "Destination"}`}
        actions={<>
          {r.is_demo && <DemoBadge />}
          <Badge tone={r.active ? "green" : "slate"} dot>{r.active ? "Active" : "Disabled"}</Badge>
<Button variant="secondary" loading={regenerating} disabled={stops.length < 2} onClick={regenerateRoad}><RefreshCw className="h-4 w-4" /> Regenerate road route</Button>
          <Button variant="secondary" onClick={() => { setRouteForm({ route_name: r.route_name, start_location: r.start_location ?? "", destination: r.destination ?? "", description: r.description ?? "" }); setEditRoute(true); }}>Edit route</Button>
          <Button variant="secondary" onClick={() => saveRoute({ active: !r.active })}>{r.active ? "Disable" : "Enable"}</Button>
          <Button variant="danger" onClick={deleteRoute}>Delete</Button>
        </>} />

      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <Card className="relative h-[560px] overflow-hidden p-0">
          <MapView className="h-full rounded-none" onClick={onMapClick}>
            <FitBounds points={line} />
            <Polyline path={line} color="#F5B301" weight={5} />
            {stops.map((s) => <GeofenceCircle key={`g${s.id}`} center={{ lat: s.latitude, lng: s.longitude }} radius={s.geofence_radius} />)}
            {stops.map((s) => <StopMarker key={s.id} stop={s} onClick={() => openEdit(s)} />)}
            {picked && <PinMarker position={picked} />}
          </MapView>
          <div className="surface absolute left-3 top-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold shadow">
            <MousePointerClick className="h-4 w-4" /> Click the map to add a stop at that point
          </div>
          <div className="surface absolute left-3 top-14 max-w-[70%] rounded-xl px-3 py-2 text-xs shadow">
            <span className="font-semibold">{hasRoad ? "Line follows real roads" : stops.length < 2 ? "Add 2 stops to draw the route" : "Straight lines between stops"}</span>
            {roadNote && <span className="mt-0.5 block text-amber-600">{roadNote}</span>}
          </div>
        </Card>

        <Card className="flex h-[560px] flex-col overflow-hidden">
          <div className="border-app flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-bold">Stops in order</h3>
            <Button variant="secondary" className="py-1.5 text-xs" onClick={() => { setEditingStop(null); setForm(emptyStop); setStopOpen(true); }}>Add manually</Button>
          </div>
          <ol className="flex-1 divide-y divide-[var(--border)] overflow-y-auto">
            {!stops.length && <li className="text-muted p-6 text-center text-sm">No stops yet. Click the map to add the first stop. The last stop should be the college.</li>}
            {stops.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-900 text-xs font-bold text-white dark:bg-amber-brand dark:text-ink-950">{s.stop_order}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{s.stop_name}</div>
                  <div className="text-muted text-xs">{s.latitude.toFixed(5)}, {s.longitude.toFixed(5)} · radius {s.geofence_radius} m{s.estimated_time ? ` · ${s.estimated_time.slice(0, 5)}` : ""}</div>
                </div>
                <div className="flex">
                  <button className="text-muted rounded p-1 hover:bg-[var(--surface-2)] disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                  <button className="text-muted rounded p-1 hover:bg-[var(--surface-2)] disabled:opacity-30" disabled={i === stops.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                  <button className="text-muted rounded p-1 hover:bg-[var(--surface-2)]" onClick={() => openEdit(s)} aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                  <button className="rounded p-1 text-red-600 hover:bg-[var(--surface-2)]" onClick={() => removeStop(s)} aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Modal open={stopOpen} title={editingStop ? `Edit stop` : "Add stop"} onClose={() => { setStopOpen(false); setPicked(null); }}
        footer={<><Button variant="secondary" onClick={() => setStopOpen(false)}>Cancel</Button><Button loading={busy} disabled={!valid} onClick={saveStop}>Save stop</Button></>}>
        {error && <ErrorBox message={error} />}
        <Field label="Stop name"><Input value={form.stop_name} onChange={set("stop_name")} placeholder="Gummidipoondi" autoFocus /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Latitude" hint="Click the map to fill"><Input value={form.latitude} onChange={set("latitude")} /></Field>
          <Field label="Longitude"><Input value={form.longitude} onChange={set("longitude")} /></Field>
          <Field label="Geofence radius (m)" hint="Bus is 'at stop' inside this circle"><Input type="number" min={10} max={2000} value={form.geofence_radius} onChange={set("geofence_radius")} /></Field>
          <Field label="Scheduled time (optional)"><Input type="time" value={form.estimated_time} onChange={set("estimated_time")} /></Field>
        </div>
        {!editingStop && <p className="text-muted text-xs">New stops are added at the end. Use the arrows to reorder.</p>}
      </Modal>

      <Modal open={editRoute} title="Edit route" onClose={() => setEditRoute(false)}
        footer={<><Button variant="secondary" onClick={() => setEditRoute(false)}>Cancel</Button><Button onClick={() => saveRoute()}>Save</Button></>}>
        <Field label="Route name"><Input value={routeForm.route_name} onChange={(e) => setRouteForm((f) => ({ ...f, route_name: e.target.value }))} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start location"><Input value={routeForm.start_location} onChange={(e) => setRouteForm((f) => ({ ...f, start_location: e.target.value }))} /></Field>
          <Field label="Destination"><Input value={routeForm.destination} onChange={(e) => setRouteForm((f) => ({ ...f, destination: e.target.value }))} /></Field>
        </div>
        <Field label="Description"><Input value={routeForm.description} onChange={(e) => setRouteForm((f) => ({ ...f, description: e.target.value }))} /></Field>
      </Modal>
    </>
  );
}
