"use client";
// Alerts: only the problems an admin must act on (overspeed, bus offline, off route, SOS),
// grouped day by day, plus the speed-limit settings used for overspeed alerts.
import { useMemo, useState } from "react";
import { BellOff, CheckCheck, CheckCircle2, Gauge, MapPinOff, Siren, WifiOff } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { useLiveBuses } from "@/hooks/useLiveBuses";
import { alertApi, type SpeedSettings } from "@/services/busmate";
import { errorMessage } from "@/lib/api";
import { alertTitle, clock, dateTime, dayLabel, localDate } from "@/lib/format";
import type { Alert } from "@/types";
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Segmented, TableSkeleton, cn, type Tone } from "@/components/ui";

type Kind = "ALL" | "OVERSPEED" | "BUS_OFFLINE" | "ROUTE_DEVIATION";
const KIND_ICON: Record<string, typeof Gauge> = { OVERSPEED: Gauge, BUS_OFFLINE: WifiOff, ROUTE_DEVIATION: MapPinOff, SOS: Siren };
const KIND_TONE: Record<string, Tone> = { OVERSPEED: "red", BUS_OFFLINE: "amber", ROUTE_DEVIATION: "violet", SOS: "red" };

export default function AlertsPage() {
  const [resolved, setResolved] = useState(false);
  const [kind, setKind] = useState<Kind>("ALL");
  const [speedOpen, setSpeedOpen] = useState(false);
  const alerts = useAsync(() => alertApi.list(resolved).then((r) => r.alerts), [resolved]);
  // New alerts arrive over Socket.IO; reload the list when one does.
  useLiveBuses(() => { if (!resolved) alerts.reload(); });

  const all = alerts.data ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of all) c[a.type] = (c[a.type] ?? 0) + 1;
    return c;
  }, [all]);
  const shown = kind === "ALL" ? all : all.filter((a) => a.type === kind);
  // Group by day (newest first)
  const groups = useMemo(() => {
    const map = new Map<string, Alert[]>();
    for (const a of shown) {
      const key = localDate(new Date(a.created_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return [...map.entries()];
  }, [shown]);

  async function resolve(id: number) {
    try { await alertApi.resolve(id); alerts.reload(); } catch (err) { alert(errorMessage(err)); }
  }
  async function resolveAll() {
    if (!confirm("Mark all open alerts as handled?")) return;
    try { await alertApi.resolveAll(); alerts.reload(); } catch (err) { alert(errorMessage(err)); }
  }

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle="Only problems you need to act on: overspeed, bus offline and off route. Resolve an alert once it is handled."
        actions={<>
          <Button variant="secondary" onClick={() => setSpeedOpen(true)}><Gauge className="h-4 w-4" /> Speed limits</Button>
          {!resolved && all.length > 0 && <Button variant="secondary" onClick={resolveAll}><CheckCheck className="h-4 w-4" /> Resolve all</Button>}
          <Segmented value={resolved ? "resolved" : "open"} onChange={(v) => setResolved(v === "resolved")}
            options={[{ value: "open", label: "Open" }, { value: "resolved", label: "Resolved" }]} />
        </>} />

      <div className="mb-4">
        <Segmented<Kind> value={kind} onChange={setKind} size="sm" options={[
          { value: "ALL", label: "All", count: all.length },
          { value: "OVERSPEED", label: "Overspeed", count: counts.OVERSPEED ?? 0 },
          { value: "BUS_OFFLINE", label: "Bus offline", count: counts.BUS_OFFLINE ?? 0 },
          { value: "ROUTE_DEVIATION", label: "Off route", count: counts.ROUTE_DEVIATION ?? 0 },
        ]} />
      </div>

      {alerts.error && <div className="mb-4"><ErrorBox message={alerts.error} onRetry={alerts.reload} /></div>}

      {alerts.loading ? <Card><TableSkeleton /></Card> : !shown.length ? (
        <Card>
          <EmptyState icon={resolved ? BellOff : CheckCircle2}
            title={resolved ? "No resolved alerts yet" : "No open alerts"}
            text={resolved ? "Alerts you resolve are kept here for reference." : "All buses are behaving. New alerts appear here and in the bell at the top."} />
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map(([day, items], gi) => (
            <section key={day}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-[13px] font-semibold">{dayLabel(items[0].created_at)}</h3>
                <span className="text-muted text-xs">{items.length} alert{items.length === 1 ? "" : "s"}</span>
              </div>
              <Card delay={gi} className="divide-y divide-[var(--border)] p-0">
                {items.map((a) => {
                  const Icon = KIND_ICON[a.type] ?? Siren;
                  const tone = KIND_TONE[a.type] ?? "slate";
                  return (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--surface-2)]">
                      <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                        tone === "red" ? "bg-red-500/10 text-red-600" : tone === "amber" ? "bg-amber-500/15 text-amber-600" : "bg-violet-500/10 text-violet-600")}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-semibold">{alertTitle(a.type)}</span>
                          {a.bus_number && <Badge tone="slate">{a.bus_number}</Badge>}
                          {a.severity === "CRITICAL" && !a.resolved && <Badge tone="red" dot pulse>Critical</Badge>}
                        </div>
                        <p className="text-muted mt-0.5 text-[13px]">{a.message}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="text-muted text-xs" title={dateTime(a.created_at)}>{clock(a.created_at)}</span>
                        {!a.resolved && <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => resolve(a.id)}><CheckCircle2 className="h-3.5 w-3.5" /> Resolve</Button>}
                      </div>
                    </div>
                  );
                })}
              </Card>
            </section>
          ))}
        </div>
      )}

      {speedOpen && <SpeedLimitModal onClose={() => setSpeedOpen(false)} />}
    </>
  );
}

