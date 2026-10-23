import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, Composition, useCurrentFrame } from "remotion";
import { Color, type InstancedMesh, Object3D } from "three";
import { mixColor } from "../shared/motion/motion";
import { FrameCamera, orbit, ThreeLayer } from "../shared/three";

// 环境自检：Three.js 图层。24×24 根方柱铺成地面，高度和颜色跟着一圈圈波纹起伏（InstancedMesh，命令式改矩阵），
// 中间一个浮着自转的环结（JSX 属性），带阴影，镜头绕场景转半圈并慢慢压低。150 帧 = 5 秒
// 乱序渲染每帧一样：所有东西都由帧号算，命令式的改动都在 useLayoutEffect 里

const FRAMES = 150;
const GRID = 24;
const GAP = 0.5;
const LOW = "#1E3A5F";
const HIGH = "#F2A93B";

const Pillars: React.FC = () => {
  const frame = useCurrentFrame();
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    let i = 0;
    for (let gx = 0; gx < GRID; gx++) {
      for (let gz = 0; gz < GRID; gz++) {
        const x = (gx - (GRID - 1) / 2) * GAP;
        const z = (gz - (GRID - 1) / 2) * GAP;
        const d = Math.hypot(x, z);
        const wave = 0.5 + 0.5 * Math.sin(d * 1.6 - frame * 0.12);
        const h = 0.15 + wave * 1.1 * Math.max(0, 1 - d / 8);
        dummy.position.set(x, h / 2, z);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, color.set(mixColor(LOW, HIGH, wave * Math.max(0, 1 - d / 7))));
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [frame, dummy, color]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, GRID * GRID]} castShadow receiveShadow>
      <boxGeometry args={[GAP * 0.86, 1, GAP * 0.86]} />
      <meshStandardMaterial roughness={0.55} metalness={0.1} />
    </instancedMesh>
  );
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FRAMES;
  const [x, , z] = orbit(0.1 + t * 0.5, 11, 0);
  const y = 6.5 - t * 2.5;
  return (
    <AbsoluteFill style={{ background: "#0B1018" }}>
      <ThreeLayer shadows>
        <FrameCamera position={[x, y, z]} lookAt={[0, 1, 0]} fov={38} />
        <fog attach="fog" args={["#0B1018", 12, 26]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[6, 10, 4]} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
        <pointLight position={[0, 3.2, 0]} intensity={18} color="#7FD4F0" distance={9} />
        <Pillars />
        <mesh position={[0, 3.1 + Math.sin(frame * 0.08) * 0.25, 0]} rotation={[frame * 0.021, frame * 0.033, 0]} castShadow>
          <torusKnotGeometry args={[0.75, 0.24, 180, 24]} />
          <meshStandardMaterial color="#EEF0F3" roughness={0.25} metalness={0.6} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#10161F" roughness={0.9} />
        </mesh>
      </ThreeLayer>
    </AbsoluteFill>
  );
};

export const ThreeCheck: React.FC = () => (
  <Composition id="ThreeCheck" component={Scene} durationInFrames={FRAMES} fps={30} width={1920} height={1080} />
);
