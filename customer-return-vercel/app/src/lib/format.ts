/**
 * Storefront-only formatting. The pure helpers live in ../shared/format so
 * the admin bundle can use them too; `formatMoney` stays here because it
 * relies on `cb.utils.displayMoney`, which the admin host does not provide.
 */
export * from "../shared/format";

export function formatMoney(amount: number, currencyCode?: string): string {
  // displayMoney already defaults to a currency-styled USD format; only the
  // currency code needs overriding when the order carries one.
  return cb.utils.displayMoney(amount ?? 0, {
    currency: currencyCode || undefined,
  });
}
