export type ApplicationStatus = "running" | "degraded" | "stopped" | "unknown";

export type DeploymentStatus = "finished" | "in_progress" | "failed" | "queued" | "cancelled";

export type Application = {
  uuid: string;
  name: string;
  description: string;
  fqdn: string;
  gitRepository: string;
  gitBranch: string;
  gitCommitSha: string;
  status: ApplicationStatus;
  updatedAt: string;
  environmentId: number | null;
  projectUuid: string | null;
  projectName: string | null;
};

export type Project = {
  id: number;
  uuid: string;
  name: string;
};

export type Deployment = {
  uuid: string;
  applicationUuid?: string;
  applicationName: string;
  serverName: string;
  status: DeploymentStatus;
  commit: string;
  commitMessage: string;
  createdAt: string;
  updatedAt: string;
  projectUuid: string | null;
  projectName: string | null;
};

export type DeploymentLogs = {
  logs: string;
  refreshedAt: string;
};

export type EnvironmentVariable = {
  uuid?: string;
  key: string;
  value: string;
  isPreview: boolean;
  isBuildTime: boolean;
  isLiteral: boolean;
  isMultiline: boolean;
};

export type OverviewData = {
  applications: Application[];
  deployments: Deployment[];
  projects: Project[];
  instanceName: string;
  refreshedAt: string;
};

export type ApiMessage = {
  message: string;
};
