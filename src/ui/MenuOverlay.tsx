import type React from "react";

type Props = {
  title: string;
  subtitle?: string | null;
  onClose: () => void;
  closeLabel?: string;
  closeTitle?: string;
  children: React.ReactNode;
};

export const MenuOverlay = ({
  title,
  subtitle,
  onClose,
  closeLabel = "Close",
  closeTitle,
  children,
}: Props) => (
  <div className="overlay">
    <div className="overlay-card relative min-w-[440px] pt-7 px-8 pb-6 text-left">
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
