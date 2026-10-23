import React, { useEffect, useState } from "react";

import {
  MAX_PHOTOS_PER_LINE,
  RETURN_REASONS,
  RETURN_WINDOW_DAYS,
} from "../../shared/constants";
import { useReturnsDb } from "../../shared/returns-store";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type ReturnsSettings,
} from "../../shared/settings";
import {
  Card,
  DataNotConfigured,
  Field,
  Notice,
  PageHeader,
  Skeleton,
} from "../components/kit";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, cx } from "../lib/tokens";

export const metadata = { title: "Return settings" };

/** Form state is all strings; parsed + validated on save. */
interface FormState {
  returnWindowDays: string;
  maxPhotosPerLine: string;
  returnReasons: string;
}

function toForm(settings: ReturnsSettings): FormState {
  return {
    returnWindowDays: String(settings.returnWindowDays),
    maxPhotosPerLine: String(settings.maxPhotosPerLine),
    returnReasons: settings.returnReasons.join("\n"),
  };
}

function parseForm(
  form: FormState,
): { value: ReturnsSettings } | { error: string } {
  const windowDays = Number(form.returnWindowDays.trim());
  if (!Number.isInteger(windowDays) || windowDays < -1) {
    return {
      error:
        "Return window must be a whole number of days, or -1 for no limit.",
    };
  }
  const photos = Number(form.maxPhotosPerLine.trim());
  if (!Number.isInteger(photos) || photos < 0) {
    return {
      error: "Photos per item must be a whole number (0 disables photos).",
    };
  }
  const reasons = form.returnReasons
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (reasons.length === 0) {
    return { error: "Add at least one return reason." };
  }
  if (new Set(reasons).size !== reasons.length) {
    return { error: "Return reasons must be unique." };
  }
  return {
    value: {
      returnWindowDays: windowDays,
      maxPhotosPerLine: photos,
      returnReasons: reasons,
    },
  };
}

export default function SettingsPage() {
  const db = useReturnsDb();
  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!db) return;
    (async () => {
      try {
        const settings = await loadSettings(db);
        if (active) setForm(toForm(settings));
      } catch (e: any) {
        if (active) {
          setLoadError(e?.message ?? "Could not load the return settings.");
          setForm(toForm(DEFAULT_SETTINGS));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [db]);

  const update = (patch: Partial<FormState>) => {
    setSaved(false);
    setError("");
    setForm((current) => (current ? { ...current, ...patch } : current));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!db || !form) return;
    const parsed = parseForm(form);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveSettings(db, parsed.value);
      setForm(toForm(parsed.value));
      setSaved(true);
    } catch (e: any) {
      setError(e?.message ?? "The settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const reasonOptions = (form?.returnReasons ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Return settings"
        subtitle="Rules the storefront applies when a customer starts a return. Leave a field at its default to keep the built-in behaviour."
      />

      {!db && <DataNotConfigured />}

      {db && !form && (
        <Card>
          <Skeleton className="mb-3 h-4 w-1/3" />
          <Skeleton className="mb-3 h-9 w-full" />
          <Skeleton className="mb-3 h-4 w-1/4" />
          <Skeleton className="h-9 w-full" />
        </Card>
      )}

      {db && form && (
        <form onSubmit={submit} className="space-y-4">
          {loadError && (
            <Notice tone="warning">
              {loadError} Showing the defaults — saving will overwrite whatever
              is stored.
            </Notice>
          )}

          <Card title="Eligibility">
            <Field
              label="Return window (days)"
              hint={
                <>
                  Days after the order date a return can still be started. Enter{" "}
                  <code>-1</code> to allow returns on every order. Default{" "}
                  {RETURN_WINDOW_DAYS}.
                </>
              }
            >
              <input
                type="number"
                min={-1}
                step={1}
                value={form.returnWindowDays}
                onChange={(event) =>
                  update({ returnWindowDays: event.target.value })
                }
                className={cx(INPUT, "max-w-[160px]")}
              />
            </Field>
          </Card>

          <Card title="Line items">
            <div className="space-y-4">
              <Field
                label="Return reasons"
                hint="One per line, in the order they appear in the dropdown."
              >
                <textarea
                  value={form.returnReasons}
                  onChange={(event) =>
                    update({ returnReasons: event.target.value })
                  }
                  rows={Math.max(6, reasonOptions.length + 1)}
                  className={INPUT}
                  placeholder={RETURN_REASONS.join("\n")}
                />
              </Field>
              <Field
                label="Photos per item"
                hint={`Maximum photos a customer may attach to one line. 0 hides the photo control. Default ${MAX_PHOTOS_PER_LINE}.`}
              >
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.maxPhotosPerLine}
                  onChange={(event) =>
                    update({ maxPhotosPerLine: event.target.value })
                  }
                  className={cx(INPUT, "max-w-[160px]")}
                />
              </Field>
            </div>
          </Card>

          {error && <Notice tone="error">{error}</Notice>}
          {saved && !error && (
            <Notice tone="success">
              Saved. The storefront picks the new values up on its next page
              load.
            </Notice>
          )}

          <div className="items-center gap-2 [display:flex]">
            <button type="submit" disabled={saving} className={BUTTON_PRIMARY}>
              {saving ? "Saving…" : "Save settings"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => update(toForm(DEFAULT_SETTINGS))}
              className={BUTTON_SECONDARY}
            >
              Reset to defaults
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
