// Privacy-friendly Plausible wrapper.
//
// The Plausible script is injected by the env-gated `<!--PLAUSIBLE-->`
// transform in vite.config.ts. When `VITE_PLAUSIBLE_DOMAIN` is unset
// no script is loaded and `window.plausible` stays undefined; track()
// becomes a no-op and the env gate also short-circuits the call.

type PlausibleProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: PlausibleProps }) => void;
  }
}

const enabled = Boolean(import.meta.env.VITE_PLAUSIBLE_DOMAIN);

export const track = (event: string, props?: PlausibleProps): void => {
  if (!enabled) return;
  if (typeof window === "undefined") return;
  window.plausible?.(event, props ? { props } : undefined);
};
