"use client";

import { RefreshCw as refreshCw, TerminalSquare as terminalSquare, X as x } from "lucide-react";
import { useMemo } from "react";
import useSWR from "swr";
import { StatusBadge } from "@/components/status-badge";
import type { ApiMessage, Deployment, DeploymentLogs } from "@/lib/types";

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  const body = (await response.json()) as T & ApiMessage;

  if (response.status === 401) window.location.reload();
  if (!response.ok) throw new Error(body.message ?? "The request failed.");
  return body;
};

type DeploymentLogDrawerProps = {
  deployment: Deployment;
  onClose: () => void;
};

type CoolifyLogEvent = {
  batch?: number;
  hidden?: boolean;
  order?: number;
  output?: unknown;
  timestamp?: string;
  type?: string;
};

type DeploymentLogLine = {
  id: string;
  message: string;
  timestamp: string;
  tone: "default" | "error" | "warning";
};

const formatLogTimestamp = (timestamp?: string): string => {
  if (!timestamp) return "";
  const match = timestamp.match(/T(\d{2}:\d{2}:\d{2})/);
  return match?.[1] ?? timestamp.slice(0, 8);
};

const getLogTone = (type: string | undefined, message: string): DeploymentLogLine["tone"] => {
  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes("error") || normalizedMessage.includes("failed")) return "error";
  if (type === "stderr" || normalizedMessage.includes("warning")) return "warning";
  return "default";
};

const parseDeploymentLogs = (source: string): DeploymentLogLine[] => {
  try {
    const parsed = JSON.parse(source) as unknown;
    if (!Array.isArray(parsed)) throw new Error("Deployment logs are not an event list.");

    return parsed.flatMap((value, eventIndex) => {
      if (!value || typeof value !== "object") return [];
      const event = value as CoolifyLogEvent;
      if (typeof event.output !== "string") return [];

      const timestamp = formatLogTimestamp(event.timestamp);
      return event.output.split(/\r?\n/).flatMap((message, lineIndex) => {
        if (!message.trim()) return [];
        return [{
          id: `${event.batch ?? 0}-${event.order ?? eventIndex}-${eventIndex}-${lineIndex}`,
          message,
          timestamp,
          tone: getLogTone(event.type, message),
        }];
      });
    });
  } catch {
    return source.split(/\r?\n/).flatMap((message, index) => {
      if (!message.trim()) return [];
      return [{
        id: `plain-${index}`,
        message,
        timestamp: "",
        tone: getLogTone(undefined, message),
      }];
    });
  }
};

export function DeploymentLogDrawer({ deployment, onClose }: DeploymentLogDrawerProps) {
  const Refresh = refreshCw;
  const Terminal = terminalSquare;
  const Close = x;
  const isActive = deployment.status === "in_progress" || deployment.status === "queued";
  const { data, error, isLoading, isValidating, mutate } = useSWR<DeploymentLogs>(
    `/api/deployments/${deployment.uuid}`,
    fetcher,
    {
      refreshInterval: isActive ? 3_000 : 0,
      revalidateOnFocus: true,
    },
  );
  const logLines = useMemo<DeploymentLogLine[]>(
    () => parseDeploymentLogs(data?.logs ?? ""),
    [data?.logs],
  );

  return (
    <div className="drawer-layer" role="presentation">
      <button className="drawer-backdrop" onClick={onClose} aria-label="Close deployment logs" />
      <aside className="log-drawer" aria-label={`${deployment.applicationName} deployment logs`}>
        <header className="drawer-header log-drawer-header">
          <div>
            <span className="utility-label">Deployment logs</span>
            <h2>{deployment.applicationName}</h2>
            <p>{deployment.commitMessage}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <Close size={19} />
          </button>
        </header>

        <div className="log-metadata">
          <div><span>Status</span><StatusBadge status={deployment.status} /></div>
          <div><span>Commit</span><code>{deployment.commit}</code></div>
          <div><span>Server</span><strong>{deployment.serverName}</strong></div>
        </div>

        <div className="log-toolbar">
          <div><Terminal size={15} /><span>Build output</span></div>
          <button className="icon-button quiet" onClick={() => mutate()} disabled={isValidating} aria-label="Refresh deployment logs">
            <Refresh className={isValidating ? "spin" : ""} size={15} />
          </button>
        </div>

        <div className="log-output" aria-live="polite">
          {isLoading ? <div className="log-state">Loading deployment logs…</div> : null}
          {error ? (
            <div className="log-state error-state">
              <span>{error.message}</span>
              <button className="secondary-button" onClick={() => mutate()}>Try again</button>
            </div>
          ) : null}
          {!isLoading && !error && !logLines.length ? (
            <div className="log-state">No log output is available for this deployment.</div>
          ) : null}
          {!isLoading && !error && logLines.length ? (
            <ol className="log-lines" aria-label="Deployment output">
              {logLines.map((line) => (
                <li className={`log-line log-line-${line.tone}`} key={line.id}>
                  <time>{line.timestamp}</time>
                  <code>{line.message}</code>
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        <footer className="log-footer">
          <span>{isActive ? "Refreshing every 3 seconds" : "Deployment complete"}</span>
          {data ? <time dateTime={data.refreshedAt}>Updated {new Date(data.refreshedAt).toLocaleTimeString()}</time> : null}
        </footer>
      </aside>
    </div>
  );
}
