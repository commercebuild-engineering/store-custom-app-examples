/**
 * Tunable behaviour of the returns flow.
 *
 * The values in constants.ts are the DEFAULTS. A store overrides any of them
 * through the returns service's settings (the admin Settings page edits
 * them); a field that is absent or of the wrong type keeps its default.
 */
import { useEffect, useState } from "react";

import {
  MAX_PHOTOS_PER_LINE,
  RETURN_REASONS,
  RETURN_WINDOW_DAYS,
} from "./constants";
import type { ReturnsApi } from "./returns-store";

export interface ReturnsSettings {
  /** Days after the order date a return may be started; -1 = no limit. */
  returnWindowDays: number;
  /** Max photos a customer may attach to one return line. */
  maxPhotosPerLine: number;
  /** Reasons offered per line item, in display order. */
  returnReasons: string[];
}

export const DEFAULT_SETTINGS: ReturnsSettings = {
  returnWindowDays: RETURN_WINDOW_DAYS,
  maxPhotosPerLine: MAX_PHOTOS_PER_LINE,
  returnReasons: [...RETURN_REASONS],
};

/** True when the window is switched off (-1 or any negative value). */
export function isReturnWindowDisabled(settings: ReturnsSettings): boolean {
  return settings.returnWindowDays < 0;
}

/** Apply whatever the settings document carries on top of the defaults. */
export function mergeSettings(data: unknown): ReturnsSettings {
  const source = (data ?? {}) as Record<string, unknown>;
  const merged: ReturnsSettings = { ...DEFAULT_SETTINGS };

  if (
    typeof source.returnWindowDays === "number" &&
    Number.isFinite(source.returnWindowDays)
  ) {
    merged.returnWindowDays = Math.trunc(source.returnWindowDays);
  }
  if (
    typeof source.maxPhotosPerLine === "number" &&
    Number.isInteger(source.maxPhotosPerLine) &&
    source.maxPhotosPerLine >= 0
  ) {
    merged.maxPhotosPerLine = source.maxPhotosPerLine;
  }
  if (Array.isArray(source.returnReasons)) {
    const reasons = source.returnReasons
      .filter((reason): reason is string => typeof reason === "string")
      .map((reason) => reason.trim())
      .filter(Boolean);
    if (reasons.length > 0) merged.returnReasons = reasons;
  }
  return merged;
}

export async function loadSettings(db: ReturnsApi): Promise<ReturnsSettings> {
  const res = await db.fetch("settings", {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Settings read failed (${res.status})`);
  return mergeSettings(await res.json());
}

/** Persist store overrides (admin Settings page). Only the given fields change. */
export async function saveSettings(
  db: ReturnsApi,
  patch: Partial<ReturnsSettings>,
): Promise<void> {
  const res = await db.fetch("settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Settings save failed (${res.status})`);
}

export interface SettingsState {
  settings: ReturnsSettings;
  /** False once the document has been read (or there is no db to read). */
  loading: boolean;
}

/**
 * Settings for the current store. Resolves to the defaults immediately when
 * the backend connection is not configured, and falls back to them if the read
 * fails — a missing settings document must never block the flow.
 */
export function useReturnsSettings(db: ReturnsApi | undefined): SettingsState {
  const [state, setState] = useState<SettingsState>({
    settings: DEFAULT_SETTINGS,
    loading: Boolean(db),
  });

  useEffect(() => {
    let active = true;
    if (!db) {
      setState({ settings: DEFAULT_SETTINGS, loading: false });
      return;
    }
    setState((current) => ({ ...current, loading: true }));
    (async () => {
      let settings = DEFAULT_SETTINGS;
      try {
        settings = await loadSettings(db);
      } catch {
        // Keep the defaults.
      }
      if (active) setState({ settings, loading: false });
    })();
    return () => {
      active = false;
    };
  }, [db]);

  return state;
}
