import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Bridge } from "../flowGeometry";
import type { Vec2 } from "../sim/types";

const VERT = /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vViewDir;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vViewDir = normalize(cameraPosition - wp.xyz);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
#include <fog_pars_fragment>

uniform float uTime;
uniform float uIsJoint;
uniform vec4 uBridges[8];
uniform int uBridgeCount;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vViewDir;

const vec3 DEEP    = vec3(0.15, 0.36, 0.70);
const vec3 SHALLOW = vec3(0.33, 0.63, 0.84);
const vec3 FOAM    = vec3(0.76, 0.91, 0.96);

float ripple(vec2 p) {
  return sin(p.x * 5.0 + p.y * 2.0)  * 0.35
       + sin(p.x * 11.0 - p.y * 3.5) * 0.20
       + sin(p.y * 7.0 + p.x * 1.5)  * 0.15;
}

void main() {
  // 0 = center, 1 = edge (cross-river for rivers, radial for lakes)
  float edge = uIsJoint > 0.5
    ? clamp(length(vUv - 0.5) * 2.0, 0.0, 1.0)
    : abs(vUv.y - 0.5) * 2.0;

  // Rivers flow along vUv.x (cumulative length downstream); lakes have no
  // flow direction and drift in world space. Two layers at different scales
  // and speeds give the surface motion some parallax.
  vec2 sp, sp2;
  if (uIsJoint > 0.5) {
    sp  = vWorldPos.xz * 1.4 + vec2(uTime * 0.32, uTime * 0.14);
    sp2 = vWorldPos.xz * 2.6 + vec2(-uTime * 0.22, uTime * 0.30);
  } else {
    sp  = vec2(vUv.x * 1.6 - uTime * 1.0, vUv.y * 3.0);
    sp2 = vec2(vUv.x * 3.0 - uTime * 1.6, vUv.y * 5.0);
  }
  float r = ripple(sp);
  float r2 = ripple(sp2);
  r = r * 0.65 + r2 * 0.45;

  // Bridge wake disruption
  float wake = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uBridgeCount) break;
    float d = length(vWorldPos.xz - uBridges[i].xy);
    wake += 1.0 - smoothstep(0.0, uBridges[i].z, d);
  }
  wake = clamp(wake, 0.0, 1.0);

  float turb = sin(vWorldPos.x * 18.0 + uTime * 2.5)
             * sin(vWorldPos.z * 18.0 + uTime * 1.8);
  r += turb * wake * 0.5;

  // Deep center -> shallow edge gradient
  vec3 col = mix(DEEP, SHALLOW, edge * edge);
  col += r * 0.09;

  // Edge foam — river banks (uIsJoint=0) and lake rims (uIsJoint=1).
  float foam = smoothstep(0.72, 0.94, edge);
  float foamBreak = sin(vWorldPos.x * 12.0 + uTime * 0.7)
                  * sin(vWorldPos.z * 12.0 + uTime * 0.5);
  foam *= max(0.0, 0.5 + 0.5 * foamBreak);
  col = mix(col, FOAM, foam * 0.55);

  // Wake foam
  col = mix(col, FOAM, wake * (0.25 + 0.25 * abs(turb)) * 0.4);

  // Fresnel — wetness sheen
  float fresnel = pow(1.0 - max(dot(vec3(0.0, 1.0, 0.0), normalize(vViewDir)), 0.0), 3.5);
  col += fresnel * 0.10;

  // Moving specular highlight (aligned with scene directional light)
  vec3 L = normalize(vec3(0.45, 0.84, 0.32));
  vec3 N = normalize(vec3(r * 0.12, 1.0, r * 0.08));
  vec3 H = normalize(L + normalize(vViewDir));
  col += pow(max(dot(N, H), 0.0), 64.0) * 0.22;

  // Subtle emissive so water reads as wet under shadow
  col += vec3(0.06, 0.17, 0.27) * 0.18;

  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}
