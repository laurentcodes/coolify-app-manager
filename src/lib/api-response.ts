import { NextResponse } from "next/server";
import { CoolifyApiError } from "@/lib/coolify";

export const apiErrorResponse = (error: unknown): NextResponse => {
  if (error instanceof CoolifyApiError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ message: "The request could not be completed." }, { status: 500 });
};

export const privateJson = <T>(data: T, init?: ResponseInit): NextResponse => {
  const response = NextResponse.json(data, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
};
