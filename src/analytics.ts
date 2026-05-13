// Privacy-friendly Plausible wrapper.
//
// The Plausible script is injected by the `<!--PLAUSIBLE-->` transform
// in vite.config.ts, but only attaches on the configured production host.
// track() mirrors that host check so local previews and native shells stay
// silent.

type PlausibleProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: PlausibleProps }) => void;
  }
}

const plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN ?? "protocol.trebeljahr.com";

export const track = (event: string, props?: PlausibleProps): void => {
  if (typeof window === "undefined") return;
  if (window.location.hostname !== plausibleDomain) return;
  window.plausible?.(event, props ? { props } : undefined);
};
