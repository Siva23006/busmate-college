"use client";
import { useLiveBuses } from "@/hooks/useLiveBuses";
import { ConnectionPill, LiveFleet } from "@/components/LiveFleet";
import { useAlertToasts } from "@/components/Toasts";
import { ErrorBox, PageHeader } from "@/components/ui";

export default function LivePage() {
  const toasts = useAlertToasts();
  const { buses, connection, loading, error, refresh } = useLiveBuses(toasts.push);
  return (
    <>
      <PageHeader title="Live Buses" subtitle="Every bus on one map. Click a bus to see its driver, speed, GPS accuracy and next-stop arrival."
        actions={<ConnectionPill connection={connection} />} />
      {error && <div className="mb-4"><ErrorBox message={error} onRetry={refresh} /></div>}
      <LiveFleet buses={buses} loading={loading} mapHeight="h-[calc(100vh-13.5rem)] min-h-[480px]" listTitle="Buses" />
      {toasts.view}
    </>
  );
}
