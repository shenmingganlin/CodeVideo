import { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import { Color, Euler, type InstancedMesh, Object3D, Quaternion, Vector3 } from "three";
import { ease, mixColor, prog, rand } from "../../shared/motion/motion";
import { FrameCamera, orbit, ThreeLayer } from "../../shared/three";
import { C, Stage, type GalleryEffect } from "../kit";

// 一个立方体由 6×6×6 块小方块拼成，猛地炸开，每块沿自己的方向飞出去、边飞边翻滚，在空中停一下，
// 再沿原路飞回来严丝合缝地拼回去。镜头一直绕着慢慢转一圈。首尾无缝：第 0 帧和第 FRAMES 帧都是拼好的立方体、同一个机位

const FRAMES = 150;
const N = 6;
const SIZE = 0.32;
const COUNT = N * N * N;

const pieces = Array.from({ length: COUNT }, (_, i) => {
  const gx = i % N;
  const gy = Math.floor(i / N) % N;
  const gz = Math.floor(i / (N * N));
  const home = new Vector3(gx - (N - 1) / 2, gy - (N - 1) / 2, gz - (N - 1) / 2).multiplyScalar(SIZE);
  // 往外飞：方向是离中心的方向加一点随机，越外层飞得越远
  const dir = home.clone().normalize().add(new Vector3(rand(i * 3.1) - 0.5, rand(i * 5.7) - 0.5, rand(i * 7.3) - 0.5).multiplyScalar(0.8)).normalize();
  const far = home.clone().add(dir.multiplyScalar(1.6 + home.length() * 2.2 + rand(i * 1.9) * 1.2));
  const spin = new Euler(rand(i * 2.3) * 6 - 3, rand(i * 4.1) * 6 - 3, rand(i * 6.7) * 6 - 3);
  // 外层的块先飞、后回，层次感
  const delay = (1 - home.length() / (SIZE * N * 0.87)) * 8;
  return { home, far, spin, delay, shell: home.length() / (SIZE * N * 0.87) };
});

const Burst: React.FC = () => {
  const frame = useCurrentFrame();
  const ref = useRef<InstancedMesh>(null);
  const tmp = useMemo(() => ({ o: new Object3D(), q: new Quaternion(), e: new Euler(), c: new Color(), p: new Vector3() }), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    pieces.forEach((pc, i) => {
      // 18–62 帧飞出，62–92 停在空中，92–138 飞回，之后拼好的立方体待着
      const out = prog(frame, 18 + pc.delay, 62 + pc.delay * 0.5, ease.out);
      const back = prog(frame, 92 - pc.delay * 0.5, 138 - pc.delay, ease.inOut);
      const k = out * (1 - back);
      tmp.p.copy(pc.home).lerp(pc.far, k);
      tmp.e.set(pc.spin.x * k, pc.spin.y * k, pc.spin.z * k);
      tmp.o.position.copy(tmp.p);
      tmp.o.quaternion.copy(tmp.q.setFromEuler(tmp.e));
      tmp.o.scale.setScalar(SIZE * (0.94 - 0.18 * k));
      tmp.o.updateMatrix();
      mesh.setMatrixAt(i, tmp.o.matrix);
      mesh.setColorAt(i, tmp.c.set(mixColor(C.fg, pc.shell > 0.75 ? C.accent : C.cool, k)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [frame, tmp]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.4} metalness={0.15} />
    </instancedMesh>
  );
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = orbit(frame / FRAMES, 6.2, 2.4);
  return (
    <Stage>
      <ThreeLayer>
        <FrameCamera position={cam} lookAt={[0, 0, 0]} fov={40} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 6, 3]} intensity={2.2} />
        <directionalLight position={[-5, -2, -4]} intensity={0.6} color={C.cool} />
        <Burst />
      </ThreeLayer>
    </Stage>
  );
};

const effect: GalleryEffect = {
  no: 89,
  name: "立方体炸成碎块再拼回",
  group: "形状",
  desc: "一个立方体由两百多块小方块拼成，猛地炸开，每块边飞边翻滚、外层先飞，在空中悬停一拍，再沿原路飞回严丝合缝地拼好；镜头绕着它转一整圈",
  tech: "Three.js（src/shared/three.tsx 的 ThreeLayer + FrameCamera + orbit）：216 块用一个 InstancedMesh，每块的位置、旋转、颜色在 useLayoutEffect 里按帧号算；飞出 ease.out、飞回 ease.inOut，按离中心的距离错开。渲染加 --gl=angle 用显卡",
  frames: FRAMES,
  component: Scene,
};
export default effect;
