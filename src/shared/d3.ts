import { forceSimulation, type SimulationNodeDatum } from "d3";

// D3 在 Remotion 里只当计算库用：d3-scale、d3-shape、d3-geo、d3-hierarchy 这些纯函数随便用，
// 算出坐标和路径再自己画成 SVG。d3-selection、d3-transition 会直接改 DOM、靠浏览器时钟动，不要用。
//
// d3-force 是模拟：默认自己开计时器跑，每个渲染标签页跑得不一样。
// 这里先停掉计时器，手动 tick 到底，把每一帧的位置记下来，画面按帧号取。
// d3-force 的随机抖动用固定种子，同样的输入每个标签页算出来完全一样

export type ForceFrame = { x: number; y: number }[];

// configure 里加力，比如 sim.force("charge", forceManyBody()).force("link", forceLink(links))。
// 返回 frames 帧的节点位置，第 i 帧是 tick 了 i 次以后（第 0 帧是初始位置）。
// ticksPerFrame 调快收敛：d3 默认约 300 次 tick 才稳定，30fps 下每帧 1 次就是 10 秒。
// 节点会被复制，传进来的数组不会被改；连线也在 configure 里现建，forceLink 会把 source/target 换成节点对象
export const precomputeForce = <N extends SimulationNodeDatum>(
  nodes: N[],
  configure: (sim: ReturnType<typeof forceSimulation<N>>) => void,
  frames: number,
  ticksPerFrame = 1,
): ForceFrame[] => {
  const copies = nodes.map((node) => ({ ...node }));
  const sim = forceSimulation(copies).stop();
  configure(sim);
  const snapshot = () =>
    copies.map((node) => ({ x: node.x ?? 0, y: node.y ?? 0 }));
  const result = [snapshot()];
  for (let i = 1; i < frames; i++) {
    sim.tick(ticksPerFrame);
    result.push(snapshot());
  }
  return result;
};
