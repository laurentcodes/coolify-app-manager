import type {
  Application,
  ApplicationStatus,
  Deployment,
  DeploymentLogs,
  DeploymentStatus,
  EnvironmentVariable,
  Project,
} from "@/lib/types";

type CoolifyApplication = {
  uuid: string;
  name: string;
  description?: string | null;
  fqdn?: string | null;
  git_repository?: string | null;
  git_branch?: string | null;
  git_commit_sha?: string | null;
  status?: string | null;
  updated_at?: string | null;
  environment_id?: number | null;
};

type CoolifyEnvironment = {
  id: number;
  project_id?: number | null;
};

type CoolifyProject = {
  id: number;
  uuid: string;
  name: string;
  environments?: CoolifyEnvironment[];
};

export type ProjectContext = {
  projects: Project[];
  projectByEnvironmentId: Map<number, Project>;
};

type CoolifyDeployment = {
  deployment_uuid?: string | null;
  uuid?: string | null;
  application_id?: string | number | null;
  application_name?: string | null;
  server_name?: string | null;
  status?: string | null;
  commit?: string | null;
  commit_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  logs?: string | null;
};

type CoolifyDeploymentHistory =
  | CoolifyDeployment[]
  | {
      count?: number;
      deployments?: CoolifyDeployment[];
    };

type CoolifyEnvironmentVariable = {
  uuid?: string;
  key: string;
  value: string;
  is_preview?: boolean;
  is_buildtime?: boolean;
  is_literal?: boolean;
  is_multiline?: boolean;
};

export class CoolifyApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CoolifyApiError";
    this.status = status;
  }
}

export const isCoolifyConfigured = (): boolean =>
  Boolean(process.env.COOLIFY_BASE_URL && process.env.COOLIFY_API_TOKEN);

const getApiBaseUrl = (): string => {
  const origin = process.env.COOLIFY_BASE_URL?.replace(/\/$/, "").replace(/\/api\/v1$/, "");

  if (!origin) {
    throw new CoolifyApiError("Coolify is not configured.", 503);
  }

  return `${origin}/api/v1`;
};

export const coolifyRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const token = process.env.COOLIFY_API_TOKEN;

  if (!token) {
    throw new CoolifyApiError("Coolify is not configured.", 503);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new CoolifyApiError(body?.message ?? `Coolify returned ${response.status}.`, response.status);
  }

  return (await response.json()) as T;
};

const normalizeApplicationStatus = (status?: string | null): ApplicationStatus => {
  const value = status?.toLowerCase() ?? "";

  if (value.includes("running")) return "running";
  if (value.includes("degraded") || value.includes("unhealthy")) return "degraded";
  if (value.includes("stopped") || value.includes("exited")) return "stopped";
  return "unknown";
};

const normalizeDeploymentStatus = (status?: string | null): DeploymentStatus => {
  const value = status?.toLowerCase() ?? "";

  if (value.includes("finish") || value.includes("success")) return "finished";
  if (value.includes("progress") || value.includes("running")) return "in_progress";
  if (value.includes("fail")) return "failed";
  if (value.includes("queue") || value.includes("pending")) return "queued";
  return "cancelled";
};

export const getApplications = async (): Promise<Application[]> => {
  const applications = await coolifyRequest<CoolifyApplication[]>("/applications");

  return applications.map((application) => ({
    uuid: application.uuid,
    name: application.name,
    description: application.description ?? "No description",
    fqdn: application.fqdn?.split(",")[0] ?? "",
    gitRepository: application.git_repository ?? "Repository unavailable",
    gitBranch: application.git_branch ?? "main",
    gitCommitSha: application.git_commit_sha?.slice(0, 7) ?? "unknown",
    status: normalizeApplicationStatus(application.status),
    updatedAt: application.updated_at ?? new Date().toISOString(),
    environmentId: application.environment_id ?? null,
    projectUuid: null,
    projectName: null,
  }));
};

