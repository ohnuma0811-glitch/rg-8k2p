// 作ったコースの形を手放す（2026-10-22 のユーザー依頼「タイトル・名前・コース選びが重い」）:
// コースの形は一度作ると使い回すが、全部取っておくとタブレットのメモリが足りなくなる（World Cities だけで形 63MB・絵 15MB）。
// 道の計算（samples など）は軽いので残し、形と、形にのせた乗り物などだけを片づける。次に使うときに作りなおす

// コースの形と一緒に作って、形にのせているもの（main.js）
export const TRACK_CACHES = ['mesh', 'showcaseMesh', 'boarModels', 'busModels', 'cowModels', 'cowLegs', 'dinoModel', 'dinoChomp', 'monkeyModels', 'nutModels', 'snowmanModels', 'trainModels'];

// 形・材質・絵を片づける（同じものは1回だけ）
function disposeObject(root) {
  const seen = new Set();
  const once = (x) => {
    if (!x || seen.has(x)) return;
    seen.add(x);
    x.dispose();
  };
  root.traverse((o) => {
    once(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue;
      for (const v of Object.values(m)) if (v && v.isTexture) once(v);
      once(m);
    }
  });
}

export function releaseTrack(track) {
  for (const key of ['mesh', 'showcaseMesh']) if (track[key]?.traverse) disposeObject(track[key]);
  for (const key of TRACK_CACHES) delete track[key];
}

// built: コースの定義 → 道の計算（main.js の builtTracks）。keep: 手放さないコースの定義
export function tracksToRelease(built, keep) {
  return [...built].filter(([def, t]) => !keep.includes(def) && (t.mesh || t.showcaseMesh)).map(([, t]) => t);
}
