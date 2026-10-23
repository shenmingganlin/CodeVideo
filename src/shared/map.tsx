import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useDelayRender } from "remotion";

// MapLibre GL 地图：地球、城市、路线、3D 地形和建筑，用法见 src/checks/MapCheck.tsx。
//
// - 渲染时要联网：样式、瓦片、字形都从图源下载，worker 脚本从 unpkg 下载
// - 确定性：关掉交互和淡入，每帧 jumpTo 到这一帧的相机，等地图 idle 了才截图
// - 要 WebGL：本机缺省的 GL 就能画（实测和 --gl=angle 只差 0.65/255），画不出来或报 WebGL 错时加 --gl=angle。
//   一个渲染标签页一个地图实例，吃内存也吃瓦片请求，出问题先把并发调小（--concurrency=1 最稳）
// - 每帧都动相机时，卫星图和地形的纹理在无界面渲染里可能闪。只是 2D 平移缩放的话，
//   改成把地图在大画布上渲染一次、用 CSS 平移缩放（remotion-best-practices 技能 maps 部分的 fixed map plate）
// - 图源的署名必须留在画面上；发 B 站的画面里有国界、有争议地区时注意审图号，见 CLAUDE.md "地图"

// 打包器解析不了 MapLibre 自带的 worker 路径，改从 unpkg 取同一版本的 worker
maplibregl.setWorkerUrl(
  URL.createObjectURL(
    new Blob(
      [
        `import "https://unpkg.com/maplibre-gl@${maplibregl.getVersion()}/dist/maplibre-gl-worker.mjs";`,
      ],
      { type: "text/javascript" },
    ),
  ),
);

type MapLibreProps = {
  // 样式 JSON 的地址，或者样式对象
  mapStyle: string | maplibregl.StyleSpecification;
  // 样式载入后调一次：加数据源、图层，设地球投影、地形、天空
  setup?: (map: maplibregl.Map) => void;
  // 每帧调一次：移相机（用 jumpTo，不用 flyTo/easeTo，它们靠浏览器时钟动）、改数据和图层属性。
  // 帧号是所在 Sequence 里的帧号
  update: (map: maplibregl.Map, frame: number) => void;
  // 图源要求的署名，比如 "© OpenStreetMap contributors"
  attribution: string;
  attributionStyle?: React.CSSProperties;
};

export const MapLibre: React.FC<MapLibreProps> = ({
  mapStyle,
  setup,
  update,
  attribution,
  attributionStyle,
}) => {
  const frame = useCurrentFrame();
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  // 只在挂载时用一次，之后父组件重渲染不会重建地图；每帧用最新的 update 和帧号
  const init = useRef({ mapStyle, setup });
  const latest = useRef({ update, frame });
  latest.current = { update, frame };
  const [loading] = useState(() =>
    delayRender("载入地图（样式、瓦片、worker 都要联网）", {
      timeoutInMilliseconds: 60000,
    }),
  );

  useEffect(() => {
    if (!container.current) {
      return;
    }
    const instance = new maplibregl.Map({
      container: container.current,
      style: init.current.mapStyle,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    let styleLoaded = false;
    instance.once("style.load", () => (styleLoaded = true));
    instance.on("error", (event) => {
      // 样式本身载不进来就没法渲染；之后个别瓦片失败只提示，等 idle 超时再报错
      if (!styleLoaded) {
        cancelRender(event.error);
      } else {
        console.warn("地图资源载入失败", event.error);
      }
    });
    instance.once("load", () => {
      init.current.setup?.(instance);
      latest.current.update(instance, latest.current.frame);
      instance.once("idle", () => {
        setMap(instance);
        continueRender(loading);
      });
    });
    // 不调用 instance.remove()：会打乱 Remotion 的渲染生命周期（见 remotion-best-practices 技能）
  }, [cancelRender, continueRender, loading]);

  useEffect(() => {
    if (!map) {
      return;
    }
    const handle = delayRender(`地图第 ${frame} 帧`, {
      timeoutInMilliseconds: 60000,
    });
    latest.current.update(map, frame);
    map.once("idle", () => continueRender(handle));
    // 相机没变时也要触发一次 idle
    map.triggerRepaint();
  }, [continueRender, delayRender, frame, map]);

  return (
    <AbsoluteFill>
      <div
        ref={container}
        style={{ position: "absolute", width: "100%", height: "100%" }}
      />
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 8,
          fontSize: 16,
          color: "rgba(0,0,0,0.65)",
          ...attributionStyle,
        }}
      >
        {attribution}
      </div>
    </AbsoluteFill>
  );
};
