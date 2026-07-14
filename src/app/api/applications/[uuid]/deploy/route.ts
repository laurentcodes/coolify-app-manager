import { apiErrorResponse, privateJson } from "@/lib/api-response";
import { requireApiSession } from "@/lib/auth";
import { deployApplication } from "@/lib/coolify";

type RouteContext = { params: Promise<{ uuid: string }> };

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  const authError = await requireApiSession();
  if (authError) return authError;

  try {
    const { uuid } = await context.params;
    return privateJson(await deployApplication(uuid));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
