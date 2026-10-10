"use client";
// Monthly report: trips, on-time starts, late starts, distance and safety events per bus.
// Download as CSV (opens in Excel) or print / save as PDF. Data: GET /reports/monthly?month=YYYY-MM.
import { useMemo, useState } from "react";
import { AlarmClock, CheckCircle2, FileBarChart, FileSpreadsheet, Gauge, History, Printer, Route as RouteIcon, Siren } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { reportApi } from "@/services/busmate";
import { downloadCsv } from "@/lib/csv";
import { localDate } from "@/lib/format";
import type { MonthlyReport } from "@/types";
import {
  Button, Card, CardHeader, EmptyState, ErrorBox, IconTile, Input, PageHeader, Skeleton, Table, Td, cn, type Tone,
} from "@/components/ui";

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

const pct = (v: number | null | undefined) => (v == null ? "-" : `${Math.round(v)}%`);
const num1 = (v: number | null | undefined) => (v == null ? "-" : (Math.round(v * 10) / 10).toLocaleString());
const pctTone = (v: number | null): Tone => (v == null ? "slate" : v >= 90 ? "green" : v >= 75 ? "amber" : "red");
const BAR: Record<Tone, string> = {
  green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", slate: "bg-slate-300", blue: "bg-blue-500", violet: "bg-violet-500", sky: "bg-sky-500",
};

function Kpi({ label, value, hint, icon, tone, delay }: { label: string; value: string; hint?: string; icon: typeof History; tone: Tone; delay: number }) {
  return (
    <Card hover delay={delay} className="print-avoid-break p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-muted text-xs font-medium">{label}</span>
        <IconTile icon={icon} tone={tone} size="sm" />
      </div>
      <div className="num mt-1 text-[26px] font-bold leading-none tracking-tight">{value}</div>
      <div className="text-subtle mt-2 truncate text-[11px]">{hint ?? " "}</div>
    </Card>
  );
}

