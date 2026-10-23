/**
 * Calls to the commercebuild platform API, always as the signed-in user —
 * with the platform token the storefront forwarded for this request, through
 * @commercebuild/platform-api. Nothing here is stored, cached or logged.
 */
import { createApi } from "@commercebuild/platform-api";

import type { Caller } from "./auth";
import { HttpError } from "./http";

/** A client for this request's user; null without a forwarded token. */
function platformFor(caller: Caller) {
  if (!caller.platform) return null;
  return createApi({
    rootUrl: caller.platform.url,
    storeId: caller.storeId,
    accessToken: caller.platform.token,
    timeout: 10,
  });
}

/** The HTTP status of a failed platform-api call, if it had one. */
function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

export interface PlatformOrderLine {
  sequence?: number;
  lineType?: string;
  itemCode?: string;
  displayItemCode?: string;
  itemDesc?: string;
  qty?: number;
  uom?: string;
  unitPriceDisplay?: number;
  unitPrice?: number;
  price?: number;
}

export interface PlatformOrder {
  orderNumber: string;
  orderDate?: string;
  startedOn?: string;
  updatedOn?: string;
  lastModifiedDate?: string;
  currencyCode?: string;
  customerCode?: string;
  orderLines?: PlatformOrderLine[];
}

/**
 * The order as the caller sees it, or null when the platform does not show it
 * to them (it scopes shopper reads to their own customer).
 */
export async function readOrder(
  caller: Caller,
  orderNumber: string,
): Promise<PlatformOrder | null> {
  const platform = platformFor(caller);
  if (!platform) {
    throw new HttpError(
      503,
      "platform_unavailable",
      "The order cannot be checked right now.",
    );
  }
  try {
    // null on 404: not this caller's order.
    return (await platform.order().getOrder(orderNumber)) ?? null;
  } catch (error) {
    if (statusOf(error) === 403) return null;
    throw new HttpError(
      502,
      "platform_error",
      `The order could not be read (${statusOf(error) ?? "no answer"}).`,
    );
  }
}

/** The caller's own email address, or "" when unavailable. */
export async function readOwnEmail(caller: Caller): Promise<string> {
  try {
    const self = await platformFor(caller)?.customer().getUserSelf();
    return self?.user?.email ?? "";
  } catch {
    return "";
  }
}

/**
 * Another user's email address, read as the calling admin. "" when the
 * admin's privileges don't cover it or the read fails.
 */
export async function readUserEmailAsAdmin(
  caller: Caller,
  userId: number,
): Promise<string> {
  try {
    const user = await platformFor(caller)?.customer().getAdminUser(userId);
    return user?.email ?? "";
  } catch {
    return "";
  }
}
