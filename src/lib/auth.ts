import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "coolify_manager_session";

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

const matches = (left: string, right: string): boolean => timingSafeEqual(digest(left), digest(right));

export const isAccessKeyConfigured = (): boolean => Boolean(process.env.DASHBOARD_ACCESS_KEY);

export const validateAccessKey = (key: string): boolean => {
  const configuredKey = process.env.DASHBOARD_ACCESS_KEY;
  return Boolean(configuredKey && matches(key, configuredKey));
};

export const createSessionToken = (): string | null => {
  const configuredKey = process.env.DASHBOARD_ACCESS_KEY;
  return configuredKey ? digest(`coolify-manager:${configuredKey}`).toString("hex") : null;
};

export const hasValidSession = async (): Promise<boolean> => {
  const expectedToken = createSessionToken();
  if (!expectedToken) return false;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  return Boolean(sessionToken && matches(sessionToken, expectedToken));
};

export const requireApiSession = async (): Promise<NextResponse | null> => {
  if (await hasValidSession()) return null;

  return NextResponse.json(
    { message: isAccessKeyConfigured() ? "Authentication is required." : "Dashboard access is not configured." },
    { status: isAccessKeyConfigured() ? 401 : 503 },
  );
};