export default function ReportsPage() {
  const thisMonth = localDate().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const report = useAsync<MonthlyReport>(() => reportApi.monthly(month), [month]);
  const data = report.data;
  const t = data?.totals;
  const late = data?.lateAfterMinutes ?? 5;

  const buses = useMemo(() => [...(data?.buses ?? [])].sort((a, b) => a.bus_number.localeCompare(b.bus_number, undefined, { numeric: true })), [data]);

  function exportCsv() {
    if (!data) return;
    const head = ["Bus", "Trips", "Completed", "Morning trips", "Evening trips", "Scheduled (with start time)", "On-time %",
      `Late starts (> ${late} min)`, "Avg trip (min)", "Distance (km)", "Overspeed", "Offline", "Off route", "Emergencies (SOS/breakdown)", "Delay messages"];
    const rows: unknown[][] = buses.map((b) => [
      b.bus_number, b.trips, b.completed, b.morning_trips, b.evening_trips, b.scheduled,
      b.on_time_pct == null ? "" : Math.round(b.on_time_pct), b.late_starts,
      b.avg_minutes == null ? "" : Math.round(b.avg_minutes), Math.round(b.distance_km * 10) / 10,
      b.overspeed, b.offline, b.off_route, b.emergencies, b.delay_messages,
    ]);
    if (t) {
      rows.push(["All buses", t.trips, t.completed, "", "", "", t.on_time_pct == null ? "" : Math.round(t.on_time_pct), t.late_starts,
        "", Math.round(t.distance_km * 10) / 10, t.overspeed, t.offline, t.off_route, t.emergencies, t.delay_messages]);
    }
    downloadCsv(`busmate-report-${data.month}.csv`, [
      [`BusMate monthly report · ${monthLabel(data.month)}`],
      [`Time zone: ${data.timeZone}. A late start is a trip that started more than ${late} min after the route's morning/evening time. Simulation trips are not counted.`],
      [],
      head,
      ...rows,
    ]);
  }

  const hasData = !!t && (t.trips > 0 || buses.some((b) => b.trips > 0 || b.overspeed || b.offline || b.off_route || b.emergencies));

  return (
    <>
      <PageHeader
        title={<>Monthly report <span className="text-muted font-semibold">· {monthLabel(month)}</span></>}
        subtitle={`Trips, on-time starts and safety events per bus. A late start means the trip started more than ${late} min after the route's morning or evening time. Simulation trips are not counted.`}
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Input type="month" value={month} max={thisMonth} onChange={(e) => setMonth(e.target.value || thisMonth)} className="w-40" aria-label="Month" />
            <Button variant="secondary" disabled={!data} onClick={exportCsv}><FileSpreadsheet className="h-4 w-4" /> Download for Excel (CSV)</Button>
            <Button variant="secondary" disabled={!data} onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save as PDF</Button>
          </div>
        }
      />
      <p className="print-only mb-3 text-xs">BusMate · Smart College Transport · printed {new Date().toLocaleString()}{data ? ` · time zone ${data.timeZone}` : ""}</p>

      {report.error && <div className="mb-4"><ErrorBox message={report.error} onRetry={report.reload} /></div>}

      {report.loading && !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[104px]" />)}</div>
          <Skeleton className="h-72" />
        </div>
      ) : data && t ? (
        <div className={cn("space-y-4 transition-opacity", report.loading && "opacity-60")}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi delay={0} label="Trips" value={t.trips.toLocaleString()} hint={`${t.completed} completed`} icon={History} tone="blue" />
            <Kpi delay={1} label="On-time %" value={pct(t.on_time_pct)} hint={t.on_time_pct == null ? "No routes with run times" : `Started within ${late} min`} icon={CheckCircle2} tone={pctTone(t.on_time_pct)} />
            <Kpi delay={2} label="Late starts" value={t.late_starts.toLocaleString()} hint={`More than ${late} min late`} icon={AlarmClock} tone={t.late_starts ? "amber" : "green"} />
            <Kpi delay={3} label="Distance" value={`${num1(t.distance_km)} km`} hint="All real trips" icon={RouteIcon} tone="violet" />
            <Kpi delay={4} label="Overspeed" value={t.overspeed.toLocaleString()} hint={`${t.offline} offline · ${t.off_route} off route`} icon={Gauge} tone={t.overspeed ? "red" : "green"} />
            <Kpi delay={5} label="Emergencies" value={t.emergencies.toLocaleString()} hint={`SOS / breakdown · ${t.delay_messages} delay msgs`} icon={Siren} tone={t.emergencies ? "red" : "green"} />
          </div>

          {!hasData ? (
            <Card><EmptyState icon={FileBarChart} title={`No trips in ${monthLabel(month)}`} text="Pick another month above. Real trips appear here once drivers run them in the Driver app." /></Card>
          ) : (
            <>
              <Card delay={6} className="print-avoid-break">
                <CardHeader title="Buses" subtitle="Trips (M/E) = morning / evening runs. Avg trip = start to end." />
                <Table head={["Bus", "Trips (M/E)", "On-time %", "Late starts", "Avg trip min", "Distance km", "Overspeed", "Offline", "Off route", "Emergencies", "Delays"]}>
                  {buses.map((b) => (
                    <tr key={b.bus_id} className="hover:bg-[var(--surface-2)]">
                      <Td className="font-semibold">{b.bus_number}</Td>
                      <Td className="num">{b.trips} <span className="text-muted">({b.morning_trips}/{b.evening_trips})</span></Td>
                      <Td className={cn("num font-semibold", b.on_time_pct == null ? "text-muted" : pctTone(b.on_time_pct) === "green" ? "text-emerald-600" : pctTone(b.on_time_pct) === "amber" ? "text-amber-600" : "text-red-600")}>{pct(b.on_time_pct)}</Td>
                      <Td className={cn("num", b.late_starts > 0 && "font-semibold text-amber-600")}>{b.late_starts}{b.scheduled ? <span className="text-muted font-normal"> / {b.scheduled}</span> : null}</Td>
                      <Td className="num">{b.avg_minutes == null ? "-" : Math.round(b.avg_minutes)}</Td>
                      <Td className="num">{num1(b.distance_km)}</Td>
                      <Td className={cn("num", b.overspeed > 0 && "font-semibold text-red-600")}>{b.overspeed}</Td>
                      <Td className="num">{b.offline}</Td>
                      <Td className="num">{b.off_route}</Td>
                      <Td className={cn("num", b.emergencies > 0 && "font-semibold text-red-600")}>{b.emergencies}</Td>
                      <Td className="num">{b.delay_messages}</Td>
                    </tr>
                  ))}
                  <tr className="bg-[var(--surface-2)] font-semibold">
                    <Td>All buses</Td>
                    <Td className="num">{t.trips}</Td>
                    <Td className="num">{pct(t.on_time_pct)}</Td>
                    <Td className="num">{t.late_starts}</Td>
                    <Td className="num">-</Td>
                    <Td className="num">{num1(t.distance_km)}</Td>
                    <Td className="num">{t.overspeed}</Td>
                    <Td className="num">{t.offline}</Td>
                    <Td className="num">{t.off_route}</Td>
                    <Td className="num">{t.emergencies}</Td>
                    <Td className="num">{t.delay_messages}</Td>
                  </tr>
                </Table>
              </Card>

              <Card delay={7} className="print-avoid-break">
                <CardHeader title="On-time starts per bus" subtitle={`Share of trips that started within ${late} min of the route time`} />
                <div className="space-y-2.5 px-4 py-4">
                  {buses.map((b, i) => {
                    const tone = pctTone(b.on_time_pct);
                    const w = b.on_time_pct == null ? 0 : Math.max(0, Math.min(100, b.on_time_pct));
                    return (
                      <div key={b.bus_id} className="flex items-center gap-3 text-[13px]">
                        <span className="w-24 shrink-0 truncate font-semibold">{b.bus_number}</span>
                        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                          <div className={cn("anim-fade-in h-full rounded-full transition-[width] duration-700", BAR[tone])} style={{ width: `${w}%`, animationDelay: `${i * 40}ms` }} />
                        </div>
                        <span className={cn("num w-28 shrink-0 text-right text-xs", b.on_time_pct == null && "text-muted")}>
                          {b.on_time_pct == null ? "no run time set" : `${pct(b.on_time_pct)} · ${b.late_starts} late`}
                        </span>
                      </div>
                    );
                  })}
                  <div className="text-subtle flex flex-wrap gap-4 pt-1 text-[11px]">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 90% or more</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> 75–89%</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> below 75%</span>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
