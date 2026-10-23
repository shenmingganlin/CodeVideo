import {
  area,
  curveMonotoneX,
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  line,
  scaleLinear,
} from "d3";
import { useMemo } from "react";
import {
  AbsoluteFill,
  Composition,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { precomputeForce } from "../shared/d3";
import { SANS_FAMILY } from "../shared/fonts";
import { ease } from "../shared/motion/motion";

// 环境自检：D3 只算坐标，画面自己用 SVG 画。左边 d3-scale + d3-shape 的折线图一笔画出来，
// 右边 d3-force 的关系图从挤成一团慢慢散开（位置是预先算好的，按帧号取）。150 帧 = 5 秒
const FRAMES = 150;
const INK = "#1f2933";
const ACCENT = "#0b7285";

export const D3Check: React.FC = () => {
  return (
    <Composition
      id="D3Check"
      component={D3CheckScene}
      durationInFrames={FRAMES}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

// 固定的示例数据，不用随机数
const DATA = Array.from({ length: 24 }, (_, i) => ({
  x: i,
  y: 40 + 25 * Math.sin(i / 3) + i * 1.8,
}));

const CHART = { left: 140, top: 200, width: 760, height: 600 };
const x = scaleLinear()
  .domain([0, DATA.length - 1])
  .range([CHART.left, CHART.left + CHART.width]);
const y = scaleLinear()
  .domain([0, 120])
  .range([CHART.top + CHART.height, CHART.top]);
const linePath = line<(typeof DATA)[number]>()
  .x((d) => x(d.x))
  .y((d) => y(d.y))
  .curve(curveMonotoneX)(DATA)!;
const areaPath = area<(typeof DATA)[number]>()
  .x((d) => x(d.x))
  .y0(y(0))
  .y1((d) => y(d.y))
  .curve(curveMonotoneX)(DATA)!;

// 关系图：一个中心、5 个分支、每个分支 3 个叶子
type GraphNode = { id: number; group: number; x?: number; y?: number };
const NODES: GraphNode[] = Array.from({ length: 21 }, (_, id) => ({
  id,
  group: id === 0 ? 0 : id <= 5 ? 1 : 2,
}));
const EDGES: [number, number][] = [
  ...[1, 2, 3, 4, 5].map((b): [number, number] => [0, b]),
  ...Array.from({ length: 15 }, (_, i): [number, number] => [
    1 + Math.floor(i / 3),
    6 + i,
  ]),
];
const GRAPH_CENTER = { x: 1420, y: 520 };

const D3CheckScene: React.FC = () => {
  const frame = useCurrentFrame();
  // 每个标签页各算一次，算出来的结果一样
  const layout = useMemo(
    () =>
      precomputeForce(
        // 一开始挤在中心附近
        NODES.map((n) => ({
          ...n,
          x: GRAPH_CENTER.x + (n.id % 5) * 3,
          y: GRAPH_CENTER.y + (n.id % 7) * 3,
        })),
        (sim) => {
          sim
            .force(
              "link",
              forceLink<GraphNode, { source: number; target: number }>(
                EDGES.map(([source, target]) => ({ source, target })),
              )
                .id((d) => d.id)
                .distance(90),
            )
            .force("charge", forceManyBody().strength(-260))
            .force("collide", forceCollide(30))
            .force("center", forceCenter(GRAPH_CENTER.x, GRAPH_CENTER.y));
        },
        FRAMES,
        2,
      ),
    [],
  );
  const pos = layout[frame];
  const reveal = interpolate(frame, [10, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.inOut,
  });
  const last = DATA[DATA.length - 1];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f8f9fa",
        fontFamily: SANS_FAMILY,
        color: INK,
      }}
    >
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        {y.ticks(6).map((t) => (
          <g key={t}>
            <line
              x1={CHART.left}
              x2={CHART.left + CHART.width}
              y1={y(t)}
              y2={y(t)}
              stroke="#dee2e6"
              strokeWidth={2}
            />
            <text
              x={CHART.left - 20}
              y={y(t) + 10}
              textAnchor="end"
              fontSize={28}
              fill="#868e96"
            >
              {t}
            </text>
          </g>
        ))}
        <path d={areaPath} fill={ACCENT} opacity={0.15 * reveal} />
        <path
          d={linePath}
          fill="none"
          stroke={ACCENT}
          strokeWidth={6}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - reveal}
        />
        <circle
          cx={x(last.x)}
          cy={y(last.y)}
          r={12 * (reveal >= 1 ? 1 : 0)}
          fill={ACCENT}
        />
        {EDGES.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={pos[a].x}
            y1={pos[a].y}
            x2={pos[b].x}
            y2={pos[b].y}
            stroke="#adb5bd"
            strokeWidth={3}
          />
        ))}
        {NODES.map((n) => (
          <circle
            key={n.id}
            cx={pos[n.id].x}
            cy={pos[n.id].y}
            r={[28, 18, 11][n.group]}
            fill={["#e8590c", ACCENT, "#495057"][n.group]}
            stroke="#f8f9fa"
            strokeWidth={4}
          />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          top: 90,
          width: "100%",
          textAlign: "center",
          fontSize: 48,
        }}
      >
        D3 只算坐标 · d3-shape 折线图 · d3-force 预先算好每一帧
      </div>
    </AbsoluteFill>
  );
};
