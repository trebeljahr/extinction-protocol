import * as THREE from "three";

// Mint-green 3D "+" floating above any enemy with the regen chip.
// Built as ExtrudeGeometry rather than a billboarded plane so the
// cross reads from any orbit angle in the compendium (the old plane
// flattened to invisible from straight above).
//
// Shared between the in-game badge (RegenBadges) and the compendium
// preview so one set of tweaks updates both surfaces.
export const REGEN_PLUS_LENGTH = 0.84;

export const buildPlusGeometry = (): THREE.BufferGeometry => {
  const shape = new THREE.Shape();
  const arm = REGEN_PLUS_LENGTH / 2;
  const half = 0.14;
  shape.moveTo(-half, -arm);
  shape.lineTo(half, -arm);
  shape.lineTo(half, -half);
  shape.lineTo(arm, -half);
  shape.lineTo(arm, half);
  shape.lineTo(half, half);
  shape.lineTo(half, arm);
  shape.lineTo(-half, arm);
  shape.lineTo(-half, half);
  shape.lineTo(-arm, half);
  shape.lineTo(-arm, -half);
  shape.lineTo(-half, -half);
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelSize: 0.04,
    bevelThickness: 0.04,
    bevelSegments: 2,
    curveSegments: 1,
  });
  geom.center();
  return geom;
};

export const buildPlusMaterial = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color("#2a9a3a"),
    emissive: new THREE.Color("#6dff8e"),
    emissiveIntensity: 1.4,
    metalness: 0.3,
    roughness: 0.35,
    toneMapped: false,
  });
