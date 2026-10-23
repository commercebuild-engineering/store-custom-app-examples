import React, { useState } from "react";

import { compressPhoto, type ReturnPhoto } from "../shared/image";
import {
  StaleStatusError,
  submitInfoResponse,
  type ReturnRequest,
  type ReturnsApi,
} from "../shared/returns-store";
import type { ReturnsSettings } from "../shared/settings";

const inputClass =
  "rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#7C3AED]";

/**
 * Shown under the "We need more information" banner while a request is in
 * Info Requested: the customer adds photos per item and/or a written reply,
 * and sending puts the request back in front of the admin (Under Review).
 */
export function InfoResponsePanel({
  db,
  request,
  settings,
  adminMessage,
  onSubmitted,
}: {
  db: ReturnsApi;
  request: ReturnRequest;
  settings: ReturnsSettings;
  adminMessage: string;
  onSubmitted: () => void;
}) {
  const [photosByLine, setPhotosByLine] = useState<
    Record<number, ReturnPhoto[]>
  >({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totalPhotos = Object.values(photosByLine).reduce(
    (sum, list) => sum + list.length,
    0,
  );
  const canSubmit =
    !submitting && (totalPhotos > 0 || message.trim().length > 0);

  const addPhotos = async (line: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    const existing = photosByLine[line] ?? [];
    const room = settings.maxPhotosPerLine - existing.length;
    if (room <= 0) {
      setError(
        `You can add up to ${settings.maxPhotosPerLine} photos per item in one reply.`,
      );
      return;
    }
    const accepted: ReturnPhoto[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        accepted.push(await compressPhoto(file));
      } catch (e: any) {
        setError(e?.message ?? "That image could not be attached.");
      }
    }
    if (accepted.length > 0) {
      setPhotosByLine({ ...photosByLine, [line]: [...existing, ...accepted] });
    }
  };

  const removePhoto = (line: number, id: string) => {
    setPhotosByLine({
      ...photosByLine,
      [line]: (photosByLine[line] ?? []).filter((photo) => photo.id !== id),
    });
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const itemCodeByLine: Record<number, string> = {};
      for (const item of request.items)
        itemCodeByLine[item.sequence] = item.itemCode;
      await submitInfoResponse(db, request.docId, {
        message,
        photosByLine,
        itemCodeByLine,
      });
      onSubmitted();
    } catch (e: any) {
      setError(
        e instanceof StaleStatusError
          ? "This return has already been updated — refresh to see its current status."
          : (e?.message ?? "Your reply could not be sent."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm">
      <div className="text-amber-900">
        <span className="font-semibold">We need more information: </span>
        {adminMessage}
      </div>

      <div className="mt-4 rounded-lg border border-amber-200/70 bg-white p-4">
        <div className="mb-3 text-sm font-semibold">Reply to this request</div>

        {settings.maxPhotosPerLine > 0 && (
          <ul className="space-y-3">
            {request.items.map((item) => {
              const photos = photosByLine[item.sequence] ?? [];
              return (
                <li
                  key={`${item.sequence}-${item.itemCode}`}
                  className="items-start justify-between gap-4 [display:flex] [flex-wrap:wrap]"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{item.itemDesc}</div>
                    <div className="text-xs opacity-70">
                      {item.displayItemCode || item.itemCode} · qty{" "}
                      {item.returnQty}
                    </div>
                  </div>
                  <div className="items-center gap-2 [display:flex] [flex-wrap:wrap]">
                    {photos.map((photo) => (
                      <span
                        key={photo.id}
                        className="relative [display:inline-block]"
                      >
                        <img
                          src={photo.dataUrl}
                          alt={photo.name}
                          className="size-12 rounded-md border border-zinc-200 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(item.sequence, photo.id)}
                          className="absolute -top-2 -right-2 size-5 rounded-full bg-zinc-900 text-xs text-white"
                          aria-label={`Remove ${photo.name}`}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {photos.length < settings.maxPhotosPerLine && (
                      <label className="cursor-pointer rounded-md border border-dashed border-zinc-300 px-3 py-2 text-xs opacity-70 hover:bg-zinc-50">
                        Add photo
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="w-0 opacity-0 [position:absolute]"
                          onChange={(event) => {
                            void addPhotos(item.sequence, event.target.files);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <label className="mt-4 [display:block]">
          <span className="mb-1 [display:block] text-xs font-semibold opacity-70">
            Message <span className="font-normal opacity-60">(optional)</span>
          </span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            placeholder="Anything else that helps us process the return…"
            className={`${inputClass} w-full`}
          />
        </label>

        {error && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 items-center gap-3 [display:flex] [flex-wrap:wrap]">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            data-btn-variant="primary"
            className="button-scheme-default relative inline-flex h-auto min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-base font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send response"}
          </button>
          <span className="text-xs opacity-70">
            Add at least one photo or a message. Your return goes back under
            review as soon as you send.
          </span>
        </div>
      </div>
    </div>
  );
}
