import * as THREE from "three";

// Adds a runtime "snow on top" shader pass to a cloned material.
// Works on any MeshStandardMaterial-family material without knowing the
// original texture. We carry the object-space normal Y into the fragment
// shader as a varying (our instanced props only rotate around Y, so object
// Y maps cleanly to world Y) and mix fragments toward near-white wherever
// the surface faces upward.
export const applySnowPass = (
  material: THREE.Material,
  {
    mix = 0.85,
    low = 0.45,
    high = 0.9,
    color = [0.96, 0.97, 0.99] as [number, number, number],
  } = {},
): THREE.Material => {
  const clone = material.clone();
  // Preserve transparency/opacity flags so alpha-tested foliage still clips
  // correctly — we only overlay on opaque fragments.
  (clone as THREE.MeshStandardMaterial).onBeforeCompile = shader => {
    shader.uniforms.uSnowMix    = { value: mix };
    shader.uniforms.uSnowLow    = { value: low };
    shader.uniforms.uSnowHigh   = { value: high };
    shader.uniforms.uSnowColor  = { value: new THREE.Vector3(...color) };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         varying float vSnowObjY;`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
         vSnowObjY = normal.y;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uSnowMix;
         uniform float uSnowLow;
         uniform float uSnowHigh;
         uniform vec3  uSnowColor;
         varying float vSnowObjY;`,
      )
      // Runs after color-space conversion so the tint reads correctly in the
      // final displayed color.
      .replace(
        "#include <dithering_fragment>",
        `float snowMask = smoothstep(uSnowLow, uSnowHigh, vSnowObjY) * uSnowMix;
         gl_FragColor.rgb = mix(gl_FragColor.rgb, uSnowColor, snowMask);
         #include <dithering_fragment>`,
      );
    // Ensure the shader program is cached separately from the plain one.
    (clone as THREE.MeshStandardMaterial).customProgramCacheKey = () => "snow-pass-v1";
  };
  clone.needsUpdate = true;
  return clone;
};
