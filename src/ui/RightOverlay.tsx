import type { ReactNode } from "react";

// Single code path for every "slides in from the right" overlay (tower,
// HQ, hero/robot, enemy, environmental clear). `.right-overlay` owns size +
// placement and clears the top-right HUD corner cluster, so fixing the
// offset once moves every panel together. The optional className layers a
// variant (accent / re-anchor) such as `tower-panel` or `tree-panel`.
export const RightOverlay = ({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) => <div className={`right-overlay ${className}`.trim()}>{children}</div>;
