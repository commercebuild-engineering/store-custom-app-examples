import type { order_v1 } from "platform-api";

/**
 * Order detail reads, at most one in flight per order number. The platform's
 * order-detail endpoint refreshes its cached copy of the order while it reads
 * it, so two concurrent reads of the same order collide and one of them fails
 * with a 500. React runs effects twice in development, which made every
 * "Return Items" click do exactly that; callers asking for the same order at
 * the same time now share one request.
 */
const inflight = new Map<
  string,
  Promise<order_v1.OrdersOrderInterface | null>
>();

export function getOrderDetail(
  orderNumber: string,
): Promise<order_v1.OrdersOrderInterface | null> {
  const pending = inflight.get(orderNumber);
  if (pending) return pending;
  const request = cb.platform
    .order()
    .getOrder(orderNumber)
    .finally(() => inflight.delete(orderNumber));
  inflight.set(orderNumber, request);
  return request;
}
