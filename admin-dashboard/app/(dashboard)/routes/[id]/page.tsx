"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, ArrowUpDown, CheckCircle2, Moon, MousePointerClick, Pencil, RefreshCw, Sun, Trash2 } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { routeApi, stopApi, type RoadRoute } from "@/services/busmate";
import { errorMessage } from "@/lib/api";
import { timeOfDay, tripEnds } from "@/lib/format";
import type { Stop } from "@/types";
import { FitBounds, GeofenceCircle, MapView, PinMarker, Polyline, StopMarker, routeLine, type LatLng } from "@/components/MapView";
import { Badge, Button, Card, DemoBadge, ErrorBox, Field, Input, Modal, PageHeader, RouteDash, Skeleton } from "@/components/ui";

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
  const [routeForm, setRouteForm] = useState({ route_name: "", start_location: "", destination: "", description: "", morning_time: "", evening_time: "" });
  const [regenerating, setRegenerating] = useState(false);
  // Shown when the road line could not be rebuilt (e.g. the routing service is unreachable).
  const [roadNote, setRoadNote] = useState<string | null>(null);
  const noteRoad = (roadRoute?: RoadRoute) => { if (roadRoute) setRoadNote(roadRoute.ok ? null : roadRoute.message); };

  const r = route.data;
  const stops = useMemo(() => [...(r?.stops ?? [])].sort((a, b) => a.stop_order - b.stop_order), [r]);
  const line = useMemo(() => routeLine(r?.path, stops), [r, stops]);
  const hasRoad = (r?.path?.length ?? 0) >= 2;
  const morning = tripEnds("TO_COLLEGE", r?.start_location, r?.destination);
  const evening = tripEnds("FROM_COLLEGE", r?.start_location, r?.destination);
  // Route setup checks shown to the admin.
  const norm = (x?: string | null) => (x ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const similar = (a?: string | null, b?: string | null) => !!norm(a) && !!norm(b) && (norm(a).includes(norm(b)) || norm(b).includes(norm(a)));
  const firstStop = stops[0]?.stop_name;
  const lastStop = stops[stops.length - 1]?.stop_name;
  const looksReversed = stops.length >= 2 && (similar(firstStop, r?.destination) || similar(lastStop, r?.start_location));
  const checks: string[] = [];
  if (r && !r.start_location) checks.push("Set the home area (e.g. Redhills): where the morning run starts and the evening run ends.");
  if (r && !r.destination) checks.push("Set the college name (e.g. Dr. MGR University).");
  if (r && (!r.morning_time || !r.evening_time)) checks.push("Set the morning and evening departure times.");
  if (stops.length < 2) checks.push("Add at least 2 stops on the map: the home area first and the college last.");
  if (looksReversed) checks.push(`The stops look reversed: the first stop is "${firstStop}" and the last is "${lastStop}". Stops must be in morning order (home area first, college last).`);

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
        morning_time: routeForm.morning_time || null, evening_time: routeForm.evening_time || null,
      });
      setEditRoute(false); route.reload();
    } catch (err) { alert(errorMessage(err)); }
  }

  /** Stops must run home area -> college. If they were added the other way round, flip them. */
  async function reverseStops() {
    if (!confirm("Reverse the stop order? The first stop should be the home area and the last stop the college.")) return;
    try { noteRoad((await routeApi.reorder(id, [...stops].reverse().map((s) => s.id))).roadRoute); route.reload(); }
    catch (err) { alert(errorMessage(err)); }
  }

  function openEditRoute() {
    if (!r) return;
    setRouteForm({
      route_name: r.route_name, start_location: r.start_location ?? "", destination: r.destination ?? "",
      description: r.description ?? "", morning_time: r.morning_time?.slice(0, 5) ?? "", evening_time: r.evening_time?.slice(0, 5) ?? "",
    });
    setEditRoute(true);
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
      <Link href="/routes" className="text-muted mb-2 inline-flex items-center gap-1 text-xs font-medium hover:text-[var(--text)]"><ArrowLeft className="h-3.5 w-3.5" /> All routes</Link>
      <PageHeader title={r.route_name} subtitle={`Morning ${morning.from} → ${morning.to} · Evening ${evening.from} → ${evening.to}. Click the map to add stops; drivers and students see these names and times.`}
        actions={<>
          {r.is_demo && <DemoBadge />}
          <Badge tone={r.active ? "green" : "slate"} dot>{r.active ? "Active" : "Disabled"}</Badge>
<Button variant="secondary" loading={regenerating} disabled={stops.length < 2} onClick={regenerateRoad}><RefreshCw className="h-3.5 w-3.5" /> Regenerate road route</Button>
          <Button variant="secondary" onClick={openEditRoute}><Pencil className="h-3.5 w-3.5" /> Edit route & times</Button>
          <Button variant="secondary" onClick={() => saveRoute({ active: !r.active })}>{r.active ? "Disable" : "Enable"}</Button>
          <Button variant="danger" onClick={deleteRoute}>Delete</Button>
        </>} />

      {/* Daily runs: what the driver and students will see */}
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <RunCard icon={Sun} title="Morning run" time={r.morning_time} from={morning.from} to={morning.to} tone="amber" />
        <RunCard icon={Moon} title="Evening run" time={r.evening_time} from={evening.from} to={evening.to} tone="ink" />
      </div>
      {checks.length > 0 ? (
        <div className="anim-fade-up mb-4 rounded-2xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-400/30 dark:bg-amber-400/5">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-amber-700 dark:text-amber-300"><AlertTriangle className="h-4 w-4" /> Finish setting up this route</div>
          <ul className="list-disc space-y-1 pl-6 text-[13px]">{checks.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {(!r.start_location || !r.destination || !r.morning_time || !r.evening_time) && <Button variant="secondary" onClick={openEditRoute}>Set home area, college & times</Button>}
            {looksReversed && <Button onClick={reverseStops}><ArrowUpDown className="h-4 w-4" /> Reverse stop order</Button>}
          </div>
        </div>
      ) : (
        <div className="anim-fade-up mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-medium text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Route is ready: drivers and students will see these place names and times.</div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <Card className="relative h-[560px] overflow-hidden p-0">
          <MapView className="h-full rounded-none" onClick={onMapClick}>
            <FitBounds points={line} />
            <Polyline path={line} color="#F5B301" weight={5} />
            {stops.map((s) => <GeofenceCircle key={`g${s.id}`} center={{ lat: s.latitude, lng: s.longitude }} radius={s.geofence_radius} />)}
            {stops.map((s) => <StopMarker key={s.id} stop={s} onClick={() => openEdit(s)} />)}
            {picked && <PinMarker position={picked} />}
          </MapView>
          <div className="surface absolute left-3 top-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-[var(--shadow-md)]">
            <MousePointerClick className="h-3.5 w-3.5 text-primary" /> Click the map to add a stop at that point
          </div>
          <div className="surface absolute left-3 top-12 max-w-[70%] rounded-lg px-2.5 py-1.5 text-xs shadow-[var(--shadow-md)]">
            <span className="font-semibold">{hasRoad ? "Line follows real roads" : stops.length < 2 ? "Add 2 stops to draw the route" : "Straight lines between stops"}</span>
            {roadNote && <span className="mt-0.5 block text-amber-600">{roadNote}</span>}
          </div>
        </Card>

        <Card className="flex h-[560px] flex-col overflow-hidden">
          <div className="border-app flex items-center justify-between border-b px-4 py-2.5">
            <h3 className="text-[15px] font-semibold">Stops in order <span className="text-muted text-xs font-medium">({stops.length})</span></h3>
            <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => { setEditingStop(null); setForm(emptyStop); setStopOpen(true); }}>Add manually</Button>
          </div>
          <ol className="flex-1 divide-y divide-[var(--border)] overflow-y-auto">
            {!stops.length && <li className="text-muted p-6 text-center text-[13px]">No stops yet. Click the map to add stops in <b>morning order</b>: first the home area (e.g. Redhills), then each pickup point, and <b>last the college</b>. The evening run uses the same stops in reverse automatically.</li>}
            {stops.map((s, i) => (
              <li key={s.id} className="group flex items-center gap-3 px-4 py-2.5 transition hover:bg-[var(--surface-2)]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-soft text-[11px] font-bold text-primary-text">{s.stop_order}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{s.stop_name}</div>
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

      <Modal open={editRoute} title="Route, place names & times" onClose={() => setEditRoute(false)}
        footer={<><Button variant="secondary" onClick={() => setEditRoute(false)}>Cancel</Button><Button onClick={() => saveRoute()}>Save</Button></>}>
        <Field label="Route name"><Input value={routeForm.route_name} onChange={(e) => setRouteForm((f) => ({ ...f, route_name: e.target.value }))} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Home area" hint="Morning run starts here, evening run ends here"><Input value={routeForm.start_location} placeholder="Redhills" onChange={(e) => setRouteForm((f) => ({ ...f, start_location: e.target.value }))} /></Field>
          <Field label="College" hint="Morning run ends here, evening run starts here"><Input value={routeForm.destination} placeholder="Dr. MGR University" onChange={(e) => setRouteForm((f) => ({ ...f, destination: e.target.value }))} /></Field>
          <Field label="Morning run leaves home area at"><Input type="time" value={routeForm.morning_time} onChange={(e) => setRouteForm((f) => ({ ...f, morning_time: e.target.value }))} /></Field>
          <Field label="Evening run leaves college at"><Input type="time" value={routeForm.evening_time} onChange={(e) => setRouteForm((f) => ({ ...f, evening_time: e.target.value }))} /></Field>
        </div>
        <p className="text-muted text-xs">Preview: Morning {routeForm.start_location || "Home area"} → {routeForm.destination || "College"} · Evening {routeForm.destination || "College"} → {routeForm.start_location || "Home area"}</p>
        <Field label="Description"><Input value={routeForm.description} onChange={(e) => setRouteForm((f) => ({ ...f, description: e.target.value }))} /></Field>
      </Modal>
    </>
  );
}

function RunCard({ icon: Icon, title, time, from, to, tone }: { icon: typeof Sun; title: string; time?: string | null; from: string; to: string; tone: "amber" | "ink" }) {
  return (
    <Card hover className={tone === "amber" ? "relative overflow-hidden bg-amber-brand p-4 text-ink-950" : "relative overflow-hidden bg-ink-900 p-4 text-white"}>
      <RouteDash className="pointer-events-none absolute -right-4 bottom-0 h-12 w-44 opacity-40" color={tone === "amber" ? "#0C1322" : "#F5B301"} stops={false} />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider"><Icon className="h-3.5 w-3.5" /> {title}</div>
        <div className="num text-[15px] font-bold">{time ? timeOfDay(time) : "Time not set"}</div>
      </div>
      <div className="relative mt-1.5 flex items-center gap-2 text-base font-bold">
        <span className="truncate">{from}</span><ArrowRight className="h-4 w-4 shrink-0" /><span className="truncate">{to}</span>
      </div>
    </Card>
  );
}
