import { useFrame } from "@react-three/fiber";
import { nanoid } from "nanoid";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Bridge } from "../lavaGeometry";
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
  // 0 = center, 1 = edge (cross-river for segments, radial for joints)
  float edge = uIsJoint > 0.5
    ? clamp(length(vUv - 0.5) * 2.0, 0.0, 1.0)
    : abs(vUv.y - 0.5) * 2.0;

  // Scrolling world-space ripple
  vec2 sp = vWorldPos.xz * 1.4 + vec2(uTime * 0.32, uTime * 0.14);
  float r = ripple(sp);
  // Second layer at a different scale/speed so motion reads clearly
  float r2 = ripple(vWorldPos.xz * 2.6 + vec2(-uTime * 0.22, uTime * 0.30));
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

  // Edge foam — only on segment banks (joint rims would look like rings)
  float foam = (uIsJoint > 0.5) ? 0.0 : smoothstep(0.72, 0.94, edge);
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
        <RiverSegments
          key={river.id}
          points={river.points}
          width={river.width}
          segMat={segMat}
          jointMat={jointMat}
        />
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

const RiverSegments = ({
  points,
  width,
  segMat,
  jointMat,
}: {
  points: Vec2[];
  width: number;
  segMat: THREE.ShaderMaterial;
  jointMat: THREE.ShaderMaterial;
}) => {
  const segs = useMemo(() => {
    const out: { id: string; pos: [number, number, number]; rotY: number; length: number }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      out.push({
        id: nanoid(),
        pos: [(a.x + b.x) / 2, 0.012, -(a.y + b.y) / 2],
        rotY: Math.atan2(-dy, dx),
        length: Math.hypot(dx, dy),
      });
    }
    return out;
  }, [points]);

  const joints = useMemo(
    () =>
      points.map((p) => ({ id: nanoid(), pos: [p.x, 0.013, -p.y] as [number, number, number] })),
    [points],
  );

  return (
    <group>
      {segs.map((s) => (
        <mesh key={s.id} position={s.pos} rotation={[-Math.PI / 2, 0, -s.rotY]} material={segMat}>
          <planeGeometry args={[s.length, width]} />
        </mesh>
      ))}
      {joints.map((j) => (
        <mesh key={j.id} position={j.pos} rotation={[-Math.PI / 2, 0, 0]} material={jointMat}>
          <circleGeometry args={[width / 2, 16]} />
        </mesh>
      ))}
    </group>
  );
};
