import type React from "react";
import { useEffect } from "react";

type Props = {
  title: string;
  subtitle?: string | null;
  onClose: () => void;
  closeLabel?: string;
  closeTitle?: string;
  // Extra classes appended to the card. Use `!w-…` to override the
  // default 560px max-width when a wider modal is needed.
  cardClassName?: string;
  children: React.ReactNode;
};

export const MenuOverlay = ({
  title,
  subtitle,
  onClose,
  closeLabel = "Close",
  closeTitle,
  cardClassName = "",
  children,
}: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Capture-phase + stopImmediatePropagation: the HUD also listens on
      // window for Escape→togglePause, which would fight this handler and
      // re-pause the game on the same key event. Eat the event here so
      // the modal owns Escape while it's open.
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    /* biome-ignore lint/a11y/noStaticElementInteractions: intentional —
       the backdrop is a click target for "click-outside-to-close". The
       card inside is the interactive region with focusable controls. */
    <div
      className="overlay menu-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`overlay-card menu-overlay-card relative min-w-[440px] pt-7 px-8 pb-6 text-left ${cardClassName}`}
      >
        <button
          type="button"
          className="btn-close absolute top-3 right-3"
          onClick={onClose}
          title={closeTitle ?? closeLabel}
          aria-label={closeLabel}
        >
          ✕
        </button>
        <h1 className="text-center mb-1">{title}</h1>
        {subtitle && (
          <div className="text-center text-xs tracking-[0.22em] uppercase text-fg-dim mb-[18px]">
            {subtitle}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
