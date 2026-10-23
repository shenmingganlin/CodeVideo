import * as turf from "@turf/turf";
import type { GeoJSONSource, Map } from "maplibre-gl";
import { AbsoluteFill, Composition, interpolate } from "remotion";
import { MapLibre } from "../shared/map";
import { ease } from "../shared/motion/motion";

// 环境自检：MapLibre 地图飞行。地球视角画出苏黎世到纽约的大圆航线，再一路推进到曼哈顿，
// 倾斜看 3D 建筑。图源是 OpenFreeMap（免 key，OSM 数据），渲染时要联网。120 帧 = 4 秒。
// 渲染：npm run video -- MapCheck，或 npx remotion render MapCheck --gl=angle --concurrency=1
const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const ATTRIBUTION = "OpenFreeMap © OpenMapTiles Data from OpenStreetMap";

const ZURICH: [number, number] = [8.5417, 47.3769];
const NEW_YORK: [number, number] = [-74.006, 40.7128];
const ARC = turf.greatCircle(ZURICH, NEW_YORK, { npoints: 120 });
// 跨 180° 经线的大圆会拆成 MultiLineString，这条航线不跨
if (ARC.geometry.type !== "LineString") {
  throw new Error("航线跨了 180° 经线，要分段画");
}
const ROUTE = turf.lineString(ARC.geometry.coordinates);
const ROUTE_KM = turf.length(ROUTE);
const MARKERS = turf.featureCollection([
  turf.point(ZURICH),
  turf.point(NEW_YORK),
]);

export const MapCheck: React.FC = () => {
  return (
    <Composition
      id="MapCheck"
      component={MapCheckScene}
      durationInFrames={120}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const setup = (map: Map) => {
  // liberty 样式引用了几个精灵图里没有的图标，每个都会刷一条警告，补成透明的 1×1
  map.setMissingStyleImageResolver((id) => {
    map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
  map.setProjection({ type: "globe" });
  map.addSource("route", {
    type: "geojson",
    data: turf.lineSliceAlong(ROUTE, 0, 0.001),
  });
  map.addLayer({
    id: "route",
    type: "line",
    source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#e8590c", "line-width": 6 },
  });
  map.addSource("markers", { type: "geojson", data: MARKERS });
  map.addLayer({
    id: "markers",
    type: "circle",
    source: "markers",
    paint: {
      "circle-color": "#e8590c",
      "circle-radius": 10,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  });
};

const update = (map: Map, frame: number) => {
  // 0–60 帧画航线，40–120 帧推进到纽约
  const drawn = interpolate(frame, [0, 60], [0, 1], {
    ...clamp,
    easing: ease.inOut,
  });
  (map.getSource("route") as GeoJSONSource).setData(
    turf.lineSliceAlong(ROUTE, 0, Math.max(0.001, ROUTE_KM * drawn)),
  );
  const push = interpolate(frame, [40, 119], [0, 1], {
    ...clamp,
    easing: ease.inOut,
  });
  // 中心比缩放先到，镜头不会在放大以后才猛地横移
  const settle = interpolate(push, [0, 0.6], [0, 1], {
    ...clamp,
    easing: ease.out,
  });
  map.jumpTo({
    center: [
      interpolate(settle, [0, 1], [-30, NEW_YORK[0]]),
      interpolate(settle, [0, 1], [50, NEW_YORK[1]]),
    ],
    zoom: interpolate(push, [0, 1], [1.6, 15]),
    pitch: interpolate(push, [0.5, 1], [0, 60], clamp),
    bearing: interpolate(push, [0.5, 1], [0, -30], clamp),
  });
};

const MapCheckScene: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b1a2a" }}>
      <MapLibre
        mapStyle={STYLE}
        setup={setup}
        update={update}
        attribution={ATTRIBUTION}
      />
    </AbsoluteFill>
  );
};
