import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { C } from "../config/theme";
import type { CityData } from "../data/schema";
import { setState, useStore } from "../store";
import { CameraRig } from "./CameraRig";
import { LayerGroup } from "./LayerGroup";
import { BuildingsLayer, DistrictsLayer, FacilitiesLayer, GreenLayer, PopulationLayer, TransportLayer } from "./layers";
import { Measure, SelectionColumn } from "./Overlays";
import { Plinth } from "./Plinth";
import { BuildingTiles } from "./BuildingTiles";
import { Landmarks } from "./Landmarks";
import { Strata } from "./Strata";
import { FootprintMap } from "./FootprintMap";
import { FacilityLabels, StationLabels } from "./FacilityLabels";
import { ShadowRig } from "./ShadowRig";
import { DEFAULT_CITY } from "../config/cities";

export function CityScene({ data, compact }: { data: Partial<CityData>; compact: boolean }) {
  const lens = useStore((s) => s.lens);
  const [lowPerf, setLowPerf] = useState(compact);
  const meta = data.meta!;
  const shadows = !lowPerf;

  return (
    <Canvas
      shadows={shadows}
      dpr={[1, compact ? 1.5 : 2]}
      camera={{ fov: compact ? 42 : 34, near: 40, far: 300000, position: [36000, 17000, 27000] }}
      gl={{ antialias: true, powerPreference: "high-performance", logarithmicDepthBuffer: true }}
      onPointerMissed={() => setState({ selection: null })}
      onPointerLeave={() => setState({ cursor: null, hover: null })}
    >
      <PerformanceMonitor onDecline={() => setLowPerf(true)} />
      <AdaptiveDpr pixelated={false} />
      <color attach="background" args={[C.navy]} />
      <fog attach="fog" args={[C.navy, 110000, 260000]} />
      <hemisphereLight args={["#DCE8F2", "#0B1421", 0.9]} />
      <ShadowRig enabled={shadows} />
      <directionalLight
        name="sun"
        position={[-20000, 32000, 14000]}
        intensity={1.9}
        color="#FFF4E2"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-5000}
        shadow-camera-right={5000}
        shadow-camera-top={5000}
        shadow-camera-bottom={-5000}
        shadow-camera-near={100}
        shadow-camera-far={110000}
      />
      <directionalLight position={[8000, 4000, -6000]} intensity={0.35} color={C.cyan} />

      <CameraRig meta={meta} compact={compact} />
      <Plinth meta={meta} />

      <LayerGroup id="buildings">
        {data.districts && <DistrictsLayer items={data.districts.items} />}
        {data.buildings && <BuildingsLayer items={data.buildings.items} landmarks={data.buildings.landmarks ?? []} lowDetail={lowPerf} />}
        {data.buildings && <FootprintMap meta={meta} base={DEFAULT_CITY.dataPath} />}
        {data.buildings?.tiles && <BuildingTiles base={DEFAULT_CITY.dataPath} tiles={data.buildings.tiles} compact={compact} />}
        {data.buildings && <Landmarks items={data.buildings.items} meta={meta} />}
      </LayerGroup>
      <LayerGroup id="green">{data.green && <GreenLayer items={data.green.items} points={data.green.points ?? []} walkways={data.green.walkways ?? []} />}</LayerGroup>
      <LayerGroup id="transport">
        {data.transport && <TransportLayer roads={data.transport.roads} metro={data.transport.metro} stations={data.transport.stations} bus={data.transport.bus ?? []} />}
      </LayerGroup>
      <LayerGroup id="facilities">{data.facilities && <FacilitiesLayer items={data.facilities.items} />}</LayerGroup>
      <LayerGroup id="population">{data.population && <PopulationLayer cells={data.population.cells} lens={lens} />}</LayerGroup>

      {data.districts && <SelectionColumn districts={data.districts.items} />}
      <Measure meta={meta} />
      <Strata meta={meta} />
      {data.facilities && <FacilityLabels items={data.facilities.items} />}
      {data.transport && <StationLabels stations={data.transport.stations} />}
    </Canvas>
  );
}
