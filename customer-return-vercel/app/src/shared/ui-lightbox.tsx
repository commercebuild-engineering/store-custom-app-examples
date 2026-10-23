import React, { useEffect } from "react";
import ReactDOM from "react-dom";

/**
 * Full-screen preview of a photo. Return photos are base64 data URLs, and
 * browsers refuse top-level navigation to `data:` URLs (a link opening one in
 * a new tab shows a blank page) — so previews must happen in-page.
 */
export function Lightbox({
  src,
  alt,
  caption,
  onClose,
}: {
  src: string;
  alt: string;
  caption?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[1000] items-center justify-center bg-black/80 p-6 [display:flex]"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 size-9 rounded-full bg-white/10 text-xl leading-none text-white hover:bg-white/20"
      >
        ×
      </button>
      <figure
        className="max-h-full max-w-full text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-[90vw] rounded-md object-contain shadow-2xl"
        />
        {caption && (
          <figcaption className="mt-3 text-sm text-white/80">
            {caption}
          </figcaption>
        )}
      </figure>
    </div>,
    document.body,
  );
}
