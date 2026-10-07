"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { useLiveBuses } from "@/hooks/useLiveBuses";
import { alertApi } from "@/services/busmate";
import { errorMessage } from "@/lib/api";
import { dateTime, timeAgo } from "@/lib/format";
import { Badge, Button, Card, EmptyState, ErrorBox, PageHeader, Table, TableSkeleton, Td } from "@/components/ui";

const LABEL: Record<string, string> = {
  GPS_POOR: "Poor GPS accuracy", BUS_OFFLINE: "Bus offline", OVERSPEED: "Overspeed", ROUTE_DEVIATION: "Route deviation",
};

export default function AlertsPage() {
  const [resolved, setResolved] = useState(false);
  const alerts = useAsync(() => alertApi.list(resolved).then((r) => r.alerts), [resolved]);
  // New alerts arrive over Socket.IO; reload the list when one does.
  useLiveBuses(() => { if (!resolved) alerts.reload(); });

  async function resolve(id: number) {
    try { await alertApi.resolve(id); alerts.reload(); } catch (err) { alert(errorMessage(err)); }
  }

  return (
    <>
      <PageHeader title="Alerts" subtitle="GPS problems, offline buses, overspeed and route deviation. Severity: INFO, WARNING, CRITICAL."
        actions={<div className="surface flex rounded-xl p-1 text-sm font-semibold">
          {[false, true].map((r) => (
            <button key={String(r)} onClick={() => setResolved(r)} className={`rounded-lg px-3 py-1.5 ${resolved === r ? "bg-ink-900 text-white dark:bg-amber-brand dark:text-ink-950" : ""}`}>
              {r ? "Resolved" : "Open"}
            </button>
          ))}
        </div>} />
      {alerts.error && <div className="mb-4"><ErrorBox message={alerts.error} onRetry={alerts.reload} /></div>}
      <Card>
        {alerts.loading ? <TableSkeleton /> : !alerts.data?.length ? <EmptyState title={resolved ? "No resolved alerts" : "No open alerts"} text="All buses are behaving." /> : (
          <Table head={["Severity", "Type", "Bus", "Message", "When", ""]}>
            {alerts.data.map((a) => (
              <tr key={a.id} className="hover:bg-[var(--surface-2)]">
                <Td><Badge tone={a.severity === "CRITICAL" ? "red" : a.severity === "WARNING" ? "amber" : "blue"} dot>{a.severity}</Badge></Td>
                <Td className="font-semibold">{LABEL[a.type] ?? a.type}</Td>
                <Td>{a.bus_number ?? "-"}</Td>
                <Td className="max-w-md whitespace-normal">{a.message}</Td>
                <Td><span title={dateTime(a.created_at)}>{timeAgo(a.created_at)}</span></Td>
                <Td>{!a.resolved && <Button variant="secondary" className="py-1.5 text-xs" onClick={() => resolve(a.id)}><CheckCircle2 className="h-4 w-4" /> Resolve</Button>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
