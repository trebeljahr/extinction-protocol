import { useEffect, useState } from "react";

// SSR-safe matchMedia subscription. Returns false on the server, then
// hydrates to the real value once mounted; React Three Fiber only runs
// in the browser anyway, but the guard keeps the hook usable elsewhere
// without a hard window dependency.
export const useMediaQuery = (query: string): boolean => {
  const get = () => (typeof window === "undefined" ? false : window.matchMedia(query).matches);
  const [matches, setMatches] = useState<boolean>(get);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    // addEventListener is the modern API; older Safari needs addListener.
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
};

// Phone-sized viewport. Three arms match the CSS breakpoints in index.css:
//   - narrow widths (portrait phones, narrow desktop windows)
//   - coarse pointer up to 1024px (iPad portrait + most tablets)
//   - short viewport (≤500px tall) up to 1024px wide — covers landscape
//     phones whose browser reports `pointer: fine` (Chrome devtools
//     emulation, some embedded webviews). Without this the TS hook and
//     the CSS media-query disagree on landscape phones, so the JSX
//     renders the 3-up slot grid while the CSS hides it.
// Tablets in landscape with fine pointer fall through to the desktop
// layout, which already works.
export const useIsMobile = (): boolean => {
  const narrow = useMediaQuery("(max-width: 720px)");
  const coarse = useMediaQuery("(pointer: coarse) and (max-width: 1024px)");
  const shortLandscape = useMediaQuery("(max-height: 500px) and (max-width: 1024px)");
  return narrow || coarse || shortLandscape;
};

export const useIsPortrait = (): boolean => useMediaQuery("(orientation: portrait)");
