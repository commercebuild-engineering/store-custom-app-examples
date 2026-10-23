import { useEffect, useState } from "react";

const ORDER_DETAILS_ROUTE =
  "xm-account/xm-account-orders/xm-account-order-details";
const ORDER_DETAILS_MODULE = "order_details_listing";

/**
 * Whether the store has order editing switched on, read exactly the way the
 * storefront account pages read it: the `enable_orderEdit` setting on the
 * `order_details_listing` module of the account order-details grid route.
 *
 * Editing is B2B-only, so callers must still gate on the customer being B2B —
 * see `useIdentity().isB2b`.
 */
export function useOrderEditEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const grid = await cb.platform
          .grid()
          .fetchGridByRoute(ORDER_DETAILS_ROUTE);
        if (!active) return;
        let value: unknown;
        for (const container of grid?.containers ?? []) {
          for (const column of container.columns ?? []) {
            if (column.module?.type === ORDER_DETAILS_MODULE) {
              value = (column.module.data as any)?.settings?.settings
                ?.enable_orderEdit;
            }
          }
        }
        // The setting comes back as any of true / 1 / "1" / "true".
        setEnabled(
          value === true || value === 1 || value === "1" || value === "true",
        );
      } catch {
        // Treat an unreadable grid as "editing off" — the same safe default
        // the storefront lands on when the module is missing.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return enabled;
}

/** The account order-edit URL, matching the core Orders table's Edit link. */
export function editOrderPath(
  orderNumber: string,
  processId?: string | null,
): string {
  const isProcess = processId ? "&isOrderProcess=1" : "";
  return cb.utils.tlink(
    `/user/order/${encodeURIComponent(orderNumber)}?edit=true${isProcess}` +
      `&from=${encodeURIComponent("/user/order")}`,
  );
}
