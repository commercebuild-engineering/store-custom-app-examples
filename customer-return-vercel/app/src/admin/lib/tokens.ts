/**
 * Store Admin look, hardcoded.
 *
 * The admin bundle's Tailwind resolves stock theme tokens only — storeadmin's
 * `ocf-*` design tokens are not in scope — so the values from
 * apps/storeadmin/src/styles/globals.css are inlined here as arbitrary-value
 * utilities. Keep recipes in one place so a token change is one edit.
 */
export const INK = "#18181b";
export const INK_2 = "#3f3f46";
export const INK_3 = "#6b6b73";
export const INK_4 = "#98989f";
export const SURFACE_2 = "#f6f6f4";
export const BORDER = "#ebebe7";
export const BORDER_STRONG = "#dcdcd6";
export const BRAND = "#5b3df5";
export const BRAND_STRONG = "#4a2de0";
export const BRAND_SOFT = "#ece7ff";

export const SHADOW_CARD = "shadow-[0_1px_2px_rgb(20_20_30_/_0.04)]";

export const CARD = `rounded-[14px] border border-[#ebebe7] bg-white p-5 ${SHADOW_CARD}`;
export const CARD_TITLE =
  "mb-3 text-[11.5px] font-medium uppercase tracking-wider text-[#6b6b73]";

export const TABLE_WRAP = `overflow-hidden rounded-[7px] border border-[#ebebe7] bg-white ${SHADOW_CARD}`;
export const TABLE = "w-full border-collapse text-[13.5px] text-[#3f3f46]";
export const TH =
  "border-b border-[#ebebe7] bg-[#f6f6f4] px-3.5 py-2.5 text-left text-[11.5px] font-medium uppercase tracking-wider text-[#6b6b73] whitespace-nowrap";
export const TD = "border-b border-[#ebebe7] px-3.5 py-3.5 align-middle";
export const ROW = "transition-colors hover:bg-[#f6f6f4]";
export const ROW_CLICKABLE = `${ROW} cursor-pointer`;

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-3.5 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-[#5b3df5] text-white enabled:hover:bg-[#4a2de0]`;
export const BUTTON_SECONDARY = `${BUTTON_BASE} border border-[#dcdcd6] bg-white text-[#18181b] enabled:hover:bg-[#f6f6f4]`;
export const BUTTON_DANGER = `${BUTTON_BASE} border border-red-200 bg-white text-red-700 enabled:hover:bg-red-50`;
export const BUTTON_LINK =
  "inline-flex items-center gap-1 text-[13px] font-medium text-[#5b3df5] hover:underline";

export const INPUT =
  "w-full rounded-[7px] border border-[#dcdcd6] bg-white px-3 py-2 text-[13.5px] text-[#18181b] outline-none placeholder:text-[#98989f] focus:border-[#b9aef0] focus:shadow-[0_0_0_3px_rgb(91_61_245_/_0.15)] disabled:bg-[#f6f6f4] disabled:text-[#98989f]";
export const LABEL =
  "mb-1 [display:block] text-[12.5px] font-medium text-[#3f3f46]";
export const HINT = "mt-1 text-[12px] text-[#6b6b73]";

/** Tiny class joiner — the admin host provides no `cn` helper. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
