import { pagePath } from "../shared/page-path";

export { pagePath };

export function goToPage(pageName: string, search?: string): void {
  cb.utils.router.push(pagePath(pageName, search));
}

/** The host's own order-detail page for an order number. */
export function orderDetailPath(orderNumber: string): string {
  return cb.utils.tlink(`/user/order/${encodeURIComponent(orderNumber)}`);
}