`;

const buildBridgeUniforms = (bridges: Bridge[]) => {
  const count = Math.min(bridges.length, 8);
  const arr: THREE.Vector4[] = [];
  for (let i = 0; i < count; i++) {
    const b = bridges[i];
    const r = b.kind === "plaza" ? b.radius * 1.2 : b.length * 0.45;
    arr.push(new THREE.Vector4(b.pos.x, -b.pos.y, r, 1));
  }
  while (arr.length < 8) arr.push(new THREE.Vector4());
  return { arr, count };
};

const makeWaterMat = (isJoint: boolean, bridges: Bridge[]): THREE.ShaderMaterial => {
  const bd = buildBridgeUniforms(bridges);
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsLib.fog,
      uTime: { value: 0 },
      uIsJoint: { value: isJoint ? 1.0 : 0.0 },
      uBridges: { value: bd.arr },
      uBridgeCount: { value: bd.count },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    fog: true,
    toneMapped: false,
  });
};

export const ForestWaterGroup = ({
  rivers,
  lakes,
  bridges,
}: {
  rivers: { id: string; points: Vec2[]; width: number }[];
  lakes: { id: string; x: number; y: number; rx: number; ry: number; rot: number }[];
  bridges: Bridge[];
}) => {
  const { segMat, jointMat } = useMemo(
    () => ({ segMat: makeWaterMat(false, bridges), jointMat: makeWaterMat(true, bridges) }),
    [bridges],
  );

  useEffect(
    () => () => {
      segMat.dispose();
      jointMat.dispose();
    },
    [segMat, jointMat],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    segMat.uniforms.uTime.value = t;
    jointMat.uniforms.uTime.value = t;
  });

  return (
    <group>
      {rivers.map((river) => (
        <RiverSegments key={river.id} points={river.points} width={river.width} segMat={segMat} />
      ))}
      {lakes.map((l) => (
        <mesh
          key={l.id}
          position={[l.x, 0.014, -l.y]}
          rotation={[-Math.PI / 2, 0, l.rot]}
          scale={[l.rx, l.ry, 1]}
          material={jointMat}
        >
          <circleGeometry args={[1, 28]} />
        </mesh>
      ))}
    </group>
  );
};

// Build a single continuous ribbon mesh that follows the river path with
// miter joints at every interior point. Replaces the previous segments +
// circle-joint composition, which left circular halos at every path point
// and triangular gaps on the outside of sharp bends where the circle-disc
// rim didn't reach the segment endcap corners.
const RiverSegments = ({
  points,
  width,
  segMat,
}: {
  points: Vec2[];
  width: number;
  segMat: THREE.ShaderMaterial;
}) => {
  const geometry = useMemo(() => {
    const n = points.length;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const halfW = width / 2;
    let cum = 0;

    for (let i = 0; i < n; i++) {
      const p = points[i];

      // Miter direction at this vertex — perpendicular to flow, scaled so the
      // resulting bank line ties smoothly into the adjacent segments.
      let nx: number;
      let ny: number;
      let scale = 1;

      if (i === 0) {
        const b = points[1];
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const l = Math.hypot(dx, dy) || 1;
        nx = -dy / l;
        ny = dx / l;
      } else if (i === n - 1) {
        const a = points[i - 1];
        const dx = p.x - a.x;
        const dy = p.y - a.y;
        const l = Math.hypot(dx, dy) || 1;
        nx = -dy / l;
        ny = dx / l;
      } else {
        const a = points[i - 1];
        const b = points[i + 1];
        const d1x = p.x - a.x;
        const d1y = p.y - a.y;
        const l1 = Math.hypot(d1x, d1y) || 1;
        const p1x = -d1y / l1;
        const p1y = d1x / l1;
        const d2x = b.x - p.x;
        const d2y = b.y - p.y;
        const l2 = Math.hypot(d2x, d2y) || 1;
        const p2x = -d2y / l2;
        const p2y = d2x / l2;
        let bx = p1x + p2x;
        let by = p1y + p2y;
        const bl = Math.hypot(bx, by);
        if (bl < 1e-4) {
          // Near-180° turn — bisector degenerates; fall back to one perp.
          nx = p1x;
          ny = p1y;
        } else {
          bx /= bl;
          by /= bl;
          // Miter scale = 1 / cos(half-bend); clamped so an acute bend
          // doesn't shoot the bank vertex out into the trees.
          const cosHalf = bx * p1x + by * p1y;
          scale = Math.min(2.5, 1 / Math.max(0.2, cosHalf));
          nx = bx;
          ny = by;
        }
      }

      const ox = nx * halfW * scale;
      const oy = ny * halfW * scale;

      if (i > 0) {
        const prev = points[i - 1];
        cum += Math.hypot(p.x - prev.x, p.y - prev.y);
      }

      const v0 = positions.length / 3;
      positions.push(p.x + ox, 0.012, -(p.y + oy));
      positions.push(p.x - ox, 0.012, -(p.y - oy));
      uvs.push(cum, 0);
      uvs.push(cum, 1);

      if (i > 0) {
        // Winding chosen so the mesh's normal is +Y (camera looks straight down,
        // so the +Y face is the front and we don't get back-face-culled).
        const vp = v0 - 2;
        indices.push(vp, v0 + 1, v0);
        indices.push(vp, vp + 1, v0 + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [points, width]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh material={segMat}>
      <primitive object={geometry} attach="geometry" />
    </mesh>
  );
};
