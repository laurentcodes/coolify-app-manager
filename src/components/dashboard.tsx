"use client";

import {
  Activity as activity,
  AppWindow as appWindow,
  ArrowUpRight as arrowUpRight,
  Box as box,
  FileText as fileText,
  GitBranch as gitBranch,
  KeyRound as keyRound,
  LogOut as logOut,
  Play as play,
  RefreshCw as refreshCw,
  Search as search,
  X as x,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { DeploymentLogDrawer } from "@/components/deployment-log-drawer";
import { EnvironmentDrawer } from "@/components/environment-drawer";
import { StatusBadge } from "@/components/status-badge";
import type { ApiMessage, Application, Deployment, OverviewData, Project } from "@/lib/types";

type View = "overview" | "applications" | "deployments";

const emptyApplications: Application[] = [];
const emptyDeployments: Deployment[] = [];
const emptyProjects: Project[] = [];

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  const body = (await response.json()) as T & ApiMessage;

  if (response.status === 401) window.location.reload();
  if (!response.ok) throw new Error(body.message ?? "The request failed.");
  return body;
};

const formatRelativeTime = (value: string): string => {
  const difference = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(difference / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const getRepositoryName = (repository: string): string =>
  repository.replace(/\.git$/, "").split("/").slice(-2).join("/");

const navItems: { id: View; label: string; icon: typeof appWindow }[] = [
  { id: "overview", label: "Overview", icon: appWindow },
  { id: "applications", label: "Applications", icon: box },
  { id: "deployments", label: "Deployments", icon: activity },
];

type ApplicationListProps = {
  applications: Application[];
  deployingUuid: string | null;
  onDeploy: (application: Application) => void;
  onEnvironment: (application: Application) => void;
};

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state-mark" />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function ApplicationList({ applications, deployingUuid, onDeploy, onEnvironment }: ApplicationListProps) {
  const ArrowUpRight = arrowUpRight;
  const Branch = gitBranch;
  const Key = keyRound;
  const Play = play;

  if (!applications.length) {
    return <EmptyState title="No applications found" description="Applications from your Coolify instance will appear here." />;
  }

  return (
    <div className="application-list">
      {applications.map((application) => (
        <article className="application-row" key={application.uuid}>
          <div className="app-identity">
            <div className="app-monogram">{application.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <div className="app-name-line">
                <h3>{application.name}</h3>
                <StatusBadge status={application.status} />
              </div>
              <p>{application.description}</p>
            </div>
          </div>
          <div className="repo-cell">
            <span><Branch size={13} /> {application.gitBranch}</span>
            <small>{getRepositoryName(application.gitRepository)}</small>
          </div>
          <time dateTime={application.updatedAt}>{formatRelativeTime(application.updatedAt)}</time>
          <div className="row-actions">
            {application.fqdn ? (
              <Link className="icon-button quiet" href={application.fqdn} target="_blank" aria-label={`Open ${application.name}`}>
                <ArrowUpRight size={15} />
              </Link>
            ) : null}
            <button
              className="icon-button quiet"
              onClick={() => onEnvironment(application)}
              aria-label={`Edit ${application.name} environment`}
            >
              <Key size={15} />
            </button>
            <button
              className="deploy-button"
              onClick={() => onDeploy(application)}
              disabled={deployingUuid === application.uuid}
            >
              {deployingUuid === application.uuid ? <span className="button-spinner" /> : <Play size={14} />}
              {deployingUuid === application.uuid ? "Starting" : "Deploy"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function DeploymentList({ deployments, onSelect }: { deployments: Deployment[]; onSelect: (deployment: Deployment) => void }) {
  const FileText = fileText;

  if (!deployments.length) {
    return <EmptyState title="No deployments yet" description="Your recent Coolify deployment history will appear here." />;
  }

  return (
    <div className="deployment-list">
      {deployments.map((deployment) => (
        <button
          className="deployment-row"
          onClick={() => onSelect(deployment)}
          aria-label={`View logs for ${deployment.applicationName}`}
          key={deployment.uuid}
        >
          <span className={`deployment-line deployment-line-${deployment.status}`} />
          <div className="deployment-copy">
            <div>
              <strong>{deployment.applicationName}</strong>
              <StatusBadge status={deployment.status} />
            </div>
            <p>{deployment.commitMessage}</p>
            <small><code>{deployment.commit}</code> · {deployment.serverName}</small>
          </div>
          <time dateTime={deployment.updatedAt}>{formatRelativeTime(deployment.updatedAt)}</time>
          <FileText className="deployment-open-icon" size={15} />
        </button>
      ))}
    </div>
  );
}

export function Dashboard() {
  const Refresh = refreshCw;
  const Search = search;
  const SignOut = logOut;
  const Close = x;
  const { data, error, isLoading, isValidating, mutate } = useSWR<OverviewData>("/api/overview", fetcher, {
    refreshInterval: 15_000,
    revalidateOnFocus: true,
  });
  const [activeView, setActiveView] = useState<View>("overview");
  const [query, setQuery] = useState<string>("");
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [deployingUuid, setDeployingUuid] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const applications = data?.applications ?? emptyApplications;
  const deployments = data?.deployments ?? emptyDeployments;
  const projects = data?.projects ?? emptyProjects;
  const runningCount = applications.filter((application) => application.status === "running").length;
  const attentionCount = applications.filter((application) => application.status === "degraded").length;
  const activeDeployment = deployments.find(
    (deployment) => deployment.status === "in_progress" || deployment.status === "queued",
  );

  const filteredApplications = useMemo<Application[]>(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return applications;
    return applications.filter((application) =>
      [application.name, application.gitRepository, application.gitBranch, application.status]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [applications, query]);

  const sortedProjects = useMemo<Project[]>(
    () => [...projects].sort((left, right) => left.name.localeCompare(right.name)),
    [projects],
  );
  const activeProjectFilter = projectFilter === "all" || projects.some((project) => project.uuid === projectFilter)
    ? projectFilter
    : "all";
  const serviceOptions = useMemo<Application[]>(
    () => applications
      .filter((application) => activeProjectFilter === "all" || application.projectUuid === activeProjectFilter)
      .sort((left, right) => left.name.localeCompare(right.name)),
    [activeProjectFilter, applications],
  );
  const activeServiceFilter = serviceFilter === "all"
    || serviceOptions.some((application) => application.uuid === serviceFilter)
    ? serviceFilter
    : "all";
  const filteredDeployments = useMemo<Deployment[]>(
    () => deployments.filter((deployment) => (
      (activeProjectFilter === "all" || deployment.projectUuid === activeProjectFilter)
      && (activeServiceFilter === "all" || deployment.applicationUuid === activeServiceFilter)
    )),
    [activeProjectFilter, activeServiceFilter, deployments],
  );

  const deploy = async (application: Application) => {
    setDeployingUuid(application.uuid);

    try {
      const response = await fetch(`/api/applications/${application.uuid}/deploy`, { method: "POST" });
      const body = (await response.json()) as ApiMessage;
      if (!response.ok) throw new Error(body.message);
      setNotice(`${application.name}: ${body.message}`);
      await mutate();
    } catch (deployError) {
      setNotice(deployError instanceof Error ? deployError.message : "The deployment could not be started.");
    } finally {
      setDeployingUuid(null);
    }
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  };

  const headline = attentionCount
    ? `${attentionCount} ${attentionCount === 1 ? "application needs" : "applications need"} attention`
    : activeDeployment
      ? `${activeDeployment.applicationName} is deploying`
      : "Systems are steady";

  return (
    <div className="app-shell">
      <header className="console-header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-mark"><span /><span /><span /></span>
            <div><strong>Coolify Manager</strong><small>Private console</small></div>
          </div>
          <nav className="main-nav" aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button className={activeView === item.id ? "active" : ""} onClick={() => setActiveView(item.id)} key={item.id}>
                  <Icon size={15} /> {item.label}
                </button>
              );
            })}
          </nav>
          <div className="header-actions">
            <button className="icon-button" onClick={() => mutate()} aria-label="Refresh data" disabled={isValidating}>
              <Refresh className={isValidating ? "spin" : ""} size={16} />
            </button>
            <button className="icon-button" onClick={signOut} aria-label="Sign out">
              <SignOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="page-heading">
          <div>
            <span className="utility-label">{data?.instanceName ?? "Coolify instance"}</span>
            <h1>{activeView === "overview" ? "Infrastructure" : activeView === "applications" ? "Applications" : "Deployments"}</h1>
          </div>
          {data ? <span className="last-updated">Updated {formatRelativeTime(data.refreshedAt)}</span> : null}
        </section>

        {error ? (
          <section className="page-error">
            <div><strong>Coolify is unavailable</strong><span>{error.message}</span></div>
            <button className="secondary-button" onClick={() => mutate()}>Try again</button>
          </section>
        ) : null}

        {isLoading ? <DashboardSkeleton /> : null}

        {!isLoading && !error && activeView === "overview" ? (
          <div className="overview-layout">
            <section className="status-rail">
              <div className={`status-orb ${attentionCount ? "warning" : ""}`}><span /></div>
              <div className="status-copy">
                <span className="utility-label">Live status</span>
                <h2>{headline}</h2>
                <p>{activeDeployment ? "A release is currently in progress." : "No active deployments right now."}</p>
              </div>
              <div className="status-metrics" aria-label="Instance summary">
                <div><strong>{applications.length}</strong><span>Applications</span></div>
                <div><strong>{runningCount}</strong><span>Running</span></div>
                <div><strong>{deployments.length}</strong><span>Recent deploys</span></div>
              </div>
            </section>

            <section className="panel overview-applications">
              <div className="panel-heading">
                <div><h2>Applications</h2><p>Current runtime state</p></div>
                <button className="text-button" onClick={() => setActiveView("applications")}>View all</button>
              </div>
              <ApplicationList
                applications={applications.slice(0, 5)}
                deployingUuid={deployingUuid}
                onDeploy={deploy}
                onEnvironment={setSelectedApplication}
              />
            </section>

            <section className="panel overview-deployments">
              <div className="panel-heading">
                <div><h2>Recent activity</h2><p>Latest deployment outcomes</p></div>
                <button className="text-button" onClick={() => setActiveView("deployments")}>View all</button>
              </div>
              <DeploymentList deployments={deployments.slice(0, 5)} onSelect={setSelectedDeployment} />
            </section>
          </div>
        ) : null}

        {!isLoading && !error && activeView === "applications" ? (
          <section className="panel page-panel">
            <div className="panel-heading panel-toolbar">
              <div><h2>All applications</h2><p>{filteredApplications.length} of {applications.length}</p></div>
              <label className="search-field">
                <Search size={15} />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search applications"
                  aria-label="Search applications"
                />
              </label>
            </div>
            <ApplicationList
              applications={filteredApplications}
              deployingUuid={deployingUuid}
              onDeploy={deploy}
              onEnvironment={setSelectedApplication}
            />
          </section>
        ) : null}

        {!isLoading && !error && activeView === "deployments" ? (
          <section className="panel page-panel">
            <div className="panel-heading deployment-toolbar">
              <div><h2>Deployment history</h2><p>{filteredDeployments.length} of {deployments.length} recent events</p></div>
              <div className="deployment-filters">
                <label className="project-filter">
                  <span>Project</span>
                  <select
                    value={activeProjectFilter}
                    onChange={(event) => {
                      setProjectFilter(event.target.value);
                      setServiceFilter("all");
                    }}
                    aria-label="Filter deployments by project"
                  >
                    <option value="all">All projects</option>
                    {sortedProjects.map((project) => (
                      <option value={project.uuid} key={project.uuid}>{project.name}</option>
                    ))}
                  </select>
                </label>
                <label className="project-filter">
                  <span>Service</span>
                  <select
                    value={activeServiceFilter}
                    onChange={(event) => setServiceFilter(event.target.value)}
                    aria-label="Filter deployments by service"
                    disabled={!serviceOptions.length}
                  >
                    <option value="all">All services</option>
                    {serviceOptions.map((application) => (
                      <option value={application.uuid} key={application.uuid}>{application.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <DeploymentList deployments={filteredDeployments} onSelect={setSelectedDeployment} />
          </section>
        ) : null}
      </main>

      {selectedApplication ? (
        <EnvironmentDrawer application={selectedApplication} onClose={() => setSelectedApplication(null)} onNotice={setNotice} />
      ) : null}

      {selectedDeployment ? (
        <DeploymentLogDrawer deployment={selectedDeployment} onClose={() => setSelectedDeployment(null)} />
      ) : null}

      {notice ? (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss notification"><Close size={14} /></button>
        </div>
      ) : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="skeleton-wrap" aria-label="Loading dashboard">
      <div className="skeleton skeleton-status" />
      <div className="skeleton-grid">
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-panel" />
      </div>
    </div>
  );
}
