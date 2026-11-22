/**
 * Glowing point sprites (additive "neon" dots) with world-size attenuation.
 * Used for the population dot-density layer and for transit stops.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial } from "three";

const vert = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 color;
  attribute float seed;
  uniform float uSize;
  uniform float uScale;
  uniform float uTime;
  uniform float uTwinkle;
  uniform float uMinPx;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float tw = 1.0 + uTwinkle * 0.35 * sin(uTime * 1.6 + seed * 6.2831);
    gl_PointSize = clamp(uSize * uScale / -mv.z, uMinPx, 40.0) * tw;
    vFade = clamp(uSize * uScale / -mv.z / 2.5, 0.9, 1.0); // far dots dimmer so the city doesn't white out
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }`;

const frag = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uOpacity;
  uniform float uGain;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    #include <logdepthbuf_fragment>
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.24, 0.0, d);
    float halo = pow(smoothstep(0.5, 0.0, d), 1.6) * 0.75;
    float a = clamp((core + halo) * uOpacity * vFade * uGain, 0.0, 1.0);
    gl_FragColor = vec4(vColor * (0.8 + core * 1.1) * uGain, a);
  }`;

export interface GlowDotsProps {
  positions: Float32Array; // xyz in scene coords
  colors: Float32Array; // rgb 0..1
  size: number; // world metres
  twinkle?: number;
  opacity?: number;
  /** smallest on-screen size in px, so the overview never fades out */
  minPx?: number;
  /** brightness multiplier */
  gain?: number;
}

export function GlowDots({ positions, colors, size, twinkle = 0, opacity = 1, minPx = 3.2, gain = 1 }: GlowDotsProps) {
  const { size: vp, camera } = useThree();
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));
    g.setAttribute("color", new BufferAttribute(colors, 3));
    const seed = new Float32Array(positions.length / 3);
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
    g.setAttribute("seed", new BufferAttribute(seed, 1));
    g.computeBoundingSphere();
    return g;
  }, [positions, colors]);
  useEffect(() => () => geo.dispose(), [geo]);

  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uSize: { value: size }, uScale: { value: 400 }, uTime: { value: 0 }, uTwinkle: { value: twinkle }, uOpacity: { value: opacity }, uMinPx: { value: minPx }, uGain: { value: gain } },
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  mat.userData.alwaysTransparent = true;
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame(({ clock }) => {
    const fov = ((camera as { fov?: number }).fov ?? 35) * (Math.PI / 180);
    mat.uniforms.uScale.value = vp.height / (2 * Math.tan(fov / 2));
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uSize.value = size;
    // LayerGroup drives material.opacity; mirror it into the shader
    mat.uniforms.uOpacity.value = opacity * (mat.opacity ?? 1);
  });

  return <points geometry={geo} material={mat} raycast={() => null} frustumCulled={false} />;
}