const getProjectEnvironments = async (project: CoolifyProject): Promise<CoolifyEnvironment[]> => {
  if (project.environments) return project.environments;

  try {
    return await coolifyRequest<CoolifyEnvironment[]>(
      `/projects/${encodeURIComponent(project.uuid)}/environments`,
    );
  } catch (error) {
    if (!(error instanceof CoolifyApiError) || ![404, 405].includes(error.status)) throw error;

    const projectDetails = await coolifyRequest<CoolifyProject>(`/projects/${encodeURIComponent(project.uuid)}`);
    return projectDetails.environments ?? [];
  }
};

export const getProjectContext = async (): Promise<ProjectContext> => {
  const rawProjects = await coolifyRequest<CoolifyProject[]>("/projects");
  const environmentsByProject = await Promise.all(rawProjects.map(getProjectEnvironments));
  const projects = rawProjects.map((project) => ({
    id: project.id,
    uuid: project.uuid,
    name: project.name,
  }));
  const projectByEnvironmentId = new Map<number, Project>();

  environmentsByProject.forEach((environments, index) => {
    const project = projects[index];
    environments.forEach((environment) => projectByEnvironmentId.set(environment.id, project));
  });

  return { projects, projectByEnvironmentId };
};

const normalizeDeployment = (deployment: CoolifyDeployment, application: Application): Deployment | null => {
  const uuid = deployment.deployment_uuid ?? deployment.uuid;
  if (!uuid) return null;

  return {
    uuid,
    applicationUuid: application.uuid,
    applicationName: deployment.application_name ?? application.name,
    serverName: deployment.server_name ?? "Default server",
    status: normalizeDeploymentStatus(deployment.status),
    commit: deployment.commit?.slice(0, 7) ?? "unknown",
    commitMessage: deployment.commit_message ?? "Deployment triggered",
    createdAt: deployment.created_at ?? new Date().toISOString(),
    updatedAt: deployment.updated_at ?? deployment.created_at ?? new Date().toISOString(),
    projectUuid: application.projectUuid,
    projectName: application.projectName,
  };
};

export const getDeployments = async (applications: Application[]): Promise<Deployment[]> => {
  const deploymentsByApplication = await Promise.all(
    applications.map(async (application) => {
      const history = await coolifyRequest<CoolifyDeploymentHistory>(
        `/deployments/applications/${encodeURIComponent(application.uuid)}?skip=0&take=100`,
      );
      const deployments = Array.isArray(history) ? history : history.deployments ?? [];

      return deployments
        .map((deployment) => normalizeDeployment(deployment, application))
        .filter((deployment): deployment is Deployment => deployment !== null);
    }),
  );

  return deploymentsByApplication
    .flat()
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
};

export const getDeploymentLogs = async (uuid: string): Promise<DeploymentLogs> => {
  const deployment = await coolifyRequest<CoolifyDeployment>(`/deployments/${encodeURIComponent(uuid)}`);

  return {
    logs: deployment.logs ?? "",
    refreshedAt: new Date().toISOString(),
  };
};

export const getEnvironmentVariables = async (uuid: string): Promise<EnvironmentVariable[]> => {
  const variables = await coolifyRequest<CoolifyEnvironmentVariable[]>(`/applications/${uuid}/envs`);

  return variables.map((variable) => ({
    uuid: variable.uuid,
    key: variable.key,
    value: variable.value,
    isPreview: variable.is_preview ?? false,
    isBuildTime: variable.is_buildtime ?? false,
    isLiteral: variable.is_literal ?? false,
    isMultiline: variable.is_multiline ?? false,
  }));
};

export const updateEnvironmentVariables = async (
  uuid: string,
  variables: EnvironmentVariable[],
): Promise<void> => {
  await coolifyRequest(`/applications/${uuid}/envs/bulk`, {
    method: "PATCH",
    body: JSON.stringify({
      data: variables.map((variable) => ({
        key: variable.key,
        value: variable.value,
        is_preview: variable.isPreview,
        is_buildtime: variable.isBuildTime,
        is_literal: variable.isLiteral,
        is_multiline: variable.isMultiline,
      })),
    }),
  });
};

export const deployApplication = async (uuid: string): Promise<{ message: string; deployment_uuid: string }> =>
  coolifyRequest(`/applications/${uuid}/start`, { method: "POST" });
