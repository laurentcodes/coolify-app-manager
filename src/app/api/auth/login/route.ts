import { AUTH_COOKIE_NAME, createSessionToken, isAccessKeyConfigured, validateAccessKey } from "@/lib/auth";
import { privateJson } from "@/lib/api-response";

export async function POST(request: Request): Promise<Response> {
  if (!isAccessKeyConfigured()) {
    return privateJson({ message: "Dashboard access is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
  if (typeof body?.key !== "string" || !body.key.trim()) {
    return privateJson({ message: "Enter your access key." }, { status: 400 });
  }

  if (!validateAccessKey(body.key)) {
    return privateJson({ message: "That access key is not valid." }, { status: 401 });
  }

  const sessionToken = createSessionToken();
  if (!sessionToken) {
    return privateJson({ message: "Dashboard access is not configured." }, { status: 503 });
  }

  const response = privateJson({ message: "Access granted." });
  response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
