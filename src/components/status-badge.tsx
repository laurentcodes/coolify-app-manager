import type { ApplicationStatus, DeploymentStatus } from "@/lib/types";

type Status = ApplicationStatus | DeploymentStatus;

const statusLabels: Record<Status, string> = {
  running: "Running",
  degraded: "Needs attention",
  stopped: "Stopped",
  unknown: "Unknown",
  finished: "Successful",
  in_progress: "Deploying",
  failed: "Failed",
  queued: "Queued",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" /> {statusLabels[status]}
    </span>
  );
}
