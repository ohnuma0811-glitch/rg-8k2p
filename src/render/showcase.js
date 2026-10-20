// コースの外観のカメラ（2026-10-20）: コースの一部（def.showcase の印のまわり）だけを映すコース（Global City のクアラルンプール）
import { pointAt, sOf } from './world/kit.js?v=d553df2';

// 印 at のまわりを、半径 r・高さ h でゆっくり回る（orbitCamera と同じ速さ）
export function showcaseCamera(camera, track, time) {
  const { at, r, h } = track.def.showcase;
  const c = pointAt(track, sOf(track, at));
  const a = time * 0.08;
  camera.fov = 60;
  camera.updateProjectionMatrix();
  camera.position.set(c.x + Math.sin(a) * r, c.y + h, c.z + Math.cos(a) * r);
  camera.lookAt(c.x, c.y + 60, c.z);
}
