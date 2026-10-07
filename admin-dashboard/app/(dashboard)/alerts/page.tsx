"use client";
import { useState } from "react";
import { BellOff, CheckCircle2 } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { useLiveBuses } from "@/hooks/useLiveBuses";
import { alertApi } from "@/services/busmate";
import { errorMessage } from "@/lib/api";
import { alertTitle, dateTime, timeAgo } from "@/lib/format";
import { Badge, Button, Card, EmptyState, ErrorBox, PageHeader, Segmented, Table, TableSkeleton, Td } from "@/components/ui";

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
      <PageHeader title="Alerts" subtitle="Problems that need your attention: weak GPS, offline buses, overspeed and route deviation. Resolve an alert once it is handled."
        actions={<Segmented value={resolved ? "resolved" : "open"} onChange={(v) => setResolved(v === "resolved")}
          options={[{ value: "open", label: "Open" }, { value: "resolved", label: "Resolved" }]} />} />
      {alerts.error && <div className="mb-4"><ErrorBox message={alerts.error} onRetry={alerts.reload} /></div>}
      <Card>
        {alerts.loading ? <TableSkeleton /> : !alerts.data?.length ? <EmptyState icon={resolved ? BellOff : CheckCircle2} title={resolved ? "No resolved alerts yet" : "No open alerts"} text={resolved ? "Alerts you resolve are kept here for reference." : "All buses are behaving. New alerts appear here and in the bell at the top."} /> : (
          <Table head={["Severity", "Type", "Bus", "Message", "When", ""]}>
            {alerts.data.map((a) => (
              <tr key={a.id} className="hover:bg-[var(--surface-2)]">
                <Td><Badge tone={a.severity === "CRITICAL" ? "red" : a.severity === "WARNING" ? "amber" : "blue"} dot pulse={a.severity === "CRITICAL" && !a.resolved}>{a.severity === "CRITICAL" ? "Critical" : a.severity === "WARNING" ? "Warning" : "Info"}</Badge></Td>
                <Td className="font-semibold">{alertTitle(a.type)}</Td>
                <Td>{a.bus_number ?? "-"}</Td>
                <Td className="max-w-md whitespace-normal">{a.message}</Td>
                <Td><span title={dateTime(a.created_at)}>{timeAgo(a.created_at)}</span></Td>
                <Td>{!a.resolved && <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => resolve(a.id)}><CheckCircle2 className="h-3.5 w-3.5" /> Resolve</Button>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
