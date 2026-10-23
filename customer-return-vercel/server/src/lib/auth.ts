/**
 * Who is calling. Every request arrives through the commercebuild storefront,
 * which signs a 60-second token for the signed-in user; @commercebuild/app-server
 * verifies it (issuer, audience = this service's origin, expiry, RS256, and
 * the typ header only the storefront's backend proxy signs).
 * Nothing else about the caller is trusted.
 */
import {
  CbAuthError,
  createCbAuth,
  type CbAuth,
  type CbAuthOptions,
  type CbPlatformAccess,
} from "@commercebuild/app-server";

import { env } from "./env";
import { HttpError } from "./http";

export interface Caller {
  storeId: string;
  userId: number;
  role: "admin" | "user";
  /** "" when the user has no linked customer. */
  customerCode: string;
  /** This app's id, for links to its pages; "" in preview and local dev. */
  appId: string;
  /** The store's origin + basePath, for links back into it. */
  storefrontUrl: string;
  /** Present when the storefront forwarded the user's platform token. */
  platform?: CbPlatformAccess;
}

let getKeyForTests: CbAuthOptions["getKey"] | null = null;
let auth: CbAuth | null = null;
let authConfig = "";

function cbAuth(): CbAuth {
  // Built on first use (and again if the configuration changed) so tests can
  // set the environment per case.
  const options: CbAuthOptions = {
    issuer: env.issuer(),
    audience: env.serviceOrigin(),
    jwksUrl: env.jwksUrl() || undefined,
    platformUrl: env.platformUrlOverride() || undefined,
    getKey: getKeyForTests ?? undefined,
  };
  const config = JSON.stringify(options);
  if (!auth || authConfig !== config) {
    auth = createCbAuth(options);
    authConfig = config;
  }
  return auth;
}

/** Test seam: verify against these keys instead of the issuer's JWKS. */
export function setKeysForTests(getKey: CbAuthOptions["getKey"] | null): void {
  getKeyForTests = getKey;
  auth = null;
}

export async function authenticate(request: Request): Promise<Caller> {
  let caller;
  try {
    caller = await cbAuth().authenticate(request);
  } catch (error) {
    if (error instanceof CbAuthError) {
      if (error.status === 503) console.error("[returns] auth keys", error.cause);
      throw new HttpError(
        error.status,
        error.status === 503 ? "unavailable" : "unauthorized",
        error.status === 503 ? "Try again shortly." : "Sign in to continue.",
      );
    }
    throw error;
  }
  return {
    storeId: caller.storeId,
    userId: Number(caller.userId),
    role: caller.role,
    customerCode: caller.customerCode,
    appId: caller.appId,
    storefrontUrl: caller.storefrontUrl,
    ...(caller.platform ? { platform: caller.platform } : {}),
  };
}

export function requireAdmin(caller: Caller): void {
  if (caller.role !== "admin") {
    throw new HttpError(403, "forbidden", "Admins only.");
  }
}
