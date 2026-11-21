import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { createAuthOptions } from "@/lib/auth/options";
import { readAuthEnv } from "@/lib/env";
import { safeErrorResponse } from "@/lib/scan/response";

type AuthRouteContext = { params: Promise<{ nextauth: string[] }> };

// next-auth v4 awaits `context.params` itself, so the Promise is passed through.
async function handleAuthRequest(
  request: NextRequest,
  context: AuthRouteContext,
): Promise<Response> {
  const env = readAuthEnv(process.env);
  if (env === null) {
    return safeErrorResponse("auth_not_configured");
  }
  return NextAuth(request, context, createAuthOptions(env));
}

export function GET(
  request: NextRequest,
  context: AuthRouteContext,
): Promise<Response> {
  return handleAuthRequest(request, context);
}

export function POST(
  request: NextRequest,
  context: AuthRouteContext,
): Promise<Response> {
  return handleAuthRequest(request, context);
}
