/**
 * Path of a sibling page of this app.
 *
 * Pages render at /{locale}/extension/{extensionId}/page/{PageExportName} on
 * the storefront and /v5-admin/{locale}/extension/{extensionId}/page/{Name}
 * in Store Admin, and the editor preview injects the app under the fixed id
 * "preview" — so the id must never be hardcoded. Swapping the last path
 * segment of the current URL keeps preview and released builds working.
 */
export function pagePath(pageName: string, search?: string): string {
  const path = window.location.pathname.replace(/\/[^/]*$/, `/${pageName}`);
  return search ? `${path}?${search}` : path;
}
