import type { TowerKind } from "../sim/types";
import { type BakeSpec, prewarmIcon, useBakedIcon } from "./bakedIcon";

const TOWER_MODEL: Record<TowerKind, { url: string; rotY: number }> = {
  pulse: { url: "/models/tower_pulse.glb", rotY: 0 },
  chain: { url: "/models/turrets/Lighting Turret.glb", rotY: 0 },
  mortar: { url: "/models/turrets/Missile Turret.glb", rotY: Math.PI / 2 },
  cryo: { url: "/models/turrets/Emp Turret.glb", rotY: 0 },
  flame: { url: "/models/turrets/Flamethrower Turret.glb", rotY: 0 },
  hive: { url: "/models/turrets/Hive Turret.glb", rotY: 0 },
};

const TOWER_KINDS: TowerKind[] = ["pulse", "chain", "flame", "hive", "mortar", "cryo"];

const specFor = (kind: TowerKind): BakeSpec => ({
  cacheKey: `tower:${kind}`,
  modelUrl: TOWER_MODEL[kind].url,
  // Tower props are static (not rigged) so a regular .clone() is fine.
  skinned: false,
  rotY: TOWER_MODEL[kind].rotY,
  // 3/4 view, framed slightly above the model's mid-height. Matches the
  // angle the picker has had since we shipped TowerPreview originally,
  // just translated into the bakedIcon's grounded 1×1×1 model space.
  camera: { position: [2.3, 1.0, 0.75], target: [0, 0.5, 0], fov: 26 },
});

/**
 * Kick off the bake for every tower kind. Call once when the HUD mounts
 * so the mobile build menu has all six PNGs cached by the time the user
 * taps the handle — otherwise the first open flashes empty placeholders
 * while the offscreen renderer serializes through them.
 */
export const prewarmTowerIcons = (): void => {
  for (const kind of TOWER_KINDS) prewarmIcon(specFor(kind));
};

export const TowerPreview = ({ kind }: { kind: TowerKind }) => {
  const url = useBakedIcon(specFor(kind));
  return (
    <div className={`tower-swatch kind-${kind}`}>
      {url ? (
        <img className="tower-icon" src={url} alt="" aria-hidden />
      ) : (
        <div className="tower-icon tower-icon-pending" />
      )}
    </div>
  );
};
