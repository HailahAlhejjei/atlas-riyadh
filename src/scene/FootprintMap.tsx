import { useTexture } from "@react-three/drei";
import { Suspense } from "react";
import { LinearMipmapLinearFilter, SRGBColorSpace } from "three";
import type { CityMeta } from "../data/schema";

/** Every building footprint in the city, rasterised to scale (scripts/render_footprints.py). */
function Map({ meta, url }: { meta: CityMeta; url: string }) {
  const tex = useTexture(url, (t) => {
    const tt = Array.isArray(t) ? t[0] : t;
    tt.colorSpace = SRGBColorSpace;
    tt.anisotropy = 8;
    tt.minFilter = LinearMipmapLinearFilter;
  });
  const { w, s, e, n } = meta.extent_m;
  return (
    <mesh position={[(w + e) / 2, 1.6, -(s + n) / 2]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={1}>
      <planeGeometry args={[e - w, n - s]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} color="#C9AE86" />
    </mesh>
  );
}

export function FootprintMap({ meta, base }: { meta: CityMeta; base: string }) {
  return (
    <Suspense fallback={null}>
      <Map meta={meta} url={`${base}/footprints.webp`} />
    </Suspense>
  );
}
