import { apiErrorResponse, privateJson } from "@/lib/api-response";
import { requireApiSession } from "@/lib/auth";
import { getApplications, getDeployments, getProjectContext } from "@/lib/coolify";

export async function GET(): Promise<Response> {
  const authError = await requireApiSession();
  if (authError) return authError;

  try {
    const [rawApplications, projectContext] = await Promise.all([getApplications(), getProjectContext()]);
    const applications = rawApplications.map((application) => {
      const project = application.environmentId === null
        ? undefined
        : projectContext.projectByEnvironmentId.get(application.environmentId);

      return {
        ...application,
        projectUuid: project?.uuid ?? null,
        projectName: project?.name ?? null,
      };
    });
    const deployments = await getDeployments(applications);
    const instanceName = new URL(process.env.COOLIFY_BASE_URL ?? "http://localhost").hostname;

    return privateJson({
      applications,
      deployments,
      projects: projectContext.projects,
      instanceName,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
