import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useLayoutEffect } from "react";
import { useVideoConfig } from "remotion";
import { PerspectiveCamera } from "three";

// Three.js 图层：3D 物体、立体场景、镜头运动。在 @remotion/three 的 <ThreeCanvas> 外面包一层，补上几处容易错的
//
//   <ThreeLayer>
//     <FrameCamera position={[x, y, z]} lookAt={[0, 0, 0]} fov={35} />
//     <ambientLight intensity={0.4} />
//     <directionalLight position={[5, 8, 5]} intensity={2} />
//     <mesh rotation={[0, frame * 0.02, 0]}>…</mesh>
//   </ThreeLayer>
//
// 硬规则（remotion-best-practices 的 3D 规则 + 本仓库踩过的）：
// - 一切动画只由 useCurrentFrame() 算，不用 R3F 的 useFrame()、three 的 Clock、动画混合器自己走的时间
// - 用 JSX 属性写的（position、rotation、color）会在 ThreeCanvas 画这一帧之前生效；
//   命令式改的（相机、InstancedMesh 的矩阵、材质参数）必须写在 useLayoutEffect 里。
//   ThreeCanvas 在 useEffect 里调 advance() 画这一帧，你的 useEffect 排在它后面，画出来就是上一帧的状态
// - 相机不要靠 <Canvas camera={…}>：那个只在创建时读一次。每帧用 <FrameCamera> 设
// - 里面的 <Sequence> 要写 layout="none"
// - 随机数用 rand(种子)，不用 Math.random

export const ThreeLayer: React.FC<{
  children: React.ReactNode;
  width?: number;
  height?: number;
  shadows?: boolean;
  style?: React.CSSProperties;
}> = ({ children, width: w, height: h, shadows = false, style }) => {
  const config = useVideoConfig();
  return (
    <ThreeCanvas
      width={w ?? config.width}
      height={h ?? config.height}
      shadows={shadows}
      // preserveDrawingBuffer：截图时画布不会已经被清掉
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      style={{ position: "absolute", left: 0, top: 0, ...style }}
    >
      {children}
    </ThreeCanvas>
  );
};

// 每帧设相机：位置、看向哪、视角。写在 useLayoutEffect 里，赶在 ThreeCanvas 画这一帧之前
export const FrameCamera: React.FC<{
  position: readonly [number, number, number];
  lookAt?: readonly [number, number, number];
  fov?: number;
  roll?: number;
}> = ({ position, lookAt = [0, 0, 0], fov, roll = 0 }) => {
  const camera = useThree((s) => s.camera);
  const [px, py, pz] = position;
  const [lx, ly, lz] = lookAt;
  useLayoutEffect(() => {
    camera.position.set(px, py, pz);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(lx, ly, lz);
    if (fov !== undefined && camera instanceof PerspectiveCamera && camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  }, [camera, px, py, pz, lx, ly, lz, fov, roll]);
  return null;
};

// 绕着一个点转的机位，给 FrameCamera 用：t 是 0..1 转一圈
export const orbit = (t: number, radius: number, height: number, center: readonly [number, number, number] = [0, 0, 0]) =>
  [center[0] + Math.sin(t * Math.PI * 2) * radius, center[1] + height, center[2] + Math.cos(t * Math.PI * 2) * radius] as const;