function SpeedLimitModal({ onClose }: { onClose: () => void }) {
  const settings = useAsync(() => alertApi.settings(), []);
  const [def, setDef] = useState<string | null>(null);
  const [perBus, setPerBus] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data: SpeedSettings | null = settings.data ?? null;

  const defValue = def ?? (data ? String(data.defaultSpeedLimitKmh) : "");
  const busValue = (id: number, current: number | null) => perBus[id] ?? (current == null ? "" : String(current));

  async function save() {
    if (!data) return;
    const d = Number(defValue);
    if (!Number.isInteger(d) || d < 10 || d > 150) { setError("Default limit must be a whole number between 10 and 150 km/h."); return; }
    const buses: { id: number; speedLimitKmh: number | null }[] = [];
    for (const b of data.buses) {
      const v = busValue(b.id, b.speed_limit_kmh).trim();
      if (v === "") { buses.push({ id: b.id, speedLimitKmh: null }); continue; }
      const n = Number(v);
      if (!Number.isInteger(n) || n < 10 || n > 150) { setError(`${b.bus_number}: limit must be 10–150 km/h, or empty to use the default.`); return; }
      buses.push({ id: b.id, speedLimitKmh: n });
    }
    setBusy(true); setError(null);
    try { await alertApi.saveSettings({ defaultSpeedLimitKmh: d, buses }); onClose(); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <Modal open title="Speed limits" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!data} onClick={save}>Save</Button></>}>
      {settings.error && <ErrorBox message={settings.error} onRetry={settings.reload} />}
      {error && <ErrorBox message={error} />}
      {!data ? <TableSkeleton rows={3} /> : (
        <div className="space-y-4 text-[13px]">
          <p className="text-muted">An <b>Overspeed</b> alert is raised when a bus goes faster than its limit. The driver app also shows the speed in red.</p>
          <Field label="Default limit for all buses (km/h)">
            <Input type="number" min={10} max={150} value={defValue} onChange={(e) => setDef(e.target.value)} />
          </Field>
          {data.buses.length > 0 && (
            <div>
              <div className="mb-1.5 font-medium">Limit for a single bus <span className="text-muted font-normal">(leave empty to use the default)</span></div>
              <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                {data.buses.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="font-semibold">{b.bus_number}</span>
                    <div className="flex items-center gap-2">
                      <Input className="h-8 w-24" type="number" min={10} max={150} placeholder={defValue || "default"}
                        value={busValue(b.id, b.speed_limit_kmh)} onChange={(e) => setPerBus((p) => ({ ...p, [b.id]: e.target.value }))} />
                      <span className="text-muted text-xs">km/h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
