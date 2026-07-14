import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { privateJson } from "@/lib/api-response";

export async function POST(): Promise<Response> {
  const response = privateJson({ message: "Signed out." });
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
  return response;
}
