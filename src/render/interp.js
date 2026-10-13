// 描くときに、前の計算と今の計算のあいだをつなぐ（物理は1秒に60回。描く間隔がばらついても車がぶれない）
function lerpAngle(a, b, t) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
}

export function blendPose(prev, cur, alpha) {
  if (alpha <= 0) return { ...prev };
  if (alpha >= 1) return { ...cur };
  return {
    x: prev.x + (cur.x - prev.x) * alpha,
    y: prev.y + (cur.y - prev.y) * alpha,
    z: prev.z + (cur.z - prev.z) * alpha,
    heading: lerpAngle(prev.heading, cur.heading, alpha),
    move: lerpAngle(prev.move, cur.move, alpha),
  };
}

export function poseOf(kart) {
  return { x: kart.x, y: kart.y, z: kart.z, heading: kart.heading, move: kart.move };
}
